import { parseInternetAccess } from "@/lib/internet-access";
import { parseToolLanguages } from "@/lib/tool-languages";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import SubmitClient, { type DraftInitialValues } from "./SubmitClient";
import { createClient } from "@/lib/supabase/server";

// Server Actionの実行時間上限。何も指定しないとVercelのデフォルト（10秒）に
// なってしまい、大きめのファイル受信＋AI審査＋Supabase Storageへの再アップロード＋
// DB保存を1回のリクエストの中で行うこの出品フォームでは、実測でタイムアウトして
// しまうケースが確認された（ブラウザ側では「ページが読み込めない」という
// クラッシュのような見え方になる）。余裕を持って60秒に設定する。
export const maxDuration = 60;

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft: draftId } = await searchParams;
  const t = await getTranslations("auth");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ログインしていない場合は、フォームを一切表示せず、
  // どの経路で来ても同じ「ログインが必要です」の案内を出す。
  if (!user) {
    const nextPath = draftId ? `/submit?draft=${encodeURIComponent(draftId)}` : "/submit";
    return (
      <>
        <Header />
        <main className="flex-1">
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-bg p-8 text-center shadow-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-ai-dim">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent-ai)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <h1 className="mb-1.5 font-display text-lg font-semibold text-text-primary">
                {t("loginRequiredTitle")}
              </h1>
              <p className="mb-6 text-[13px] text-text-secondary">
                {t("loginRequiredBodySubmit")}
              </p>

              <div className="flex flex-col gap-2">
                <Link
                  href={`/login?next=${encodeURIComponent(nextPath)}`}
                  className="w-full rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
                >
                  {t("login")}
                </Link>
                <Link
                  href={`/signup?next=${encodeURIComponent(nextPath)}`}
                  className="w-full rounded-lg border border-border py-2.5 text-[13px] font-medium text-text-secondary transition hover:bg-surface"
                >
                  {t("signup")}
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  let canReceivePayments = false;
  const { data } = await supabase.rpc("seller_can_receive_payments", {
    p_user_id: user.id,
  });
  canReceivePayments = Boolean(data);

  let initialDraft: DraftInitialValues | null = null;
  if (draftId) {
    const { data: draft } = await supabase
      .from("tools")
      .select(
        "id, author_id, status, name, tagline, description, category, categories, price, runtime, internet_access, ui_languages, platforms, min_os_version, thumbnail_url, gallery_urls, file_key"
      )
      .eq("id", draftId)
      .maybeSingle();

    // 他人の下書き・既に下書きでなくなったものは、静かに無視して
    // 通常の新規出品フォームとして表示する（存在自体は教えない）
    if (draft && draft.author_id === user.id && draft.status === "draft") {
      // ツールのURLは別テーブル（本人なら読める）から取り出す
      const { data: access } = await supabase
        .from("tool_access_urls")
        .select("url")
        .eq("tool_id", draft.id)
        .maybeSingle();
      initialDraft = {
        id: draft.id,
        name: draft.name,
        tagline: draft.tagline,
        description: draft.description,
        category: draft.category,
        categories: draft.categories?.length ? draft.categories : draft.category ? [draft.category] : [],
        price: draft.price,
        runtime: draft.runtime,
        platforms: draft.platforms ?? [],
        minOsVersion: draft.min_os_version,
        internetAccess: parseInternetAccess(draft.internet_access),
        uiLanguages: parseToolLanguages(draft.ui_languages),
        demoUrl: access?.url ?? null,
        thumbnailUrl: draft.thumbnail_url,
        galleryUrls: draft.gallery_urls ?? [],
        fileName: draft.file_key ? draft.file_key.split("/").pop() ?? null : null,
      };
    }
  }

  return (
    <>
      <Header />
      <SubmitClient canReceivePayments={canReceivePayments} initialDraft={initialDraft} />
    </>
  );
}
