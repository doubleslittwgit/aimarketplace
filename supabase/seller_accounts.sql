-- ============================================================
-- seller_accounts: Stripe Connect（Express）の連結アカウント情報
-- ============================================================
-- 本番DBには直接 apply_migration で適用済みだったが、環境再構築用の
-- ソースとしてこのリポジトリに欠けていたため、実際の本番の定義に
-- 合わせて書き起こしたもの。（docs/stripe-connect-plan.md も参照）
--
-- なぜ profiles に列を足さず、専用テーブルに分離しているか:
--   grants.sql が profiles テーブル全体への update を authenticated に
--   許可しているため、ここに「受取可能かどうか」の列を足すと、
--   ログイン中のユーザーが自分の行を書き換えて
--   「Stripeの審査を通さずに自分を受取可能状態にする」ことが
--   可能になってしまう。そのためこのテーブルは
--   authenticated には SELECT しか許可せず、書き込みは
--   service_role（Webhook・サーバーアクション）だけが行う。
-- ============================================================

create table if not exists public.seller_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text not null unique,

  -- destination charge を on_behalf_of なしで行う構成のため、
  -- 出品者は「決済を受け付ける側」ではなく「資金の受取人」になる。
  -- charges_enabled は false のままが正常であり、販売可否の判定には使わない。
  -- 実際の判断には transfers_enabled と payouts_enabled を使う
  -- （lib/stripe/seller-account.ts, app/seller/page.tsx を参照）。
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  transfers_enabled boolean not null default false,
  details_submitted boolean not null default false,

  -- Stripeが「あと何が必要か」を返す項目名の配列（例: individual.dob.day）
  requirements_due text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_accounts enable row level security;

-- 自分の登録状況だけ読める。書き込みポリシーは意図的に設定しない
-- （service_role はRLSを無視するため、書き込みは
--  lib/stripe/seller-account.ts の syncSellerAccount 経由のみになる）。
drop policy if exists "users can view own seller account" on public.seller_accounts;
create policy "users can view own seller account"
  on public.seller_accounts for select
  using (auth.uid() = user_id);

-- schema.sql の profiles/tools と同じ touch_updated_at() を再利用する
drop trigger if exists seller_accounts_touch_updated_at on public.seller_accounts;
create trigger seller_accounts_touch_updated_at
  before update on public.seller_accounts
  for each row execute function public.touch_updated_at();


-- ------------------------------------------------------------
-- GRANT
-- ------------------------------------------------------------
-- 閲覧: 本人のみ（RLSで絞られる）。書き込みはservice_roleのみ。
grant select on public.seller_accounts to authenticated;
grant select, insert, update, delete on public.seller_accounts to service_role;
