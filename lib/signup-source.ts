/**
 * 新規登録の「流入元」（どこから来た人か）を判定する。
 *
 * 判定の優先順:
 *   1. URL の ?utm_source=xxx または ?ref=xxx（投稿に貼るリンクに付ける）
 *   2. 直前のページ（document.referrer）のドメイン。Threads のリンクは
 *      l.threads.net などを経由するので、付け忘れてもある程度わかる
 *
 * ブラウザの localStorage に「最初に来た経路」だけを30日間覚えておき、
 * 登録が終わった時点で一度だけサーバーに送る（components/SignupSourceTracker.tsx）。
 * サーバー側は日ごとの件数を足すだけで、誰がどこから来たかは保存しない。
 */
export const SIGNUP_SOURCE_KEY = "buildbay-signup-source";
export const SIGNUP_SOURCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 登録直後の画面だと知らせるための URL パラメータ（app/auth/callback・confirm が付ける） */
export const WELCOME_PARAM = "welcome";

const REFERRER_MAP: [RegExp, string][] = [
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)facebook\.com$/, "facebook"],
  [/(^|\.)(x|twitter)\.com$|^t\.co$/, "x"],
  [/(^|\.)line\.me$/, "line"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)youtube\.com$/, "youtube"],
  [/(^|\.)dcard\.tw$/, "dcard"],
  [/(^|\.)ptt\.cc$/, "ptt"],
];

/** 英小文字・数字・. _ - の32文字までにそろえる（DB 側でも同じ制限をかけている） */
export function normalizeSource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32);
  return s || null;
}

export function sourceFromUrlAndReferrer(href: string, referrer: string): string | null {
  try {
    const url = new URL(href);
    const fromParam = normalizeSource(url.searchParams.get("utm_source") ?? url.searchParams.get("ref"));
    if (fromParam) return fromParam;
    if (!referrer) return null;
    const ref = new URL(referrer);
    if (ref.host === url.host) return null; // サイト内の移動は流入元ではない
    const host = ref.hostname.replace(/^www\./, "");
    for (const [re, name] of REFERRER_MAP) if (re.test(host)) return name;
    return normalizeSource(host);
  } catch {
    return null;
  }
}

/**
 * ログイン直後の移動先に ?welcome=1 を付ける（登録して間もない人だけ）。
 * 付いていると、SignupSourceTracker が流入元をサーバーに送る。
 */
export function withWelcome(path: string, createdAt: string | undefined | null): string {
  if (!createdAt || Date.now() - new Date(createdAt).getTime() > 24 * 60 * 60 * 1000) return path;
  const [base, hash = ""] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${WELCOME_PARAM}=1${hash ? "#" + hash : ""}`;
}
