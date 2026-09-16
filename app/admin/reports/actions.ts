"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  return { ok: Boolean(isAdminData) };
}

export async function updateReportStatus(
  reportId: string,
  status: "reviewed" | "dismissed"
): Promise<{ error: string | null }> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "管理者権限がありません" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("tool_reports")
    .update({ status })
    .eq("id", reportId);

  if (error) return { error: error.message };

  revalidatePath("/admin/reports");
  return { error: null };
}
