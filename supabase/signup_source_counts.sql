-- 新規登録がどこから来たか（Threads など）を、日ごとの件数だけで数える。
-- 誰がどこから来たかは保存しない（集計のみ）。重複して数えないよう、数えたユーザーIDだけ記録する。
-- 書き込みはサーバーの管理用クライアント（service_role）だけ。app/actions/signup-source.ts から呼ぶ。
create table if not exists public.signup_source_counts (
  day date not null,
  source text not null,
  count integer not null default 0,
  primary key (day, source)
);
create table if not exists public.signup_source_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.signup_source_counts enable row level security;
alter table public.signup_source_claims enable row level security;
-- ポリシーは作らない（サーバーの管理用クライアントだけが読み書きする）

create or replace function public.claim_signup_source(p_user_id uuid, p_source text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted uuid;
  v_source text := lower(coalesce(nullif(trim(p_source), ''), 'direct'));
begin
  if v_source !~ '^[a-z0-9._-]{1,32}$' then
    v_source := 'other';
  end if;
  insert into public.signup_source_claims (user_id) values (p_user_id)
  on conflict (user_id) do nothing
  returning user_id into v_inserted;
  if v_inserted is null then
    return false;
  end if;
  insert into public.signup_source_counts (day, source, count)
  values ((now() at time zone 'Asia/Tokyo')::date, v_source, 1)
  on conflict (day, source) do update set count = public.signup_source_counts.count + 1;
  return true;
end;
$$;
revoke all on function public.claim_signup_source(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_signup_source(uuid, text) to service_role;
