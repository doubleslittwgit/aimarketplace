/**
 * 講座の購入機能が本番で使える状態か。
 * false の間は、有料講座を審査で公開できない（買えない講座が並ぶのを防ぐ）。
 * 購入機能（Stripe決済・購入者への全文公開）を完成させたら true にする。
 */
export const COURSE_PURCHASE_ENABLED = false;

/**
 * 講座の販売手数料（BuildBay の取り分）。ツールの20%とは別に、講座は10%。
 * Stripe の決済手数料はこの中から支払われる。
 * 決済開始時と、支払い完了の記録時（Webhook）の両方でこの値を使う。
 */
export const COURSE_PLATFORM_FEE_RATE = 0.1;
