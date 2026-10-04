"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSource } from "@/lib/signup-source";

/** 登録から24時間以内のユーザーだけを数える（昔からのユーザーのログインを数えないため） */
const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 新規登録した人の流入元を、日ごとの件数に1足す（1人1回まで）。
 * 誰がどこから来たかは保存せず、件数だけを残す（supabase/signup_source_counts.sql）。
 */
export async function reportSignupSource(rawSource: string | null): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.created_at) return { ok: false };
  if (Date.now() - new Date(user.created_at).getTime() > NEW_USER_WINDOW_MS) return { ok: false };

  const admin = createAdminClient();
  const { error } = await admin.rpc("claim_signup_source", {
    p_user_id: user.id,
    p_source: normalizeSource(rawSource) ?? "direct",
  });
  return { ok: !error };
}
