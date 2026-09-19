"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notifications/create";
import { adminToolReported } from "@/lib/notifications/content";

export type ReportResult = { ok: true } | { ok: false; error: string; needsLogin?: boolean };

const REASON_LABELS: Record<string, string> = {
  malware: "危険なコード・マルウェアの疑い",
  misrepresentation: "説明と実際の内容が大きく異なる",
  copyright: "著作権・知的財産権の侵害",
  spam: "スパム・詐欺的な出品",
  other: "その他",
};

export async function reportTool(
  toolId: string,
  reason: string,
  detail: string
): Promise<ReportResult> {
  const t = await getTranslations("errors");
  if (!toolId) return { ok: false, error: t("targetToolMissing") };
  if (!REASON_LABELS[reason]) return { ok: false, error: t("reportReasonRequired") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: t("reportLoginRequired"), needsLogin: true };
  }

  const { data: tool } = await supabase
    .from("tools")
    .select("name")
    .eq("id", toolId)
    .maybeSingle();

  if (!tool) return { ok: false, error: t("reportToolNotFound") };

  const { error } = await supabase.from("tool_reports").insert({
    tool_id: toolId,
    reporter_id: user.id,
    reason,
    detail: detail.trim() || null,
  });

  if (error) {
    // 既に同じ人が同じツールを通報済み（ユニーク制約違反）
    if (error.code === "23505") {
      return { ok: false, error: t("alreadyReported") };
    }
    return { ok: false, error: t("reportFailed", { message: error.message }) };
  }

  await notifyAdmins(
    "admin_tool_reported",
    adminToolReported(tool.name, REASON_LABELS[reason])
  );

  return { ok: true };
}
