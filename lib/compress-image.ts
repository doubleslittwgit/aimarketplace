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
 * 【実装方式について（重要な経緯）】
 * 当初 createImageBitmap(file, {...}) でBlobから直接デコードする方式を
 * 使っていたが、実機のiPhone（Safari）で「写真を添付して投稿すると
 * ページごとクラッシュする」不具合が発生した。調査の結果、
 * ・SafariにはBlobから createImageBitmap する際にEXIFの向き情報が
 *   正しく適用されないという既知の未解決バグがある
 *   （WebKit Bug 237895）
 * ・iOS Safariには昔からcanvas関連の大きな画像に対するメモリ制限があり、
 *   実装によってクラッシュにつながることがある
 * という2点が分かったため、より実績のある「<img>要素として読み込み、
 * その要素をcanvasに描画する」方式に変更した。この方式は、WebKit側で
 * EXIFの向きが正しく反映されることが確認できており（<img>表示時点で
 * 補正されるため）、何年も前から使われている実績のある手法でもある。
 * 【出力形式について（Safari向けの補足）】
 * SafariはWebPの「表示」には対応しているが、canvas経由のWebP「書き出し」
 * には対応していない。非対応のまま指定すると、仕様上ブラウザが黙って
 * PNG（無圧縮）にフォールバックしてしまい、画質指定が効かず圧縮効果も
 * 得られない。そのため、書き出し前に「このブラウザはWebPを書き出せるか」
 * を一度だけ判定し、対応していればWebP（透過も保持）、非対応であれば
 * 画質指定が効くJPEGを使う（JPEGは透過を扱えないため、その場合のみ
 * 先に白背景を敷いてから描画する）。ファイル名・MIMEタイプも
 * 実際に書き出した形式に合わせて決定する。
 */
export type CompressImageOptions = {
  /** 長辺の最大ピクセル数。これを超える場合は縮小する */
  maxDimension?: number;
  /** 出力品質（0〜1）。高いほど綺麗だがファイルが大きくなる */
  quality?: number;
};

const PREFERRED_MIME = "image/webp";
const FALLBACK_MIME = "image/jpeg";
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
};

/** ObjectURL経由で<img>要素として読み込む（Safariでも向き情報が正しく反映される） */
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = url;
  });
}

// このブラウザがcanvas経由でWebPを書き出せるかどうかは、端末・セッション中は
// 変わらないので、1度判定した結果をキャッシュして使い回す。
let webpEncodeSupport: Promise<boolean> | null = null;
function supportsWebpEncode(): Promise<boolean> {
  if (!webpEncodeSupport) {
    webpEncodeSupport = new Promise((resolve) => {
      const testCanvas = document.createElement("canvas");
      testCanvas.width = 1;
      testCanvas.height = 1;
      testCanvas.toBlob((blob) => resolve(blob?.type === PREFERRED_MIME), PREFERRED_MIME);
    });
  }
  return webpEncodeSupport;
}

export async function compressImage(
  file: File,
  { maxDimension = 1920, quality = 0.82 }: CompressImageOptions = {}
): Promise<File> {
  // 画像でないもの・GIF（アニメーションを壊してしまうため）はそのまま返す
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  let objectUrl: string | null = null;
  try {
    // Safari等、canvas経由のWebP書き出しに対応していないブラウザでは
    // JPEGを使う。JPEGは透過を扱えないため、その場合だけ先に白背景を
    // 敷いておく（透過PNGのロゴ等が黒背景になってしまうのを防ぐため）。
    // WebP書き出しに対応しているブラウザでは、透過はそのまま保持される。
    const canUseWebp = await supportsWebpEncode();
    const outputMime = canUseWebp ? PREFERRED_MIME : FALLBACK_MIME;

    objectUrl = URL.createObjectURL(file);
    const img = await loadImageElement(objectUrl);

    const srcWidth = img.naturalWidth;
    const srcHeight = img.naturalHeight;
    const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    if (!canUseWebp) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputMime, quality)
    );

    // デコード済みの画像データを、ガベージコレクションの実行タイミング任せに
    // せず、ここで明示的に手放す。特に高解像度の写真を連続して処理する場合、
    // 解放が遅れるとその分だけピークメモリが積み上がってしまうため。
    img.src = "";
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) return file;

    // 圧縮した結果、元より大きくなってしまった場合は元のファイルを使う
    // （既に軽い画像や、小さいアイコン画像などで起こりうる）
    if (blob.size >= file.size) return file;

    const ext = EXTENSION_BY_MIME[blob.type] ?? ".jpg";
    const newName = file.name.replace(/\.[^./]+$/, "") + ext;
    return new File([blob], newName, { type: blob.type, lastModified: Date.now() });
  } catch (e) {
    // 圧縮に失敗しても致命的にはせず、元のファイルのままアップロードを続ける
    console.error("[compressImage] 圧縮に失敗、元のファイルを使用します:", e);
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 複数の画像を「同時にではなく1枚ずつ」圧縮する。
 * Promise.allで並列に処理すると、大きな写真を複数同時に扱うことになり
 * モバイル端末のメモリを圧迫しやすいため、あえて直列に処理している。
 * さらに、1枚ごとに短い間隔を空けることで、ブラウザ側がガベージ
 * コレクションを実行する猶予を作り、高解像度の写真が連続しても
 * ピークメモリが積み上がりにくくしている。
 */
export async function compressImagesSequentially(
  files: File[],
  options?: CompressImageOptions
): Promise<File[]> {
  const results: File[] = [];
  for (const file of files) {
    results.push(await compressImage(file, options));
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return results;
}

/** サムネイル・アイコン等、小さく表示するもの向けのプリセット */
export const COMPRESS_PRESET_THUMBNAIL: CompressImageOptions = { maxDimension: 1200, quality: 0.85 };
/** アバターのように、ごく小さい円形で表示するもの向けのプリセット */
export const COMPRESS_PRESET_AVATAR: CompressImageOptions = { maxDimension: 512, quality: 0.85 };
/** 紹介画像・投稿画像のように、大きく表示するもの向けのプリセット */
export const COMPRESS_PRESET_GALLERY: CompressImageOptions = { maxDimension: 1920, quality: 0.82 };
