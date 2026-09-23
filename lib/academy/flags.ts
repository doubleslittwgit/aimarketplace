/**
 * 講座の購入機能を使えるか。
 * false にすると、購入ボタンが「準備中」になり、有料講座を審査で公開できなくなる
 * （買えない講座が並ぶのを防ぐ）。決済まわりで問題が起きたときの緊急停止にも使える。
 */
export const COURSE_PURCHASE_ENABLED = true;

/**
 * 講座の販売手数料（BuildBay の取り分）。ツールの20%とは別に、講座は10%。
 * Stripe の決済手数料はこの中から支払われる。
 * 決済開始時と、支払い完了の記録時（Webhook）の両方でこの値を使う。
 */
export const COURSE_PLATFORM_FEE_RATE = 0.1;
