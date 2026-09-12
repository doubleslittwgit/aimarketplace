import { createBrowserClient } from "@supabase/ssr";

/**
 * ブラウザ側（クライアントコンポーネント）で使うSupabaseクライアント。
 *
 * ここで使う ANON_KEY は「公開しても安全」な鍵。
 * データベース側のRLS（行レベルセキュリティ）が実際のアクセス制御を行う。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
