"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export type ClaimResult = { error: string };

/**
 * 無料ツールの取得。
 *
 * 実際の処理は supabase/functions.sql の claim_free_tool() が行う。
 * その関数の中で「価格が0円でなければエラー」という検証をしているため、
 * ここを突破されても有料ツールをタダで取得することはできない。
 */
export async function claimFreeTool(toolId: string): Promise<ClaimResult | never> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tool } = await supabase
    .from("tools")
    .select("slug")
    .eq("id", toolId)
    .maybeSingle();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(tool ? `/apps/${tool.slug}` : "/browse")}`);
  }

  const { error } = await supabase.rpc("claim_free_tool", { p_tool_id: toolId });

  if (error) {
    // データベースからの英語のメッセージは、そのまま見せずに案内文に置き換える
    if (error.message.includes("own tool")) return { error: t("claimOwnTool") };
    if (error.message.includes("not available") || error.message.includes("not free")) {
      return { error: t("claimUnavailable") };
    }
    console.error("[claimFreeTool]", error.message);
    return { error: t("claimFailedGeneric") };
  }

  revalidatePath(`/apps/${tool?.slug ?? ""}`);
  redirect(`/apps/${tool?.slug ?? ""}?claimed=1`);
}
