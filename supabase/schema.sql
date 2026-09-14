-- ============================================================
-- AIマーケットプレイス データベーススキーマ
-- ============================================================
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて実行
--
-- 設計方針:
--   1. 全テーブルでRLS（Row Level Security）を有効化する
--   2. 「デフォルト拒否」を原則とし、必要な権限だけを明示的に許可
--   3. 金額・売上などの機微な情報は本人しか読めないようにする
-- ============================================================


-- ============================================================
-- 1. profiles: ユーザープロフィール
-- ============================================================
-- Supabase Authのauth.usersと1対1で対応する公開プロフィール。
-- auth.usersにはメールアドレス等が入るため直接公開せず、
-- 表示用の情報だけをこのテーブルに持つ。
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  -- 出品者としての本人確認ステータス（Stripe Identity連携時に使用）
  is_verified_seller boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- プロフィールは全員が閲覧可能（出品者名を表示するため）
drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- 自分のプロフィールだけ作成できる
drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 自分のプロフィールだけ更新できる
drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ============================================================
-- 2. tools: 出品されたツール
-- ============================================================
do $$ begin
  create type tool_runtime as enum ('cloud', 'local');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tool_status as enum ('draft', 'pending_review', 'published', 'suspended');
exception when duplicate_object then null; end $$;

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  author_id uuid not null references public.profiles(id) on delete cascade,

  name text not null,
  tagline text not null,
  description text not null,
  category text not null,
  tags text[] not null default '{}',

  -- 価格は「円」単位の整数。0 = 無料
  price integer not null default 0 check (price >= 0),

  runtime tool_runtime not null,
  -- ローカル実行の場合の対応OS（例: {'Windows','macOS'}）
  platforms text[] not null default '{}',
  min_os_version text,

  version text not null default '1.0.0',
  -- ファイルの保管先キー（Cloudflare R2 / Supabase Storage のパス）
  file_key text,
  file_size_bytes bigint,
  -- クラウド型の場合のデモURL
  demo_url text,

  status tool_status not null default 'draft',
  -- ウイルススキャン結果（VirusTotal連携時に使用）
  scan_passed boolean not null default false,

  install_count integer not null default 0,
  like_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tools_author_idx   on public.tools(author_id);
create index if not exists tools_status_idx   on public.tools(status);
create index if not exists tools_category_idx on public.tools(category);

alter table public.tools enable row level security;

-- 公開済みのツールは誰でも閲覧できる。
-- 下書き・審査中・停止中のものは、作者本人と、既に購入済みの人だけが見られる。
-- （購入済みの人まで含めるのは、出品者が後から非公開にしても
-- 　既に買った人がダウンロードできなくならないようにするため）
drop policy if exists "published tools are viewable by everyone" on public.tools;
create policy "published tools are viewable by everyone"
  on public.tools for select
  using (
    status = 'published'
    or auth.uid() = author_id
    or exists (
      select 1 from public.purchases p
      where p.tool_id = tools.id
        and p.buyer_id = auth.uid()
        and p.status = 'completed'
    )
  );

-- ログイン済みユーザーは、自分を作者としてのみ出品できる
drop policy if exists "users can insert own tools" on public.tools;
create policy "users can insert own tools"
  on public.tools for insert
  with check (auth.uid() = author_id);

-- 自分のツールだけ更新できる
drop policy if exists "users can update own tools" on public.tools;
create policy "users can update own tools"
  on public.tools for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- 自分のツールだけ削除できる
drop policy if exists "users can delete own tools" on public.tools;
create policy "users can delete own tools"
  on public.tools for delete
  using (auth.uid() = author_id);


-- ============================================================
-- 3. purchases: 購入履歴
-- ============================================================
-- 重要: このテーブルはクライアントからの書き込みを一切許可しない。
--       購入レコードはStripeのWebhookを受けたサーバー側だけが作成する。
--       （そうしないと「お金を払わずに購入済みにする」不正が可能になる）
do $$ begin
  create type purchase_status as enum ('pending', 'completed', 'refunded', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,

  -- 購入時点の価格を記録する（後から値上げされても履歴は変わらない）
  price_paid integer not null check (price_paid >= 0),
  platform_fee integer not null check (platform_fee >= 0),
  seller_earnings integer not null check (seller_earnings >= 0),

  stripe_payment_intent_id text unique,
  status purchase_status not null default 'pending',

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists purchases_buyer_idx  on public.purchases(buyer_id);
create index if not exists purchases_seller_idx on public.purchases(seller_id);
create index if not exists purchases_tool_idx   on public.purchases(tool_id);

alter table public.purchases enable row level security;

-- 購入履歴は「買った本人」と「売った本人」だけが見られる。
-- 他人の購入履歴・売上は一切見えない。
drop policy if exists "buyers and sellers can view own purchases" on public.purchases;
create policy "buyers and sellers can view own purchases"
  on public.purchases for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- INSERT / UPDATE / DELETE のポリシーは意図的に作成しない。
-- → RLS有効かつポリシー無しなので、クライアントからは書き込めない。
-- → サーバー側（service_roleキー使用）のみが書き込める。


-- ============================================================
-- 4. reviews: レビュー
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- 同じツールに同じ人が複数レビューを書けないようにする
  unique (tool_id, author_id)
);

create index if not exists reviews_tool_idx on public.reviews(tool_id);

alter table public.reviews enable row level security;

-- レビューは誰でも読める
drop policy if exists "reviews are viewable by everyone" on public.reviews;
create policy "reviews are viewable by everyone"
  on public.reviews for select
  using (true);

-- レビューは「実際に購入した人」だけが書ける。
-- これがないと、使ってもいない人が荒らしレビューを書けてしまう。
drop policy if exists "only buyers can insert reviews" on public.reviews;
create policy "only buyers can insert reviews"
  on public.reviews for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.purchases p
      where p.tool_id = reviews.tool_id
        and p.buyer_id = auth.uid()
        and p.status = 'completed'
    )
  );

-- 自分のレビューだけ編集・削除できる
drop policy if exists "users can update own reviews" on public.reviews;
create policy "users can update own reviews"
  on public.reviews for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "users can delete own reviews" on public.reviews;
create policy "users can delete own reviews"
  on public.reviews for delete
  using (auth.uid() = author_id);


-- ============================================================
-- 5. 新規ユーザー登録時に自動でプロフィールを作る仕組み
-- ============================================================
-- Supabase Authでサインアップした瞬間に、profilesにも行を作る。
-- これがないと「ログインはできるがプロフィールが無い」状態が発生する。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base   text;
  v_handle text;
begin
  -- メールが無い場合（電話番号認証・一部のソーシャルログイン）もあるため、
  -- 必ず何らかの初期ハンドルを作れるようにする。
  v_base := split_part(coalesce(new.email, ''), '@', 1);
  if v_base is null or v_base = '' then
    v_base := 'user';
  end if;

  v_handle := v_base || '_' || substr(md5(random()::text), 1, 6);

  -- 万一ハンドルが重複しても、登録そのものは失敗させない。
  -- （ここで例外を投げると、ユーザーがサインアップできなくなってしまう）
  begin
    insert into public.profiles (id, handle, display_name)
    values (
      new.id,
      v_handle,
      coalesce(new.raw_user_meta_data->>'display_name', v_base)
    );
  exception when unique_violation then
    insert into public.profiles (id, handle, display_name)
    values (
      new.id,
      v_base || '_' || replace(new.id::text, '-', ''),
      coalesce(new.raw_user_meta_data->>'display_name', v_base)
    );
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 6. updated_at を自動更新する仕組み
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists tools_touch_updated_at on public.tools;
create trigger tools_touch_updated_at
  before update on public.tools
  for each row execute function public.touch_updated_at();
