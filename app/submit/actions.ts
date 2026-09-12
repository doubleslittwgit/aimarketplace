"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB（出品フォームに明記している上限と揃える）

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

  if (!name || !tagline || !description || !category) {
    return { error: "必須項目が入力されていません" };
  }
  if (Number.isNaN(price)) {
    return { error: "価格の形式が正しくありません" };
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

  const id = crypto.randomUUID();
  const slug = `${slugify(name)}-${id.slice(0, 6)}`;

  let fileKey: string | null = null;
  let fileSizeBytes: number | null = null;

  // ファイルの保管パスは「作者ID/ツールID/ファイル名」に固定する。
  // これは supabase/storage.sql のダウンロード権限ルールが、
  // このパス構造を前提に「誰のファイルか」を判定しているため。
  if (runtime === "local" && uploadedFile) {
    fileKey = `${user.id}/${id}/${uploadedFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from("tool-files")
      .upload(fileKey, uploadedFile, { upsert: false });

    if (uploadError) {
      return { error: `ファイルのアップロードに失敗しました: ${uploadError.message}` };
    }
    fileSizeBytes = uploadedFile.size;
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
    return { error: `保存に失敗しました: ${insertError.message}` };
  }

  redirect(`/apps/${slug}`);
}
