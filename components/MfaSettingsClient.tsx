"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: "verified" | "unverified";
};

export default function MfaSettingsClient() {
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

  async function verifyEnroll() {
    if (!pendingFactorId || code.length !== 6) return;
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

      setEnrolling(false);
      setQrCode(null);
      setSecret(null);
      setPendingFactorId(null);
      setCode("");
      await loadFactors();
    } catch (err) {
      setError(
        err instanceof Error
          ? `予期しないエラーが発生しました: ${err.message}`
          : "予期しないエラーが発生しました。もう一度お試しください。"
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
      <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
        二段階認証
      </h1>
      <p className="mb-8 text-[13px] text-text-muted">
        認証アプリ(Google Authenticator、1Password等)を使った二段階認証を設定できます。
        有効にすると、ログイン時にパスワードに加えて6桁のコード入力が必要になります。
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-4 py-3 text-[13px] text-accent-danger">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-text-muted">読み込み中...</p>
      ) : enrolling ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="mb-4 text-[13px] text-text-secondary">
            認証アプリでこのQRコードを読み取ってください。
          </p>
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrCode}
              alt="QRコード"
              className="mx-auto mb-4 h-48 w-48 rounded-lg border border-border bg-white p-2"
            />
          )}
          {secret && (
            <p className="mb-4 text-center font-mono text-[12px] text-text-dim">
              読み取れない場合は手動でキーを入力: {secret}
            </p>
          )}

          <label className="mb-1.5 block text-[12px] text-text-muted">
            認証アプリに表示された6桁のコード
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="mb-4 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-text-primary"
          />

          <div className="flex gap-2">
            <button
              onClick={verifyEnroll}
              disabled={code.length !== 6 || verifying}
              className="flex-1 rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {verifying ? "確認中..." : "確認して有効化"}
            </button>
            <button
              onClick={cancelEnroll}
              className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-text-secondary hover:bg-surface-raised"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : verifiedFactors.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-accent-success" />
            <p className="text-[13px] font-medium text-text-primary">
              二段階認証は有効です
            </p>
          </div>
          {verifiedFactors.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between border-t border-border py-3 first:border-t-0 first:pt-0"
            >
              <span className="text-[13px] text-text-secondary">
                認証アプリ({f.friendly_name || "TOTP"})
              </span>
              <button
                onClick={() => unenroll(f.id)}
                className="text-[13px] text-accent-danger hover:underline"
              >
                解除
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="mb-4 text-[13px] text-text-muted">
            二段階認証はまだ設定されていません。
          </p>
          <button
            onClick={startEnroll}
            className="rounded-lg bg-accent-signal px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
          >
            二段階認証を有効にする
          </button>
        </div>
      )}
    </div>
  );
}
