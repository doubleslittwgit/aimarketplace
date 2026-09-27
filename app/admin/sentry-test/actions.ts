"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * わざとサーバー側でエラーを起こす（管理者のみ）。
 * Server Action で投げたエラーは instrumentation.ts の onRequestError から Sentry に送られる。
 */
export async function triggerServerTestError(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: isAdmin } = await supabase.rpc("is_admin", { p_user_id: user.id });
  if (!isAdmin) return;
  throw new Error("BuildBay Sentry test (server)");
}
