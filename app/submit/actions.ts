"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MAX_TOOL_FILE_SIZE, MAX_THUMBNAIL_FILE_SIZE } from "@/lib/mock-data";
import { reviewToolSubmission } from "@/lib/ai/review-tool";
import { notify, notifyAdmins } from "@/lib/notifications/create";
import {
  toolAutoRejectedRisk,
  adminNewPendingReview,
  adminHighRiskFlagged,
} from "@/lib/notifications/content";

export type CreateToolResult = { error: string } | { error: null };

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/**
 * アップロードされたファイル名をStorageの保存パスとして安全な形に変換する。
 *
 * スマホのカメラやChatGPT等が生成するファイル名には、日本語・絵文字・空白・
 * 括弧などが含まれることがあり、そのままではSupabase Storageのキーとして
 * 無効になる（"Invalid key" エラー）。拡張子は保持しつつ、本体部分は
 * 英数字・アンダースコア・ハイフンだけに絞り込む。
 */
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

const MAX_FILE_SIZE = MAX_TOOL_FILE_SIZE; // 出品フォームに明記している上限と揃える
const MAX_THUMBNAIL_SIZE = MAX_THUMBNAIL_FILE_SIZE; // storage_limits.sqlのtool-images上限と揃える

export async function createTool(formData: FormData): Promise<CreateToolResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "出品するにはログインが必要です" };
  }

  const name = String(formData.get("name") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const runtime = String(formData.get("runtime") || "cloud") as "cloud" | "local";
  const priceRaw = String(formData.get("price") || "0");
  const price = Math.max(0, Math.round(Number(priceRaw)));
  const platformsRaw = String(formData.get("platforms") || "");
  const platforms = platformsRaw ? platformsRaw.split(",").filter(Boolean) : [];
  const minOsVersion = String(formData.get("minOsVersion") || "").trim() || null;
  const demoUrl = String(formData.get("demoUrl") || "").trim() || null;
  const file = formData.get("file");
  const uploadedFile = file instanceof File && file.size > 0 ? file : null;
  const thumbnail = formData.get("thumbnail");
  const uploadedThumbnail = thumbnail instanceof File && thumbnail.size > 0 ? thumbnail : null;

  if (!name || !tagline || !description || !category) {
    return { error: "必須項目が入力されていません" };
  }
  if (Number.isNaN(price)) {
    return { error: "価格の形式が正しくありません" };
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
        error: `受け取り設定の確認に失敗しました: ${receiveCheckError.message}`,
      };
    }
    if (!canReceive) {
      return {
        error:
          "有料ツールを出品するには、先に売上の受け取り設定（Stripe登録）を完了してください。マイページの「売上の受け取り設定」から進められます。無料ツールとして出品する場合はこの設定は不要です。",
      };
    }
  }
  // 「ローカル実行なのにファイルが無い」のチェックは、下書きに既に
  // ファイルが付いている可能性があるため、ここでは行わない。
  // 実際のチェックは、下書きの既存ファイルと合わせた後（fileKey確定後）に行う。
  if (runtime === "cloud" && !demoUrl) {
    return { error: "クラウド型ツールにはデモURLの入力が必要です" };
  }
  if (uploadedFile && uploadedFile.size > MAX_FILE_SIZE) {
    return { error: "ファイルサイズは300MBまでです" };
  }
  if (uploadedThumbnail && uploadedThumbnail.size > MAX_THUMBNAIL_SIZE) {
    return { error: "サムネイル画像は10MBまでです" };
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
      return { error: "下書きが見つかりませんでした" };
    }
    if (existing.status !== "draft") {
      return { error: "この出品は既に審査に出されています" };
    }
    id = existing.id;
    slug = existing.slug;
    existingFileKey = existing.file_key;
    existingFileSizeBytes = existing.file_size_bytes;
    existingThumbnailUrl = existing.thumbnail_url;
  } else {
    id = crypto.randomUUID();
    slug = `${slugify(name)}-${id.slice(0, 6)}`;
  }

  let fileKey: string | null = existingFileKey;
  let fileSizeBytes: number | null = existingFileSizeBytes;
  let thumbnailUrl: string | null = existingThumbnailUrl;
  let thumbKey: string | null = null;

  // ファイルの保管パスは「作者ID/ツールID/ファイル名」に固定する。
  // これは supabase/storage.sql のダウンロード権限ルールが、
  // このパス構造を前提に「誰のファイルか」を判定しているため。
  if (runtime === "local" && uploadedFile) {
    fileKey = `${user.id}/${id}/${sanitizeFileName(uploadedFile.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("tool-files")
      .upload(fileKey, uploadedFile, { upsert: Boolean(draftId) });

    if (uploadError) {
      return { error: `ファイルのアップロードに失敗しました: ${uploadError.message}` };
    }
    fileSizeBytes = uploadedFile.size;
  }

  if (runtime === "local" && !fileKey) {
    // 下書きの時点でファイルを付け忘れ、本文入力時にも付けなかった場合
    return { error: "ローカル実行ツールにはファイルのアップロードが必要です" };
  }

  // サムネイルは tool-images（公開バケット）に保存し、公開URLをそのままDBに持たせる
  if (uploadedThumbnail) {
    thumbKey = `${user.id}/${id}/${sanitizeFileName(uploadedThumbnail.name)}`;

    const { error: thumbUploadError } = await supabase.storage
      .from("tool-images")
      .upload(thumbKey, uploadedThumbnail, { upsert: Boolean(draftId) });

    if (thumbUploadError) {
      if (fileKey && !draftId) await supabase.storage.from("tool-files").remove([fileKey]);
      return { error: `サムネイルのアップロードに失敗しました: ${thumbUploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from("tool-images")
      .getPublicUrl(thumbKey);
    thumbnailUrl = publicUrlData.publicUrl;
  }

  // AIによる静的レビュー（実行はせず、コードを読んで所見を作るだけ）。
  // 最終判断は必ず人間（管理者）が行うが、明確に危険なものだけは
  // ここで自動的に弾く（「危険なものを弾くのは自動、良いものを通すのは手動」という方針）。
  const fileBuffer = uploadedFile
    ? Buffer.from(await uploadedFile.arrayBuffer())
    : null;

  const review = await reviewToolSubmission({
    toolName: name,
    tagline,
    description,
    fileBuffer,
    fileName: uploadedFile?.name ?? null,
  });

  const initialStatus = review.risk === "high" ? "rejected" : "pending_review";

  const { error: upsertError } = await supabase.from("tools").upsert(
    {
      id,
      slug,
      author_id: user.id,
      name,
      tagline,
      description,
      category,
      price,
      runtime,
      platforms,
      min_os_version: minOsVersion,
      file_key: fileKey,
      file_size_bytes: fileSizeBytes,
      thumbnail_url: thumbnailUrl,
      demo_url: demoUrl,
      status: initialStatus,
      ai_review_summary: review.summary,
      ai_review_risk: review.risk,
      rejection_reason: review.risk === "high" ? review.summary : null,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    // アップロード済みのファイルが孤立しないよう、失敗時は片付ける
    // （下書きから継続した場合、そのファイルは元々下書きのものなので消さない）
    if (fileKey && !draftId) {
      await supabase.storage.from("tool-files").remove([fileKey]);
    }
    if (thumbKey && !draftId) {
      await supabase.storage.from("tool-images").remove([thumbKey]);
    }
    return { error: `保存に失敗しました: ${upsertError.message}` };
  }

  // 出品者の表示名（通知の宛先ではなく、管理者向け通知の文面に使う）
  const { data: authorProfile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", user.id)
    .maybeSingle();
  const authorName =
    authorProfile?.display_name || authorProfile?.handle || "名前未設定の出品者";

  if (initialStatus === "rejected") {
    // 危険判定による自動却下: 出品者へ、そして管理者にも念のため知らせる
    await notify(
      user.id,
      "tool_auto_rejected_risk",
      toolAutoRejectedRisk(name, review.summary)
    );
    await notifyAdmins(
      "admin_high_risk_flagged",
      adminHighRiskFlagged(name, authorName, review.summary)
    );
  } else {
    // 通常の審査待ち: 管理者に知らせる
    await notifyAdmins(
      "admin_new_pending_review",
      adminNewPendingReview(name, authorName)
    );
  }

  redirect(
    initialStatus === "rejected"
      ? "/dashboard?rejected=1"
      : `/dashboard?pending=1`
  );
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "下書き保存にはログインが必要です" };
  }

  const name = String(formData.get("name") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const runtime = String(formData.get("runtime") || "cloud") as "cloud" | "local";
  const priceRaw = String(formData.get("price") || "0");
  const price = Math.max(0, Math.round(Number(priceRaw)) || 0);
  const platformsRaw = String(formData.get("platforms") || "");
  const platforms = platformsRaw ? platformsRaw.split(",").filter(Boolean) : [];
  const minOsVersion = String(formData.get("minOsVersion") || "").trim() || null;
  const demoUrl = String(formData.get("demoUrl") || "").trim() || null;
  const file = formData.get("file");
  const uploadedFile = file instanceof File && file.size > 0 ? file : null;
  const thumbnail = formData.get("thumbnail");
  const uploadedThumbnail =
    thumbnail instanceof File && thumbnail.size > 0 ? thumbnail : null;

  if (uploadedFile && uploadedFile.size > MAX_FILE_SIZE) {
    return { error: "ファイルサイズは300MBまでです" };
  }
  if (uploadedThumbnail && uploadedThumbnail.size > MAX_THUMBNAIL_SIZE) {
    return { error: "サムネイル画像は10MBまでです" };
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
      return { error: "下書きが見つかりませんでした" };
    }
    if (existing.status !== "draft") {
      return { error: "この出品は既に下書きではありません（審査中または公開済み）" };
    }
    id = existing.id;
    slug = existing.slug;
    existingFileKey = existing.file_key;
    existingFileSizeBytes = existing.file_size_bytes;
    existingThumbnailUrl = existing.thumbnail_url;
  } else {
    id = crypto.randomUUID();
    slug = `${slugify(name || "draft") || "draft"}-${id.slice(0, 6)}`;
  }

  let fileKey = existingFileKey;
  let fileSizeBytes = existingFileSizeBytes;
  let thumbnailUrl = existingThumbnailUrl;

  if (runtime === "local" && uploadedFile) {
    const newKey = `${user.id}/${id}/${sanitizeFileName(uploadedFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("tool-files")
      .upload(newKey, uploadedFile, { upsert: true });
    if (uploadError) {
      return { error: `ファイルのアップロードに失敗しました: ${uploadError.message}` };
    }
    fileKey = newKey;
    fileSizeBytes = uploadedFile.size;
  }

  if (uploadedThumbnail) {
    const newThumbKey = `${user.id}/${id}/${sanitizeFileName(uploadedThumbnail.name)}`;
    const { error: thumbUploadError } = await supabase.storage
      .from("tool-images")
      .upload(newThumbKey, uploadedThumbnail, { upsert: true });
    if (thumbUploadError) {
      return { error: `サムネイルのアップロードに失敗しました: ${thumbUploadError.message}` };
    }
    const { data: publicUrlData } = supabase.storage
      .from("tool-images")
      .getPublicUrl(newThumbKey);
    thumbnailUrl = publicUrlData.publicUrl;
  }

  const { error: upsertError } = await supabase.from("tools").upsert(
    {
      id,
      slug,
      author_id: user.id,
      name: name || "無題の下書き",
      tagline,
      description,
      category,
      price,
      runtime,
      platforms,
      min_os_version: minOsVersion,
      demo_url: demoUrl,
      file_key: fileKey,
      file_size_bytes: fileSizeBytes,
      thumbnail_url: thumbnailUrl,
      status: "draft",
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    return { error: `下書きの保存に失敗しました: ${upsertError.message}` };
  }

  return { error: null, draftId: id, slug };
}
