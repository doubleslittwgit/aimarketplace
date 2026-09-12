import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Googleなどの外部ログインが完了した後、Supabaseがユーザーを
 * このURLに戻してくる。ここで一時的な認証コードを、
 * 実際のログインセッションに交換する。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // ログイン後にどこへ戻るか（未指定ならトップページ）
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 失敗した場合は、エラーを伝えてログイン画面に戻す
  return NextResponse.redirect(`${origin}/login?error=google`);
}
