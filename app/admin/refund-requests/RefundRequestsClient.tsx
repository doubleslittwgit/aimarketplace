"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/mock-data";
import { updateRefundRequestStatus, refundPayment } from "./actions";
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

        <RefundByPaymentId />

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

  const [refundError, setRefundError] = useState<string | null>(null);
  const payment = request.purchases ?? request.course_purchases;
  const alreadyRefunded = payment?.status === "refunded";
  const canRefund = Boolean(payment && payment.price_paid > 0 && !alreadyRefunded);

  function refund() {
    if (!payment) return;
    const ok = window.confirm(
      `${formatPrice(payment.price_paid)} を購入者に返金します。\n\n` +
        "・出品者への送金とBuildBayの手数料も取り消されます\n" +
        "・購入者のダウンロード／閲覧はできなくなります\n" +
        "・Stripeの決済手数料は戻りません\n\nこの操作は取り消せません。返金しますか？"
    );
    if (!ok) return;
    setRefundError(null);
    startTransition(async () => {
      let result = await refundPayment({ requestId: request.id, note });
      // すでにダウンロード・利用・閲覧している場合は、内容を見せてもう一度確認する
      if (result.accessWarning) {
        if (!window.confirm(accessWarningText(result.accessWarning))) return;
        result = await refundPayment({ requestId: request.id, note, acknowledgeAccess: true });
      }
      if (result.error) setRefundError(result.error);
      else if (!result.accessWarning) onUpdate("resolved", note || "返金済み");
    });
  }

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
        ) : request.courses ? (
          <>
            <span className="shrink-0 rounded-full bg-[#C9A227]/15 px-2 py-0.5 text-[10px] font-medium text-[#9C7A12]">
              講座
            </span>
            <Link
              href={`/academy/courses/${request.courses.slug}`}
              target="_blank"
              className="text-[13px] font-medium text-accent-signal hover:underline"
            >
              {request.courses.title}
            </Link>
          </>
        ) : (
          <span className="text-[12px] text-text-dim">（削除されたツール）</span>
        )}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${STATUS_STYLE[request.status]}`}>
          {STATUS_LABEL[request.status]}
        </span>
        {alreadyRefunded && (
          <span className="shrink-0 rounded-full bg-text-primary/80 px-2 py-0.5 text-[10px] text-white">返金済み</span>
        )}
      </div>

      <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-bg px-3 py-2 text-[13px] text-text-secondary">
        {request.message}
      </p>

      <p className="mt-1.5 font-mono text-[11px] text-text-dim">
        {request.buyer?.display_name ?? request.buyer?.handle ?? "不明な購入者"} ・{" "}
        {request.purchases
          ? formatPrice(request.purchases.price_paid)
          : request.course_purchases
            ? formatPrice(request.course_purchases.price_paid)
            : ""} ・{" "}
        {new Date(request.created_at).toLocaleString("ja-JP")}
      </p>

      <DeliveryEvidence request={request} />

      {request.status === "pending" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="対応メモ（任意・自分用）"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[12px] text-text-primary outline-none focus:border-border-strong"
          />
          {refundError && <p className="text-[12px] text-accent-danger">{refundError}</p>}
          <div className="flex flex-wrap gap-2">
            {canRefund && (
              <button
                type="button"
                onClick={refund}
                disabled={isPending}
                className="rounded-lg bg-accent-danger px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
              >
                返金する
              </button>
            )}
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

/**
 * 報告が無い支払い（二重決済など）を、Stripeの支払いID（pi_...）で返金する欄。
 * 支払いIDは、Stripeの画面の「支払い」から確認できる。
 */
function RefundByPaymentId() {
  const [open, setOpen] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const id = paymentIntentId.trim();
    if (!id) return;
    const ok = window.confirm(
      `支払い ${id} を返金します。\n出品者への送金とBuildBayの手数料も取り消され、購入者の権限は外れます。\nこの操作は取り消せません。返金しますか？`
    );
    if (!ok) return;
    setMessage(null);
    startTransition(async () => {
      let result = await refundPayment({ paymentIntentId: id });
      if (result.accessWarning) {
        if (!window.confirm(accessWarningText(result.accessWarning))) return;
        result = await refundPayment({ paymentIntentId: id, acknowledgeAccess: true });
      }
      setMessage(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: "返金しました" });
      if (!result.error) setPaymentIntentId("");
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[13px] font-medium text-text-primary"
      >
        {open ? "▾" : "▸"} 報告の無い支払いを返金する（二重決済など）
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] text-text-muted">
            Stripeの画面の「支払い」にある支払いID（pi_ で始まるID）を入力してください。必ずここから返金してください（Stripeの画面から返金すると、出品者への送金が取り消されません）。
          </p>
          <div className="flex gap-2">
            <input
              value={paymentIntentId}
              onChange={(e) => setPaymentIntentId(e.target.value)}
              placeholder="pi_..."
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[12px] text-text-primary outline-none focus:border-border-strong"
            />
            <button
              type="button"
              onClick={submit}
              disabled={isPending || !paymentIntentId.trim()}
              className="shrink-0 rounded-lg bg-accent-danger px-3 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {isPending ? "処理中..." : "返金する"}
            </button>
          </div>
          {message && (
            <p className={`text-[12px] ${message.kind === "ok" ? "text-accent-success" : "text-accent-danger"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatJst(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function accessWarningText(w: { count: number; first: string; last: string }): string {
  return (
    `⚠️ この購入者は、すでに商品を受け取っています（ダウンロード・利用・閲覧 ${w.count}回）。\n` +
    `初回: ${formatJst(w.first)}\n最終: ${formatJst(w.last)}\n\n` +
    "返金しても、ダウンロードしたファイルや利用先URLは購入者の手元に残ります。\n" +
    "・出品者に不具合や状況を確認しましたか？\n" +
    "・返金の条件（場合によって返金あり／重大な不具合／決済の誤り）に当てはまりますか？\n\n" +
    "それでも返金しますか？"
  );
}

/** 返金の判断材料: 購入者がすでに受け取っているか、決済時に規約へ同意しているか */
function DeliveryEvidence({ request }: { request: RefundRequestRow }) {
  const payment = request.purchases ?? request.course_purchases;
  if (!payment || payment.price_paid <= 0) return null;
  const access = request.access;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      {access && access.count > 0 ? (
        <span className="font-medium text-accent-danger">
          受け取り済み: {access.count}回（初回 {formatJst(access.first)} / 最終 {formatJst(access.last)}）
        </span>
      ) : (
        <span className="text-text-muted">受け取りの記録: なし</span>
      )}
      <span className="text-text-muted">
        規約への同意: {payment.terms_accepted_at ? `あり（${formatJst(payment.terms_accepted_at)}）` : "記録なし"}
      </span>
    </div>
  );
}
