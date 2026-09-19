"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import OtpInput from "@/components/OtpInput";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: "verified" | "unverified";
  created_at?: string;
};

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-signal text-[12px] font-semibold text-white">
      {n}
    </span>
  );
}

export default function MfaSettingsClient() {
  const t = useTranslations("mfa");
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 有効化フローの途中状態
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function loadFactors() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setError(error.message);
    } else {
      setFactors(data.totp as Factor[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setError(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `BuildBay-${Date.now()}`,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPendingFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  }

  async function cancelEnroll() {
    // 検証前に離脱する場合、未検証のfactorを片付けておく
    if (pendingFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    }
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode("");
  }

  async function verifyEnroll(fullCode: string) {
    if (!pendingFactorId || fullCode.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);

    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId,
        challengeId: challenge.id,
        code: fullCode,
      });

      if (verifyError) {
        setError(
          verifyError.message === "Invalid TOTP code"
            ? t("invalidCode")
            : verifyError.message
        );
        setCode("");
        return;
      }

      setEnrolling(false);
      setQrCode(null);
      setSecret(null);
      setPendingFactorId(null);
      setCode("");
      await loadFactors();
    } catch (err) {
      setError(
        err instanceof Error
          ? t("unexpectedError", { message: err.message })
          : t("unexpectedErrorGeneric")
      );
    } finally {
      setVerifying(false);
    }
  }

  async function unenroll(factorId: string) {
    setError(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setError(error.message);
      return;
    }
    await loadFactors();
  }

  const verifiedFactors = factors.filter((f) => f.status === "verified");

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-8 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-ai-dim text-accent-ai">
          <ShieldIcon />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            {t("title")}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            <span className="inline-flex items-center gap-1 rounded bg-surface-raised px-1.5 py-0.5 font-semibold text-text-secondary">
              <PhoneIcon />
              {t("authApp")}
            </span>
            {t("subtitle")}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-4 py-3 text-[13px] text-accent-danger">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-text-muted">{t("loading")}</p>
      ) : enrolling ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-5 flex items-start gap-3">
            <StepNumber n={1} />
            <div className="pt-0.5">
              <p className="text-[13px] font-medium text-text-primary">
                {t("step1Title")}
              </p>
              <p className="mt-0.5 text-[12px] text-text-muted">
                {t("step1Body")}
              </p>
            </div>
          </div>

          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrCode}
              alt={t("qrAlt")}
              className="mx-auto mb-3 h-44 w-44 rounded-lg border border-border bg-white p-2"
            />
          )}
          {secret && (
            <details className="mb-6 text-center">
              <summary className="cursor-pointer text-[12px] text-accent-ai hover:underline">
                {t("cantScan")}
              </summary>
              <p className="mt-2 break-all rounded-lg bg-surface-raised px-3 py-2 font-mono text-[12px] text-text-secondary">
                {secret}
              </p>
              <p className="mt-1 text-[11px] text-text-dim">
                {t("enterManually")}
              </p>
            </details>
          )}

          <div className="mb-4 flex items-start gap-3">
            <StepNumber n={2} />
            <div className="w-full pt-0.5">
              <p className="mb-3 text-[13px] font-medium text-text-primary">
                {t("step2Title")}
              </p>
              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={verifyEnroll}
                disabled={verifying}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => verifyEnroll(code)}
              disabled={code.length !== 6 || verifying}
              className="flex-1 rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {verifying ? t("verifying") : t("verifyAndEnable")}
            </button>
            <button
              onClick={cancelEnroll}
              className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-text-secondary hover:bg-surface-raised"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : verifiedFactors.length > 0 ? (
        <div className="rounded-xl border border-accent-success/30 bg-accent-success/5 p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-success text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <div>
              <p className="text-[14px] font-semibold text-text-primary">
                {t("enabledTitle")}
              </p>
              <p className="text-[12px] text-text-muted">
                {t("enabledSubtitle")}
              </p>
            </div>
          </div>
          {verifiedFactors.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-border bg-bg px-4 py-3"
            >
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
                <PhoneIcon className="text-text-muted" />
                {t("authApp")}
              </span>
              <button
                onClick={() => unenroll(f.id)}
                className="text-[13px] text-accent-danger hover:underline"
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-text-muted">
            <ShieldIcon />
          </div>
          <p className="mb-4 text-[13px] text-text-muted">
            {t("notSetUp")}
          </p>
          <button
            onClick={startEnroll}
            className="rounded-lg bg-accent-signal px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
          >
            {t("enable")}
          </button>
        </div>
      )}
    </div>
  );
}
