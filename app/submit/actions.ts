"use server";

import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_TOOL_FILE_SIZE } from "@/lib/mock-data";
import { isAllowedToolFile } from "@/lib/tool-file-types";
import { slugify } from "@/lib/slugify";
import { notifyAdmins } from "@/lib/notifications/create";
import { adminNewPendingReview } from "@/lib/notifications/content";

export type CreateToolResult = { error: string } | { error: null };

const MAX_FILE_SIZE = MAX_TOOL_FILE_SIZE; // 出品フォームに明記している上限と揃える
const MAX_GALLERY_IMAGES = 5;

/**
 * ギャラリー画像（既存の維持分 + 新規アップロード分）をまとめて処理し、
 * 最終的にDBへ保存するURLの配列を返す。
 *
 * createTool（新規出品）と saveDraft（下書き保存）の両方から呼ばれる。
 * 上限(5枚)は超過分を静かに切り捨てる方針にしている
 * （下書きの時点で厳密にエラーにすると、保存自体ができず不便なため）。
 */
function processGalleryImages(
  formData: FormData
): { urls: string[]; error?: string } {
  const existingRaw = String(formData.get("existingGalleryUrls") || "");
  const existing = existingRaw ? existingRaw.split(",").filter(Boolean) : [];

  // 新規分もブラウザ側で既にアップロード済みなので、そのURLを受け取るだけ
  const uploadedRaw = String(formData.get("uploadedGalleryUrls") || "");
  const uploaded = uploadedRaw ? uploadedRaw.split(",").filter(Boolean) : [];

  return { urls: [...existing, ...uploaded].slice(0, MAX_GALLERY_IMAGES) };
}

export async function createTool(formData: FormData): Promise<CreateToolResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("submitLoginRequired") };
  }

  // 「その人が出品した時に使っていた言語」でメール通知を送るため、
  // 出品するたびに、今このページで使われているロケールを記録しておく。
  // 失敗しても出品自体は止めない（通知の言語が古いままになるだけ）。
  const currentLocale = await getLocale();
  await supabase.from("profiles").update({ locale: currentLocale }).eq("id", user.id);

  const name = String(formData.get("name") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const categoriesRaw = String(formData.get("categories") || "");
  const categoriesList = categoriesRaw ? categoriesRaw.split(",").filter(Boolean) : [];
  const category = categoriesList[0] ?? "";
  const hostAppsRaw = String(formData.get("hostApps") || "");
  const hostAppsList = hostAppsRaw ? hostAppsRaw.split(",").filter(Boolean) : [];
  const remixAllowed = formData.get("remixAllowed") === "1";
  const refundPolicyRaw = String(formData.get("refundPolicy") || "none");
  const refundPolicy = ["none", "conditional", "full"].includes(refundPolicyRaw)
    ? refundPolicyRaw
    : "none";
  const isWip = formData.get("isWip") === "1";
  const runtime = String(formData.get("runtime") || "cloud") as "cloud" | "local";
  const priceRaw = String(formData.get("price") || "0");
  const price = Math.max(0, Math.round(Number(priceRaw)));
  const platformsRaw = String(formData.get("platforms") || "");
  const platforms = platformsRaw ? platformsRaw.split(",").filter(Boolean) : [];
  const minOsVersion = String(formData.get("minOsVersion") || "").trim() || null;
  const demoUrl = String(formData.get("demoUrl") || "").trim() || null;

  // ファイル本体はブラウザから直接Supabase Storageへアップロード済み。
  // ここで受け取るのは、その保存先パスとサイズだけ（lib/direct-upload.ts 参照）。
  // Vercelのサーバー関数には1リクエスト4.5MBという回避不能な上限があるため、
  // ファイル本体をここに通すと大きいファイルで必ず失敗してしまう。
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
    // 有料ツールは、実際に売上を受け取れる状態の出品者しか出せないようにする。
    // これをしないと「買えるのに出品者が代金を受け取れない」商品が生まれてしまう。
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
        error: t("payoutRequiredForSubmit"),
      };
    }
  }
  // 「ローカル実行なのにファイルが無い」のチェックは、下書きに既に
  // ファイルが付いている可能性があるため、ここでは行わない。
  // 実際のチェックは、下書きの既存ファイルと合わせた後（fileKey確定後）に行う。
  if (runtime === "cloud" && !demoUrl) {
    return { error: t("demoUrlRequiredForCloud") };
  }
  if (uploadedFileSize && uploadedFileSize > MAX_FILE_SIZE) {
    return { error: t("fileSizeLimit300mb") };
  }

  // 下書きから続けて公開する場合は、既存の行をそのまま使う
  // （新しいIDを振ると、下書き保存時にアップロード済みのファイルと
  //  ひも付かなくなってしまうため）。
  const draftId = String(formData.get("draftId") || "").trim() || null;
  let id: string;
  let slug: string;
  let existingFileKey: string | null = null;
  let existingFileSizeBytes: number | null = null;
  let existingThumbnailUrl: string | null = null;

  if (draftId) {
    const { data: existing } = await supabase
      .from("tools")
      .select("id, slug, author_id, status, file_key, file_size_bytes, thumbnail_url")
      .eq("id", draftId)
      .maybeSingle();

    if (!existing || existing.author_id !== user.id) {
      return { error: t("draftNotFound") };
    }
    if (existing.status !== "draft") {
      return { error: t("alreadySubmittedForReview") };
    }
    id = existing.id;
    slug = existing.slug;
    existingFileKey = existing.file_key;
    existingFileSizeBytes = existing.file_size_bytes;
    existingThumbnailUrl = existing.thumbnail_url;
  } else {
    // ブラウザ側が既にこのIDでアップロード先のパスを組み立てているため、
    // ここで別のIDを振り直すと、ファイルの保存先とDB上のIDが食い違ってしまう。
    // （ダウンロード権限のRLSがパス中のツールIDを見て判定しているため、
    //   食い違うと購入者がダウンロードできなくなる）
    const providedId = String(formData.get("newToolId") || "").trim();
    id = /^[0-9a-f-]{36}$/i.test(providedId) ? providedId : crypto.randomUUID();
    slug = `${slugify(name)}-${id.slice(0, 6)}`;
  }

  let fileKey: string | null = existingFileKey;
  let fileSizeBytes: number | null = existingFileSizeBytes;
  let thumbnailUrl: string | null = existingThumbnailUrl;

  // ブラウザ側で既にアップロード済みのものがあれば、それで上書きする。
  // 無ければ（＝今回ファイルを選び直していなければ）下書き時のものを引き継ぐ。
  if (runtime === "local" && uploadedFileKey) {
    // 他人のフォルダのパスを送りつけられないよう、必ず自分のIDで始まることを確認する。
    // （Storage側のRLSでも防がれているが、DBに不正なパスを記録させないための二重の防御）
    if (!uploadedFileKey.startsWith(`${user.id}/`)) {
      return { error: t("fileUploadFailed", { message: "invalid path" }) };
    }
    // ブラウザ側のacceptは回避できてしまうため、サーバー側でも形式を確認する
    if (!isAllowedToolFile(uploadedFileKey)) {
      return { error: t("unsupportedFileType") };
    }
    fileKey = uploadedFileKey;
    fileSizeBytes = uploadedFileSize;
  }

  if (runtime === "local" && !fileKey) {
    // 下書きの時点でファイルを付け忘れ、本文入力時にも付けなかった場合
    return { error: t("localFileRequired") };
  }

  if (uploadedThumbnailUrl) {
    thumbnailUrl = uploadedThumbnailUrl;
  }

  const galleryResult = processGalleryImages(formData);
  if (galleryResult.error) {
    return { error: galleryResult.error };
  }

  // AI審査は一旦停止中（Shuさんの判断）。ブラウザからSupabaseへ直接
  // アップロードする方式に変えたことで、サーバーがファイルの中身を
  // 一度も受け取らなくなったため、従来の「受信したファイルをその場で解析する」
  // 方式が成立しなくなった。審査の仕組み自体（lib/ai/review-tool.ts）は
  // 残してあるので、後日やり方を決めて復活させられる。
  // なお「審査待ち → 管理者が承認」という人による確認の流れは維持している。
  const initialStatus = "pending_review";

  const { error: upsertError } = await supabase.from("tools").upsert(
    {
      id,
      slug,
      author_id: user.id,
      name,
      tagline,
      description,
      category,
      categories: categoriesList,
      host_apps: hostAppsList,
      remix_allowed: remixAllowed,
      refund_policy: refundPolicy,
      is_wip: isWip,
      price,
      runtime,
      platforms,
      min_os_version: minOsVersion,
      file_key: fileKey,
      file_size_bytes: fileSizeBytes,
      thumbnail_url: thumbnailUrl,
      gallery_urls: galleryResult.urls,
      demo_url: demoUrl,
      status: initialStatus,
      ai_review_summary: null,
      ai_review_risk: null,
      rejection_reason: null,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    // ブラウザ側で既にアップロード済みのファイルは、ここでは消さない。
    // 失敗した場合、利用者は同じフォームから再送信できる（その際アップロード済みの
    // ファイルはそのまま再利用される）ため、消してしまうと大きいファイルを
    // もう一度アップロードし直させることになってしまう。
    return { error: t("saveFailed", { message: upsertError.message }) };
  }

  // 出品者の表示名（通知の宛先ではなく、管理者向け通知の文面に使う）
  const { data: authorProfile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", user.id)
    .maybeSingle();
  const authorName =
    authorProfile?.display_name || authorProfile?.handle || t("unnamedSeller");

  // 管理者に審査依頼を知らせる
  await notifyAdmins(
    "admin_new_pending_review",
    adminNewPendingReview(name, authorName)
  );

  redirect("/dashboard?pending=1");
}

/**
 * 出品フォームの内容を「下書き」として保存する（審査には出さない）。
 *
 * 通常出品(createTool)と違い、必須項目のチェックをほとんど行わない
 * （途中まで書いた状態でも保存できるのが下書きの目的のため）。
 * ファイルは指定された場合のみアップロードし、既存の下書きを
 * 再保存する場合は upsert:true で同じ場所に上書きする。
 */
export type SaveDraftResult =
  | { error: string }
  | { error: null; draftId: string; slug: string };

export async function saveDraft(
  formData: FormData,
  draftId?: string
): Promise<SaveDraftResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("draftSaveLoginRequired") };
  }

  const name = String(formData.get("name") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const categoriesRaw = String(formData.get("categories") || "");
  const categoriesList = categoriesRaw ? categoriesRaw.split(",").filter(Boolean) : [];
  const category = categoriesList[0] ?? "";
  const hostAppsRaw = String(formData.get("hostApps") || "");
  const hostAppsList = hostAppsRaw ? hostAppsRaw.split(",").filter(Boolean) : [];
  const remixAllowed = formData.get("remixAllowed") === "1";
  const refundPolicyRaw = String(formData.get("refundPolicy") || "none");
  const refundPolicy = ["none", "conditional", "full"].includes(refundPolicyRaw)
    ? refundPolicyRaw
    : "none";
  const isWip = formData.get("isWip") === "1";
  const runtime = String(formData.get("runtime") || "cloud") as "cloud" | "local";
  const priceRaw = String(formData.get("price") || "0");
  const price = Math.max(0, Math.round(Number(priceRaw)) || 0);
  const platformsRaw = String(formData.get("platforms") || "");
  const platforms = platformsRaw ? platformsRaw.split(",").filter(Boolean) : [];
  const minOsVersion = String(formData.get("minOsVersion") || "").trim() || null;
  const demoUrl = String(formData.get("demoUrl") || "").trim() || null;

  // createToolと同じく、ファイル本体はブラウザから直接アップロード済み。
  // ここで受け取るのは保存先パスとサイズのみ。
  const uploadedFileKey = String(formData.get("uploadedFileKey") || "").trim() || null;
  const uploadedFileSize = Number(formData.get("uploadedFileSize") || 0) || null;
  const uploadedThumbnailUrl = String(formData.get("uploadedThumbnailUrl") || "").trim() || null;

  if (uploadedFileSize && uploadedFileSize > MAX_FILE_SIZE) {
    return { error: t("fileSizeLimit300mb") };
  }

  let id: string;
  let slug: string;
  let existingFileKey: string | null = null;
  let existingFileSizeBytes: number | null = null;
  let existingThumbnailUrl: string | null = null;

  if (draftId) {
    const { data: existing } = await supabase
      .from("tools")
      .select("id, slug, author_id, status, file_key, file_size_bytes, thumbnail_url")
      .eq("id", draftId)
      .maybeSingle();

    if (!existing || existing.author_id !== user.id) {
      return { error: t("draftNotFound") };
    }
    if (existing.status !== "draft") {
      return { error: t("notADraftAnymore") };
    }
    id = existing.id;
    slug = existing.slug;
    existingFileKey = existing.file_key;
    existingFileSizeBytes = existing.file_size_bytes;
    existingThumbnailUrl = existing.thumbnail_url;
  } else {
    const providedId = String(formData.get("newToolId") || "").trim();
    id = /^[0-9a-f-]{36}$/i.test(providedId) ? providedId : crypto.randomUUID();
    slug = `${slugify(name || "draft") || "draft"}-${id.slice(0, 6)}`;
  }

  let fileKey = existingFileKey;
  let fileSizeBytes = existingFileSizeBytes;
  let thumbnailUrl = existingThumbnailUrl;

  if (runtime === "local" && uploadedFileKey) {
    if (!uploadedFileKey.startsWith(`${user.id}/`)) {
      return { error: t("fileUploadFailed", { message: "invalid path" }) };
    }
    // ブラウザ側のacceptは回避できてしまうため、サーバー側でも形式を確認する
    if (!isAllowedToolFile(uploadedFileKey)) {
      return { error: t("unsupportedFileType") };
    }
    fileKey = uploadedFileKey;
    fileSizeBytes = uploadedFileSize;
  }

  if (uploadedThumbnailUrl) {
    thumbnailUrl = uploadedThumbnailUrl;
  }

  const galleryResult = processGalleryImages(formData);
  if (galleryResult.error) {
    return { error: galleryResult.error };
  }

  const { error: upsertError } = await supabase.from("tools").upsert(
    {
      id,
      slug,
      author_id: user.id,
      name: name || t("untitledDraft"),
      tagline,
      description,
      category,
      categories: categoriesList,
      host_apps: hostAppsList,
      remix_allowed: remixAllowed,
      refund_policy: refundPolicy,
      is_wip: isWip,
      price,
      runtime,
      platforms,
      min_os_version: minOsVersion,
      demo_url: demoUrl,
      file_key: fileKey,
      file_size_bytes: fileSizeBytes,
      thumbnail_url: thumbnailUrl,
      gallery_urls: galleryResult.urls,
      status: "draft",
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    return { error: t("saveFailed", { message: upsertError.message }) };
  }

  return { error: null, draftId: id, slug };
}
