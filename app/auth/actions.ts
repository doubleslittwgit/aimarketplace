"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  if (path.startsWith("/") && !path.startsWith("//")) return path;
  return "/";
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

export async function signInWithGoogle(origin: string, next?: string) {
  const supabase = await createClient();
  const safeNext = safeNextPath(next ?? null);

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
