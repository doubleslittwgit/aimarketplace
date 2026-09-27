import type { Metadata } from "next";

/**
 * ページごとのSNSシェア表示・検索向けの情報（タイトル・説明・画像・正規URL）を作る。
 *
 * ルートのレイアウト（app/layout.tsx）にはサイト共通の値だけを置き、
 * ツール・講座・ユーザーなど個別のページではこれで上書きする。
 */
export function shareMetadata(params: {
  /** ページタイトル（「| BuildBay」はレイアウト側のテンプレートで付く） */
  title: string;
  description: string;
  /** サイト内のパス（/apps/xxx など）。正規URLとシェア時のURLに使う */
  path: string;
  /** シェア時の画像。無ければサイト共通のOGP画像 */
  image?: string | null;
  /** 公開されていないページなど、検索に出したくない場合 */
  noindex?: boolean;
}): Metadata {
  const description = params.description.replace(/\s+/g, " ").trim().slice(0, 160);
  const images = params.image ? [{ url: params.image }] : [{ url: "/OGP.png", width: 1200, height: 630 }];
  return {
    title: params.title,
    description,
    alternates: { canonical: params.path },
    openGraph: {
      type: "website",
      siteName: "BuildBay",
      url: params.path,
      title: params.title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: params.title,
      description,
      images: images.map((i) => i.url),
    },
    ...(params.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
