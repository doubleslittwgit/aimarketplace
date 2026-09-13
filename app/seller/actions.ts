"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const { data: existing, error: lookupError } = await admin
      .from("seller_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      return { error: `登録状況の確認に失敗しました: ${lookupError.message}` };
    }

    let accountId = existing?.stripe_account_id ?? null;

    if (!accountId) {
      // Express アカウントを作成する。
      //
      // controller の指定は Connect 契約時に同意した内容と揃えている:
      //   fees.payer = application   … Stripeの手数料はプラットフォームが負担
      //   losses.payments = application … 返金・チャージバックの責任もプラットフォーム
      //   stripe_dashboard.type = express … 出品者はExpressダッシュボードを使う
      //
      // capabilities は transfers のみを要求する。
      // destination charge 方式では決済自体はプラットフォーム側で行われるため、
      // 出品者側に card_payments は不要。要求する権限を最小にすることで、
      // 出品者が提出しなければならない情報も少なくて済む。
      const account = await stripe.accounts.create({
        country: "JP",
        email: user.email ?? undefined,
        controller: {
          stripe_dashboard: { type: "express" },
          fees: { payer: "application" },
          losses: { payments: "application" },
        },
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          buildbay_user_id: user.id,
        },
      });

      accountId = account.id;

      const { error: insertError } = await admin.from("seller_accounts").insert({
        user_id: user.id,
        stripe_account_id: accountId,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements_due: account.requirements?.currently_due ?? [],
      });

      if (insertError) {
        // DBに記録できないまま登録画面へ送ると、次回また別のアカウントを
        // 作ってしまう。ここで中断する方が安全。
        return {
          error: `登録情報の保存に失敗しました: ${insertError.message}`,
        };
      }
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      // 期限切れ等でリンクが無効になった場合の戻り先
      refresh_url: `${origin}/seller?refresh=1`,
      // 登録が終わって戻ってくる先
      return_url: `${origin}/seller?return=1`,
      type: "account_onboarding",
    });

    onboardingUrl = link.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return { error: `Stripeの登録準備に失敗しました: ${message}` };
  }

  if (!onboardingUrl) {
    return { error: "登録画面のURLを取得できませんでした" };
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
      return { error: "まだStripeの登録が行われていません" };
    }
    if (!sellerAccount.details_submitted) {
      return { error: "Stripeの登録がまだ完了していません" };
    }

    const link = await stripe.accounts.createLoginLink(
      sellerAccount.stripe_account_id
    );
    loginUrl = link.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return { error: `ダッシュボードを開けませんでした: ${message}` };
  }

  if (!loginUrl) {
    return { error: "ダッシュボードのURLを取得できませんでした" };
  }

  redirect(loginUrl);
}
