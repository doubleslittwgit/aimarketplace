import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import SellerOnboardingButton from "@/components/SellerOnboardingButton";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import {
  syncSellerAccount,
  sellerAccountFieldsFromStripe,
} from "@/lib/stripe/seller-account";

/** Stripeが返す要件キーを、翻訳キーに対応付ける */
const REQUIREMENT_KEYS: Record<string, string> = {
  "business_profile.url": "businessUrl",
  "business_profile.product_description": "productDescription",
  "business_profile.mcc": "businessCategory",
  external_account: "bankAccount",
  "individual.verification.document": "idDocument",
  "individual.address.line1": "address",
  "individual.dob.day": "dob",
  "individual.first_name": "firstName",
  "individual.last_name": "lastName",
  "individual.phone": "phone",
  "tos_acceptance.date": "tosAcceptance",
};

export default async function SellerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("seller");
  const requirementLabel = (key: string) => {
    const reqKey = REQUIREMENT_KEYS[key];
    return reqKey ? t(`requirements.${reqKey}`) : key;
  };
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
      "stripe_account_id, transfers_enabled, payouts_enabled, details_submitted, requirements_due"
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
      current = { ...account, ...sellerAccountFieldsFromStripe(fresh) };
    } catch {
      // 取得に失敗しても画面は表示する（Webhookが後から更新してくれる）
    }
  }

  // destination charge では出品者は「資金の受取人」なので、
  // charges_enabled ではなく「送金を受け取れる/出金できる」で判定する
  const canReceive = Boolean(
    current?.transfers_enabled && current?.payouts_enabled
  );
  const inProgress = Boolean(current) && !canReceive;
  const due = current?.requirements_due ?? [];

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
            {t("title")}
          </h1>
          <p className="mb-8 text-[13px] text-text-muted">
            {t("subtitle")}
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
                    {t("completeTitle")}
                  </p>
                  <p className="text-[12px] text-text-muted">
                    {t("completeSubtitle")}
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-border bg-bg px-4 py-3 text-[12px] text-text-muted">
                {t("feeNoticePrefix")}
                <span className="mx-1 font-semibold text-text-secondary">
                  {t("feeNoticeHighlight")}
                </span>
                {t("feeNoticeSuffix")}
              </div>

              <SellerOnboardingButton
                action="dashboard"
                label={t("checkPayouts")}
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
                    {t("inProgressTitle")}
                  </p>
                  <p className="text-[12px] text-text-muted">
                    {t("inProgressSubtitle")}
                  </p>
                </div>
              </div>

              {due.length > 0 && (
                <div className="mb-4 rounded-lg border border-border bg-bg px-4 py-3">
                  <p className="mb-2 text-[12px] font-medium text-text-secondary">
                    {t("requirementsNeeded")}
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
                label={t("continueRegistration")}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="mb-1 text-[13px] font-medium text-text-primary">
                {t("registrationFlowTitle")}
              </p>
              <ol className="mb-5 space-y-2.5">
                {[t("step1"), t("step2"), t("step3")].map((text, i) => (
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
                label={t("startSetup")}
              />
              <p className="mt-3 text-center text-[11px] text-text-dim">
                {t("freeNoSetupNeeded")}
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/dashboard"
              className="text-[13px] text-accent-signal hover:underline"
            >
              {t("backToDashboard")}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
