-- ============================================================
-- BuildBay Academy：講座（courses / course_bodies / course_tool_links）
-- ============================================================
-- courses（誰でも読める・公開中のもの）
--   タイトル・価格・サムネイル・「有料ラインより上の無料部分」・目次だけを置く。
--   有料部分の本文は絶対にここへ置かない（公開鍵で直接読めてしまうため。
--   クラウド型ツールのURLで見つかったのと同じ種類の問題を、最初から避ける）。
-- course_bodies（金庫）
--   有料部分を含む全文。読めるのは作者と、無料で公開中の講座のみ。
--   購入者を読めるようにする条件は、購入機能を作る段階で追加する。
-- course_tool_links
--   講座と「作者自身の」ツールの紐付け。他人のツールには紐付けられない。
-- protect_course_status
--   作者が自分で「公開」にして審査を飛ばせないようにする（公開は管理者権限のみ）。
-- 検証済み：作者の自己公開は拒否、他人から有料講座の全文は0件、一覧情報は表示。
-- ============================================================

create type course_status as enum ('draft', 'pending_review', 'published', 'suspended', 'rejected');

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  thumbnail_url text,
  price integer not null default 0 check (price >= 0 and price <= 100000),
  status course_status not null default 'draft',
  rejection_reason text,
  free_content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  toc jsonb not null default '[]'::jsonb,
  has_paid_part boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index courses_status_idx on public.courses (status, published_at desc);
create index courses_author_idx on public.courses (author_id);

alter table public.courses enable row level security;
create policy "published courses are viewable by everyone"
  on public.courses for select using (status = 'published' or auth.uid() = author_id);
create policy "authors can insert own courses"
  on public.courses for insert with check (auth.uid() = author_id);
create policy "authors can update own courses"
  on public.courses for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "authors can delete own courses"
  on public.courses for delete using (auth.uid() = author_id);

create table public.course_bodies (
  course_id uuid primary key references public.courses(id) on delete cascade,
  content jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.course_bodies enable row level security;
create policy "course body readable by author or free published"
  on public.course_bodies for select using (
    exists (select 1 from public.courses c where c.id = course_id
      and (c.author_id = auth.uid() or (c.price = 0 and c.status = 'published'))));
create policy "author can insert course body"
  on public.course_bodies for insert with check (
    exists (select 1 from public.courses c where c.id = course_id and c.author_id = auth.uid()));
create policy "author can update course body"
  on public.course_bodies for update
  using (exists (select 1 from public.courses c where c.id = course_id and c.author_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.author_id = auth.uid()));

create table public.course_tool_links (
  course_id uuid not null references public.courses(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  primary key (course_id, tool_id)
);
alter table public.course_tool_links enable row level security;
create policy "course tool links are viewable by everyone"
  on public.course_tool_links for select using (true);
create policy "author can link own course to own tool"
  on public.course_tool_links for insert with check (
    exists (select 1 from public.courses c where c.id = course_id and c.author_id = auth.uid())
    and exists (select 1 from public.tools t where t.id = tool_id and t.author_id = auth.uid()));
create policy "author can unlink own course"
  on public.course_tool_links for delete using (
    exists (select 1 from public.courses c where c.id = course_id and c.author_id = auth.uid()));

create or replace function public.protect_course_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') then
      raise exception '講座の公開状態は直接指定できません';
    end if;
    new.rejection_reason := null;
    new.published_at := null;
    return new;
  end if;
  if new.status is distinct from old.status and not (
       new.status in ('draft', 'pending_review')
       or (old.status = 'published' and new.status = 'suspended')
       or (old.status = 'suspended' and new.status = 'published')
     ) then
    raise exception '講座の公開状態は直接変更できません';
  end if;
  new.rejection_reason := old.rejection_reason;
  new.published_at := old.published_at;
  new.author_id := old.author_id;
  return new;
end; $$;
create trigger courses_protect_status before insert or update on public.courses
  for each row execute function public.protect_course_status();

grant select, insert, update, delete on public.courses to authenticated;
grant select on public.courses to anon;
grant select, insert, update on public.course_bodies to authenticated;
grant select on public.course_bodies to anon;
grant select, insert, delete on public.course_tool_links to authenticated;
grant select on public.course_tool_links to anon;
grant select, insert, update, delete on public.courses, public.course_bodies, public.course_tool_links to service_role;
