/**
 * 価格のルール（ツール）。
 *
 * 有料は100円以上。カード決済（Stripe）には日本円で50円という最低金額があり、
 * それを下回る価格・0円のセールでは購入時に決済エラーになるため、出品・編集の時点で弾く。
 * 同じルールをデータベースの制約（supabase/launch_hardening.sql）でもかけている。
 */
export const MIN_PAID_PRICE = 100;
export const MAX_PRICE = 1_000_000;
