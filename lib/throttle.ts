import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 回数制限（supabase/action_throttle.sql）。
 *
 * key ごとに「直近 windowMinutes 分間に max 回まで」を許可する。
 * 許可した場合は、その回数を記録して true を返す。上限に達していれば false。
 * 記録に失敗した場合は、サービスを止めないよう許可する（ログだけ残す）。
 */
export async function takeThrottle(key: string, windowMinutes: number, max: number): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await admin
    .from("action_throttle")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", since);
  if (error) {
    console.error("[throttle] 回数の確認に失敗:", error.message);
    return true;
  }
  if ((count ?? 0) >= max) return false;

  await admin.from("action_throttle").insert({ key });
  // 古い記録を、ときどき片付ける（2日より前のものは使わない）
  if (Math.random() < 0.02) {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    await admin.from("action_throttle").delete().lt("created_at", old);
  }
  return true;
}
