-- ============================================================
-- posts / post_likes / post_comments / post_reports
-- ============================================================
-- 「マーケットプレイス + ソーシャル」の第一歩として、文章と画像だけの
-- 軽量な投稿フィードを追加する。
--
-- モデレーション方針: 即時公開（事前審査なし）＋通報制。
-- 理由: 文章の投稿は内容の善し悪しが一瞬で判断できるものが大半であり、
-- 出品ツールの審査（コード内の危険な挙動チェック）ほどの精査は不要と
-- 判断したため。危険な投稿は post_reports 経由で事後対応する。
-- ============================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  image_urls text[] not null default '{}',
  -- ビルドログ機能: 出品者が「このツールを作った過程」として投稿する場合、
  -- 自分の（公開中の）ツールを1つだけ紐付けられる。他人のツールは選べない
  -- （選択肢の絞り込みはアプリ側で行い、ここではnullを許容するだけ）。
  tool_id uuid references public.tools(id) on delete set null,
  view_count integer not null default 0,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists posts_tool_id_idx on public.posts(tool_id);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_author_id_idx on public.posts(author_id);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_idx on public.post_comments(post_id);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reports enable row level security;

drop policy if exists "posts are viewable by everyone" on public.posts;
create policy "posts are viewable by everyone"
  on public.posts for select using (true);

drop policy if exists "users can create their own posts" on public.posts;
create policy "users can create their own posts"
  on public.posts for insert with check (auth.uid() = author_id);

drop policy if exists "users can delete their own posts" on public.posts;
create policy "users can delete their own posts"
  on public.posts for delete using (auth.uid() = author_id);

drop policy if exists "post likes are viewable by everyone" on public.post_likes;
create policy "post likes are viewable by everyone"
  on public.post_likes for select using (true);

drop policy if exists "users can like as themselves" on public.post_likes;
create policy "users can like as themselves"
  on public.post_likes for insert with check (auth.uid() = user_id);

drop policy if exists "users can unlike their own likes" on public.post_likes;
create policy "users can unlike their own likes"
  on public.post_likes for delete using (auth.uid() = user_id);

drop policy if exists "post comments are viewable by everyone" on public.post_comments;
create policy "post comments are viewable by everyone"
  on public.post_comments for select using (true);

drop policy if exists "users can comment as themselves" on public.post_comments;
create policy "users can comment as themselves"
  on public.post_comments for insert with check (auth.uid() = author_id);

drop policy if exists "users can delete their own comments" on public.post_comments;
create policy "users can delete their own comments"
  on public.post_comments for delete using (auth.uid() = author_id);

-- 通報は本人のみ作成可（一覧の閲覧は管理者のみ、admin_reports参照時と同様
-- service_role/管理者判定を伴うクエリから読む想定）
drop policy if exists "users can report as themselves" on public.post_reports;
create policy "users can report as themselves"
  on public.post_reports for insert with check (auth.uid() = reporter_id);

grant select, insert, delete on public.posts to authenticated;
grant select on public.posts to anon;
grant select, insert, delete on public.post_likes to authenticated;
grant select on public.post_likes to anon;
grant select, insert, delete on public.post_comments to authenticated;
grant select on public.post_comments to anon;
grant insert on public.post_reports to authenticated;

-- ------------------------------------------------------------
-- いいね・コメントの増減を件数カラムに反映するトリガー
-- （毎回集計クエリを投げずに済むよう非正規化しておく）
-- ------------------------------------------------------------
create or replace function public.handle_post_like_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_like_change on public.post_likes;
create trigger post_like_change
  after insert or delete on public.post_likes
  for each row execute function public.handle_post_like_change();

create or replace function public.handle_post_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_comment_change on public.post_comments;
create trigger post_comment_change
  after insert or delete on public.post_comments
  for each row execute function public.handle_post_comment_change();

-- 投稿の閲覧数（フィード上での表示回数）を1件増やす
create or replace function public.increment_post_view_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set view_count = view_count + 1 where id = p_post_id;
end;
$$;

grant execute on function public.increment_post_view_count(uuid) to anon, authenticated;
