-- ============================================================
-- notifications: アプリ内通知
-- ============================================================
-- 「審査が通った」「売れた」「受け取り設定の状況が変わった」等を
-- 通知ベルに表示するためのテーブル。
--
-- 書き込みは意図的に service_role のみに限定している。
-- 他人（例: 出品者）に通知を作るのは常に「自分以外の誰かの行に
-- insert する」操作になるため、authenticated 向けの単純な
-- RLS（auth.uid() = user_id）では対応できない。
-- 通知の作成は必ず lib/notifications/create.ts（管理者権限）を
-- 経由させることで、「誰が誰に何を通知したか」を
-- サーバー側のロジックだけが決められるようにしている。
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_all_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- 閲覧は本人の通知だけ
drop policy if exists "users can view own notifications" on public.notifications;
create policy "users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- 既読にする（read_at の更新）だけは本人に許可する。
-- それ以外の列（title/body/link_url等）まで書き換えられると困るので、
-- 更新できる列は WITH CHECK 側でも同じ行に限定し、
-- 内容の改ざんはアプリのロジック（read_atしか更新しない）に委ねる。
drop policy if exists "users can mark own notifications read" on public.notifications;
create policy "users can mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- GRANT
-- ------------------------------------------------------------
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
