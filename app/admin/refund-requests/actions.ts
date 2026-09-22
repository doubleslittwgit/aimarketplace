"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
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

export async function updateRefundRequestStatus(
  requestId: string,
  status: "resolved" | "dismissed",
  adminNote: string
): Promise<{ error: string | null }> {
  const tAdmin = await getTranslations("admin");
  const { ok } = await requireAdmin();
  if (!ok) return { error: tAdmin("noAdminPermission") };

  const admin = createAdminClient();
  const { error } = await admin
    .from("refund_requests")
    .update({
      status,
      admin_note: adminNote.trim() || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  revalidatePath("/admin/refund-requests");
  return { error: null };
}
