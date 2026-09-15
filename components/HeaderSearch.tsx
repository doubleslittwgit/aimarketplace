"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * ヘッダーの検索欄。
 * Headerはサーバーコンポーネントなので、状態を持つこの部分だけを分離している。
 * 送信すると /browse?q=... に遷移し、BrowseClientが初期クエリとして拾う。
 */
export default function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  const [value, setValue] = useState(urlQuery);
  // URL側が変わったときだけ入力欄を追随させる（レンダー中の状態調整）。
  // useEffectで同期すると余計な再レンダーが連鎖するため、この形をとる。
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setValue(urlQuery);
  }

  function submit() {
    const q = value.trim();
    router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-muted transition focus-within:border-border-strong">
      <button
        type="button"
        onClick={submit}
        aria-label="検索"
        className="shrink-0 transition hover:text-text-secondary"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="ツールを検索... 例: 請求書 自動化"
        aria-label="ツールを検索"
        className="w-full bg-transparent font-mono text-[13px] text-text-primary outline-none placeholder:text-text-dim"
      />
    </div>
  );
}
