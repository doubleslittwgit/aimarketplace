"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications-actions";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

/** 通知の種類ごとに、ベルの隣に出す小さいアイコンの色分け（気分で見分けやすくする程度のもの） */
function dotColor(type: string) {
  if (type.startsWith("admin_high_risk")) return "bg-accent-danger";
  if (type === "sale" || type === "purchase_receipt") return "bg-accent-success";
  if (type.includes("rejected") || type === "tool_unpublished_by_admin")
    return "bg-accent-danger";
  return "bg-accent-ai";
}

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

function timeAgo(iso: string, t: ReturnType<typeof useTranslations>, intlLocale: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t("justNow");
  if (min < 60) return t("minutesAgo", { minutes: min });
  const hour = Math.floor(min / 60);
  if (hour < 24) return t("hoursAgo", { hours: hour });
  const day = Math.floor(hour / 24);
  if (day < 7) return t("daysAgo", { days: day });
  return new Date(iso).toLocaleDateString(intlLocale);
}

export default function NotificationBell({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const intlLocale = INTL_LOCALE[locale] ?? "ja-JP";

  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleItemClick(id: string) {
    // 押した瞬間に見た目を既読にする（通信を待たせない）
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    startTransition(() => {
      markNotificationRead(id);
    });
  }

  function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    );
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("bellAriaLabel")}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface hover:text-text-primary"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-signal px-1 font-mono text-[9px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-bg shadow-[0_16px_40px_-12px_rgba(22,35,45,0.25)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[13px] font-medium text-text-primary">{t("title")}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[12px] text-accent-ai hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-text-muted">
                {t("empty")}
              </p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link_url ?? "#"}
                  onClick={() => {
                    handleItemClick(n.id);
                    setOpen(false);
                  }}
                  className={`flex items-start gap-2.5 border-b border-border px-4 py-3 text-left transition hover:bg-surface ${
                    n.read_at ? "" : "bg-accent-ai-dim/40"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      n.read_at ? "bg-transparent" : dotColor(n.type)
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-text-primary">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-text-secondary">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-text-dim">
                      {timeAgo(n.created_at, t, intlLocale)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/settings/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center border-t border-border py-2.5 text-[12px] text-text-muted transition hover:bg-surface hover:text-text-secondary"
          >
            {t("settingsLink")}
          </Link>
        </div>
      )}
    </div>
  );
}
