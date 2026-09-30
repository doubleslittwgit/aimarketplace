/**
 * 審査の「前回からの変更点」を出すための仕組み。
 *
 * 管理者が承認・差し戻し・非公開にしたとき、その時点のツールの内容を
 * tools.last_reviewed_snapshot に保存しておく（app/admin/review/actions.ts）。
 * 次に審査待ちになったとき、今の内容と比べて、変わった項目だけを審査画面に並べる。
 */

export type ToolSnapshot = {
  name: string | null;
  tagline: string | null;
  description: string | null;
  price: number | null;
  categories: string[] | null;
  host_apps: string[] | null;
  runtime: string | null;
  platforms: string[] | null;
  min_os_version: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  gallery_urls: string[] | null;
  file_key: string | null;
  file_size_bytes: number | null;
  internet_access: string | null;
  ui_languages: string[] | null;
  refund_policy: string | null;
  is_wip: boolean | null;
  remix_allowed: boolean | null;
  access_url: string | null;
};

/** スナップショットを作るために tools から読む列 */
export const SNAPSHOT_TOOL_COLUMNS =
  "name, tagline, description, price, categories, host_apps, runtime, platforms, min_os_version, video_url, thumbnail_url, gallery_urls, file_key, file_size_bytes, internet_access, ui_languages, refund_policy, is_wip, remix_allowed";

type ToolRowForSnapshot = Omit<ToolSnapshot, "access_url">;

export function buildToolSnapshot(row: ToolRowForSnapshot, accessUrl: string | null): ToolSnapshot {
  return {
    name: row.name ?? null,
    tagline: row.tagline ?? null,
    description: row.description ?? null,
    price: row.price ?? null,
    categories: row.categories ?? null,
    host_apps: row.host_apps ?? null,
    runtime: row.runtime ?? null,
    platforms: row.platforms ?? null,
    min_os_version: row.min_os_version ?? null,
    video_url: row.video_url ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    gallery_urls: row.gallery_urls ?? null,
    file_key: row.file_key ?? null,
    file_size_bytes: row.file_size_bytes ?? null,
    internet_access: row.internet_access ?? null,
    ui_languages: row.ui_languages ?? null,
    refund_policy: row.refund_policy ?? null,
    is_wip: row.is_wip ?? null,
    remix_allowed: row.remix_allowed ?? null,
    access_url: accessUrl ?? null,
  };
}

export type SnapshotChange =
  | { field: string; kind: "text"; before: string; after: string }
  | { field: string; kind: "image"; before: string | null; after: string | null }
  | { field: string; kind: "images"; added: string[]; removed: string[] }
  | { field: string; kind: "link"; before: string | null; after: string | null };

const LABELS: Record<keyof ToolSnapshot, string> = {
  name: "ツール名",
  tagline: "キャッチコピー",
  description: "説明文",
  price: "価格",
  categories: "カテゴリ",
  host_apps: "対応アプリ（Creative）",
  runtime: "提供形態",
  platforms: "対応OS",
  min_os_version: "最低OSバージョン",
  video_url: "紹介動画",
  thumbnail_url: "サムネイル",
  gallery_urls: "ギャラリー画像",
  file_key: "ファイル",
  file_size_bytes: "ファイルサイズ",
  internet_access: "インターネット接続",
  ui_languages: "対応言語",
  refund_policy: "返金ポリシー",
  is_wip: "開発中の表示",
  remix_allowed: "リミックスの許可",
  access_url: "ツールのURL",
};

function asText(v: unknown): string {
  if (v == null || v === "") return "（なし）";
  if (Array.isArray(v)) return v.length ? v.join("、") : "（なし）";
  if (typeof v === "boolean") return v ? "あり" : "なし";
  return String(v);
}

function fileName(key: string | null): string | null {
  if (!key) return null;
  return key.split("/").pop() ?? key;
}

/** 前回審査した内容（before）と今の内容（after）を比べ、変わった項目だけを返す */
export function diffSnapshots(before: ToolSnapshot, after: ToolSnapshot): SnapshotChange[] {
  const changes: SnapshotChange[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  for (const key of Object.keys(LABELS) as (keyof ToolSnapshot)[]) {
    if (key === "file_size_bytes") continue; // ファイルの変更と一緒に出す
    const a = before[key];
    const b = after[key];
    if (same(a, b)) continue;
    const field = LABELS[key];

    if (key === "thumbnail_url") {
      changes.push({ field, kind: "image", before: (a as string) ?? null, after: (b as string) ?? null });
    } else if (key === "gallery_urls") {
      const oldList = (a as string[] | null) ?? [];
      const newList = (b as string[] | null) ?? [];
      const added = newList.filter((u) => !oldList.includes(u));
      const removed = oldList.filter((u) => !newList.includes(u));
      if (added.length || removed.length) changes.push({ field, kind: "images", added, removed });
    } else if (key === "file_key") {
      changes.push({
        field,
        kind: "text",
        before: fileName(a as string | null) ?? "（なし）",
        after: `${fileName(b as string | null) ?? "（なし）"}（新しいファイル）`,
      });
    } else if (key === "access_url" || key === "video_url") {
      changes.push({ field, kind: "link", before: (a as string) ?? null, after: (b as string) ?? null });
    } else if (key === "price") {
      changes.push({
        field,
        kind: "text",
        before: a == null ? "（なし）" : `¥${Number(a).toLocaleString()}`,
        after: b == null ? "（なし）" : `¥${Number(b).toLocaleString()}`,
      });
    } else {
      changes.push({ field, kind: "text", before: asText(a), after: asText(b) });
    }
  }
  return changes;
}
