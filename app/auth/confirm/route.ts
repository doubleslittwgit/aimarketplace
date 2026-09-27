import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * メール内のリンク（パスワード再設定・登録確認）を受け取る窓口（トークン方式）。
 *
 * /auth/callback（コード方式）は、リンクを「申請したのと同じブラウザ」で開かないと失敗する。
 * メールアプリ内のブラウザで開く人も多いため、Supabaseのメール文面を
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 * の形にしておくと、どのブラウザで開いても使える。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${type === "recovery" ? "/reset-password" : next}`);
    }
  }

  return NextResponse.redirect(
    type === "recovery" ? `${origin}/forgot-password?error=expired` : `${origin}/login`
  );
}
