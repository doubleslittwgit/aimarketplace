import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripeから取得したアカウント情報を seller_accounts に反映する。
 *
 * 【なぜ "use server" のファイルに置かないのか】
 * "use server" を付けたファイルからエクスポートされた関数は、
 * Next.jsによって「外部から直接呼び出せるHTTPエンドポイント」になる。
 * この関数は userId と審査状況を引数に取るため、そこに置くと
 * 第三者が任意のユーザーを charges_enabled = true に書き換えられてしまう。
 *
 * そのため通常のサーバー用モジュールとして置き、
 * 「Stripeから取得した本物のAccountオブジェクト」を持っている
 * 呼び出し元（Webhook・サーバーアクション・サーバーコンポーネント）からのみ使う。
 *
 * クライアントコンポーネントから import しないこと。
 */
export async function syncSellerAccount(
  userId: string,
  account: Stripe.Account
) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("seller_accounts")
    .update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements_due: account.requirements?.currently_due ?? [],
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[seller-account] 同期に失敗:", error.message);
  }
}
