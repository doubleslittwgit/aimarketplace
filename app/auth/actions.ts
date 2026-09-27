"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | { error: null };

/**
 * ログイン後の戻り先として安全な相対パスだけを許可する。
 * 検証せずに使うと、悪意あるURL（例: https://evil.example.com）を
 * next に仕込まれてログイン直後に外部サイトへ飛ばされる
 * オープンリダイレクトの脆弱性になる。
 */
function safeNextPath(value: FormDataEntryValue | string | null): string {
  const path = typeof value === "string" ? value : "";
  // 「/\evil.com」のようにバックスラッシュを使うと、ブラウザが「//evil.com」（外部サイト）と
  // 解釈してしまうため、バックスラッシュ・制御文字を含むものは受け付けない
  if (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(path)
  ) {
    return path;
  }
  return "/";
}

/**
 * Googleログイン後に戻ってくる先のサイト（オリジン）。
 * ブラウザから渡された値は使わず、サーバー側の設定から決める
 * （渡された値をそのまま使うと、ログインの結果を外部のサイトへ送らせる細工ができてしまうため）。
 */
async function trustedOrigin(): Promise<string> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.getbuildbay.com").replace(/\/+$/, "");
  const requestOrigin = (await headers()).get("origin");
  const allowed = [site, "http://localhost:3000"];
  return requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : site;
}

export async function login(formData: FormData): Promise<AuthResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: t("emailPasswordRequired") };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // メールアドレスの確認がまだ（確認メールの期限切れ・紛失など）の場合は、確認メールを送り直す。
    // このエラーはパスワードが正しいときだけ返るため、登録の有無を第三者に知られる心配はない。
    if (error.code === "email_not_confirmed" || error.message === "Email not confirmed") {
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
      return { error: resendError ? t("emailNotConfirmedWait") : t("emailNotConfirmedResent") };
    }
    // Supabaseの生のエラーメッセージは英語のため、翻訳済みの文言に置き換える
    const message =
      error.message === "Invalid login credentials"
        ? t("invalidCredentials")
        : error.message;
    return { error: message };
  }

  const next = safeNextPath(formData.get("next"));
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim();

  if (!email || !password) {
    return { error: t("emailPasswordRequired") };
  }
  if (password.length < 8) {
    return { error: t("passwordTooShort") };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || undefined },
    },
  });

  if (error) {
    const message =
      error.message === "User already registered"
        ? t("emailAlreadyRegistered")
        : error.message;
    return { error: message };
  }

  const next = safeNextPath(formData.get("next"));
  revalidatePath("/", "layout");
  redirect(`/login?confirm=1&next=${encodeURIComponent(next)}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithGoogle(_origin: string, next?: string) {
  const supabase = await createClient();
  const safeNext = safeNextPath(next ?? null);
  const origin = await trustedOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // 認証完了後、Googleから戻ってきたユーザーをこのURLで受け取る
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }

  redirect(data.url);
}

/**
 * パスワード再設定のメールを送る。
 * 登録されていないメールアドレスでも「送信しました」と同じ表示にする
 * （登録の有無を第三者に知られないようにするため）。
 */
export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  const t = await getTranslations("errors");
  const email = String(formData.get("email") || "").trim();
  if (!email || !email.includes("@")) return { error: t("emailRequired") };

  const origin =
    (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://www.getbuildbay.com";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  // 送信回数の上限に達した場合だけは伝える（それ以外は、登録の有無が分からないよう成功扱い）
  if (error && /rate limit|too many/i.test(error.message)) {
    return { error: t("rateLimited") };
  }
  if (error) console.error("[requestPasswordReset]", error.message);
  return { error: null };
}

/** 再設定用のリンクからログインした状態で、新しいパスワードを設定する */
export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const t = await getTranslations("errors");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 8) return { error: t("passwordTooShort") };
  if (password !== confirm) return { error: t("passwordMismatch") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("resetLinkExpired") };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/same.*password|different from the old/i.test(error.message)) return { error: t("passwordSameAsOld") };
    if (/weak|pwned|leaked/i.test(error.message)) return { error: t("passwordWeak") };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard?passwordUpdated=1");
}
