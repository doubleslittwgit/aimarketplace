-- ============================================================
-- refund_requests
-- ============================================================
-- 買い手が「説明と大きく異なる」「重大な不具合」等を報告できる、
-- アプリ内の返金・トラブル報告窓口。特商法ページに書いている
-- 「購入から14日以内にご連絡ください」を、メールでの個別連絡だけでなく
-- アプリの中からも申告できるようにするためのもの。
-- ============================================================

create type refund_request_status as enum ('pending', 'resolved', 'dismissed');

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  status refund_request_status not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- 同じ購入について、対応中の申告を二重に出せないようにする
  unique (purchase_id)
);

create index refund_requests_status_idx on public.refund_requests (status);

alter table public.refund_requests enable row level security;

create policy "buyers can view own refund requests"
  on public.refund_requests for select
  using (auth.uid() = buyer_id);

create policy "buyers can create own refund requests"
  on public.refund_requests for insert
  with check (auth.uid() = buyer_id);

grant select, insert on public.refund_requests to authenticated;
grant select, insert, update, delete on public.refund_requests to service_role;
