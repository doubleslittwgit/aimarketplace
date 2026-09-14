"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { stripe, PLATFORM_FEE_RATE } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/apps");
  }

  // 価格は必ずDBから取得する（ブラウザからの金額は信用しない）
  const { data: tool, error: toolError } = await supabase
    .from("tools")
    .select("id, slug, name, tagline, price, author_id, status, thumbnail_url")
    .eq("id", toolId)
    .maybeSingle();

  if (toolError || !tool) {
    return { error: "ツールが見つかりませんでした" };
  }
  if (tool.status !== "published") {
    return { error: "このツールは現在購入できません" };
  }
  if (tool.price <= 0) {
    return { error: "無料ツールは購入手続きが不要です" };
  }
  // 自分のツールを自分で買う不正（手数料だけ払って売上を水増しする等）を防ぐ
  if (tool.author_id === user.id) {
    return { error: "自分が出品したツールは購入できません" };
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
      error: `出品者情報の確認に失敗しました: ${sellerAccountError.message}`,
    };
  }
  if (
    !sellerAccount ||
    !sellerAccount.transfers_enabled ||
    !sellerAccount.payouts_enabled
  ) {
    return {
      error:
        "現在このツールは購入できません（出品者の受け取り設定が完了していません）",
    };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const platformFee = Math.round(tool.price * PLATFORM_FEE_RATE);

  let checkoutUrl: string | null = null;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // 購入者のメールを引き継いで、入力の手間を減らす
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "jpy",
            unit_amount: tool.price, // JPYは最小単位が「円」なので、そのままの数値でよい
            product_data: {
              name: tool.name,
              description: tool.tagline,
              ...(tool.thumbnail_url ? { images: [tool.thumbnail_url] } : {}),
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
      },
      // Webhookで「誰が何を買ったか」を特定するための情報。
      // 金額もここに記録し、後でDBの値と突き合わせて検証する。
      metadata: {
        tool_id: tool.id,
        buyer_id: user.id,
        seller_id: tool.author_id,
        price: String(tool.price),
        platform_fee: String(platformFee),
        seller_earnings: String(tool.price - platformFee),
      },
    });

    checkoutUrl = session.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return { error: `決済の準備に失敗しました: ${message}` };
  }

  if (!checkoutUrl) {
    return { error: "決済ページのURLを取得できませんでした" };
  }

  // redirect は try の外で呼ぶ。
  // （Next.jsのredirectは内部的に例外を投げるため、tryの中だとcatchに拾われてしまう）
  redirect(checkoutUrl);
}
