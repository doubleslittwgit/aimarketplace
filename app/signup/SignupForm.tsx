"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signup } from "@/app/auth/actions";
import GoogleButton from "@/components/GoogleButton";

export default function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signup(formData);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <GoogleButton next={next} />

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

      <p className="text-center text-[11px] leading-relaxed text-text-dim">
        登録すると、利用規約とプライバシーポリシーに同意したものとみなされます
      </p>
      </form>
    </div>
  );
}
