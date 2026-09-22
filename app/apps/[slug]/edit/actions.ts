"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_TOOL_FILE_SIZE } from "@/lib/mock-data";
import { translateAndSaveTool } from "@/lib/translate-tool";
import { notify, notifyAdmins } from "@/lib/notifications/create";
import {
  toolEditTriggeredReview,
  adminNewPendingReview,
} from "@/lib/notifications/content";

export type EditActionResult = { error: string } | { error: null };

const MAX_FILE_SIZE = MAX_TOOL_FILE_SIZE;

const MAX_GALLERY_IMAGES = 5;

/**
 * ギャラリー画像（既存の維持分 + 新規アップロード分）をまとめて処理し、
 * 最終的にDBへ保存するURLの配列を返す。
 * app/submit/actions.ts の同名関数と全く同じロジック
 * （出品時と編集時でファイルの保存先の考え方を揃えるため）。
 */
function processGalleryImages(
  formData: FormData
): { urls: string[]; error?: string } {
  const existingRaw = String(formData.get("existingGalleryUrls") || "");
  const existing = existingRaw ? existingRaw.split(",").filter(Boolean) : [];

  // 新規分はブラウザ側で既にアップロード済みなので、そのURLを受け取るだけ
  const uploadedRaw = String(formData.get("uploadedGalleryUrls") || "");
  const uploadedUrls = uploadedRaw ? uploadedRaw.split(",").filter(Boolean) : [];

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
    .select("id, slug, author_id, runtime, file_key, thumbnail_url, status, price")
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
  const hostAppsRaw = String(formData.get("hostApps") || "");
  const hostAppsList = hostAppsRaw ? hostAppsRaw.split(",").filter(Boolean) : [];
  const priceRaw = String(formData.get("price") || "0");
  const price = Math.max(0, Math.round(Number(priceRaw)));

  // セール価格（任意）。saleEnabledがオフなら、他の値に関わらずnull（=セール無し）にする。
  const saleEnabled = formData.get("saleEnabled") === "1";
  const salePriceRaw = String(formData.get("salePrice") || "").trim();
  const saleEndsAtRaw = String(formData.get("saleEndsAt") || "").trim();
  let salePrice: number | null = null;
  let saleEndsAt: string | null = null;
  if (saleEnabled && salePriceRaw && saleEndsAtRaw) {
    const parsed = Math.max(0, Math.round(Number(salePriceRaw)));
    if (!Number.isNaN(parsed) && parsed < price) {
      salePrice = parsed;
      saleEndsAt = new Date(saleEndsAtRaw).toISOString();
    }
  }
  const platformsRaw = String(formData.get("platforms") || "");
  const platforms = platformsRaw ? platformsRaw.split(",").filter(Boolean) : [];
  const minOsVersion = String(formData.get("minOsVersion") || "").trim() || null;
  const demoUrl = String(formData.get("demoUrl") || "").trim() || null;
  // ファイル本体はブラウザから直接Supabaseへアップロード済み（出品時と同じ理由）
  const uploadedFileKey = String(formData.get("uploadedFileKey") || "").trim() || null;
  const uploadedFileSize = Number(formData.get("uploadedFileSize") || 0) || null;
  const uploadedThumbnailUrl = String(formData.get("uploadedThumbnailUrl") || "").trim() || null;

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
  if (uploadedFileSize && uploadedFileSize > MAX_FILE_SIZE) {
    return { error: t("fileSizeLimit300mb") };
  }

  let fileKey = existing.file_key;
  let thumbnailUrl = existing.thumbnail_url;

  // 新しいファイルが指定された場合だけ差し替える（ブラウザ側でアップロード済み）
  if (existing.runtime === "local" && uploadedFileKey) {
    if (!uploadedFileKey.startsWith(`${user.id}/`)) {
      return { error: t("fileUploadFailed", { message: "invalid path" }) };
    }
    fileKey = uploadedFileKey;
  }

  if (uploadedThumbnailUrl) {
    thumbnailUrl = uploadedThumbnailUrl;
  }

  const galleryResult = processGalleryImages(formData);
  if (galleryResult.error) {
    return { error: galleryResult.error };
  }

  // 公開中のツールが、詐欺的な差し替え（値上げ・サムネイル差し替え・
  // ファイル差し替え）でこっそり中身を変えられてしまわないよう、これらの変更が
  // あった場合は一時的に「審査待ち」に戻し、管理者の再確認を必須にする。
  // 説明文の修正など、それ以外の変更では今まで通り即座に反映される。
  // （AI審査は現在停止中のため、判断は管理者の目視確認に委ねている）
  const priceIncreased = price > existing.price;
  const needsReReview =
    existing.status === "published" &&
    (priceIncreased || Boolean(uploadedThumbnailUrl) || Boolean(uploadedFileKey));

  const nextStatus: string | undefined = needsReReview ? "pending_review" : undefined;

  if (needsReReview) {
    after(async () => {
      const { data: authorProfile } = await supabase
        .from("profiles")
        .select("display_name, handle")
        .eq("id", user.id)
        .maybeSingle();
      const authorName =
        authorProfile?.display_name || authorProfile?.handle || "出品者";

      await notify(user.id, "tool_edit_triggered_review", (locale) => toolEditTriggeredReview(name, locale));
      await notifyAdmins("admin_new_pending_review", adminNewPendingReview(name, authorName));
    });
  }

  const { error: updateError } = await supabase
    .from("tools")
    .update({
      name,
      tagline,
      description,
      category,
      categories: categoriesList,
      host_apps: hostAppsList,
      price,
      sale_price: salePrice,
      sale_ends_at: saleEndsAt,
      platforms,
      min_os_version: minOsVersion,
      demo_url: demoUrl,
      file_key: fileKey,
      file_size_bytes: uploadedFileSize ?? undefined,
      thumbnail_url: thumbnailUrl,
      gallery_urls: galleryResult.urls,
      ...(nextStatus
        ? {
            status: nextStatus,
            ai_review_summary: null,
            ai_review_risk: null,
            rejection_reason: null,
          }
        : {}),
    })
    .eq("id", toolId);

  if (updateError) {
    return { error: t("updateFailed", { message: updateError.message }) };
  }

  // 公開済みのツールを編集した場合、既存の翻訳キャッシュは古い内容のままなので
  // 更新しておく（下書き・審査待ちの間は、まだ誰にも見えていないので不要）。
  if (existing.status === "published" && !needsReReview) {
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
