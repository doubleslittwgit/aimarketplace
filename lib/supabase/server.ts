import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * サーバー側（サーバーコンポーネント・API Route）で使うSupabaseクライアント。
 *
 * ログイン状態をCookie経由で確認するため、Next.jsのcookiesと連携する。
 * こちらもANON_KEYを使用（service_roleキーはここでも使わない）。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Componentから呼ばれた場合、Cookieの書き込みはできない。
            // Middlewareでセッションを更新していれば問題ないため、ここは無視してよい。
          }
        },
      },
    }
  );
}
