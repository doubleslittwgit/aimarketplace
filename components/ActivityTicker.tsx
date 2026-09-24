import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * トップページ上部の「最近のアクティビティ」。
 *
 * 以前は架空の購入者・金額を並べたデモ表示だったが、景品表示法（有利誤認・優良誤認）の
 * リスクがあるため、DBにある実際の出来事だけを表示する。
 *
 * - 公開: 公開中のツール・講座（出品者名つき。出品者は公開プロフィールなので問題ない）
 * - 更新: 公開中ツールのバージョン履歴
 * - 購入: 「購入された」という事実のみ。購入者が誰かも金額も出さない（プライバシー配慮）
 *
 * 出来事が少なすぎるとかえって寂しく見えるため、MIN_EVENTS 未満なら何も表示しない。
 */

const MAX_EVENTS = 12;
const MIN_EVENTS = 3;
const FETCH_EACH = 8;

type ActivityEvent =
  | { kind: "published"; at: string; by: string; title: string }
  | { kind: "coursePublished"; at: string; by: string; title: string }
  | { kind: "updated"; at: string; title: string; version: string }
  | { kind: "purchased"; at: string; title: string; free: boolean }
  | { kind: "coursePurchased"; at: string; title: string };

type Named = { display_name: string | null } | null;

async function loadEvents(unnamed: string): Promise<ActivityEvent[]> {
  const supabase = await createClient();

  // 購入テーブルはRLSで本人しか読めないため、ツール名と日時だけを管理者クライアントで取得する
  // （購入者IDなどの個人に紐づく列は一切selectしない）
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  const [toolsRes, coursesRes, versionsRes, purchasesRes, coursePurchasesRes] = await Promise.all([
    supabase
      .from("tools")
      .select("name, created_at, profiles:author_id(display_name)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(FETCH_EACH),
    supabase
      .from("courses")
      .select("title, published_at, profiles:author_id(display_name)")
      .eq("status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(FETCH_EACH),
    supabase
      .from("tool_versions")
      .select("version, created_at, tools!inner(name, status)")
      .eq("tools.status", "published")
      .order("created_at", { ascending: false })
      .limit(FETCH_EACH),
    admin
      ? admin
          .from("purchases")
          .select("price_paid, created_at, tools!inner(name, status)")
          .eq("status", "completed")
          .eq("tools.status", "published")
          .order("created_at", { ascending: false })
          .limit(FETCH_EACH)
      : Promise.resolve({ data: null }),
    admin
      ? admin
          .from("course_purchases")
          .select("created_at, courses!inner(title, status)")
          .eq("status", "completed")
          .eq("courses.status", "published")
          .order("created_at", { ascending: false })
          .limit(FETCH_EACH)
      : Promise.resolve({ data: null }),
  ]);

  const events: ActivityEvent[] = [];

  for (const r of toolsRes.data ?? []) {
    const p = r.profiles as unknown as Named;
    events.push({ kind: "published", at: r.created_at, by: p?.display_name || unnamed, title: r.name });
  }
  for (const r of coursesRes.data ?? []) {
    const p = r.profiles as unknown as Named;
    if (!r.published_at || !r.title) continue;
    events.push({ kind: "coursePublished", at: r.published_at, by: p?.display_name || unnamed, title: r.title });
  }
  for (const r of versionsRes.data ?? []) {
    const tool = r.tools as unknown as { name: string } | null;
    if (!tool) continue;
    events.push({ kind: "updated", at: r.created_at, title: tool.name, version: r.version });
  }
  for (const r of (purchasesRes.data ?? []) as { price_paid: number; created_at: string; tools: unknown }[]) {
    const tool = r.tools as { name: string } | null;
    if (!tool) continue;
    events.push({ kind: "purchased", at: r.created_at, title: tool.name, free: r.price_paid === 0 });
  }
  for (const r of (coursePurchasesRes.data ?? []) as { created_at: string; courses: unknown }[]) {
    const course = r.courses as { title: string } | null;
    if (!course) continue;
    events.push({ kind: "coursePurchased", at: r.created_at, title: course.title });
  }

  return events
    .filter((e) => !Number.isNaN(Date.parse(e.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_EVENTS);
}

function relativeTime(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffSec = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60) || -1, "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

const DOT: Record<ActivityEvent["kind"], string> = {
  purchased: "bg-accent-signal",
  coursePurchased: "bg-accent-signal",
  updated: "bg-accent-ai",
  published: "bg-accent-success",
  coursePublished: "bg-accent-success",
};

export default async function ActivityTicker() {
  const t = await getTranslations("activity");
  const tCommon = await getTranslations("common");
  const locale = await getLocale();
  const intlLocale = ({ ja: "ja-JP", zh: "zh-TW", en: "en-US" } as Record<string, string>)[locale] ?? "ja-JP";

  let events: ActivityEvent[] = [];
  try {
    events = await loadEvents(tCommon("unnamedDeveloper"));
  } catch {
    events = [];
  }
  if (events.length < MIN_EVENTS) return null;

  const text = (e: ActivityEvent) => {
    switch (e.kind) {
      case "published":
        return t("published", { by: e.by, tool: e.title });
      case "coursePublished":
        return t("coursePublished", { by: e.by, course: e.title });
      case "updated":
        return t("updated", { tool: e.title, version: e.version });
      case "purchased":
        return e.free ? t("downloaded", { tool: e.title }) : t("purchased", { tool: e.title });
      case "coursePurchased":
        return t("coursePurchased", { course: e.title });
    }
  };

  const line = [...events, ...events]; // 途切れなくループさせるため2周分並べる
  // 件数に応じて流れる速さをそろえる（1件あたり約5秒）
  const duration = `${Math.max(24, events.length * 5)}s`;

  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/60 py-2.5">
      <div className="flex w-max gap-8" style={{ animation: `ticker ${duration} linear infinite` }}>
        {line.map((e, i) => (
          <span
            key={i}
            aria-hidden={i >= events.length}
            className="flex shrink-0 items-center gap-2 font-mono text-[12px] text-text-muted"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${DOT[e.kind]}`} />
            <span className="text-text-primary">{text(e)}</span>
            <span className="text-text-dim">· {relativeTime(e.at, intlLocale)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
