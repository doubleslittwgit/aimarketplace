import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 荒らし・スパム対策のための簡易的な連投制限。
 * 外部のレート制限サービスは使わず、対象テーブル自身に対して
 * 「直近◯分間に、この人が何件作ったか」をカウントするだけの単純な仕組み。
 * 件数の少ない個人開発者向けマーケットの規模では、これで十分と判断した。
 */
export async function isRateLimited(
  supabase: SupabaseServerClient,
  table: string,
  authorColumn: string,
  userId: string,
  windowMinutes: number,
  maxCount: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(authorColumn, userId)
    .gte("created_at", since);

  return (count ?? 0) >= maxCount;
}
