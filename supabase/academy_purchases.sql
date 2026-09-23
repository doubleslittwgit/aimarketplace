-- ============================================================
-- BuildBay Academy：講座の購入（course_purchases）と返金ポリシー
-- ============================================================
-- ・講座の購入記録は、ツールの購入記録（purchases）とは別の表にする。
--   混ぜると、ツールのダウンロード権限や分析に講座が紛れ込むため。
-- ・購入記録を作れるのは、Stripeの支払い完了通知（管理者権限）だけ。
-- ・購入者は講座の全文（course_bodies）を読める。講座が後で非公開になっても読める。
-- ・購入された講座は削除できない（購入者が読めなくならないように）。
-- ・返金・トラブル報告（refund_requests）を、講座の購入にも使えるようにする。
-- 検証済み：購入前0件→購入後1件、偽造の購入記録は拒否、二重購入は拒否、購入済み講座の削除は拒否。
-- ============================================================

alter table public.courses add column if not exists refund_policy refund_policy_type not null default 'none';

create table public.course_purchases (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  price_paid integer not null check (price_paid > 0),
  platform_fee integer not null check (platform_fee >= 0),
  seller_earnings integer not null check (seller_earnings >= 0),
  stripe_payment_intent_id text not null unique,
  status text not null default 'completed' check (status in ('completed', 'refunded')),
  created_at timestamptz not null default now()
);
create unique index course_purchases_one_per_buyer
  on public.course_purchases (course_id, buyer_id) where status = 'completed';
create index course_purchases_seller_idx on public.course_purchases (seller_id, created_at desc);
create index course_purchases_buyer_idx on public.course_purchases (buyer_id, created_at desc);

alter table public.course_purchases enable row level security;
create policy "buyers and sellers can view own course purchases"
  on public.course_purchases for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
grant select on public.course_purchases to authenticated;
grant select, insert, update, delete on public.course_purchases to service_role;

drop policy "course body readable by author or free published" on public.course_bodies;
create policy "course body readable by author buyers or free published"
  on public.course_bodies for select using (
    exists (
      select 1 from public.courses c where c.id = course_id
        and (
          c.author_id = auth.uid()
          or (c.price = 0 and c.status = 'published')
          or exists (
            select 1 from public.course_purchases p
            where p.course_id = c.id and p.buyer_id = auth.uid() and p.status = 'completed'
          )
        )
    )
  );

drop policy "published courses are viewable by everyone" on public.courses;
create policy "courses viewable when published, by author, or by buyers"
  on public.courses for select using (
    status = 'published'
    or auth.uid() = author_id
    or exists (
      select 1 from public.course_purchases p
      where p.course_id = courses.id and p.buyer_id = auth.uid() and p.status = 'completed'
    )
  );

alter table public.refund_requests alter column purchase_id drop not null;
alter table public.refund_requests alter column tool_id drop not null;
alter table public.refund_requests
  add column if not exists course_purchase_id uuid unique references public.course_purchases(id) on delete cascade,
  add column if not exists course_id uuid references public.courses(id) on delete cascade;
alter table public.refund_requests add constraint refund_requests_one_target check (
  (purchase_id is not null and tool_id is not null and course_purchase_id is null and course_id is null)
  or (course_purchase_id is not null and course_id is not null and purchase_id is null and tool_id is null)
);

-- 返金・トラブル報告は「自分が実際に購入したもの」にしか出せないようにする。
-- 以前は buyer_id が自分であることしか確認しておらず、公開鍵で直接問い合わせれば
-- 他人の購入IDを指定した報告を作れてしまった。検証済み：本人の相談は通り、他人の購入の指定は拒否。
drop policy if exists "buyers can create own refund requests" on public.refund_requests;
create policy "buyers can create refund requests for own purchases"
  on public.refund_requests for insert
  with check (
    auth.uid() = buyer_id
    and (
      (purchase_id is not null and exists (
        select 1 from public.purchases p
        where p.id = purchase_id and p.buyer_id = auth.uid() and p.tool_id = refund_requests.tool_id and p.status = 'completed'))
      or
      (course_purchase_id is not null and exists (
        select 1 from public.course_purchases cp
        where cp.id = course_purchase_id and cp.buyer_id = auth.uid() and cp.course_id = refund_requests.course_id and cp.status = 'completed'))
    )
  );

-- courses / course_bodies の読み取り条件が course_purchases を参照しているため、
-- ログインしていない閲覧者（anon）にも参照権限が必要（無いと Academy の一覧や、
-- 講座と紐付いたツールのページが、ログインしていない人には permission denied で表示できなかった）。
-- 行レベルの制限があるので、anon には1行も見えない（検証済み）。
grant select on public.course_purchases to anon;
