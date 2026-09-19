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

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("claim_free_tool", { p_tool_id: toolId });

  if (error) {
    return { error: t("claimFailed", { message: error.message }) };
  }

  const { data: tool } = await supabase
    .from("tools")
    .select("slug")
    .eq("id", toolId)
    .maybeSingle();

  revalidatePath(`/apps/${tool?.slug ?? ""}`);
  redirect(`/apps/${tool?.slug ?? ""}?claimed=1`);
}
