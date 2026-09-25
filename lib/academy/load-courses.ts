import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CourseCardData } from "@/components/academy/CourseCard";
import type { CourseCategory } from "@/lib/academy/categories";
import type { JSONNode, TocItem } from "@/lib/course-content";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  price: number;
  toc: TocItem[] | null;
  free_content: JSONNode | null;
  author_id: string;
  category: string | null;
  profiles: { display_name: string | null; handle: string | null } | null;
};

export type LoadedCourse = CourseCardData & { id: string };

function countH2(doc: JSONNode | null): number {
  return (doc?.content ?? []).filter((b) => b.type === "heading" && b.attrs?.level !== 3).length;
}

/**
 * 公開中の講座を取得し、カード表示用の形に整える（Academyトップ・プロフィールで共通）。
 * 「本人確認済み」の判定元（seller_accounts）は非公開なので、管理者権限で
 * 真偽だけを取り出す（口座情報などは一切画面に渡さない）。
 */
export async function loadCourses(filter: {
  q?: string;
  category?: CourseCategory;
  authorId?: string;
  ids?: string[];
  limit?: number;
}): Promise<LoadedCourse[]> {
  const supabase = await createClient();
  let query = supabase
    .from("courses")
    .select(
      "id, slug, title, thumbnail_url, price, toc, free_content, author_id, category, profiles:author_id(display_name, handle)"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(filter.limit ?? 40);

  if (filter.q) {
    // 検索語に含まれるワイルドカード記号は、ただの文字として扱う
    const safe = filter.q.replace(/[%_\\]/g, "").slice(0, 50);
    if (safe) query = query.ilike("title", `%${safe}%`);
  }
  if (filter.category) query = query.eq("category", filter.category);
  if (filter.authorId) query = query.eq("author_id", filter.authorId);
  if (filter.ids) {
    if (filter.ids.length === 0) return [];
    query = query.in("id", filter.ids);
  }

  const { data } = await query;
  const rows = (data ?? []) as unknown as CourseRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));

  const [{ data: links }, { data: accounts }, { data: ratings }, { data: stock }] = await Promise.all([
    supabase.from("course_tool_links").select("course_id").in("course_id", ids),
    createAdminClient()
      .from("seller_accounts")
      .select("user_id, transfers_enabled, payouts_enabled")
      .in("user_id", authorIds),
    supabase.from("course_rating_stats").select("course_id, avg_rating, review_count").in("course_id", ids),
    supabase.rpc("course_stock", { p_ids: ids }),
  ]);
  const remainingById = new Map(
    ((stock ?? []) as { course_id: string; remaining: number }[]).map((s) => [s.course_id, s.remaining])
  );
  const makerIds = new Set((links ?? []).map((l) => l.course_id));
  const verifiedIds = new Set(
    (accounts ?? []).filter((a) => a.transfers_enabled && a.payouts_enabled).map((a) => a.user_id)
  );
  const ratingById = new Map(
    (ratings ?? []).map((r) => [r.course_id as string, { avg: Number(r.avg_rating), count: Number(r.review_count) }])
  );

  return rows.map((r) => {
    const toc = r.toc ?? [];
    const h2 = toc.filter((x) => x.level === 2).length;
    const rating = ratingById.get(r.id);
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      price: r.price,
      authorName: r.profiles?.display_name || r.profiles?.handle || "—",
      verified: verifiedIds.has(r.author_id),
      byMaker: makerIds.has(r.id),
      chapters: h2 || toc.length,
      freeChapters: countH2(r.free_content),
      hasPaywall: (r.free_content?.content ?? []).length > 0,
      ratingAvg: rating?.avg ?? null,
      ratingCount: rating?.count ?? 0,
      remaining: remainingById.get(r.id) ?? null,
    };
  });
}

/** 「評価の高い講座」に出す最小のレビュー件数 */
const MIN_REVIEWS_FOR_TOP = 1;
/** これより平均が低い講座は「評価の高い講座」に出さない */
const MIN_AVG_FOR_TOP = 3.5;
/** 件数の少ない講座が満点1件だけで上位を独占しないよう、平均を全体の平均へ引き寄せる強さ */
const PRIOR_WEIGHT = 3;

/**
 * レビュー評価の高い公開講座を返す。
 * 平均点だけで並べると「★5が1件」の講座が常に1位になるため、
 * 件数が少ないほど全体の平均に近づける（ベイズ平均）で順位を付ける。
 */
export async function loadTopRatedCourses(limit = 5): Promise<LoadedCourse[]> {
  const supabase = await createClient();
  // ビューは見る人の権限で集計されるため、公開中の講座のレビューだけが数えられる
  const { data } = await supabase.from("course_rating_stats").select("course_id, avg_rating, review_count");
  const rows = (data ?? []).map((r) => ({
    id: r.course_id as string,
    avg: Number(r.avg_rating),
    count: Number(r.review_count),
  }));
  const eligible = rows.filter((r) => r.count >= MIN_REVIEWS_FOR_TOP && r.avg >= MIN_AVG_FOR_TOP);
  if (eligible.length === 0) return [];

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const globalMean = totalCount > 0 ? rows.reduce((s, r) => s + r.avg * r.count, 0) / totalCount : 3;
  const score = (r: { avg: number; count: number }) =>
    (PRIOR_WEIGHT * globalMean + r.avg * r.count) / (PRIOR_WEIGHT + r.count);

  const ranked = eligible.sort((a, b) => score(b) - score(a) || b.count - a.count).slice(0, limit);
  const courses = await loadCourses({ ids: ranked.map((r) => r.id), limit });
  const order = new Map(ranked.map((r, i) => [r.id, i]));
  return courses.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
