"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * ブラウザから直接Supabase Storageへファイルをアップロードする。
 *
 * 【なぜサーバー（Server Action）を経由しないのか】
 * Vercelのサーバー関数には「1リクエストあたり4.5MB」という、プランや設定では
 * 回避できないプラットフォーム側の絶対的な上限がある。以前は
 * next.config.ts の bodySizeLimit を320MBに設定していたが、あれはNext.js側の
 * 設定に過ぎず、Vercel側の制限は上書きできない。そのため21MBのファイルを
 * 出品しようとすると、送信した瞬間に接続を切られ、ブラウザ側では
 * 「ページが読み込めない」というクラッシュのような表示になっていた。
 *
 * ブラウザからSupabaseへ直接送ることで、この制限を完全に回避できる。
 * 保存先パスは「ユーザーID/ツールID/ファイル名」で固定しており、Storage側の
 * RLSが「先頭のフォルダ名 = 自分のユーザーID」であることを検証するため、
 * 他人のフォルダに書き込むことはできない。
 */

/**
 * アップロードされたファイル名をStorageの保存パスとして安全な形に変換する。
 *
 * スマホのカメラやChatGPT等が生成するファイル名には、日本語・絵文字・空白・
 * 括弧などが含まれることがあり、そのままではSupabase Storageのキーとして
 * 無効になる（"Invalid key" エラー）。拡張子は保持しつつ、本体部分は
 * 英数字・アンダースコア・ハイフンだけに絞り込む。
 *
 * サーバー側（app/submit/actions.ts）と同じ規則である必要があるため、
 * ここに実装を一本化して両方から使う。
 */
export function sanitizeFileName(name: string): string {
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

export type UploadProgress = {
  /** 0〜100 */
  percent: number;
};

export type DirectUploadResult =
  | { ok: true; key: string; publicUrl?: string }
  | { ok: false; error: string };

/**
 * Supabase Storageへ直接アップロードする。
 * onProgressを渡すと、アップロードの進捗を随時受け取れる。
 */
export async function uploadToStorage(params: {
  bucket: "tool-files" | "tool-images";
  key: string;
  file: File;
  upsert?: boolean;
  onProgress?: (progress: UploadProgress) => void;
}): Promise<DirectUploadResult> {
  const { bucket, key, file, upsert = true, onProgress } = params;
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "ログインの有効期限が切れています。再度ログインしてください。" };
  }

  // Supabase JSのupload()は進捗を通知してくれないため、進捗バーを出すには
  // XMLHttpRequestで直接Storage APIを叩く必要がある。大きなファイルでは
  // 「今どれくらい進んでいるか」が見えないと不安になるので、あえてこの方式にしている。
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(key)}`;

  return new Promise<DirectUploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upsert ? "PUT" : "POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("x-upsert", String(upsert));
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({ percent: Math.round((event.loaded / event.total) * 100) });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ percent: 100 });
        if (bucket === "tool-images") {
          const { data } = supabase.storage.from(bucket).getPublicUrl(key);
          return resolve({ ok: true, key, publicUrl: data.publicUrl });
        }
        return resolve({ ok: true, key });
      }

      let message = `アップロードに失敗しました (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed?.message) message = parsed.message;
      } catch {
        // レスポンスがJSONでない場合は、そのまま既定のメッセージを使う
      }
      resolve({ ok: false, error: message });
    };

    xhr.onerror = () =>
      resolve({ ok: false, error: "通信エラーによりアップロードに失敗しました。" });
    xhr.onabort = () => resolve({ ok: false, error: "アップロードが中断されました。" });

    xhr.send(file);
  });
}
