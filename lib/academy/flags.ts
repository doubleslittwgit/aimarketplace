/**
 * 講座の購入機能が本番で使える状態か。
 * false の間は、有料講座を審査で公開できない（買えない講座が並ぶのを防ぐ）。
 * 購入機能（Stripe決済・購入者への全文公開）を完成させたら true にする。
 */
export const COURSE_PURCHASE_ENABLED = false;
