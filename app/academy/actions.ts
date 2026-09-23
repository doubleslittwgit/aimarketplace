"use server";

import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { notifyAdmins } from "@/lib/notifications/create";
import { adminCoursePending } from "@/lib/notifications/content";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";
import { isCourseCategory } from "@/lib/academy/categories";
import {
  validateCourseDoc,
  splitAtPaywall,
  buildToc,
  type JSONNode,
} from "@/lib/course-content";

export type SaveCourseInput = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  category: string | null;
  refundPolicy: string;
  /** 本文（TipTapのJSONを文字列にしたもの） */
  content: string | unknown;
  /** true なら「審査に出す」、false なら「下書き保存」 */
  submit: boolean;
  toolIds: string[];
};

export type SaveCourseResult = { error: string } | { error: null; slug: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hasText(node: JSONNode): boolean {
  if (node.type === "text" && node.text?.trim()) return true;
  if (["image", "videoEmbed", "linkCard"].includes(node.type)) return true;
  return (node.content ?? []).some(hasText);
}

function withoutPaywall(doc: JSONNode): JSONNode {
  return { ...doc, content: (doc.content ?? []).filter((b) => b.type !== "paywall") };
}

/**
 * 講座を保存する（新規作成・更新の両方）。
 *
 * 本文は必ずここで検証してから保存する（ブラウザからの送信内容は改ざんできるため）。
 * 保存先は2か所に分ける:
 *   - courses（誰でも読める）: タイトル・価格・無料部分・目次だけ
 *   - course_bodies（金庫）  : 有料部分を含む全文
 */
export async function saveCourse(input: SaveCourseInput): Promise<SaveCourseResult> {
  // 予期しないエラーで画面全体がエラーページになるのを防ぎ、原因をメッセージとして返す。
  // （実際にiPhoneで「下書き保存」がエラーページになった件の調査のため、詳細をログにも残す）
  try {
    return await saveCourseInner(input);
  } catch (e) {
    console.error("[saveCourse] unexpected error:", e);
    const t = await getTranslations("academyEditor");
    return { error: t("errors.unexpected", { message: e instanceof Error ? e.message : String(e) }) };
  }
}

async function saveCourseInner(input: SaveCourseInput): Promise<SaveCourseResult> {
  const t = await getTranslations("academyEditor");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("errors.loginRequired") };

  if (!UUID.test(input.id)) return { error: t("errors.invalidFormat") };

  const title = String(input.title ?? "").trim().slice(0, 120);
  if (input.submit && !title) return { error: t("errors.titleRequired") };

  const price = Math.round(Number(input.price) || 0);
  if (price < 0 || price > 100000) return { error: t("errors.invalidPrice") };

  // サムネイルは、本人がエディタからアップロードした画像だけを受け付ける
  // 設定値の末尾に「/」が付いていても、正しく比較できるようにする
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const thumbnailUrl = input.thumbnailUrl || null;
  if (
    thumbnailUrl &&
    !thumbnailUrl.startsWith(`${base}/storage/v1/object/public/tool-images/${user.id}/`)
  ) {
    return { error: t("errors.imageNotAllowed") };
  }

  // 本文は文字列（JSON）で受け取り、ここで元に戻す（理由は CourseComposer 側のコメント参照）
  let parsedContent: unknown;
  try {
    parsedContent = typeof input.content === "string" ? JSON.parse(input.content) : input.content;
  } catch {
    return { error: t("errors.invalidFormat") };
  }
  const validated = validateCourseDoc(parsedContent);
  if (!validated.ok) return { error: t(`errors.${validated.reason}`) };
  const doc = validated.doc;

  if (input.submit && !hasText(doc)) return { error: t("errors.contentRequired") };

  // 有料講座を審査に出すには、売上の受け取り設定が済んでいる必要がある
  if (input.submit && price > 0) {
    const { data: canReceive } = await supabase.rpc("seller_can_receive_payments", {
      p_user_id: user.id,
    });
    if (!canReceive) return { error: t("errors.payoutRequired") };
  }

  // 他人の講座IDを指定して上書きしようとしていないか確認する
  const { data: existing } = await supabase
    .from("courses")
    .select("id, author_id, slug, status")
    .eq("id", input.id)
    .maybeSingle();
  if (existing && existing.author_id !== user.id) return { error: t("errors.notFound") };

  // 公開中・非公開中の講座の編集は、再審査の流れを作る段階で対応する
  if (existing && (existing.status === "published" || existing.status === "suspended")) {
    return { error: t("errors.publishedEditNotYet") };
  }

  // 無料で見せる部分を決める
  //   無料講座     : 全文（有料ラインがあっても無視する）
  //   有料＋ライン有: ラインより上
  //   有料＋ライン無: 何も見せない（目次だけ公開される）
  const { free, hasPaywall } = splitAtPaywall(doc);
  const freeContent =
    price === 0
      ? withoutPaywall(doc)
      : hasPaywall
        ? free
        : { type: "doc", content: [] };

  let slugBase = slugify(title || "course");
  if (slugBase === "tool") slugBase = "course";
  const slug = existing?.slug ?? `${slugBase}-${input.id.slice(0, 6)}`;
  const status = input.submit ? "pending_review" : (existing?.status ?? "draft");

  const { error: courseError } = await supabase.from("courses").upsert(
    {
      id: input.id,
      slug,
      author_id: user.id,
      title,
      thumbnail_url: thumbnailUrl,
      price,
      // 決められたカテゴリ以外は保存しない（DB側の制約とも一致させている）
      category: isCourseCategory(input.category) ? input.category : null,
      // 決められた3つ以外は「返金なし」として扱う
      refund_policy: ["none", "conditional", "full"].includes(input.refundPolicy) ? input.refundPolicy : "none",
      status,
      free_content: freeContent,
      toc: buildToc(doc),
      has_paid_part: price > 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (courseError) return { error: t("errors.saveFailed", { message: courseError.message }) };

  const { error: bodyError } = await supabase.from("course_bodies").upsert(
    { course_id: input.id, content: doc, updated_at: new Date().toISOString() },
    { onConflict: "course_id" }
  );
  if (bodyError) return { error: t("errors.saveFailed", { message: bodyError.message }) };

  // 自分のツールとの紐付けを、送られてきた内容で置き換える
  // （他人のツールはデータベース側の制限で紐付けられない）
  const toolIds = Array.from(new Set((input.toolIds ?? []).filter((id) => UUID.test(id)))).slice(0, 10);
  await supabase.from("course_tool_links").delete().eq("course_id", input.id);
  if (toolIds.length > 0) {
    const { error: linkError } = await supabase
      .from("course_tool_links")
      .insert(toolIds.map((tool_id) => ({ course_id: input.id, tool_id })));
    if (linkError) return { error: t("errors.saveFailed", { message: linkError.message }) };
  }

  if (input.submit) {
    after(async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, handle")
        .eq("id", user.id)
        .maybeSingle();
      await notifyAdmins(
        "admin_course_pending",
        adminCoursePending(title, profile?.display_name || profile?.handle || "—")
      );
    });
  }

  return { error: null, slug };
}
