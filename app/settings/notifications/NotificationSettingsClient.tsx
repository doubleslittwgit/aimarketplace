"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateNotificationPrefs } from "./actions";
import { OPTIONAL_NOTIFICATION_TYPES, type OptionalNotificationType } from "@/lib/notifications/content";

export default function NotificationSettingsClient({
  initialDisabledTypes,
}: {
  initialDisabledTypes: string[];
}) {
  const t = useTranslations("notificationSettings");
  const [disabled, setDisabled] = useState<Set<string>>(new Set(initialDisabledTypes));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(type: OptionalNotificationType) {
    setSaved(false);
    setError(null);
    const next = new Set(disabled);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setDisabled(next);

    startTransition(async () => {
      const result = await updateNotificationPrefs(Array.from(next));
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div>
      <div className="rounded-xl border border-border bg-surface">
        {OPTIONAL_NOTIFICATION_TYPES.map((type, i) => (
          <label
            key={type}
            className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <div>
              <p className="text-[13px] font-medium text-text-primary">
                {t(`types.${type}.label`)}
              </p>
              <p className="mt-0.5 text-[12px] text-text-dim">
                {t(`types.${type}.description`)}
              </p>
            </div>
            <input
              type="checkbox"
              checked={!disabled.has(type)}
              onChange={() => toggle(type)}
              disabled={isPending}
              className="h-4 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-border-strong transition checked:bg-accent-signal relative before:absolute before:left-0.5 before:top-0.5 before:h-3 before:w-3 before:rounded-full before:bg-white before:transition checked:before:translate-x-5"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 h-4 text-[12px]">
        {error && <span className="text-accent-danger">{error}</span>}
        {!error && saved && <span className="text-accent-success">{t("saved")}</span>}
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-text-dim">{t("essentialNotice")}</p>
    </div>
  );
}
