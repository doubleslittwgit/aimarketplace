"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notifications/create";
import { adminRefundRequested } from "@/lib/notifications/content";

export type SubmitRefundRequestResult = { error: string | null };

/**
 * 購入したツールについて、返金・トラブルをアプリ内から報告する。
 * 特商法ページに書いている「購入から14日以内にご連絡ください」の窓口を、
 * メールでの個別連絡だけでなくアプリの中からも用意したもの。
 *
 * 実際の返金処理（Stripe側の返金操作）は、ここでは行わない。
 * あくまで「申告を受け付けて、Shuさんに知らせる」ところまで。
 * 個別の事情確認が必要な性質のものなので、対応は引き続き人が行う。
 */
export async function submitRefundRequest(
  purchaseId: string,
  message: string
): Promise<SubmitRefundRequestResult> {
  const t = await getTranslations("errors");
  const tRefund = await getTranslations("refundRequest");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("submitLoginRequired") };
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return { error: tRefund("messageRequired") };
  }

  // 本当に自分の購入か、完了しているかを確認する
  // （RLSのwith_checkでも守られているが、分かりやすいエラーを返すためここでも見る）
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, tool_id, buyer_id, status, tools(name)")
    .eq("id", purchaseId)
    .maybeSingle();

  if (!purchase || purchase.buyer_id !== user.id || purchase.status !== "completed") {
    return { error: tRefund("purchaseNotFound") };
  }

  const { error } = await supabase.from("refund_requests").insert({
    purchase_id: purchaseId,
    tool_id: purchase.tool_id,
    buyer_id: user.id,
    message: trimmed,
  });

  if (error) {
    // 既に申告済み（unique制約）の場合は、専用のメッセージにする
    if (error.code === "23505") {
      return { error: tRefund("alreadySubmitted") };
    }
    return { error: t("saveFailed", { message: error.message }) };
  }

  const toolName =
    (purchase.tools as { name?: string } | null)?.name ?? tRefund("unknownTool");
  await notifyAdmins("admin_refund_requested", adminRefundRequested(toolName, trimmed));

  return { error: null };
}
