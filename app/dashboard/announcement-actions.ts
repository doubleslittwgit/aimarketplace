"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/create";
import { sellerAnnouncement } from "@/lib/notifications/content";

export type AnnouncementResult = { error: string | null };

/** 短時間に連投できないよう、前回の送信からこの時間は空けてもらう */
const COOLDOWN_HOURS = 6;

/**
 * フォロワー全員にお知らせを送る。
 *
 * フォロー機能はあったが、出品者から能動的に何かを届ける手段が無かった。
 * 「新作を出しました」「セールします」を自分で届けられるようにするもの。
 *
 * 一斉配信は迷惑にもなりうるので、連投できないよう間隔を設けている。
 */
export async function sendAnnouncement(message: string): Promise<AnnouncementResult> {
  const t = await getTranslations("errors");
  const tA = await getTranslations("announcement");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: t("submitLoginRequired") };

  const trimmed = message.trim();
  if (!trimmed) return { error: tA("messageRequired") };
  if (trimmed.length > 500) return { error: tA("tooLong") };

  // 連投制限
  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("seller_announcements")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .gte("created_at", cutoff);

  if ((count ?? 0) > 0) {
    return { error: tA("cooldown", { hours: COOLDOWN_HOURS }) };
  }

  const { error } = await supabase.from("seller_announcements").insert({
    author_id: user.id,
    message: trimmed,
  });

  if (error) return { error: t("saveFailed", { message: error.message }) };

  after(async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, handle")
      .eq("id", user.id)
      .maybeSingle();
    const name = profile?.display_name || profile?.handle || "";
    const handle = profile?.handle || "";

    const { data: followers } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.id);

    for (const f of followers ?? []) {
      await notify(f.follower_id, "seller_announcement", (locale) =>
        sellerAnnouncement(name, handle, trimmed, locale)
      );
    }
  });

  revalidatePath("/dashboard");
  return { error: null };
}
