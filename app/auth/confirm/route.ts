import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { withWelcome } from "@/lib/signup-source";

/**
 * メール内のリンク（パスワード再設定・登録確認）を受け取る窓口（トークン方式）。
 *
 * /auth/callback（コード方式）は、リンクを「申請したのと同じブラウザ」で開かないと失敗する。
 * メールアプリ内のブラウザで開く人も多いため、Supabaseのメール文面を
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 * の形にしておくと、どのブラウザで開いても使える。
 * メールの文面は supabase/email-templates/ にある（Supabaseの管理画面に貼り付けて使う）。
 *
 * 対応する type:
 *   - email / signup … 新規登録の確認 → next（既定はトップ）へ
 *   - recovery       … パスワード再設定 → /reset-password へ
 *   - email_change   … メールアドレス変更の確認 → next（既定はアカウント設定）へ
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (type === "recovery") return NextResponse.redirect(`${origin}/reset-password`);
      // 登録確認なら ?welcome=1 を付け、流入元を数えてもらう（components/SignupSourceTracker.tsx）
      const dest = type === "signup" || type === "email" ? withWelcome(next, data.user?.created_at) : next;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  // リンクが無効（期限切れ・使用済み）の場合。
  // 登録確認のリンクなら、ログインを試せば確認メールが自動で送り直される（app/auth/actions.ts の login）。
  return NextResponse.redirect(
    type === "recovery" ? `${origin}/forgot-password?error=expired` : `${origin}/login?error=link`
  );
}
