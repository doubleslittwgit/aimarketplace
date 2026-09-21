import { getTranslations } from "next-intl/server";
import Link from "next/link";
import SellerOnboardingButton from "@/components/SellerOnboardingButton";

type Steps = {
  profile: boolean;
  firstListing: boolean;
  payout: boolean;
  firstPost: boolean;
};

export default async function OnboardingChecklist({
  steps,
  handle,
}: {
  steps: Steps;
  handle: string | null;
}) {
  const complete = Object.values(steps).every(Boolean);
  if (complete) return null;

  const t = await getTranslations("dashboard");

  return (
    <section className="mb-8 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-[15px] font-semibold text-text-primary">
        {t("onboardingTitle")}
      </h2>
      <p className="mt-0.5 text-[12px] text-text-muted">{t("onboardingSubtitle")}</p>

      <div className="mt-4 space-y-2.5">
        <ChecklistRow
          done={steps.profile}
          label={t("stepProfile")}
          actionLabel={t("stepProfileAction")}
          href={handle ? `/u/${handle}` : "/dashboard"}
        />
        <ChecklistRow
          done={steps.firstListing}
          label={t("stepFirstListing")}
          actionLabel={t("stepFirstListingAction")}
          href="/submit"
        />
        <ChecklistRow done={steps.payout} label={t("stepPayout")} href={null}>
          <SellerOnboardingButton
            action="onboarding"
            label={t("stepPayoutAction")}
            variant="secondary"
          />
        </ChecklistRow>
        <ChecklistRow
          done={steps.firstPost}
          label={t("stepFirstPost")}
          actionLabel={t("stepFirstPostAction")}
          href="/feed"
        />
      </div>
    </section>
  );
}

function ChecklistRow({
  done,
  label,
  actionLabel,
  href,
  children,
}: {
  done: boolean;
  label: string;
  actionLabel?: string;
  href: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            done
              ? "border-accent-success bg-accent-success text-white"
              : "border-border text-transparent"
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span className={`truncate text-[13px] ${done ? "text-text-dim line-through" : "text-text-secondary"}`}>
          {label}
        </span>
      </div>
      {!done &&
        (children ?? (
          <Link
            href={href ?? "#"}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-[12px] text-text-secondary transition hover:border-border-strong hover:bg-surface-raised"
          >
            {actionLabel}
          </Link>
        ))}
    </div>
  );
}
