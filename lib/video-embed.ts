/**
 * 紹介動画のURLを解析し、埋め込み用のURLに変換する。
 *
 * 【YouTubeとVimeoだけに限定している理由】
 * 任意のURLをiframeで埋め込めるようにすると、悪意のあるページを
 * 商品ページの中に表示させることができてしまう。動画の配信元を
 * 信頼できる2社に絞り、しかも「動画IDを取り出して、こちらで
 * 埋め込みURLを組み立て直す」ことで、入力されたURLをそのまま
 * iframeに渡すことが一切ないようにしている。
 *
 * 【動画を自前でアップロードさせない理由】
 * 動画をSupabase Storageで配信すると、転送量で費用が大きく膨らむため。
 * 配信は外部サービスに任せる。
 *
 * サーバー（保存時の検証）とクライアント（表示）の両方から使うため、
 * DBアクセスを含まない純粋関数にしている。
 */

export type VideoEmbed = {
  provider: "youtube" | "vimeo";
  /** iframeのsrcにそのまま使えるURL */
  embedUrl: string;
  /** サムネイル一覧に使う画像（Vimeoは外部APIが必要なので無し） */
  thumbnailUrl: string | null;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/i;

export function parseVideoUrl(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\.|^m\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  // --- YouTube ---
  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (host === "youtu.be") {
      id = segments[0] ?? null; // youtu.be/ID
    } else if (segments[0] === "watch") {
      id = url.searchParams.get("v"); // youtube.com/watch?v=ID
    } else if (["shorts", "embed", "live"].includes(segments[0] ?? "")) {
      id = segments[1] ?? null; // youtube.com/shorts/ID など
    }
    if (!id || !YOUTUBE_ID.test(id)) return null;
    return {
      provider: "youtube",
      // Cookieを使わない埋め込みドメインを使い、閲覧者のプライバシーに配慮する
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  // --- Vimeo ---
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    let id: string | null = null;
    let hash: string | null = null;
    if (host === "player.vimeo.com" && segments[0] === "video") {
      id = segments[1] ?? null; // player.vimeo.com/video/ID?h=HASH
      hash = url.searchParams.get("h");
    } else {
      id = segments[0] ?? null; // vimeo.com/ID または vimeo.com/ID/HASH
      hash = segments[1] ?? null;
    }
    if (!id || !VIMEO_ID.test(id)) return null;
    // 限定公開の動画は、URL末尾のハッシュが無いと再生できない
    const safeHash = hash && VIMEO_HASH.test(hash) ? hash : null;
    return {
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${id}${safeHash ? `?h=${safeHash}` : ""}`,
      thumbnailUrl: null,
    };
  }

  return null;
}
