"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/create";
import { newQuestion, questionAnswered } from "@/lib/notifications/content";

export type QAItem = {
  id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  asker: { display_name: string | null; handle: string; avatar_url: string | null };
};

export async function askQuestion(
  toolId: string,
  slug: string,
  question: string
): Promise<{ error: string | null; item?: QAItem }> {
  const t = await getTranslations("errors");
  const tQa = await getTranslations("qa");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  const trimmed = question.trim();
  if (!trimmed) return { error: tQa("questionRequired") };

  const { data: tool } = await supabase
    .from("tools")
    .select("id, name, author_id")
    .eq("id", toolId)
    .maybeSingle();
  if (!tool) return { error: t("toolNotFound") };

  const { data: inserted, error } = await supabase
    .from("tool_questions")
    .insert({ tool_id: toolId, asker_id: user.id, question: trimmed })
    .select("*, profiles:asker_id(display_name, handle, avatar_url)")
    .single();

  if (error || !inserted) {
    return { error: t("postFailed", { message: error?.message ?? "" }) };
  }

  after(async () => {
    if (tool.author_id === user.id) return; // 自分のツールへの自分の質問は通知しない
    const { data: askerProfile } = await supabase
      .from("profiles")
      .select("display_name, handle")
      .eq("id", user.id)
      .maybeSingle();
    const name = askerProfile?.display_name || askerProfile?.handle || "";
    await notify(
      tool.author_id,
      "new_question",
      (locale) => newQuestion(name, tool.name, trimmed.slice(0, 60), slug, locale),
      { email: true }
    );
  });

  revalidatePath(`/apps/${slug}`);
  return {
    error: null,
    item: {
      id: inserted.id,
      question: inserted.question,
      answer: inserted.answer,
      answered_at: inserted.answered_at,
      created_at: inserted.created_at,
      asker: {
        display_name: inserted.profiles?.display_name ?? null,
        handle: inserted.profiles?.handle ?? "",
        avatar_url: inserted.profiles?.avatar_url ?? null,
      },
    },
  };
}

export async function answerQuestion(
  questionId: string,
  slug: string,
  answer: string
): Promise<{ error: string | null }> {
  const t = await getTranslations("errors");
  const tQa = await getTranslations("qa");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  const trimmed = answer.trim();
  if (!trimmed) return { error: tQa("answerRequired") };

  // RLS側でも「そのツールの出品者本人か」を検証しているが、
  // ここでも一度確認しておくことで、権限が無い場合に分かりやすいエラーを返せる
  const { data: existing } = await supabase
    .from("tool_questions")
    .select("*, tools:tool_id(name, author_id)")
    .eq("id", questionId)
    .maybeSingle();
  if (!existing) return { error: t("contentNotFound") };
  if (existing.tools?.author_id !== user.id) return { error: tQa("noAnswerPermission") };

  const { error } = await supabase
    .from("tool_questions")
    .update({ answer: trimmed, answered_at: new Date().toISOString() })
    .eq("id", questionId);

  if (error) return { error: t("updateFailed", { message: error.message }) };

  after(() =>
    notify(
      existing.asker_id,
      "question_answered",
      (locale) => questionAnswered(existing.tools?.name ?? "", slug, locale),
      { email: true }
    )
  );

  revalidatePath(`/apps/${slug}`);
  return { error: null };
}
