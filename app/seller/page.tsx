import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import SellerOnboardingButton from "@/components/SellerOnboardingButton";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { syncSellerAccount } from "@/lib/stripe/seller-account";

/** Stripeが返す要件キーを、出品者に分かる日本語に置き換える */
const REQUIREMENT_LABELS: Record<string, string> = {
  "business_profile.url": "事業のウェブサイトURL",
  "business_profile.product_description": "販売する商品の説明",
  "business_profile.mcc": "事業カテゴリー",
  "external_account": "入金先の銀行口座",
  "individual.verification.document": "本人確認書類",
  "individual.address.line1": "住所",
  "individual.dob.day": "生年月日",
  "individual.first_name": "名前",
  "individual.last_name": "姓",
  "individual.phone": "電話番号",
  "tos_acceptance.date": "利用規約への同意",
};

function requirementLabel(key: string) {
  return REQUIREMENT_LABELS[key] ?? key;
}

export default async function SellerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/seller");
  }

  // 自分の行はRLSで読めるため、ここでは管理者権限を使わない（最小権限）
  const { data: account } = await supabase
    .from("seller_accounts")
    .select(
      "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_due"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // Stripeの登録画面から戻ってきた直後は、Webhookの到達を待たずに
  // その場で最新状態を取り直す（画面表示が古いままになるのを防ぐ）
  let current = account;
  if (params.return === "1" && account) {
    try {
      const fresh = await stripe.accounts.retrieve(account.stripe_account_id);
      await syncSellerAccount(user.id, fresh);
      current = {
        ...account,
        charges_enabled: fresh.charges_enabled,
        payouts_enabled: fresh.payouts_enabled,
        details_submitted: fresh.details_submitted,
        requirements_due: fresh.requirements?.currently_due ?? [],
      };
    } catch {
      // 取得に失敗しても画面は表示する（Webhookが後から更新してくれる）
    }
  }

  const canReceive = Boolean(
    current?.charges_enabled && current?.payouts_enabled
  );
  const inProgress = Boolean(current) && !canReceive;
  const due = current?.requirements_due ?? [];

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
            売上の受け取り設定
          </h1>
          <p className="mb-8 text-[13px] text-text-muted">
            有料ツールを販売するには、売上を受け取るための登録が必要です。
            登録はStripeの画面で行われ、BuildBayが銀行口座や本人確認書類を
            預かることはありません。
          </p>

          {canReceive ? (
            <div className="rounded-xl border border-accent-success/30 bg-accent-success/5 p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-success text-white">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-text-primary">
                    受け取り設定は完了しています
                  </p>
                  <p className="text-[12px] text-text-muted">
                    有料ツールを販売でき、売上は自動で入金されます
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-border bg-bg px-4 py-3 text-[12px] text-text-muted">
                販売価格から
                <span className="mx-1 font-semibold text-text-secondary">
                  プラットフォーム手数料20%
                </span>
                を差し引いた金額が、購入と同時にあなたのStripeアカウントへ送金されます。
              </div>

              <SellerOnboardingButton
                action="dashboard"
                label="Stripeで売上・入金先を確認する"
                variant="secondary"
              />
            </div>
          ) : inProgress ? (
            <div className="rounded-xl border border-border bg-surface p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-signal-dim text-accent-signal">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-text-primary">
                    登録がまだ完了していません
                  </p>
                  <p className="text-[12px] text-text-muted">
                    完了するまで有料ツールは販売できません
                  </p>
                </div>
              </div>

              {due.length > 0 && (
                <div className="mb-4 rounded-lg border border-border bg-bg px-4 py-3">
                  <p className="mb-2 text-[12px] font-medium text-text-secondary">
                    あと必要な情報
                  </p>
                  <ul className="space-y-1">
                    {due.map((key: string) => (
                      <li
                        key={key}
                        className="flex items-start gap-1.5 text-[12px] text-text-muted"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-dim" />
                        {requirementLabel(key)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <SellerOnboardingButton
                action="onboarding"
                label="登録を続ける"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="mb-1 text-[13px] font-medium text-text-primary">
                登録の流れ
              </p>
              <ol className="mb-5 space-y-2.5">
                {[
                  "Stripeの登録画面に移動します",
                  "本人確認の情報と、入金先の銀行口座を登録します",
                  "審査が通ると、有料ツールを販売できるようになります",
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-signal text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="text-[13px] text-text-secondary">
                      {text}
                    </span>
                  </li>
                ))}
              </ol>

              <SellerOnboardingButton
                action="onboarding"
                label="受け取り設定を始める"
              />
              <p className="mt-3 text-center text-[11px] text-text-dim">
                無料ツールの公開だけであれば、この設定は不要です
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/dashboard"
              className="text-[13px] text-accent-signal hover:underline"
            >
              マイページに戻る
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
