"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

const MIN_PAYOUT_BALANCE_JPY = 1000;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" as const };

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  if (!isAdminData) return { error: "管理者権限がありません" as const };

  return { error: null };
}

/**
 * 【一度だけ実行する想定の一時的な処理】
 *
 * 「新規アカウント作成時に最低出金額(1,000円)を設定する」機能を追加する前に
 * 登録済みだった出品者アカウントに、同じ設定を後から一括で反映する。
 * 冪等（何度実行しても安全）なので、押し間違えても問題ない。
 */
export async function backfillMinimumPayoutBalances(): Promise<
  { error: string } | { error: null; results: { accountId: string; ok: boolean; message?: string }[] }
> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { data: accounts, error } = await admin
    .from("seller_accounts")
    .select("stripe_account_id");

  if (error) return { error: `一覧の取得に失敗しました: ${error.message}` };

  const results = await Promise.all(
    (accounts ?? []).map(async ({ stripe_account_id }) => {
      try {
        await stripe.balanceSettings.update(
          { payments: { payouts: { minimum_balance_by_currency: { jpy: MIN_PAYOUT_BALANCE_JPY } } } },
          { stripeAccount: stripe_account_id }
        );
        return { accountId: stripe_account_id, ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : "不明なエラー";
        return { accountId: stripe_account_id, ok: false, message };
      }
    })
  );

  return { error: null, results };
}
