"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { logout } from "@/app/auth/actions";

type Props = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin?: boolean;
};

export default function UserMenu({ email, displayName, avatarUrl, isAdmin }: Props) {
  const t = useTranslations("userMenu");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = (displayName || email).slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2.5 transition hover:border-border-strong"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-ai-dim text-[10px] font-semibold text-accent-ai">
            {initials}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate text-[13px] text-text-secondary sm:block">
          {displayName || email}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-lg border border-border bg-surface py-1.5 shadow-lg">
          <div className="border-b border-border px-3.5 py-2.5">
            <p className="truncate text-[13px] font-medium text-text-primary">
              {displayName || t("unnamedUser")}
            </p>
            <p className="truncate text-[12px] text-text-muted">{email}</p>
          </div>

          <Link
            href="/dashboard"
            className="block px-3.5 py-2 text-[13px] text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            {t("dashboard")}
          </Link>
          <Link
            href="/submit"
            className="block px-3.5 py-2 text-[13px] text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            {t("publishTool")}
          </Link>
          <Link
            href="/seller"
            className="block px-3.5 py-2 text-[13px] text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            {t("sellerSettings")}
          </Link>
          <Link
            href="/mfa"
            className="block px-3.5 py-2 text-[13px] text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            {t("mfa")}
          </Link>

          {isAdmin && (
            <>
              <div className="my-1.5 border-t border-border" />
              <Link
                href="/admin/review"
                className="block px-3.5 py-2 text-[13px] text-accent-ai hover:bg-surface-raised"
                onClick={() => setOpen(false)}
              >
                {t("adminReview")}
              </Link>
              <Link
                href="/admin/reports"
                className="block px-3.5 py-2 text-[13px] text-accent-ai hover:bg-surface-raised"
                onClick={() => setOpen(false)}
              >
                {t("adminReports")}
              </Link>
              <Link
                href="/admin/refund-requests"
                className="block px-3.5 py-2 text-[13px] text-accent-ai hover:bg-surface-raised"
                onClick={() => setOpen(false)}
              >
                {t("adminRefundRequests")}
              </Link>
            </>
          )}

          <div className="my-1.5 border-t border-border" />

          <form action={logout}>
            <button
              type="submit"
              className="block w-full px-3.5 py-2 text-left text-[13px] text-accent-danger hover:bg-surface-raised"
            >
              {t("logout")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
