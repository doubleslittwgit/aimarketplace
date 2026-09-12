-- ============================================================
-- 購入処理まわりのサーバー関数
-- ============================================================
-- schema.sql / storage.sql を実行した後に、このファイルを実行してください。
--
-- なぜ関数にするのか:
--   購入が確定したとき、やることが複数ある。
--     1. purchasesに記録を作る
--     2. 手数料と売上を計算する
--     3. toolsのインストール数を増やす
--   これらは「全部成功」か「全部失敗」でなければならない。
--   途中で失敗すると「お金は取ったが購入記録が無い」等の事故になる。
--   関数にまとめることで、この一体性を保証する。
-- ============================================================


-- ------------------------------------------------------------
-- 手数料率の定義
-- ------------------------------------------------------------
-- プラットフォーム手数料は20%。ここを一箇所に集約しておくと、
-- 将来レートを変えるときに修正漏れが起きない。
create or replace function public.platform_fee_rate()
returns numeric
language sql
immutable
as $$ select 0.20::numeric $$;


-- ------------------------------------------------------------
-- 1. 購入レコードの作成（Stripe決済開始時に呼ぶ）
-- ------------------------------------------------------------
-- security definer: RLSを迂回して実行される。
--   → purchasesテーブルはクライアントから直接書けない設計にしたので、
--     この関数経由でのみ作成される。
-- 呼び出しはサーバー側（Stripe Webhook等）からのみ想定。
create or replace function public.create_pending_purchase(
  p_tool_id uuid,
  p_buyer_id uuid,
  p_stripe_payment_intent_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool       public.tools%rowtype;
  v_fee        integer;
  v_earnings   integer;
  v_purchase_id uuid;
begin
  -- ツールを取得し、同時に行をロックする。
  -- （同じツールへの同時購入で価格が変わる等の競合を防ぐ）
  select * into v_tool
  from public.tools
  where id = p_tool_id
  for update;

  if not found then
    raise exception 'tool not found: %', p_tool_id;
  end if;

  if v_tool.status <> 'published' then
    raise exception 'tool is not published: %', p_tool_id;
  end if;

  -- 自分が出品したツールは買えない（自演購入の防止）
  if v_tool.author_id = p_buyer_id then
    raise exception 'cannot purchase own tool';
  end if;

  -- 同じツールを重複購入させない
  if exists (
    select 1 from public.purchases
    where tool_id = p_tool_id
      and buyer_id = p_buyer_id
      and status in ('pending', 'completed')
  ) then
    raise exception 'already purchased or pending';
  end if;

  -- 手数料の計算。端数は切り捨てず四捨五入し、売上は差額で求める。
  -- （こうすると fee + earnings = price が必ず成立する）
  v_fee      := round(v_tool.price * public.platform_fee_rate());
  v_earnings := v_tool.price - v_fee;

  insert into public.purchases (
    tool_id, buyer_id, seller_id,
    price_paid, platform_fee, seller_earnings,
    stripe_payment_intent_id, status
  )
  values (
    p_tool_id, p_buyer_id, v_tool.author_id,
    v_tool.price, v_fee, v_earnings,
    p_stripe_payment_intent_id, 'pending'
  )
  returning id into v_purchase_id;

  return v_purchase_id;
end;
$$;

-- この関数は誰でも実行できてはいけない。
-- 一般ユーザーからは剥奪し、サーバー側（service_role）にだけ許可する。
revoke execute on function public.create_pending_purchase(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_pending_purchase(uuid, uuid, text) to service_role;


-- ------------------------------------------------------------
-- 2. 購入の完了処理（Stripeから「支払い成功」の通知が来たときに呼ぶ）
-- ------------------------------------------------------------
create or replace function public.complete_purchase(
  p_stripe_payment_intent_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases%rowtype;
begin
  select * into v_purchase
  from public.purchases
  where stripe_payment_intent_id = p_stripe_payment_intent_id
  for update;

  if not found then
    raise exception 'purchase not found for payment intent: %', p_stripe_payment_intent_id;
  end if;

  -- すでに完了しているなら何もしない。
  -- Stripeは同じ通知を複数回送ることがあるため、この防御が必要。
  if v_purchase.status = 'completed' then
    return v_purchase.id;
  end if;

  update public.purchases
  set status = 'completed',
      completed_at = now()
  where id = v_purchase.id;

  update public.tools
  set install_count = install_count + 1
  where id = v_purchase.tool_id;

  return v_purchase.id;
end;
$$;

revoke execute on function public.complete_purchase(text) from public, anon, authenticated;
grant execute on function public.complete_purchase(text) to service_role;


-- ------------------------------------------------------------
-- 3. 無料ツールの取得（お金が動かないので、本人が直接呼んでよい）
-- ------------------------------------------------------------
create or replace function public.claim_free_tool(p_tool_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool public.tools%rowtype;
  v_purchase_id uuid;
begin
  -- ログインしていない人は使えない
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_tool from public.tools where id = p_tool_id;

  if not found or v_tool.status <> 'published' then
    raise exception 'tool not available';
  end if;

  -- 有料ツールをこの関数で取得させない（最重要の防御）
  if v_tool.price <> 0 then
    raise exception 'this tool is not free';
  end if;

  -- すでに取得済みなら、その記録を返すだけ
  select id into v_purchase_id
  from public.purchases
  where tool_id = p_tool_id and buyer_id = auth.uid();

  if found then
    return v_purchase_id;
  end if;

  insert into public.purchases (
    tool_id, buyer_id, seller_id,
    price_paid, platform_fee, seller_earnings,
    status, completed_at
  )
  values (
    p_tool_id, auth.uid(), v_tool.author_id,
    0, 0, 0,
    'completed', now()
  )
  returning id into v_purchase_id;

  update public.tools
  set install_count = install_count + 1
  where id = p_tool_id;

  return v_purchase_id;
end;
$$;

-- 無料ツールの取得は、ログイン済みユーザーなら誰でも実行できてよい
grant execute on function public.claim_free_tool(uuid) to authenticated;


-- ------------------------------------------------------------
-- 4. 出品者が自分の売上を確認するためのビュー
-- ------------------------------------------------------------
-- security_invoker = on にすると、このビューを見る人の権限で
-- purchasesテーブルのRLSが適用される。
-- → 自分の売上しか見えない。他人の売上は一切見えない。
create or replace view public.seller_earnings_summary
with (security_invoker = on)
as
select
  seller_id,
  count(*) filter (where status = 'completed')                    as total_sales,
  coalesce(sum(seller_earnings) filter (where status = 'completed'), 0) as total_earnings,
  coalesce(sum(price_paid)      filter (where status = 'completed'), 0) as gross_revenue
from public.purchases
group by seller_id;
