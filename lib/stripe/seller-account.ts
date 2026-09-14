import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * StripeのAccountオブジェクトから、DBに保存する形へ変換する。
 *
 * 【注意】destination charge を on_behalf_of なしで行う構成では、
 * 出品者のアカウントは「決済を受け付ける側」ではなく「資金の受取人」になる。
 * そのため charges_enabled は false のままになるのが正常で、
 * 販売可否の判断には使えない（使うと誰も販売できなくなる）。
 * 実際の判断に使うのは transfers_enabled と payouts_enabled。
 */
export function sellerAccountFieldsFromStripe(account: Stripe.Account) {
  return {
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    transfers_enabled: account.capabilities?.transfers === "active",
    requirements_due: account.requirements?.currently_due ?? [],
  };
}

/**
 * Stripeから取得したアカウント情報を seller_accounts に反映する。
 *
 * 【なぜ "use server" のファイルに置かないのか】
 * "use server" を付けたファイルからエクスポートされた関数は、
 * Next.jsによって「外部から直接呼び出せるHTTPエンドポイント」になる。
 * この関数は userId と審査状況を引数に取るため、そこに置くと
 * 第三者が任意のユーザーを「受け取り可能」に書き換えられてしまう。
 *
 * そのため通常のサーバー用モジュールとして置き、
 * 「Stripeから取得した本物のAccountオブジェクト」を持っている
 * 呼び出し元（Webhook・サーバーコンポーネント）からのみ使う。
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
    .update(sellerAccountFieldsFromStripe(account))
    .eq("user_id", userId);

  if (error) {
    console.error("[seller-account] 同期に失敗:", error.message);
  }
}
