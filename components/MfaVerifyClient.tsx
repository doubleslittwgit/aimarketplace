"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OtpInput from "@/components/OtpInput";

export default function MfaVerifyClient() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);

  useEffect(() => {
    async function prepare() {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setError(error.message);
        setPreparing(false);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (!verified) {
        // 検証済みの認証要素が無い＝そもそもこのページに来る必要が無い
        router.replace(next);
        return;
      }
      setFactorId(verified.id);
      setPreparing(false);
    }
    prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCode(fullCode: string) {
    if (!factorId || fullCode.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: fullCode,
      });

      if (verifyError) {
        setError(
          verifyError.message === "Invalid TOTP code"
            ? "コードが正しくありません。認証アプリの最新の6桁をもう一度入力してください。"
            : verifyError.message
        );
        setCode("");
        return;
      }

      // クライアント側のルーターだと、更新後のCookie（aal2）が
      // ミドルウェアに読み込まれる前に遷移してしまうことがあるため、
      // 確実性を優先してフルページ遷移にする。
      window.location.assign(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? `予期しないエラーが発生しました: ${err.message}`
          : "予期しないエラーが発生しました。もう一度お試しください。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitCode(code);
  }

  if (preparing) {
    return null;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-ai-dim">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-ai)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="mb-1.5 font-display text-lg font-semibold text-text-primary">
          本人確認が必要です
        </h1>
        <p className="mb-1 text-[13px] text-text-secondary">
          スマートフォンの
          <span className="mx-1 inline-flex items-center gap-1 rounded bg-accent-ai-dim px-1.5 py-0.5 align-middle text-[12px] font-semibold text-accent-ai">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <path d="M12 18h.01" />
            </svg>
            認証アプリ
          </span>
          を開き、
        </p>
        <p className="mb-6 text-[13px] text-text-secondary">
          表示されている<span className="font-semibold text-text-primary">6桁のコード</span>を入力してください。
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3.5 py-2.5 text-[13px] text-accent-danger">
            {error}
          </div>
        )}

        <div className="mb-2">
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={submitCode}
            disabled={submitting}
          />
        </div>
        <p className="mb-6 text-[11px] text-text-dim">
          コードは30秒ごとに更新されます。最新の番号を入力してください。
        </p>

        <button
          type="submit"
          disabled={code.length !== 6 || submitting}
          className="w-full rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {submitting ? "確認中..." : "確認する"}
        </button>
      </form>
    </div>
  );
}
