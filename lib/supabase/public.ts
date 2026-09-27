import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * ログイン状態（Cookie）を使わない、公開データ読み取り専用のクライアント。
 *
 * サイトマップのように「誰が見ても同じ内容」のページで使う。
 * Cookieを読むクライアント（lib/supabase/server.ts）を使うと、ページが毎回作り直しになり、
 * キャッシュ（revalidate）が効かなくなるため。
 * 公開鍵で動くので、データベースの制限（公開中のものだけ読める等）はそのまま効く。
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
