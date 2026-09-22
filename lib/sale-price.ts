/**
 * セール価格（出品者が設定する期間限定の値引き）に関する共通ロジック。
 * サーバー・クライアント両方から使うため、DBアクセスを含まない純粋関数にしている。
 */

export type SaleFields = {
  price: number;
  sale_price?: number | null;
  sale_ends_at?: string | null;
};

/** 今この瞬間、セールが有効かどうか */
export function isSaleActive(tool: SaleFields): boolean {
  if (tool.sale_price == null || !tool.sale_ends_at) return false;
  if (tool.sale_price >= tool.price) return false; // 念のため（DB制約はあるが二重に防ぐ）
  return new Date(tool.sale_ends_at).getTime() > Date.now();
}

/** 実際に請求すべき価格（セール中ならセール価格、そうでなければ通常価格） */
export function getEffectivePrice(tool: SaleFields): number {
  return isSaleActive(tool) ? (tool.sale_price as number) : tool.price;
}

/** 割引率（%）。表示用。 */
export function getDiscountPercent(tool: SaleFields): number {
  if (!isSaleActive(tool) || tool.price <= 0) return 0;
  return Math.round((1 - (tool.sale_price as number) / tool.price) * 100);
}
