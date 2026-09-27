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
  // ログイン後にどこへ戻るか（未指定ならトップページ）。
  // 「/」で始まるサイト内のパスだけを許可する（「@evil.com」などを渡されて
  // 外部サイトへ飛ばされる、オープンリダイレクトを防ぐため）
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // パスワード再設定のリンクが期限切れ・別のブラウザで開かれた等で使えなかった場合
  if (next.startsWith("/reset-password")) {
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
  }
  // 失敗した場合は、エラーを伝えてログイン画面に戻す
  return NextResponse.redirect(`${origin}/login?error=google`);
}
