-- ============================================================
-- follows
-- ============================================================
-- ユーザー同士のフォロー関係。プロフィールページの「フォローする」
-- ボタンと、フォロワー数・フォロー数の表示に使う。
-- ============================================================

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows(following_id);
create index if not exists follows_follower_id_idx on public.follows(follower_id);

alter table public.follows enable row level security;

-- フォロワー数・フォロー中の数は誰でも見られる（プロフィールの公開情報の一部）
drop policy if exists "follows are viewable by everyone" on public.follows;
create policy "follows are viewable by everyone"
  on public.follows for select
  using (true);

-- 自分の意思としてのフォローだけを許可する
drop policy if exists "users can follow as themselves" on public.follows;
create policy "users can follow as themselves"
  on public.follows for insert
  with check (auth.uid() = follower_id);

-- 自分のフォローだけを解除できる
drop policy if exists "users can unfollow their own follows" on public.follows;
create policy "users can unfollow their own follows"
  on public.follows for delete
  using (auth.uid() = follower_id);

grant select, insert, delete on public.follows to authenticated;
grant select on public.follows to anon;
