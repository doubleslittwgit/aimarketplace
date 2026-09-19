"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export type UpdateProfileResult = { error: string } | { error: null };

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const hasExt = dotIndex > 0 && dotIndex < name.length - 1;
  const ext = hasExt
    ? name.slice(dotIndex + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
    : "png";
  return `avatar-${Date.now()}.${ext || "png"}`;
}

/**
 * 自分自身のプロフィール（表示名・自己紹介・アイコン画像）を更新する。
 * RLS（"users can update own profile"）により、他人のプロフィールは更新できない。
 */
export async function updateProfile(
  handle: string,
  formData: FormData
): Promise<UpdateProfileResult> {
  const t = await getTranslations("errors");
  const tProfile = await getTranslations("profile");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("loginRequired") };
  }

  const displayName = String(formData.get("displayName") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const avatar = formData.get("avatar");
  const uploadedAvatar = avatar instanceof File && avatar.size > 0 ? avatar : null;

  if (!displayName) {
    return { error: tProfile("displayNameRequired") };
  }

  let avatarUrl: string | undefined;

  if (uploadedAvatar) {
    if (uploadedAvatar.size > MAX_AVATAR_SIZE) {
      return { error: tProfile("avatarUploadFailed", { message: "5MBまでです" }) };
    }
    const key = `${user.id}/${sanitizeFileName(uploadedAvatar.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("tool-images")
      .upload(key, uploadedAvatar, { upsert: true });

    if (uploadError) {
      return { error: tProfile("avatarUploadFailed", { message: uploadError.message }) };
    }

    const { data: publicUrlData } = supabase.storage.from("tool-images").getPublicUrl(key);
    avatarUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: bio || null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", user.id);

  if (error) {
    return { error: t("updateFailed", { message: error.message }) };
  }

  revalidatePath(`/u/${handle}`);
  return { error: null };
}
