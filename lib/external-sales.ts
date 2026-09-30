/**
 * 外部の販売ページでの販売（海外の出品者向け）。
 *
 * BuildBay の決済（日本の Stripe）は、日本国外の出品者へ売上を送金できない。
 * そのため海外の出品者は、Gumroad などの販売ページで販売し、BuildBay の商品ページには
 * 「外部で購入」のボタンだけを出す。BuildBay はこの取引のお金を一切扱わない
 * （Stripe の決済・送金・返金・Webhook はどれも動かない）。
 *
 * 安全のため:
 *   - 受け付けるのは、下の一覧にある販売サービスの https のURLだけ（なりすましページへの誘導を防ぐ）
 *   - 購入者に見せるのは、管理者が審査で承認したURLだけ（tools.approved_external_url）
 *   - 公開中にURLを変えると、データベース側で審査待ちに戻る（supabase/external_sales.sql）
 *   - BuildBay の決済で受け取れる出品者（日本で Stripe 登録済み）は使えない（手数料の回避を防ぐ）
 *   - 主に日本国内の人が使う販売サービス（BOOTH など）は、手数料の回避につながるため入れない
 *
 * この一覧を変えるときは、データベース側の制約（supabase/external_sales.sql の
 * tools_external_purchase_url_check）のドメイン一覧も同じように変えること。
 */

/** 受け付ける販売サービス（ドメインとその配下のサブドメイン）と、ボタンに出す名前 */
export const EXTERNAL_SALE_PLATFORMS: { domain: string; name: string }[] = [
  { domain: "gumroad.com", name: "Gumroad" },
  { domain: "lemonsqueezy.com", name: "Lemon Squeezy" },
  { domain: "polar.sh", name: "Polar" },
  { domain: "payhip.com", name: "Payhip" },
  { domain: "ko-fi.com", name: "Ko-fi" },
  { domain: "itch.io", name: "itch.io" },
  { domain: "buymeacoffee.com", name: "Buy Me a Coffee" },
  { domain: "portaly.cc", name: "Portaly" },
];

const MAX_URL_LENGTH = 500;

function matchPlatform(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return EXTERNAL_SALE_PLATFORMS.find((p) => host === p.domain || host.endsWith(`.${p.domain}`)) ?? null;
}

/**
 * 出品者が入力した販売ページのURLを確認し、保存してよい形に整えて返す。
 * 受け付けられない場合は null。
 */
export function normalizeExternalPurchaseUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || value.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  // user:pass@ 付きのURLは、表示と実際の行き先が食い違って見えるため受け付けない
  if (url.username || url.password) return null;
  if (url.port) return null;
  if (!matchPlatform(url.hostname)) return null;
  const normalized = url.toString();
  return normalized.length <= MAX_URL_LENGTH ? normalized : null;
}

/** ボタンに出す販売サービスの名前（一覧に無ければ null） */
export function externalPlatformName(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return matchPlatform(new URL(url).hostname)?.name ?? null;
  } catch {
    return null;
  }
}

/** 出品フォームのヒントに出す、使える販売サービスの名前の一覧 */
export const EXTERNAL_SALE_PLATFORM_NAMES = EXTERNAL_SALE_PLATFORMS.map((p) => p.name).join(" / ");
