-- ============================================================
-- tool_reports: 問題のある出品の通報
-- ============================================================
-- 匿名の通報は受け付けない（本人確認が取れないと荒らしの温床になるため）。
-- ログイン済みユーザーが、理由を選んで通報する形にする。
-- 同じ人が同じツールを何度も通報してカウントを盛れないよう、
-- (tool_id, reporter_id) を一意にする。
-- ============================================================

create table if not exists public.tool_reports (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  detail text,
  status text not null default 'open', -- open | reviewed | dismissed
  created_at timestamptz not null default now(),
  unique (tool_id, reporter_id)
);

create index if not exists tool_reports_status_idx on public.tool_reports (status, created_at desc);

alter table public.tool_reports enable row level security;

-- 通報した本人は、自分が通報したという事実だけ確認できる
-- （他人の通報内容までは見せない）
drop policy if exists "users can view own reports" on public.tool_reports;
create policy "users can view own reports"
  on public.tool_reports for select
  using (auth.uid() = reporter_id);

-- 通報は自分名義でのみ作成できる
drop policy if exists "users can insert own reports" on public.tool_reports;
create policy "users can insert own reports"
  on public.tool_reports for insert
  with check (auth.uid() = reporter_id);

grant select, insert on public.tool_reports to authenticated;
grant select, insert, update, delete on public.tool_reports to service_role;
