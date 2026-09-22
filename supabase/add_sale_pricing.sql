-- ============================================================
-- sale_price / sale_ends_at
-- ============================================================
-- 出品者が自分のツールに、期間限定の値引き価格を設定できるようにする。
-- sale_price が設定されていて、かつ sale_ends_at が未来の場合にのみ
-- 「セール中」として扱う（lib/sale-price.ts の getEffectivePrice 参照）。
-- 通常価格以上のセール価格は無意味なので、DB側でも弾く。
-- ============================================================

alter table public.tools add column if not exists sale_price integer;
alter table public.tools add column if not exists sale_ends_at timestamptz;
alter table public.tools add constraint tools_sale_price_check
  check (sale_price is null or (sale_price >= 0 and sale_price < price));
