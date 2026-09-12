import Stripe from "stripe";

/**
 * サーバー側でのみ使うStripeクライアント。
 *
 * このファイルは絶対にクライアントコンポーネントから import しないこと。
 * STRIPE_SECRET_KEY は、漏洩すると第三者が自由に決済・返金を実行できてしまう。
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY が設定されていません");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia",
  typescript: true,
});

/** プラットフォーム手数料率（supabase/functions.sql の platform_fee_rate() と揃える） */
export const PLATFORM_FEE_RATE = 0.2;
