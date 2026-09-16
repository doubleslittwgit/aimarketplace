"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signup } from "@/app/auth/actions";
import GoogleButton from "@/components/GoogleButton";

export default function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [showAgreementError, setShowAgreementError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  function handleSubmit(formData: FormData) {
    if (!agreed) {
      setShowAgreementError(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await signup(formData);
      if (result.error) setError(result.error);
    });
  }

  const agreementCheckbox = (
    <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-text-secondary">
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => {
          setAgreed(e.target.checked);
          if (e.target.checked) setShowAgreementError(false);
        }}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent-signal focus:ring-accent-signal"
      />
      <span>
        <Link href="/legal/terms" target="_blank" className="text-accent-ai underline underline-offset-2">
          利用規約
        </Link>
        と
        <Link href="/legal/privacy" target="_blank" className="text-accent-ai underline underline-offset-2">
          プライバシーポリシー
        </Link>
        に同意します
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      {agreementCheckbox}
      {showAgreementError && (
        <p className="-mt-3 text-[12px] text-accent-danger">
          登録には利用規約・プライバシーポリシーへの同意が必要です
        </p>
      )}

      <GoogleButton next={next} disabled={!agreed} />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[12px] text-text-dim">または</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {error && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3.5 py-2.5 text-[13px] text-accent-danger">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          表示名
        </label>
        <input
          type="text"
          name="displayName"
          autoComplete="name"
          placeholder="例：Kenji Sato"
          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          メールアドレス
        </label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
          パスワード
        </label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="8文字以上"
          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-accent-signal py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {isPending ? "登録中..." : "登録する"}
      </button>
      </form>
    </div>
  );
}
