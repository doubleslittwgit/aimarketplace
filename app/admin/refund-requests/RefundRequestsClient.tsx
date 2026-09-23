"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/mock-data";
import { updateRefundRequestStatus } from "./actions";
import type { RefundRequestRow } from "./page";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-accent-danger/10 text-accent-danger",
  resolved: "bg-accent-success/10 text-accent-success",
  dismissed: "bg-surface-raised text-text-muted",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "未対応",
  resolved: "対応済み",
  dismissed: "対応不要",
};

export default function RefundRequestsClient({
  requests,
}: {
  requests: RefundRequestRow[];
}) {
  const [items, setItems] = useState(requests);
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const visible = tab === "pending" ? items.filter((r) => r.status === "pending") : items;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/admin"
          className="mb-3 inline-flex items-center gap-1 text-[12px] text-text-muted transition hover:text-text-primary"
        >
          ← 管理ダッシュボード
        </Link>
        <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
          返金・トラブル報告
        </h1>
        <p className="mb-6 text-[13px] text-text-muted">
          買い手からアプリ内で寄せられた、返金・トラブルの申告一覧です。
        </p>

        <div className="mb-6 flex gap-1 border-b border-border">
          <TabButton
            active={tab === "pending"}
            onClick={() => setTab("pending")}
            label={`未対応 (${items.filter((r) => r.status === "pending").length})`}
          />
          <TabButton
            active={tab === "all"}
            onClick={() => setTab("all")}
            label={`すべて (${items.length})`}
          />
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-[13px] text-text-muted">
            {tab === "pending" ? "未対応の報告はありません" : "報告はまだありません"}
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((r) => (
              <RequestRowItem
                key={r.id}
                request={r}
                onUpdate={(status, note) => {
                  setItems((prev) =>
                    prev.map((p) => (p.id === r.id ? { ...p, status, admin_note: note } : p))
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition ${
        active
          ? "border-accent-signal text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

function RequestRowItem({
  request,
  onUpdate,
}: {
  request: RefundRequestRow;
  onUpdate: (status: "resolved" | "dismissed", note: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState(request.admin_note ?? "");

  function handle(status: "resolved" | "dismissed") {
    startTransition(async () => {
      const result = await updateRefundRequestStatus(request.id, status, note);
      if (!result.error) onUpdate(status, note);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        {request.tools ? (
          <Link
            href={`/apps/${request.tools.slug}`}
            target="_blank"
            className="text-[13px] font-medium text-accent-signal hover:underline"
          >
            {request.tools.name}
          </Link>
        ) : (
          <span className="text-[12px] text-text-dim">（削除されたツール）</span>
        )}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${STATUS_STYLE[request.status]}`}>
          {STATUS_LABEL[request.status]}
        </span>
      </div>

      <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-bg px-3 py-2 text-[13px] text-text-secondary">
        {request.message}
      </p>

      <p className="mt-1.5 font-mono text-[11px] text-text-dim">
        {request.buyer?.display_name ?? request.buyer?.handle ?? "不明な購入者"} ・{" "}
        {request.purchases ? formatPrice(request.purchases.price_paid) : ""} ・{" "}
        {new Date(request.created_at).toLocaleString("ja-JP")}
      </p>

      {request.status === "pending" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="対応メモ（任意・自分用）"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[12px] text-text-primary outline-none focus:border-border-strong"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handle("resolved")}
              disabled={isPending}
              className="rounded-lg bg-accent-signal px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {isPending ? "処理中..." : "対応済みにする"}
            </button>
            <button
              type="button"
              onClick={() => handle("dismissed")}
              disabled={isPending}
              className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-raised disabled:opacity-60"
            >
              対応不要にする
            </button>
          </div>
        </div>
      )}
      {request.status !== "pending" && request.admin_note && (
        <p className="mt-2 text-[12px] text-text-muted">メモ: {request.admin_note}</p>
      )}
    </div>
  );
}
