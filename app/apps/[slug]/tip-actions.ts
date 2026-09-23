"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { stripe, PLATFORM_FEE_RATE } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TipResult = { error: string };

/** チップとして選べる金額。任意入力にすると不正な値が入りうるので、選択式にしている */
export const TIP_AMOUNTS = [300, 500, 1000, 3000] as const;

/**
 * 出品者へのチップ（投げ銭）。
 *
 * 無料ツールを出した人には一円も入らず、感謝を伝える手段も無かったため。
 *
 * 購入処理（checkout-actions.ts）と同じ原則で作っている:
 *   1. 金額はブラウザからの数値をそのまま使わず、必ず許可リストと突き合わせる
 *   2. チップの記録はここでは作らない。支払い完了のWebhookを受けて初めて作る
 */
export async function startTip(
  toolId: string,
  amount: number
): Promise<TipResult | never> {
  const t = await getTranslations("errors");
  const tTip = await getTranslations("tip");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/apps");
  }

  // 金額は許可リストにあるものだけを受け付ける。
  // （ブラウザから任意の数値を送れる状態にすると、1円チップや
  //   極端な高額での誤操作を招くため）
  if (!TIP_AMOUNTS.includes(amount as (typeof TIP_AMOUNTS)[number])) {
    return { error: tTip("invalidAmount") };
  }

  const { data: tool } = await supabase
    .from("tools")
    .select("id, slug, name, author_id, status")
    .eq("id", toolId)
    .maybeSingle();

  if (!tool) return { error: t("toolNotFound") };
  if (tool.status !== "published") return { error: t("toolNotPurchasable") };
  // 自分自身にチップは送れない
  if (tool.author_id === user.id) return { error: tTip("cannotTipSelf") };

  // 出品者が受け取れる状態かを確認する。
  // seller_accounts はRLSで本人以外に非公開なので、管理者権限で読む。
  const admin = createAdminClient();
  const { data: sellerAccount } = await admin
    .from("seller_accounts")
    .select("stripe_account_id, transfers_enabled, payouts_enabled")
    .eq("user_id", tool.author_id)
    .maybeSingle();

  if (
    !sellerAccount ||
    !sellerAccount.transfers_enabled ||
    !sellerAccount.payouts_enabled
  ) {
    return { error: tTip("sellerCannotReceive") };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const platformFee = Math.round(amount * PLATFORM_FEE_RATE);

  let checkoutUrl: string | null = null;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "jpy",
            unit_amount: amount,
            product_data: {
              name: tTip("productName", { toolName: tool.name }),
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/apps/${tool.slug}?tipped=1`,
      cancel_url: `${origin}/apps/${tool.slug}`,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: sellerAccount.stripe_account_id,
        },
      },
      // 購入と区別できるよう kind を持たせる。
      // Webhook側はこれを見て、購入かチップかを判断する。
      metadata: {
        kind: "tip",
        tool_id: tool.id,
        tipper_id: user.id,
        seller_id: tool.author_id,
        amount: String(amount),
        platform_fee: String(platformFee),
        seller_earnings: String(amount - platformFee),
      },
    });

    checkoutUrl = session.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : t("unknownError");
    return { error: t("checkoutPreparationFailed", { message }) };
  }

  if (!checkoutUrl) return { error: t("checkoutUrlFailed") };

  redirect(checkoutUrl);
}
