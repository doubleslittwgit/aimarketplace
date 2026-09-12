"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | { error: null };

export async function login(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabaseの生のエラーメッセージは英語のため、日本語に置き換える
    const message =
      error.message === "Invalid login credentials"
        ? "メールアドレスまたはパスワードが正しくありません"
        : error.message;
    return { error: message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim();

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で設定してください" };
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
        ? "このメールアドレスはすでに登録されています"
        : error.message;
    return { error: message };
  }

  revalidatePath("/", "layout");
  redirect("/login?confirm=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithGoogle(origin: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // 認証完了後、Googleから戻ってきたユーザーをこのURLで受け取る
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }

  redirect(data.url);
}
