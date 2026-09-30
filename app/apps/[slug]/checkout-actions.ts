"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createCheckoutSessionWithConsent } from "@/lib/stripe/checkout-consent";
import { paymentIntentDetails } from "@/lib/stripe/payment-description";
import { PLATFORM_FEE_RATE } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectivePrice } from "@/lib/sale-price";

export type CheckoutResult = { error: string };

/**
 * 購入手続き（Stripe Checkoutセッションの作成）
 *
 * 設計上の重要な原則:
 *   1. 価格は必ずデータベースから取得する。
 *      ブラウザから送られた金額は一切信用しない。
 *      （信用すると「1円に書き換えて送信」する不正が成立してしまう）
 *   2. 購入レコードはここでは作らない。
 *      実際に支払いが完了したという通知（Webhook）を受けて初めて作る。
 *      （ここで作ると「決済画面を開いただけで購入済み」になってしまう）
 */
export async function startCheckout(toolId: string): Promise<CheckoutResult | never> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // ログイン後に、この商品ページへ戻ってこられるようにする
    const { data: target } = await supabase.from("tools").select("slug").eq("id", toolId).maybeSingle();
    redirect(`/login?next=${encodeURIComponent(target ? `/apps/${target.slug}` : "/browse")}`);
  }

  // 価格は必ずDBから取得する（ブラウザからの金額は信用しない）
  const { data: tool, error: toolError } = await supabase
    .from("tools")
    .select("id, slug, name, tagline, price, sale_price, sale_ends_at, author_id, status, thumbnail_url, external_purchase_url")
    .eq("id", toolId)
    .maybeSingle();

  if (toolError || !tool) {
    return { error: t("toolNotFound") };
  }
  if (tool.status !== "published") {
    return { error: t("toolNotPurchasable") };
  }
  if (tool.price <= 0) {
    return { error: t("freeToolNoCheckout") };
  }
  // 外部の販売ページで売っているツールは、BuildBay の決済を作らない（lib/external-sales.ts）。
  // 商品ページでは購入ボタン自体を出していないが、直接呼ばれた場合に備えてここでも止める。
  if (tool.external_purchase_url) {
    return { error: t("externalSaleNoCheckout") };
  }
  // セール中なら、実際に請求する額をセール価格に差し替える
  // （ここでもサーバー側のDB値だけを根拠にする。ブラウザからは一切受け取らない）
  const chargedPrice = getEffectivePrice(tool);
  // 自分のツールを自分で買う不正（手数料だけ払って売上を水増しする等）を防ぐ
  if (tool.author_id === user.id) {
    return { error: t("cannotBuyOwnTool") };
  }

  // すでに購入済み・処理中のものを二重に買わせない
  const { data: existing } = await supabase
    .from("purchases")
    .select("id, status")
    .eq("tool_id", tool.id)
    .eq("buyer_id", user.id)
    .in("status", ["pending", "completed"])
    .maybeSingle();

  if (existing?.status === "completed") {
    redirect(`/apps/${tool.slug}?already=1`);
  }

  // 出品者が実際に売上を受け取れる状態か、購入直前にもう一度確認する。
  // 出品時点ではOKでも、その後Stripe側の審査状態が変わっている可能性があるため。
  //
  // seller_accounts はRLSで本人以外に非公開なので、買い手のセッションでは読めない。
  // ここは「出品者の連結アカウントIDを取得する」という管理的な操作のため、
  // 管理者権限のクライアントを使う（買い手には一切公開しない）。
  const admin = createAdminClient();
  const { data: sellerAccount, error: sellerAccountError } = await admin
    .from("seller_accounts")
    .select("stripe_account_id, transfers_enabled, payouts_enabled")
    .eq("user_id", tool.author_id)
    .maybeSingle();

  if (sellerAccountError) {
    return {
      error: t("sellerInfoCheckFailed", { message: sellerAccountError.message }),
    };
  }
  if (
    !sellerAccount ||
    !sellerAccount.transfers_enabled ||
    !sellerAccount.payouts_enabled
  ) {
    return {
      error: t("sellerPayoutIncomplete"),
    };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const platformFee = Math.round(chargedPrice * PLATFORM_FEE_RATE);

  let checkoutUrl: string | null = null;

  try {
    const session = await createCheckoutSessionWithConsent({
      // 支払い方法はカード（Apple Pay・Google Payを含む）に限定する。
      // コンビニ払いなどの「後から支払う」方式は、特定商取引法の表記（クレジットカード決済）と合わず、
      // 支払いの完了が遅れて届くため購入の記録・権限付与の流れとも合わないため。
      payment_method_types: ["card"],
      mode: "payment",
      // 購入者のメールを引き継いで、入力の手間を減らす
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "jpy",
            unit_amount: chargedPrice, // JPYは最小単位が「円」なので、そのままの数値でよい
            product_data: {
              name: tool.name,
              description: tool.tagline,
              // Stripeの決済画面に出す画像は、https から始まる完全なURLでないと受け付けられない
              // （「Not a valid URL」で決済の準備ごと失敗する）。サイト内の画像（/samples/...）は
              // サイトのURLを付けて完全なURLにし、それ以外の形式なら画像なしで進める。
              ...(toAbsoluteHttpsUrl(tool.thumbnail_url, origin)
                ? { images: [toAbsoluteHttpsUrl(tool.thumbnail_url, origin)!] }
                : {}),
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/apps/${tool.slug}?purchased=1`,
      cancel_url: `${origin}/apps/${tool.slug}?canceled=1`,
      // ここが destination charge の核心部分。
      // on_behalf_of は指定しない（指定すると出品者がMerchant of Recordになり、
      // recipient構成のアカウントでは要求できない権限が必要になってしまう）。
      // 決済自体はプラットフォーム名義で行われ、手数料を差し引いた残りだけが
      // 出品者のアカウントへ自動的に送金される。
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: sellerAccount.stripe_account_id,
        },
        // Stripeの管理画面で何の支払いかわかるようにする
        ...paymentIntentDetails({
          kind: "tool",
          itemName: tool.name,
          itemId: tool.id,
          buyerId: user.id,
          sellerId: tool.author_id,
        }),
      },
      // Webhookで「誰が何を買ったか」を特定するための情報。
      // 金額もここに記録し、後でDBの値と突き合わせて検証する。
      metadata: {
        tool_id: tool.id,
        buyer_id: user.id,
        seller_id: tool.author_id,
        price: String(chargedPrice),
        platform_fee: String(platformFee),
        seller_earnings: String(chargedPrice - platformFee),
      },
    }, "purchase", await getLocale());

    checkoutUrl = session.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : t("unknownError");
    return { error: t("checkoutPreparationFailed", { message }) };
  }

  if (!checkoutUrl) {
    return { error: t("checkoutUrlFailed") };
  }

  // redirect は try の外で呼ぶ。
  // （Next.jsのredirectは内部的に例外を投げるため、tryの中だとcatchに拾われてしまう）
  redirect(checkoutUrl);
}

function toAbsoluteHttpsUrl(url: string | null | undefined, origin: string): string | null {
  if (!url) return null;
  try {
    const absolute = new URL(url, origin.startsWith("https://") ? origin : "https://www.getbuildbay.com");
    return absolute.protocol === "https:" ? absolute.toString() : null;
  } catch {
    return null;
  }
}
