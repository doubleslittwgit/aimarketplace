"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { OPTIONAL_NOTIFICATION_TYPES } from "@/lib/notifications/content";

export type UpdateNotificationPrefsResult = { error: string | null };

/**
 * 通知（メール）のオン/オフ設定を保存する。
 * オフにできるのは OPTIONAL_NOTIFICATION_TYPES に含まれる種類だけ。
 * それ以外のキーが混ざっていても無視する（不正な入力を弾く）。
 */
export async function updateNotificationPrefs(
  disabledTypes: string[]
): Promise<UpdateNotificationPrefsResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("submitLoginRequired") };
  }

  const validDisabled = disabledTypes.filter((type) =>
    (OPTIONAL_NOTIFICATION_TYPES as readonly string[]).includes(type)
  );

  const prefs: Record<string, boolean> = {};
  for (const type of validDisabled) {
    prefs[type] = false;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: prefs })
    .eq("id", user.id);

  if (error) {
    return { error: t("saveFailed", { message: error.message }) };
  }

  revalidatePath("/settings/notifications");
  return { error: null };
}
