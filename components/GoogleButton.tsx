"use client";

import { useTranslations } from "next-intl";
import { signInWithGoogle } from "@/app/auth/actions";

export default function GoogleButton({
  next,
  disabled,
}: {
  next?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("auth");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => signInWithGoogle(window.location.origin, next)}
      className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-text-primary transition hover:border-border-strong hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-surface"
    >
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.998 11.998 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.75l4-3.11Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.63l4 3.1C6.22 6.87 8.87 4.75 12 4.75Z"
        />
      </svg>
      {t("continueWithGoogle")}
    </button>
  );
}
