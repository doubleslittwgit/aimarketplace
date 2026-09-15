"use client";

import { useState, useTransition } from "react";
import { formatPrice } from "@/lib/mock-data";
import { approveTool, rejectTool, unpublishToolByAdmin } from "./actions";

type PendingTool = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  price: number;
  runtime: "cloud" | "local";
  platforms: string[] | null;
  min_os_version: string | null;
  demo_url: string | null;
  thumbnail_url: string | null;
  file_key: string | null;
  ai_review_summary: string | null;
  ai_review_risk: "low" | "medium" | "high" | "unknown" | null;
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; handle: string } | null;
};

type PublishedTool = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  price: number;
  category: string;
  runtime: "cloud" | "local";
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; handle: string } | null;
};

const RISK_STYLE: Record<string, string> = {
  low: "bg-accent-success/10 text-accent-success",
  medium: "bg-accent-ai-dim text-accent-ai",
  high: "bg-accent-danger/10 text-accent-danger",
  unknown: "bg-surface-raised text-text-muted",
};

const RISK_LABEL: Record<string, string> = {
  low: "AI判定: 低リスク",
  medium: "AI判定: 要確認",
  high: "AI判定: 高リスク",
  unknown: "AI判定: 不明",
};

export default function AdminReviewClient({
  tools,
  publishedTools,
}: {
  tools: PendingTool[];
  publishedTools: PublishedTool[];
}) {
  const [tab, setTab] = useState<"pending" | "published">("pending");

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
          出品の審査
        </h1>
        <p className="mb-6 text-[13px] text-text-muted">
          AIレビューはあくまで参考情報です。最終判断はご自身で行ってください。
        </p>

        <div className="mb-6 flex gap-1 border-b border-border">
          <TabButton
            active={tab === "pending"}
            onClick={() => setTab("pending")}
            label={`審査待ち (${tools.length})`}
          />
          <TabButton
            active={tab === "published"}
            onClick={() => setTab("published")}
            label={`公開中のツール管理 (${publishedTools.length})`}
          />
        </div>

        {tab === "pending" ? (
          tools.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-[13px] text-text-muted">
              審査待ちのツールはありません。
            </div>
          ) : (
            <div className="space-y-5">
              {tools.map((tool) => (
                <ReviewCard key={tool.id} tool={tool} />
              ))}
            </div>
          )
        ) : publishedTools.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-[13px] text-text-muted">
            公開中のツールはありません。
          </div>
        ) : (
          <div className="space-y-3">
            {publishedTools.map((tool) => (
              <PublishedToolRow key={tool.id} tool={tool} />
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

function PublishedToolRow({ tool }: { tool: PublishedTool }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleUnpublish() {
    setError(null);
    startTransition(async () => {
      const result = await unpublishToolByAdmin(tool.id, reason);
      if (result?.error) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-[13px] text-text-muted">
        「{tool.name}」を非公開にしました。
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-[14px] font-semibold text-text-primary">
            {tool.name}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-muted">{tool.tagline}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-dim">
            出品者: {tool.profiles?.display_name ?? "不明"}（@{tool.profiles?.handle}） ・{" "}
            {formatPrice(tool.price)} ・ {tool.category}
          </p>
        </div>
        <a
          href={`/apps/${tool.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[12px] text-text-muted hover:underline"
        >
          商品ページを見る
        </a>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3 py-2 text-[12px] text-accent-danger">
          {error}
        </div>
      )}

      {showForm ? (
        <div className="mt-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="非公開にする理由（出品者に表示されます）"
            className="mb-2 w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[12px] text-text-primary outline-none focus:border-border-strong"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isPending}
              className="rounded-lg bg-accent-danger px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {isPending ? "処理中..." : "この理由で非公開にする"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-raised"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-accent-danger/40 bg-bg px-4 py-2 text-[12px] font-medium text-accent-danger transition hover:bg-accent-danger/10"
          >
            非公開にする
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ tool }: { tool: PendingTool }) {
  const [isApproving, startApprove] = useTransition();
  const [isRejecting, startReject] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState(tool.ai_review_summary ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  function handleApprove() {
    setError(null);
    startApprove(async () => {
      const result = await approveTool(tool.id);
      if (result?.error) setError(result.error);
      else setDone("approved");
    });
  }

  function handleReject() {
    setError(null);
    startReject(async () => {
      const result = await rejectTool(tool.id, reason);
      if (result?.error) setError(result.error);
      else setDone("rejected");
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-text-muted">
        「{tool.name}」を{done === "approved" ? "承認しました" : "却下しました"}。
      </div>
    );
  }

  const risk = tool.ai_review_risk ?? "unknown";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-[16px] font-semibold text-text-primary">
              {tool.name}
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${RISK_STYLE[risk]}`}
            >
              {RISK_LABEL[risk]}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-text-muted">{tool.tagline}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-dim">
            出品者: {tool.profiles?.display_name ?? "不明"}（@{tool.profiles?.handle}） ・{" "}
            {formatPrice(tool.price)} ・ {tool.category} ・{" "}
            {tool.runtime === "local" ? "ローカル実行" : "クラウド"}
          </p>
        </div>
        {tool.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tool.thumbnail_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
          />
        )}
      </div>

      <p className="mb-3 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
        {tool.description}
      </p>

      {tool.ai_review_summary && (
        <div className="mb-3 rounded-lg border border-border bg-bg p-3">
          <p className="mb-1 text-[11px] font-medium text-text-muted">AIレビューの所見</p>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-secondary">
            {tool.ai_review_summary}
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 text-[12px]">
        {tool.runtime === "local" && tool.file_key && (
          <a
            href={`/apps/download/${tool.id}`}
            className="text-accent-signal hover:underline"
          >
            ファイルをダウンロードして確認
          </a>
        )}
        {tool.runtime === "cloud" && tool.demo_url && (
          <a
            href={tool.demo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-signal hover:underline"
          >
            デモURLを開く
          </a>
        )}
        <a
          href={`/apps/${tool.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:underline"
        >
          商品ページのプレビュー
        </a>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3 py-2 text-[12px] text-accent-danger">
          {error}
        </div>
      )}

      {showRejectForm ? (
        <div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="却下理由（出品者に表示されます）"
            className="mb-2 w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[12px] text-text-primary outline-none focus:border-border-strong"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={isRejecting}
              className="rounded-lg bg-accent-danger px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {isRejecting ? "処理中..." : "この理由で却下する"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-raised"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving}
            className="rounded-lg bg-accent-success px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {isApproving ? "処理中..." : "承認して公開"}
          </button>
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            className="rounded-lg border border-accent-danger/40 bg-bg px-4 py-2 text-[12px] font-medium text-accent-danger transition hover:bg-accent-danger/10"
          >
            却下する
          </button>
        </div>
      )}
    </div>
  );
}
