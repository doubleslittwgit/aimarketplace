import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 有料で購入した商品を、購入者がいつ受け取ったか（ダウンロード・利用・閲覧）の記録。
 *
 * 目的は2つ:
 *   - 返金の判断材料（「すでにダウンロードしているか」を管理画面で確認する）
 *   - チャージバックの証拠（「商品は届いていた」ことをカード会社に示す）
 * 記録するのは有料の購入についてだけ。IPアドレスとブラウザの種類も、証拠のためだけに保存する。
 * 表（purchase_access_logs）は管理者権限でしか読み書きできないので、必ず管理者クライアントを渡すこと。
 */

export type AccessKind = "download" | "open" | "course_view";

export type AccessSummary = {
  count: number;
  first: string | null;
  last: string | null;
  lastIp: string | null;
};

export function clientInfoFromHeaders(h: Headers): { ip: string | null; userAgent: string | null } {
  const forwarded = h.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : h.get("x-real-ip"))?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 300) || null;
  return { ip: ip ? ip.slice(0, 64) : null, userAgent };
}

export async function logPurchaseAccess(
  admin: SupabaseClient,
  entry: {
    userId: string;
    kind: AccessKind;
    toolId?: string | null;
    courseId?: string | null;
    purchaseId?: string | null;
    coursePurchaseId?: string | null;
    ip: string | null;
    userAgent: string | null;
  }
): Promise<void> {
  const { error } = await admin.from("purchase_access_logs").insert({
    user_id: entry.userId,
    kind: entry.kind,
    tool_id: entry.toolId ?? null,
    course_id: entry.courseId ?? null,
    purchase_id: entry.purchaseId ?? null,
    course_purchase_id: entry.coursePurchaseId ?? null,
    ip: entry.ip,
    user_agent: entry.userAgent,
  });
  if (error) console.error("[access-log] 記録に失敗:", error.message);
}

/** 購入ごとの受け取り記録の要約（件数・最初と最後の日時・最後のIP） */
export async function getAccessSummaries(
  admin: SupabaseClient,
  target: { purchaseIds?: string[]; coursePurchaseIds?: string[] }
): Promise<Map<string, AccessSummary>> {
  const result = new Map<string, AccessSummary>();
  const add = (key: string, created: string, ip: string | null) => {
    const cur = result.get(key) ?? { count: 0, first: null, last: null, lastIp: null };
    cur.count += 1;
    if (!cur.first || created < cur.first) cur.first = created;
    if (!cur.last || created >= cur.last) {
      cur.last = created;
      cur.lastIp = ip;
    }
    result.set(key, cur);
  };

  const purchaseIds = (target.purchaseIds ?? []).filter(Boolean);
  const coursePurchaseIds = (target.coursePurchaseIds ?? []).filter(Boolean);
  const [a, b] = await Promise.all([
    purchaseIds.length
      ? admin.from("purchase_access_logs").select("purchase_id, created_at, ip").in("purchase_id", purchaseIds).limit(5000)
      : Promise.resolve({ data: [] as { purchase_id: string; created_at: string; ip: string | null }[] }),
    coursePurchaseIds.length
      ? admin
          .from("purchase_access_logs")
          .select("course_purchase_id, created_at, ip")
          .in("course_purchase_id", coursePurchaseIds)
          .limit(5000)
      : Promise.resolve({ data: [] as { course_purchase_id: string; created_at: string; ip: string | null }[] }),
  ]);
  for (const r of (a.data ?? []) as { purchase_id: string; created_at: string; ip: string | null }[]) {
    add(r.purchase_id, r.created_at, r.ip);
  }
  for (const r of (b.data ?? []) as { course_purchase_id: string; created_at: string; ip: string | null }[]) {
    add(r.course_purchase_id, r.created_at, r.ip);
  }
  return result;
}

export function formatJst(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

/** 講座の閲覧記録。同じ購入について、指定時間内にすでに記録があれば記録しない */
export async function logCourseViewThrottled(
  admin: SupabaseClient,
  entry: {
    userId: string;
    courseId: string;
    coursePurchaseId: string;
    ip: string | null;
    userAgent: string | null;
  },
  withinHours = 6
): Promise<void> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("purchase_access_logs")
    .select("id", { count: "exact", head: true })
    .eq("course_purchase_id", entry.coursePurchaseId)
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;
  await logPurchaseAccess(admin, { ...entry, kind: "course_view" });
}
