-- ============================================================
-- BuildBay Academy: 公開後の内容ロック・販売部数の上限
-- ============================================================
-- 方針（Brainの運用を参考に、より単純にしたもの）
--   ・公開後は、本文・タイトル・サムネイル・返金ポリシーを変更できない
--     （審査した内容と、購入者が買った内容を一致させ続けるため）
--   ・価格（有料の範囲内）・カテゴリ・販売部数の上限は、審査なしで変更できる
--   ・無料⇔有料の切り替えはできない（無料で読めていた人が読めなくなる／
--     有料部分が無料で見えてしまう、のどちらも起こさないため）
--   ・内容を直したい場合は「改訂版」として新しい講座を作り、審査に出す
-- 画面側でも同じ制限をかけているが、ここ（データベース）が最終的な守り。

-- ------------------------------------------------------------
-- 1. 販売部数の上限
-- ------------------------------------------------------------
alter table public.courses
  add column if not exists sales_limit integer
  check (sales_limit is null or sales_limit between 1 and 100000);

-- 売れた部数。作者本人と管理者権限の処理にだけ返す（他人の講座の販売数は見せない）
create or replace function public.course_sold_count(p_course_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.role() = 'service_role'
      or exists (select 1 from public.courses c where c.id = p_course_id and c.author_id = auth.uid())
    then (
      select count(*)::int from public.course_purchases p
      where p.course_id = p_course_id and p.status = 'completed'
    )
    else null
  end;
$$;
revoke all on function public.course_sold_count(uuid) from public;
grant execute on function public.course_sold_count(uuid) to authenticated, service_role;

-- 残り部数。上限を設定している講座についてだけ返す（上限が無い講座の販売数は出さない）
create or replace function public.course_stock(p_ids uuid[])
returns table (course_id uuid, sales_limit integer, remaining integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.sales_limit,
         greatest(
           c.sales_limit - (
             select count(*)::int from public.course_purchases p
             where p.course_id = c.id and p.status = 'completed'
           ),
           0
         )
  from public.courses c
  where c.id = any (p_ids)
    and c.sales_limit is not null
    and (c.status in ('published', 'suspended') or c.author_id = auth.uid());
$$;
revoke all on function public.course_stock(uuid[]) from public;
grant execute on function public.course_stock(uuid[]) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2. 公開後の内容ロック（courses）
-- ------------------------------------------------------------
create or replace function public.lock_published_course_content()
returns trigger
language plpgsql
as $$
begin
  -- 管理者権限の処理（審査の承認・Webhookなど）は対象外
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;
  if old.status not in ('published', 'suspended') then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.thumbnail_url is distinct from old.thumbnail_url
     or new.free_content is distinct from old.free_content
     or new.toc is distinct from old.toc
     or new.has_paid_part is distinct from old.has_paid_part
     or new.refund_policy is distinct from old.refund_policy
     or new.slug is distinct from old.slug then
    raise exception '公開後の講座は、本文・タイトル・サムネイル・返金ポリシーを変更できません';
  end if;

  if (old.price = 0) <> (new.price = 0) then
    raise exception '公開後に無料と有料を切り替えることはできません';
  end if;
  if new.price > 0 and new.price < 100 then
    raise exception '有料講座の価格は100円以上にしてください';
  end if;
  if new.sales_limit is not null
     and new.sales_limit < coalesce(public.course_sold_count(old.id), 0) then
    raise exception '販売部数の上限は、すでに売れた部数より少なくできません';
  end if;
  return new;
end;
$$;

drop trigger if exists courses_lock_published_content on public.courses;
create trigger courses_lock_published_content
  before update on public.courses
  for each row execute function public.lock_published_course_content();

-- ------------------------------------------------------------
-- 3. 公開後の本文ロック（course_bodies）
-- ------------------------------------------------------------
create or replace function public.lock_published_course_body()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;
  if exists (
    select 1 from public.courses c
    where c.id = old.course_id and c.status in ('published', 'suspended')
  ) then
    raise exception '公開後の講座の本文は変更できません';
  end if;
  return new;
end;
$$;

drop trigger if exists course_bodies_lock_published on public.course_bodies;
create trigger course_bodies_lock_published
  before update on public.course_bodies
  for each row execute function public.lock_published_course_body();
