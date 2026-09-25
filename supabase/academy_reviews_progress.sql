-- ============================================================
-- BuildBay Academy: 講座のレビュー と 読んだ位置の記録
-- ============================================================

-- ------------------------------------------------------------
-- 1. 読んだ位置（講座ごと・本人だけが読み書きできる）
-- ------------------------------------------------------------
-- heading_index: 最後に読んでいた見出しの番号（目次の順番。見出しより前なら -1）
-- percent      : 最後に開いていた位置（本文の何%まで進んだか）
-- max_percent  : これまでに一番先まで読んだ位置（マイページの「◯%読了」に使う）
create table if not exists public.course_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  heading_index integer not null default -1 check (heading_index >= -1 and heading_index < 1000),
  percent smallint not null default 0 check (percent between 0 and 100),
  max_percent smallint not null default 0 check (max_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.course_progress enable row level security;

drop policy if exists "users can read own course progress" on public.course_progress;
create policy "users can read own course progress"
  on public.course_progress for select using (auth.uid() = user_id);

drop policy if exists "users can insert own course progress" on public.course_progress;
create policy "users can insert own course progress"
  on public.course_progress for insert with check (auth.uid() = user_id);

drop policy if exists "users can update own course progress" on public.course_progress;
create policy "users can update own course progress"
  on public.course_progress for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can delete own course progress" on public.course_progress;
create policy "users can delete own course progress"
  on public.course_progress for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.course_progress to authenticated;
grant select, insert, update, delete on public.course_progress to service_role;

-- ------------------------------------------------------------
-- 2. 講座のレビュー
-- ------------------------------------------------------------
-- 書けるのは:
--   有料講座 … 購入が完了している人
--   無料講座 … ログインしている人
-- のどちらかで、作者本人は自分の講座に書けない。公開中の講座に限る。
create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index if not exists course_reviews_course_idx on public.course_reviews (course_id, created_at desc);

create or replace function public.can_review_course(p_course_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id
      and c.status = 'published'
      and c.author_id <> p_user_id
      and (
        c.price = 0
        or exists (
          select 1 from public.course_purchases cp
          where cp.course_id = c.id and cp.buyer_id = p_user_id and cp.status = 'completed'
        )
      )
  );
$$;
revoke all on function public.can_review_course(uuid, uuid) from public;
grant execute on function public.can_review_course(uuid, uuid) to authenticated, service_role;

alter table public.course_reviews enable row level security;

drop policy if exists "course reviews are viewable on published courses" on public.course_reviews;
create policy "course reviews are viewable on published courses"
  on public.course_reviews for select using (
    auth.uid() = user_id
    or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  );

drop policy if exists "eligible users can write course reviews" on public.course_reviews;
create policy "eligible users can write course reviews"
  on public.course_reviews for insert
  with check (auth.uid() = user_id and public.can_review_course(course_id, auth.uid()));

drop policy if exists "users can update own course reviews" on public.course_reviews;
create policy "users can update own course reviews"
  on public.course_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.can_review_course(course_id, auth.uid()));

drop policy if exists "users can delete own course reviews" on public.course_reviews;
create policy "users can delete own course reviews"
  on public.course_reviews for delete using (auth.uid() = user_id);

grant select on public.course_reviews to anon;
grant select, insert, update, delete on public.course_reviews to authenticated;
grant select, insert, update, delete on public.course_reviews to service_role;

-- 講座ごとの平均と件数（見る人の権限で集計するので、公開中の講座の分しか数えない）
create or replace view public.course_rating_stats
with (security_invoker = true) as
  select course_id,
         round(avg(rating)::numeric, 2)::float8 as avg_rating,
         count(*)::int as review_count
  from public.course_reviews
  group by course_id;

grant select on public.course_rating_stats to anon, authenticated, service_role;
