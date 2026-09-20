/**
 * アップロード前に、ブラウザ側で画像を自動的にリサイズ・圧縮する。
 *
 * 【なぜクライアント側でやるのか】
 * - サーバー側（Vercelの関数）で画像処理をしようとすると、Node向けの画像
 *   ライブラリが必要になり環境依存の問題が起きやすい。ブラウザのCanvas APIを
 *   使えば、追加の依存なしで完結する。
 * - 圧縮してからアップロードするので、Vercelの関数を通る転送量そのものも
 *   減らせる（アップロードはServer Action経由でサーバーを1回通っているため）。
 * - 一番効果が大きいのはSupabase Storage側（保存容量・配信時の転送量）。
 *
 * 【EXIFの向き情報について】
 * スマホ写真は「向き情報（EXIF Orientation）」を持っていることが多く、
 * 単純に描画すると横倒しになることがある。createImageBitmapの
 * imageOrientation: "from-image" オプションが、主要ブラウザで
 * 自動的に正しい向きに補正してくれるため、追加のライブラリなしで対応できる。
 *
 * 【メモリの使い方について（重要）】
 * 最近のiPhone等は4000万画素を超える写真を撮れる。これをそのまま
 * createImageBitmapでフルサイズのままビットマップ化すると、それだけで
 * 200MB近いメモリを一時的に消費し、モバイルSafariではタブごと
 * クラッシュすることがある（実際に発生した不具合）。
 * そのため、事前に軽量な<img>読み込みで元画像のピクセルサイズだけを把握し、
 * createImageBitmapの resizeWidth/resizeHeight オプションで
 * 「縮小しながらデコードする」ことで、フルサイズを一度もメモリに
 * 展開しないようにしている。
 */
export type CompressImageOptions = {
  /** 長辺の最大ピクセル数。これを超える場合は縮小する */
  maxDimension?: number;
  /** 出力品質（0〜1）。高いほど綺麗だがファイルが大きくなる */
  quality?: number;
};

const OUTPUT_MIME = "image/webp";

/** <img>で読み込むだけで、フルサイズのデコードを避けつつ元画像のピクセルサイズを取得する */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像サイズの取得に失敗しました"));
    };
    img.src = url;
  });
}

export async function compressImage(
  file: File,
  { maxDimension = 1920, quality = 0.82 }: CompressImageOptions = {}
): Promise<File> {
  // 画像でないもの・GIF（アニメーションを壊してしまうため）はそのまま返す
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    const { width: srcWidth, height: srcHeight } = await readImageSize(file);
    const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    // resizeWidth/resizeHeightを渡すことで、ブラウザに縮小しながら
    // デコードさせる（フルサイズのビットマップを経由しない）
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "medium",
    });

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    bitmap = null;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_MIME, quality)
    );
    if (!blob) return file;

    // 圧縮した結果、元より大きくなってしまった場合は元のファイルを使う
    // （既に軽い画像や、小さいアイコン画像などで起こりうる）
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^./]+$/, "") + ".webp";
    return new File([blob], newName, { type: OUTPUT_MIME, lastModified: Date.now() });
  } catch (e) {
    // 圧縮に失敗しても致命的にはせず、元のファイルのままアップロードを続ける
    console.error("[compressImage] 圧縮に失敗、元のファイルを使用します:", e);
    return file;
  } finally {
    bitmap?.close();
  }
}

/** サムネイル・アイコン等、小さく表示するもの向けのプリセット */
export const COMPRESS_PRESET_THUMBNAIL: CompressImageOptions = { maxDimension: 1200, quality: 0.85 };
/** アバターのように、ごく小さい円形で表示するもの向けのプリセット */
export const COMPRESS_PRESET_AVATAR: CompressImageOptions = { maxDimension: 512, quality: 0.85 };
/** 紹介画像・投稿画像のように、大きく表示するもの向けのプリセット */
export const COMPRESS_PRESET_GALLERY: CompressImageOptions = { maxDimension: 1920, quality: 0.82 };
