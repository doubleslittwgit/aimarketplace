"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { stripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRetrySupabase } from "@/lib/retry";

/**
 * 自動出金の最低残高（円）。
 *
 * 出金1回ごとにStripe側の手数料がかかるため、数百円程度の売上のたびに
 * 出金が発生すると、その手数料だけでプラットフォームの取り分（20%）を
 * 上回ってしまい赤字になりかねない。この金額に達するまでは自動出金せず
 * Stripe残高に留め、複数件の売上をまとめて出金することで、
 * 1回あたりの手数料負担を薄める。
 */
const MIN_PAYOUT_BALANCE_JPY = 1000;

export type SellerActionResult = { error: string };

async function getOrigin() {
  const headerList = await headers();
  return (
    headerList.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

/**
 * 出品者のStripe Connect登録を開始する。
 *
 * 1回目: Stripeに連結アカウント(Express)を作り、DBに記録してから登録画面へ送る
 * 2回目以降: 既存のアカウントに対して新しい登録リンクを発行して送る
 *   （登録リンクは使い捨て・短時間で失効するため、毎回発行し直す必要がある）
 */
export async function startSellerOnboarding(): Promise<
  SellerActionResult | never
> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/seller");
  }

  const admin = createAdminClient();
  const origin = await getOrigin();

  let onboardingUrl: string | null = null;

  try {
    // 既に連結アカウントを持っているか確認する。
    // 注意: 必ず「DBに記録済みのIDを再利用する」こと。
    // ここで毎回新規作成すると、出品者ごとに使われないアカウントが増え続け、
    // 「登録したのに受け取れない」状態になる。
    const { data: existing, error: lookupError } = await withRetrySupabase(() =>
      admin
        .from("seller_accounts")
        .select("stripe_account_id")
        .eq("user_id", user.id)
        .maybeSingle()
    );

    if (lookupError) {
      return { error: `登録状況の確認に失敗しました: ${lookupError.message}` };
    }

    let accountId = existing?.stripe_account_id ?? null;

    if (!accountId) {
      // Stripeは新規のConnect実装に Accounts v2 (/v2/core/accounts) を要求する。
      // v1形式（accounts.create with type/controller）は新規実装では拒否される。
      //
      // configuration は "recipient" を使う。
      // destination charge を on_behalf_of なしで行う場合、出品者は
      // Merchant of Record ではなく「資金の受取人」になるため。
      // （merchant を指定すると、出品者に決済事業者としての重い要件が課される）
      //
      // responsibilities は Connect契約時に同意した内容と揃えている:
      //   fees_collector   = application … Stripeの手数料はプラットフォーム負担
      //   losses_collector = application … 返金・チャージバックもプラットフォーム責任
      const account = await stripe.v2.core.accounts.create({
        contact_email: user.email ?? undefined,
        dashboard: "express",
        identity: { country: "JP" },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
        defaults: {
          currency: "jpy",
          locales: ["ja-JP"],
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        metadata: {
          buildbay_user_id: user.id,
        },
      });

      accountId = account.id;

      // 最低出金額を設定する。失敗しても登録フロー自体は止めない
      // （設定できなくても、Stripeの初期値である「毎回全額出金」に
      //  なるだけで、致命的な問題にはならないため）。
      try {
        await stripe.balanceSettings.update(
          { payments: { payouts: { minimum_balance_by_currency: { jpy: MIN_PAYOUT_BALANCE_JPY } } } },
          { stripeAccount: accountId }
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "不明なエラー";
        console.error(`[seller] 最低出金額の設定に失敗: ${accountId}`, message);
      }

      // 作成直後はどの項目も未完了。実際の状態は、登録完了後の同期処理と
      // account.updated Webhook が埋める（列のデフォルトは全て false）。
      const { error: insertError } = await withRetrySupabase(() =>
        admin
          .from("seller_accounts")
          .insert({ user_id: user.id, stripe_account_id: accountId })
          .select("user_id")
          .maybeSingle()
      );

      if (insertError) {
        // 再試行しても保存できなかった場合。
        // Stripe側にはアカウントが出来てしまっているため、
        // 復旧できるようIDをログに残す（次回は同じIDを使い回したい）。
        console.error(
          `[seller] 連結アカウントを作成したが保存に失敗: ${accountId}`,
          insertError.message
        );
        return {
          error: t("sellerSaveFailed"),
        };
      }
    }

    // 登録リンクは使い捨て・短時間で失効するため、毎回発行し直す
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          // 期限切れ等でリンクが無効になった場合の戻り先
          refresh_url: `${origin}/seller?refresh=1`,
          // 登録が終わって戻ってくる先
          return_url: `${origin}/seller?return=1`,
        },
      },
    });

    onboardingUrl = link.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : t("unknownError");
    return { error: t("stripeOnboardingPrepFailed", { message }) };
  }

  if (!onboardingUrl) {
    return { error: t("onboardingUrlFailed") };
  }

  // redirect は try の外で呼ぶ
  // （Next.jsのredirectは内部的に例外を投げるため、tryの中だとcatchに拾われる）
  redirect(onboardingUrl);
}

/**
 * 出品者用のStripe Expressダッシュボードを開く。
 * 売上明細や入金先口座の変更は、Stripe側の画面で行ってもらう。
 */
export async function openSellerDashboard(): Promise<
  SellerActionResult | never
> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/seller");
  }

  const admin = createAdminClient();
  let loginUrl: string | null = null;

  try {
    const { data: sellerAccount } = await admin
      .from("seller_accounts")
      .select("stripe_account_id, details_submitted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sellerAccount) {
      return { error: t("stripeNotRegisteredYet") };
    }
    if (!sellerAccount.details_submitted) {
      return { error: t("stripeRegistrationIncomplete") };
    }

    const link = await stripe.accounts.createLoginLink(
      sellerAccount.stripe_account_id
    );
    loginUrl = link.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : t("unknownError");
    return { error: t("dashboardOpenFailed", { message }) };
  }

  if (!loginUrl) {
    return { error: t("dashboardUrlFailed") };
  }

  redirect(loginUrl);
}
