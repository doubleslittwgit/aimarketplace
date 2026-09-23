-- ============================================================
-- tool_notes / tips
-- ============================================================
-- tool_notes:
--   「使い方のコツ」投稿。レビュー（評価）とは別枠で、
--   実際に使った人が使いこなしのノウハウを書き残せる場所。
--
-- tips:
--   出品者へのチップ（投げ銭）。無料ツールを出した人には
--   一円も入らず、感謝を伝える手段も無かったため。
--   金額の確定はStripeのWebhook側で行うので、insertは
--   service_role からのみ（ユーザーが直接作れないようにする）。
-- ============================================================

create table public.tool_notes (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index tool_notes_tool_idx on public.tool_notes (tool_id, created_at desc);

alter table public.tool_notes enable row level security;

create policy "tool notes are viewable by everyone"
  on public.tool_notes for select using (true);

create policy "users can add own tool notes"
  on public.tool_notes for insert with check (auth.uid() = author_id);

create policy "users can delete own tool notes"
  on public.tool_notes for delete using (auth.uid() = author_id);

grant select, insert, delete on public.tool_notes to authenticated;
grant select on public.tool_notes to anon;
grant select, insert, update, delete on public.tool_notes to service_role;

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid references public.tools(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  tipper_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  platform_fee integer not null default 0,
  seller_earnings integer not null default 0,
  stripe_payment_intent_id text unique,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index tips_seller_idx on public.tips (seller_id, created_at desc);

alter table public.tips enable row level security;

create policy "tippers and sellers can view own tips"
  on public.tips for select
  using (auth.uid() = tipper_id or auth.uid() = seller_id);

grant select on public.tips to authenticated;
grant select, insert, update, delete on public.tips to service_role;
