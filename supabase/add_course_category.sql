-- ============================================================
-- courses.category（BuildBay Academy のカテゴリ）
-- ============================================================
-- 値は lib/academy/categories.ts の COURSE_CATEGORIES と一致させること。
-- 表示名は messages/*.json の academyHome.categories にある。
-- ============================================================
alter table public.courses add column if not exists category text
  check (category is null or category in ('beginner','productivity','product','webapp','automation','creative','monetize','ai-usage'));
create index if not exists courses_category_idx on public.courses (category) where status = 'published';
