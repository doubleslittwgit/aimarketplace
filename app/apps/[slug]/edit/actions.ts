"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_TOOL_FILE_SIZE, MAX_THUMBNAIL_FILE_SIZE } from "@/lib/mock-data";
import { translateAndSaveTool } from "@/lib/translate-tool";

export type EditActionResult = { error: string } | { error: null };

// app/submit/actions.ts と全く同じ命名規則にする
// （既存ファイルと同じ author_id/tool_id/ファイル名 の構造を崩さないため）
function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const hasExt = dotIndex > 0 && dotIndex < name.length - 1;
  const base = hasExt ? name.slice(0, dotIndex) : name;
  const ext = hasExt ? name.slice(dotIndex + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";

  const safeBase =
    base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/(^_|_$)/g, "")
      .slice(0, 80) || "file";

  return ext ? `${safeBase}.${ext}` : safeBase;
}

const MAX_FILE_SIZE = MAX_TOOL_FILE_SIZE;
const MAX_THUMBNAIL_SIZE = MAX_THUMBNAIL_FILE_SIZE;
const MAX_GALLERY_IMAGES = 5;

/**
 * ギャラリー画像（既存の維持分 + 新規アップロード分）をまとめて処理し、
 * 最終的にDBへ保存するURLの配列を返す。
 * app/submit/actions.ts の同名関数と全く同じロジック
 * （出品時と編集時でファイルの保存先の考え方を揃えるため）。
 */
async function processGalleryImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  userId: string,
  toolId: string
): Promise<{ urls: string[]; error?: string }> {
  const t = await getTranslations("errors");
  const existingRaw = String(formData.get("existingGalleryUrls") || "");
  const existing = existingRaw ? existingRaw.split(",").filter(Boolean) : [];

  const newFiles = formData
    .getAll("galleryImages")
    .filter((f): f is File => f instanceof File && f.size > 0);

  for (const file of newFiles) {
    if (file.size > MAX_THUMBNAIL_SIZE) {
      return { urls: existing, error: t("galleryImageTooLarge", { name: file.name }) };
    }
  }

  const remaining = Math.max(0, MAX_GALLERY_IMAGES - existing.length);
  const uploadedUrls: string[] = [];

  for (const file of newFiles.slice(0, remaining)) {
    const key = `${userId}/${toolId}/gallery-${crypto.randomUUID().slice(0, 8)}-${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("tool-images")
      .upload(key, file, { upsert: true });

    if (uploadError) {
      return { urls: existing, error: t("galleryUploadFailed", { message: uploadError.message }) };
    }

    const { data: publicUrlData } = supabase.storage.from("tool-images").getPublicUrl(key);
    uploadedUrls.push(publicUrlData.publicUrl);
  }

  return { urls: [...existing, ...uploadedUrls].slice(0, MAX_GALLERY_IMAGES) };
}

/** ツール本体を更新する。作者本人以外からの呼び出しはRLSで弾かれる。 */
export async function updateTool(
  toolId: string,
  formData: FormData
): Promise<EditActionResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("editLoginRequired") };
  }

  // 所有権の確認。RLSでも二重に守られているが、ここで確認しておくと
  // 「他人のツールを編集しようとした」という分かりやすいエラーを返せる。
  const { data: existing, error: fetchError } = await supabase
    .from("tools")
    .select("id, slug, author_id, runtime, file_key, thumbnail_url, status")
    .eq("id", toolId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: t("toolNotFound") };
  }
  if (existing.author_id !== user.id) {
    return { error: t("noEditPermission") };
  }

  const name = String(formData.get("name") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const categoriesRaw = String(formData.get("categories") || "");
  const categoriesList = categoriesRaw ? categoriesRaw.split(",").filter(Boolean) : [];
  const category = categoriesList[0] ?? "";
  const priceRaw = String(formData.get("price") || "0");
  const price = Math.max(0, Math.round(Number(priceRaw)));
  const platformsRaw = String(formData.get("platforms") || "");
  const platforms = platformsRaw ? platformsRaw.split(",").filter(Boolean) : [];
  const minOsVersion = String(formData.get("minOsVersion") || "").trim() || null;
  const demoUrl = String(formData.get("demoUrl") || "").trim() || null;
  const file = formData.get("file");
  const uploadedFile = file instanceof File && file.size > 0 ? file : null;
  const thumbnail = formData.get("thumbnail");
  const uploadedThumbnail =
    thumbnail instanceof File && thumbnail.size > 0 ? thumbnail : null;

  if (!name || !tagline || !description || categoriesList.length === 0) {
    return { error: t("requiredFieldsMissing") };
  }
  if (Number.isNaN(price)) {
    return { error: t("invalidPriceFormat") };
  }
  if (price > 0) {
    // 出品時と同じチェック。既に有料公開中でも、その後Stripe側の状態が
    // 変わっている可能性があるため、更新のたびに確認する。
    const { data: canReceive, error: receiveCheckError } = await supabase.rpc(
      "seller_can_receive_payments",
      { p_user_id: user.id }
    );
    if (receiveCheckError) {
      return {
        error: t("payoutCheckFailed", { message: receiveCheckError.message }),
      };
    }
    if (!canReceive) {
      return {
        error: t("payoutRequiredForContinuedPublish"),
      };
    }
  }
  if (existing.runtime === "cloud" && !demoUrl) {
    return { error: t("demoUrlRequiredForCloud") };
  }
  if (uploadedFile && uploadedFile.size > MAX_FILE_SIZE) {
    return { error: t("fileSizeLimit300mb") };
  }
  if (uploadedThumbnail && uploadedThumbnail.size > MAX_THUMBNAIL_SIZE) {
    return { error: t("thumbnailSizeLimit10mb") };
  }

  let fileKey = existing.file_key;
  let thumbnailUrl = existing.thumbnail_url;

  // 新しいファイルが指定された場合だけ差し替える。
  // upsert:true にしているのは、編集は既存の枠に上書きする操作であり、
  // 出品時（常に新規のtool_idなので衝突しない）とは事情が違うため。
  if (existing.runtime === "local" && uploadedFile) {
    const newKey = `${user.id}/${toolId}/${sanitizeFileName(uploadedFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("tool-files")
      .upload(newKey, uploadedFile, { upsert: true });

    if (uploadError) {
      return { error: t("fileUploadFailed", { message: uploadError.message }) };
    }
    fileKey = newKey;
  }

  if (uploadedThumbnail) {
    const newThumbKey = `${user.id}/${toolId}/${sanitizeFileName(uploadedThumbnail.name)}`;
    const { error: thumbUploadError } = await supabase.storage
      .from("tool-images")
      .upload(newThumbKey, uploadedThumbnail, { upsert: true });

    if (thumbUploadError) {
      return {
        error: t("thumbnailUploadFailed", { message: thumbUploadError.message }),
      };
    }
    const { data: publicUrlData } = supabase.storage
      .from("tool-images")
      .getPublicUrl(newThumbKey);
    thumbnailUrl = publicUrlData.publicUrl;
  }

  const galleryResult = await processGalleryImages(supabase, formData, user.id, toolId);
  if (galleryResult.error) {
    return { error: galleryResult.error };
  }

  const { error: updateError } = await supabase
    .from("tools")
    .update({
      name,
      tagline,
      description,
      category,
      categories: categoriesList,
      price,
      platforms,
      min_os_version: minOsVersion,
      demo_url: demoUrl,
      file_key: fileKey,
      file_size_bytes: uploadedFile ? uploadedFile.size : undefined,
      thumbnail_url: thumbnailUrl,
      gallery_urls: galleryResult.urls,
    })
    .eq("id", toolId);

  if (updateError) {
    return { error: t("updateFailed", { message: updateError.message }) };
  }

  // 公開済みのツールを編集した場合、既存の翻訳キャッシュは古い内容のままなので
  // 更新しておく（下書き・審査待ちの間は、まだ誰にも見えていないので不要）。
  if (existing.status === "published") {
    after(() => translateAndSaveTool(toolId, name, tagline, description));
  }

  redirect(`/apps/${existing.slug}`);
}

/** 公開⇔非公開を切り替える（購入者は非公開後もダウンロード可能） */
export async function setToolPublished(
  toolId: string,
  published: boolean
): Promise<EditActionResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("loginRequired") };
  }

  const { error } = await supabase
    .from("tools")
    .update({ status: published ? "published" : "suspended" })
    .eq("id", toolId)
    .eq("author_id", user.id); // 念のため二重に所有権を確認

  if (error) {
    return { error: t("updateFailed", { message: error.message }) };
  }

  return { error: null };
}

/**
 * ツールを完全に削除する。
 *
 * purchases.tool_id は on delete restrict のため、購入履歴が1件でもあると
 * DB側が削除を拒否する（意図的な安全装置）。そのため事前に件数を確認し、
 * 1件でもあれば「非公開にする」を案内して、実際の削除は行わない。
 */
export async function deleteTool(toolId: string): Promise<EditActionResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("loginRequired") };
  }

  const { data: tool } = await supabase
    .from("tools")
    .select("id, author_id, file_key, thumbnail_url")
    .eq("id", toolId)
    .maybeSingle();

  if (!tool || tool.author_id !== user.id) {
    return { error: t("noDeletePermission") };
  }

  const { count, error: countError } = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("tool_id", toolId);

  if (countError) {
    return { error: t("purchaseHistoryCheckFailed", { message: countError.message }) };
  }
  if (count && count > 0) {
    return {
      error: t("cannotDeleteHasPurchases"),
    };
  }

  // 参照しているファイルを片付ける（失敗しても削除処理は続行する）
  if (tool.file_key) {
    await supabase.storage.from("tool-files").remove([tool.file_key]);
  }
  if (tool.thumbnail_url) {
    const marker = "/tool-images/";
    const idx = tool.thumbnail_url.indexOf(marker);
    if (idx !== -1) {
      const path = tool.thumbnail_url.slice(idx + marker.length);
      await supabase.storage.from("tool-images").remove([path]);
    }
  }

  const { error: deleteError } = await supabase
    .from("tools")
    .delete()
    .eq("id", toolId);

  if (deleteError) {
    return { error: t("deleteFailed", { message: deleteError.message }) };
  }

  redirect("/dashboard");
}
