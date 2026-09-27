-- ============================================================
-- 回数制限（連打・自動化による悪用の防止）
-- ============================================================
-- 「このキーで直近◯分間に何回行ったか」を数えるだけの単純な表。
-- 使っている場所（lib/throttle.ts）:
--   - AI検索（1人あたりの回数。AnthropicのAPI料金が膨らむのを防ぐ）
--   - フォロー通知（フォロー・解除を繰り返してメールを大量に送りつけるのを防ぐ）
-- 管理者権限の処理からだけ読み書きする（APIからは誰も触れない）。
-- 古い行は、書き込みのついでに少しずつ消す。

create table if not exists public.action_throttle (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists action_throttle_key_created_idx on public.action_throttle (key, created_at desc);
alter table public.action_throttle enable row level security;
revoke all on public.action_throttle from anon, authenticated;
grant select, insert, delete on public.action_throttle to service_role;
comment on table public.action_throttle is 'Simple per-key rate limiting (AI search, follow notifications). service_role only.';
