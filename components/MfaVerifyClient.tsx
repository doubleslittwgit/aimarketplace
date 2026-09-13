"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
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
        code,
      });

      if (verifyError) {
        setError(
          verifyError.message === "Invalid TOTP code"
            ? "コードが正しくありません。もう一度お試しください。"
            : verifyError.message
        );
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

  if (preparing) {
    return null;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-7"
      >
        <h1 className="mb-1.5 font-display text-lg font-semibold text-text-primary">
          二段階認証
        </h1>
        <p className="mb-5 text-[13px] text-text-muted">
          認証アプリに表示されている6桁のコードを入力してください。
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3.5 py-2.5 text-[13px] text-accent-danger">
            {error}
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="mb-4 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-text-primary"
        />

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
