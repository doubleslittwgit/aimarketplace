-- ============================================================
-- 不当な返金・チャージバックへの備え（購入後の利用記録・規約への同意）
-- ============================================================
-- デジタル商品は、返金されてもファイルやURLが購入者の手元に残る。
-- 返金の判断と、チャージバック（カード会社への申し立て）で「商品を受け取っていた」ことを
-- 示す証拠のために、有料で購入した商品を購入者がいつ受け取ったか（ダウンロード・利用・閲覧）を記録する。
--
-- 個人情報の扱い:
--   - 記録するのは有料の購入についてだけ（無料の取得は記録しない）
--   - IPアドレスとブラウザの種類（User-Agent）は、チャージバックの証拠として使うためだけに保存する
--   - 利用者本人を含め、APIからは誰も読めない（管理者権限の処理からだけ読み書きする）
--   - 退会時はIPアドレス・User-Agentを消す（受け取った日時の記録だけ残す）

create table if not exists public.purchase_access_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('download', 'open', 'course_view')),
  tool_id uuid references public.tools(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete cascade,
  course_purchase_id uuid references public.course_purchases(id) on delete cascade,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  check (purchase_id is not null or course_purchase_id is not null)
);
create index if not exists purchase_access_logs_purchase_idx
  on public.purchase_access_logs (purchase_id, created_at);
create index if not exists purchase_access_logs_course_purchase_idx
  on public.purchase_access_logs (course_purchase_id, created_at);
create index if not exists purchase_access_logs_user_idx
  on public.purchase_access_logs (user_id, created_at desc);

alter table public.purchase_access_logs enable row level security;
-- ポリシーは作らない（= anon / authenticated からは読み書きできない）
revoke all on public.purchase_access_logs from anon, authenticated;
grant select, insert, update, delete on public.purchase_access_logs to service_role;
comment on table public.purchase_access_logs is
  'Evidence of delivery for paid purchases (refund decisions / chargeback evidence). service_role only.';

-- 決済画面で利用規約（デジタルコンテンツのため原則返金不可）に同意した日時
alter table public.purchases add column if not exists terms_accepted_at timestamptz;
alter table public.course_purchases add column if not exists terms_accepted_at timestamptz;
alter table public.tips add column if not exists terms_accepted_at timestamptz;
