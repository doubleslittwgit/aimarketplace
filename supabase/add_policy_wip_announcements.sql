-- ============================================================
-- refund_policy / is_wip / seller_announcements
-- ============================================================
-- refund_policy:
--   返金対応の方針を、出品者が商品ページに明示できるようにする。
--   返金の「報告窓口」は作ったが、買う前に「この出品者は返金に応じるのか」が
--   分からないままだったため。
--
-- is_wip:
--   完成前のツールを「開発中」として公開できるようにする。
--   興味を持った人がフォローして、完成を待てる。
--
-- seller_announcements:
--   出品者がフォロワー全員へ一斉にお知らせを送るためのもの。
--   フォロー機能はあったが、出品者から能動的に何かを届ける手段が無かった。
-- ============================================================

create type refund_policy_type as enum ('none', 'conditional', 'full');
alter table public.tools add column if not exists refund_policy refund_policy_type not null default 'none';

alter table public.tools add column if not exists is_wip boolean not null default false;

create table public.seller_announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index seller_announcements_author_idx on public.seller_announcements (author_id, created_at desc);

alter table public.seller_announcements enable row level security;

create policy "announcements are viewable by everyone"
  on public.seller_announcements for select using (true);

create policy "users can create own announcements"
  on public.seller_announcements for insert
  with check (auth.uid() = author_id);

grant select, insert on public.seller_announcements to authenticated;
grant select on public.seller_announcements to anon;
grant select, insert, update, delete on public.seller_announcements to service_role;
