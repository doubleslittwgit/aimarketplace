import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccessSummaries } from "@/lib/access-log";

/**
 * Stripeの支払い（payment_intent）から、BuildBay側の記録を探す。
 *
 * BuildBayの有料の支払いは3種類あり、それぞれ別の表に記録している:
 *   - ツールの購入 … purchases
 *   - 講座の購入   … course_purchases
 *   - チップ       … tips
 * 返金・チャージバックの処理では、どの種類の支払いでも同じように扱えるよう、ここで共通の形にそろえる。
 * 必ず管理者権限のクライアントで呼ぶこと。
 */

export type PaymentKind = "tool" | "course" | "tip";

export type PaymentRecord = {
  kind: PaymentKind;
  id: string;
  status: string;
  amount: number;
  buyerId: string;
  sellerId: string;
  itemName: string;
  /** 商品ページのパス（/apps/xxx など） */
  path: string | null;
  /** 決済画面で利用規約に同意した日時（記録が無ければ null） */
  termsAcceptedAt: string | null;
};

export async function findPaymentRecord(
  admin: SupabaseClient,
  paymentIntentId: string
): Promise<PaymentRecord | null> {
  const [{ data: purchase }, { data: coursePurchase }, { data: tip }] = await Promise.all([
    admin
      .from("purchases")
      .select("id, status, price_paid, buyer_id, seller_id, terms_accepted_at, tools(name, slug)")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle(),
    admin
      .from("course_purchases")
      .select("id, status, price_paid, buyer_id, seller_id, terms_accepted_at, courses(title, slug)")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle(),
    admin
      .from("tips")
      .select("id, status, amount, tipper_id, seller_id, terms_accepted_at, tools(name, slug)")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle(),
  ]);

  if (purchase) {
    const tool = purchase.tools as unknown as { name: string; slug: string } | null;
    return {
      kind: "tool",
      id: purchase.id,
      status: purchase.status,
      amount: purchase.price_paid,
      buyerId: purchase.buyer_id,
      sellerId: purchase.seller_id,
      itemName: tool?.name ?? "—",
      path: tool ? `/apps/${tool.slug}` : null,
      termsAcceptedAt: purchase.terms_accepted_at ?? null,
    };
  }
  if (coursePurchase) {
    const course = coursePurchase.courses as unknown as { title: string; slug: string } | null;
    return {
      kind: "course",
      id: coursePurchase.id,
      status: coursePurchase.status,
      amount: coursePurchase.price_paid,
      buyerId: coursePurchase.buyer_id,
      sellerId: coursePurchase.seller_id,
      itemName: course?.title ?? "—",
      path: course ? `/academy/courses/${course.slug}` : null,
      termsAcceptedAt: coursePurchase.terms_accepted_at ?? null,
    };
  }
  if (tip) {
    const tool = tip.tools as unknown as { name: string; slug: string } | null;
    return {
      kind: "tip",
      id: tip.id,
      status: tip.status,
      amount: tip.amount,
      buyerId: tip.tipper_id,
      sellerId: tip.seller_id,
      itemName: tool?.name ?? "—",
      path: tool ? `/apps/${tool.slug}` : null,
      termsAcceptedAt: tip.terms_accepted_at ?? null,
    };
  }
  return null;
}

const TABLE: Record<PaymentKind, string> = {
  tool: "purchases",
  course: "course_purchases",
  tip: "tips",
};

/**
 * 記録を「返金済み」にする。
 * ダウンロード・講座の閲覧は「status が completed の購入」だけに許可しているため、
 * これで購入者の権限も外れる（RLS・ダウンロード処理の両方で completed を確認している）。
 */
export async function markPaymentRefunded(
  admin: SupabaseClient,
  record: PaymentRecord
): Promise<{ error: string | null }> {
  const { error } = await admin.from(TABLE[record.kind]).update({ status: "refunded" }).eq("id", record.id);
  return { error: error?.message ?? null };
}

/** 購入者が商品を受け取った記録の要約を、支払いの種類に合わせて取り出す（チップは対象外） */
export async function getRecordAccessSummary(admin: SupabaseClient, record: PaymentRecord) {
  if (record.kind === "tip") return null;
  const map = await getAccessSummaries(
    admin,
    record.kind === "tool" ? { purchaseIds: [record.id] } : { coursePurchaseIds: [record.id] }
  );
  return map.get(record.id) ?? null;
}
