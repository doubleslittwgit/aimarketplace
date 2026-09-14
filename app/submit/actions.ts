"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MAX_TOOL_FILE_SIZE, MAX_THUMBNAIL_FILE_SIZE } from "@/lib/mock-data";

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
  if (runtime === "local" && !uploadedFile) {
    return { error: "ローカル実行ツールにはファイルのアップロードが必要です" };
  }
  if (runtime === "cloud" && !demoUrl) {
    return { error: "クラウド型ツールにはデモURLの入力が必要です" };
  }
  if (uploadedFile && uploadedFile.size > MAX_FILE_SIZE) {
    return { error: "ファイルサイズは300MBまでです" };
  }
  if (uploadedThumbnail && uploadedThumbnail.size > MAX_THUMBNAIL_SIZE) {
    return { error: "サムネイル画像は10MBまでです" };
  }

  const id = crypto.randomUUID();
  const slug = `${slugify(name)}-${id.slice(0, 6)}`;

  let fileKey: string | null = null;
  let fileSizeBytes: number | null = null;
  let thumbnailUrl: string | null = null;
  let thumbKey: string | null = null;

  // ファイルの保管パスは「作者ID/ツールID/ファイル名」に固定する。
  // これは supabase/storage.sql のダウンロード権限ルールが、
  // このパス構造を前提に「誰のファイルか」を判定しているため。
  if (runtime === "local" && uploadedFile) {
    fileKey = `${user.id}/${id}/${sanitizeFileName(uploadedFile.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("tool-files")
      .upload(fileKey, uploadedFile, { upsert: false });

    if (uploadError) {
      return { error: `ファイルのアップロードに失敗しました: ${uploadError.message}` };
    }
    fileSizeBytes = uploadedFile.size;
  }

  // サムネイルは tool-images（公開バケット）に保存し、公開URLをそのままDBに持たせる
  if (uploadedThumbnail) {
    thumbKey = `${user.id}/${id}/${sanitizeFileName(uploadedThumbnail.name)}`;

    const { error: thumbUploadError } = await supabase.storage
      .from("tool-images")
      .upload(thumbKey, uploadedThumbnail, { upsert: false });

    if (thumbUploadError) {
      if (fileKey) await supabase.storage.from("tool-files").remove([fileKey]);
      return { error: `サムネイルのアップロードに失敗しました: ${thumbUploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from("tool-images")
      .getPublicUrl(thumbKey);
    thumbnailUrl = publicUrlData.publicUrl;
  }

  const { error: insertError } = await supabase.from("tools").insert({
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
    // MVP段階につき、審査フローが無いためそのまま公開する。
    // 将来ここを 'pending_review' にし、審査後に 'published' へ変える想定。
    status: "published",
  });

  if (insertError) {
    // アップロード済みのファイルが孤立しないよう、失敗時は片付ける
    if (fileKey) {
      await supabase.storage.from("tool-files").remove([fileKey]);
    }
    if (thumbKey) {
      await supabase.storage.from("tool-images").remove([thumbKey]);
    }
    return { error: `保存に失敗しました: ${insertError.message}` };
  }

  redirect(`/apps/${slug}`);
}
