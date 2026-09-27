"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { findPaymentRecord, markPaymentRefunded, getRecordAccessSummary } from "@/lib/stripe/payment-records";
import { notify } from "@/lib/notifications/create";
import { purchaseRefundedBuyer, purchaseRefundedSeller } from "@/lib/notifications/content";
import { formatPrice } from "@/lib/mock-data";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  return { ok: Boolean(isAdminData) };
}

export async function updateRefundRequestStatus(
  requestId: string,
  status: "resolved" | "dismissed",
  adminNote: string
): Promise<{ error: string | null }> {
  const tAdmin = await getTranslations("admin");
  const { ok } = await requireAdmin();
  if (!ok) return { error: tAdmin("noAdminPermission") };

  const admin = createAdminClient();
  const { error } = await admin
    .from("refund_requests")
    .update({
      status,
      admin_note: adminNote.trim() || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  revalidatePath("/admin/refund-requests");
  return { error: null };
}

/**
 * 支払いを返金する（管理者専用）。
 *
 * BuildBayの決済は「いったんBuildBayが受け取り、出品者へ送金する」方式（destination charge）。
 * この方式でStripeの画面から普通に返金すると、出品者への送金は戻らず、返金額はBuildBayの残高から出てしまう。
 * そのため必ずここから返金し、次の2つを同時に行う:
 *   - reverse_transfer: 出品者へ送った分を取り戻す
 *   - refund_application_fee: BuildBayの手数料分も購入者へ返す
 * そのうえで、購入記録を「返金済み」にして、購入者のダウンロード・閲覧権限を外す。
 *
 * 対象の指定は「返金・トラブル報告」から（requestId）か、Stripeの支払いID（pi_...）で行う。
 */
export type RefundResult = {
  error: string | null;
  /**
   * 購入者がすでに商品を受け取っている（ダウンロード・利用・閲覧した）場合、返金せずにこれを返す。
   * 画面で内容を見せて、もう一度確認を取ってから acknowledgeAccess: true で呼び直す。
   */
  accessWarning?: { count: number; first: string; last: string };
};

export async function refundPayment(input: {
  requestId?: string;
  paymentIntentId?: string;
  note?: string;
  /** 受け取り済みであることを確認したうえで返金する */
  acknowledgeAccess?: boolean;
}): Promise<RefundResult> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "管理者権限がありません" };

  const admin = createAdminClient();

  // 1. 返金する支払いを特定する
  let paymentIntentId = (input.paymentIntentId ?? "").trim();
  if (input.requestId) {
    const { data: req } = await admin
      .from("refund_requests")
      .select("purchase_id, course_purchase_id")
      .eq("id", input.requestId)
      .maybeSingle();
    if (!req) return { error: "報告が見つかりません" };
    const { data: target } = req.purchase_id
      ? await admin.from("purchases").select("stripe_payment_intent_id").eq("id", req.purchase_id).maybeSingle()
      : await admin
          .from("course_purchases")
          .select("stripe_payment_intent_id")
          .eq("id", req.course_purchase_id)
          .maybeSingle();
    paymentIntentId = target?.stripe_payment_intent_id ?? "";
  }
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
    return { error: "支払いID（pi_ で始まるID）が見つからないか、形式が正しくありません" };
  }

  const record = await findPaymentRecord(admin, paymentIntentId);
  if (!record) return { error: "この支払いIDの購入記録が見つかりません" };
  if (record.status === "refunded") return { error: "この支払いはすでに返金済みです" };
  if (record.amount <= 0) return { error: "無料の取得は返金の対象外です" };

  // デジタル商品は返金しても手元に残る。すでに受け取っている場合は、画面でもう一段確認を取る
  // （ボタンの押し間違いや、確認不足のまま返金してしまうのを防ぐ。サーバー側で必ず止める）
  if (!input.acknowledgeAccess) {
    const summary = await getRecordAccessSummary(admin, record);
    if (summary && summary.count > 0 && summary.first && summary.last) {
      return {
        error: null,
        accessWarning: { count: summary.count, first: summary.first, last: summary.last },
      };
    }
  }

  // 2. Stripeで返金する（同じ支払いへの二重返金は、冪等キーでStripe側でも防ぐ）
  try {
    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { source: "buildbay_admin", kind: record.kind, record_id: record.id },
      },
      { idempotencyKey: `buildbay-refund-${paymentIntentId}` }
    );
  } catch (e) {
    const err = e as { code?: string; message?: string };
    // Stripe側ではすでに返金済み（別の経路で返金された等）の場合は、記録だけ合わせる
    if (err.code !== "charge_already_refunded") {
      return { error: `Stripeでの返金に失敗しました: ${err.message ?? "不明なエラー"}` };
    }
  }

  // 3. 記録を「返金済み」にする（これで購入者の権限が外れる）
  const { error: markError } = await markPaymentRefunded(admin, record);
  if (markError) {
    return { error: `Stripeでの返金は完了しましたが、記録の更新に失敗しました: ${markError}` };
  }

  if (input.requestId) {
    await admin
      .from("refund_requests")
      .update({
        status: "resolved",
        admin_note: (input.note ?? "").trim() || "返金済み",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", input.requestId);
  }

  // 4. 購入者と出品者に知らせる
  const amount = formatPrice(record.amount);
  await Promise.all([
    notify(record.buyerId, "purchase_refunded", (locale) => purchaseRefundedBuyer(record.itemName, amount, locale)),
    notify(record.sellerId, "purchase_refunded", (locale) => purchaseRefundedSeller(record.itemName, amount, locale)),
  ]);

  revalidatePath("/admin/refund-requests");
  revalidatePath("/dashboard");
  return { error: null };
}
