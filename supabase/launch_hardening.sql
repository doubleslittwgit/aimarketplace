-- ============================================================
-- リリース前の総点検で見つかった穴を塞ぐ（2026-09-28）
-- ============================================================
-- 1. 審査のすり抜け防止（ツール）
--    - 画面を通さずに「公開済み」のツールを直接作れてしまう → INSERT も検査する
--    - 承認後にファイル・サムネイル等を差し替えても公開のまま → 自動で審査待ちに戻す
--    - 管理者が停止したツールを出品者が公開に戻せる → rejection_reason があれば不可
--    - 購入者には「管理者が承認した時点のファイル・URL」だけを渡す
--      （approved_file_key / tool_access_urls.approved_url。承認時に管理者の処理で設定）
-- 2. 審査のすり抜け防止（講座）
--    - 公開後に下書きへ戻して本文を書き換えられる → 下書き・審査待ちへは公開前からのみ
--    - 管理者が停止した講座を出品者が公開に戻せる → rejection_reason があれば不可
-- 3. 価格の下限（Stripeの最低額 ¥50 を下回る価格・¥0 のセールで決済できなくなるのを防ぐ）
-- 4. ファイル置き場
--    - 承認済みのファイルは上書き・削除できない（同じ場所への差し替えを防ぐ）
--    - 購入者が読めるのは承認済みのファイルだけ
--    - 公開中のツール・講座の画像は削除できない（削除→同名で再アップロードする差し替えを防ぐ）
--    - 画像の置き場には画像しか置けない
-- 5. レビュー: 買っていないツールへの付け替え・自分のツールへのレビューを防ぐ
-- 6. 無料ツールの取得: 取得数が加算されない不具合を直し、自分のツールは取得できないようにする
-- 7. 返金・トラブル報告: 報告者が「対応済み」の状態で作れないようにする
--
-- 何度実行しても同じ結果になるように書いている。
-- ============================================================


-- ------------------------------------------------------------
-- 1-a. 承認済みのファイル・URL
-- ------------------------------------------------------------
alter table public.tools add column if not exists approved_file_key text;
comment on column public.tools.approved_file_key is
  '管理者が承認した時点のファイル。購入者にはこちらを渡す（出品者が差し替えた file_key は承認されるまで購入者に届かない）';

alter table public.tool_access_urls add column if not exists approved_url text;
comment on column public.tool_access_urls.approved_url is
  '管理者が承認した時点のURL。購入者にはこちらを案内する';

-- 既に公開済み・非公開中のもの（＝承認済み）は、今の内容を承認済みとして扱う
update public.tools
   set approved_file_key = file_key
 where status in ('published', 'suspended') and approved_file_key is null;

update public.tool_access_urls a
   set approved_url = a.url
  from public.tools t
 where t.id = a.tool_id and t.status in ('published', 'suspended') and a.approved_url is null;


-- ------------------------------------------------------------
-- 1-b. tools の保護トリガー（INSERT にも効かせる）
-- ------------------------------------------------------------
create or replace function public.protect_tool_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_needs_review boolean := false;
begin
  -- 管理者の処理（service_role）はそのまま通す。
  -- データベースを直接操作する保守作業では、先に
  --   select set_config('request.jwt.claim.role', 'service_role', true);
  -- を実行してから更新すること
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- 新しいツールは「下書き」か「審査待ち」でしか作れない
    if new.status not in ('draft', 'pending_review') then
      raise exception 'ツールの公開状態は直接指定できません';
    end if;
    new.install_count := 0;
    new.like_count := 0;
    new.view_count := 0;
    new.ai_review_risk := null;
    new.ai_review_summary := null;
    new.rejection_reason := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.approved_file_key := null;
    return new;
  end if;

  -- ここから UPDATE
  new.author_id := old.author_id;
  new.approved_file_key := old.approved_file_key;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;

  -- 承認済み（公開中・非公開中）のツールで、見た目や中身に関わる項目が変わったら、
  -- 出品者の指定にかかわらず審査待ちに戻す
  if old.status in ('published', 'suspended') then
    v_needs_review :=
      new.file_key is distinct from old.file_key
      or new.thumbnail_url is distinct from old.thumbnail_url
      or (new.video_url is not null and new.video_url is distinct from old.video_url)
      or new.price > old.price
      or new.runtime is distinct from old.runtime
      or exists (
        select unnest(coalesce(new.gallery_urls, '{}'::text[]))
        except
        select unnest(coalesce(old.gallery_urls, '{}'::text[]))
      );
    if v_needs_review then
      new.status := 'pending_review';
    end if;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'published' and new.status = 'suspended')
      -- 出品者が自分で非公開にしたものだけ、自分で公開に戻せる（管理者の停止は不可）
      or (old.status = 'suspended' and new.status = 'published' and old.rejection_reason is null)
      or (new.status = 'pending_review' and old.status in ('draft', 'rejected', 'published', 'suspended'))
      or (new.status = 'draft' and old.status in ('rejected', 'pending_review'))
    ) then
      if old.status = 'suspended' and new.status = 'published' then
        raise exception '運営によって非公開にされたツールは、再審査を受けるまで公開できません';
      end if;
      raise exception '審査ステータスは直接変更できません';
    end if;
  end if;

  if new.status is distinct from old.status and new.status in ('pending_review', 'draft') then
    new.ai_review_risk := null;
    new.ai_review_summary := null;
    new.rejection_reason := case when new.status = 'draft' then old.rejection_reason else null end;
  else
    new.ai_review_risk := old.ai_review_risk;
    new.ai_review_summary := old.ai_review_summary;
    new.rejection_reason := old.rejection_reason;
  end if;

  if coalesce(current_setting('app.counter_update', true), '') <> 'on' then
    new.install_count := old.install_count;
    new.like_count := old.like_count;
    new.view_count := old.view_count;
  end if;

  return new;
end;
$$;

drop trigger if exists tools_protect_privileged_columns on public.tools;
create trigger tools_protect_privileged_columns
  before insert or update on public.tools
  for each row execute function public.protect_tool_privileged_columns();


-- ------------------------------------------------------------
-- 1-c. ツールのURL（クラウド型）の保護
-- ------------------------------------------------------------
create or replace function public.protect_tool_access_url()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.approved_url := null;
  else
    new.tool_id := old.tool_id;
    new.approved_url := old.approved_url;
  end if;
  return new;
end;
$$;

drop trigger if exists tool_access_urls_protect on public.tool_access_urls;
create trigger tool_access_urls_protect
  before insert or update on public.tool_access_urls
  for each row execute function public.protect_tool_access_url();

-- 承認済みのツールのURLを出品者が変えたら、ツールを審査待ちに戻す
create or replace function public.tool_access_url_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return null;
  end if;
  if tg_op = 'INSERT' or new.url is distinct from old.url then
    update public.tools
       set status = 'pending_review'
     where id = new.tool_id and status in ('published', 'suspended');
  end if;
  return null;
end;
$$;

drop trigger if exists tool_access_urls_changed on public.tool_access_urls;
create trigger tool_access_urls_changed
  after insert or update on public.tool_access_urls
  for each row execute function public.tool_access_url_changed();


-- ------------------------------------------------------------
-- 2. 講座の公開状態
-- ------------------------------------------------------------
create or replace function public.protect_course_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') then
      raise exception '講座の公開状態は直接指定できません';
    end if;
    new.rejection_reason := null;
    new.published_at := null;
    return new;
  end if;
  if new.status is distinct from old.status and not (
       -- 審査に出す・取り下げるのは、公開前の講座だけ
       -- （公開後に下書きへ戻すと本文の変更ロックが外れてしまうため）
       (new.status = 'pending_review' and old.status in ('draft', 'rejected'))
       or (new.status = 'draft' and old.status in ('pending_review', 'rejected'))
       or (old.status = 'published' and new.status = 'suspended')
       -- 自分で非公開にしたものだけ、自分で公開に戻せる（運営の停止は不可）
       or (old.status = 'suspended' and new.status = 'published' and old.rejection_reason is null)
     ) then
    if old.status = 'suspended' and new.status = 'published' then
      raise exception '運営によって非公開にされた講座は公開できません';
    end if;
    raise exception '講座の公開状態は直接変更できません';
  end if;
  new.rejection_reason := old.rejection_reason;
  new.published_at := old.published_at;
  new.author_id := old.author_id;
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 3. 価格の下限（有料は100円以上。セール価格は100円以上かつ通常価格未満）
-- ------------------------------------------------------------
alter table public.tools drop constraint if exists tools_price_minimum;
alter table public.tools add constraint tools_price_minimum
  check (price = 0 or price >= 100);

alter table public.tools drop constraint if exists tools_sale_price_minimum;
alter table public.tools add constraint tools_sale_price_minimum
  check (sale_price is null or (sale_price >= 100 and sale_price < price));


-- ------------------------------------------------------------
-- 4. ファイル置き場（Storage）
-- ------------------------------------------------------------
-- 4-a. ツール本体: 上書きは不可（差し替えは必ず新しい場所へ）
drop policy if exists "sellers can update own tool files" on storage.objects;

-- 4-b. ツール本体: 承認済みのファイルは削除できない（購入者が受け取れなくなるため）
drop policy if exists "sellers can delete own tool files" on storage.objects;
create policy "sellers can delete own tool files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tool-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.tools t where t.approved_file_key = objects.name
    )
  );

-- 4-c. ツール本体の読み取り: 出品者本人は自分のファイルすべて、
--      購入者・無料ツールの利用者は「承認済みのファイル」だけ
drop policy if exists "owners and buyers can download tool files" on storage.objects;
create policy "owners and buyers can download tool files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tool-files'
    and (
      (storage.foldername(objects.name))[1] = auth.uid()::text
      or exists (
        select 1
          from public.purchases p
          join public.tools t on t.id = p.tool_id
         where p.buyer_id = auth.uid()
           and p.status = 'completed'
           and t.approved_file_key = objects.name
      )
      or exists (
        select 1
          from public.tools t
         where t.approved_file_key = objects.name
           and t.price = 0
           and t.status = 'published'
      )
    )
  );

-- 4-d. 画像: 公開中・非公開中のツールや講座の画像は削除できない
--      （削除して同じ名前で上げ直すと、審査なしで画像を差し替えられてしまうため）
drop policy if exists "users can delete own tool images" on storage.objects;
create policy "users can delete own tool images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tool-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.tools t
       where t.id::text = (storage.foldername(objects.name))[2]
         and t.status in ('published', 'suspended')
    )
    and not exists (
      select 1 from public.courses c
       where (storage.foldername(objects.name))[2] = 'courses'
         and c.id::text = (storage.foldername(objects.name))[3]
         and c.status in ('published', 'suspended')
    )
  );

-- 4-e. 画像の置き場には画像しか置けない（HTML等を置いてフィッシングに使われるのを防ぐ）
update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
 where id = 'tool-images';


-- ------------------------------------------------------------
-- 5. レビュー
-- ------------------------------------------------------------
drop policy if exists "only buyers can insert reviews" on public.reviews;
create policy "only buyers can insert reviews"
  on public.reviews for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1 from public.purchases p
       where p.tool_id = reviews.tool_id
         and p.buyer_id = (select auth.uid())
         and p.status = 'completed'
    )
    and not exists (
      select 1 from public.tools t
       where t.id = reviews.tool_id and t.author_id = (select auth.uid())
    )
  );

-- 更新しても「買ったツールへのレビュー」のままであること（別のツールへ付け替え不可）
drop policy if exists "users can update own reviews" on public.reviews;
create policy "users can update own reviews"
  on public.reviews for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1 from public.purchases p
       where p.tool_id = reviews.tool_id
         and p.buyer_id = (select auth.uid())
         and p.status = 'completed'
    )
    and not exists (
      select 1 from public.tools t
       where t.id = reviews.tool_id and t.author_id = (select auth.uid())
    )
  );

create or replace function public.lock_review_target()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.tool_id := old.tool_id;
  new.author_id := old.author_id;
  return new;
end;
$$;

drop trigger if exists reviews_lock_target on public.reviews;
create trigger reviews_lock_target
  before update on public.reviews
  for each row execute function public.lock_review_target();


-- ------------------------------------------------------------
-- 6. 無料ツールの取得
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
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_tool from public.tools where id = p_tool_id;

  if not found or v_tool.status <> 'published' then
    raise exception 'tool not available';
  end if;

  if v_tool.price <> 0 then
    raise exception 'this tool is not free';
  end if;

  -- 出品者本人は取得不要（取得数の水増し・自作自演のレビューを防ぐ）
  if v_tool.author_id = auth.uid() then
    raise exception 'own tool';
  end if;

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

  -- 取得数は保護トリガーで守られているため、加算するときだけ許可を出す
  perform set_config('app.counter_update', 'on', true);
  update public.tools set install_count = install_count + 1 where id = p_tool_id;
  perform set_config('app.counter_update', '', true);

  return v_purchase_id;
end;
$$;


-- ------------------------------------------------------------
-- 7. 返金・トラブル報告は、必ず「未対応」で作られる
-- ------------------------------------------------------------
create or replace function public.refund_request_force_pending()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  new.status := 'pending';
  new.admin_note := null;
  new.resolved_at := null;
  return new;
end;
$$;

drop trigger if exists refund_requests_force_pending on public.refund_requests;
create trigger refund_requests_force_pending
  before insert on public.refund_requests
  for each row execute function public.refund_request_force_pending();


-- ------------------------------------------------------------
-- 8. ツールのURL（クラウド型）の読み取り・削除
-- ------------------------------------------------------------
-- 購入者には「承認済みのURL」だけを渡したいので、この表を直接読めるのは出品者本人だけにする。
-- 購入者・無料ツールの利用者には、購入の確認をしたうえで、ダウンロードの窓口
-- （app/apps/download/[toolId]/route.ts）が管理者権限で approved_url を読んで案内する。
drop policy if exists "access url readable by owner buyers or free" on public.tool_access_urls;
drop policy if exists "access url readable by owner" on public.tool_access_urls;
create policy "access url readable by owner" on public.tool_access_urls for select to authenticated
  using (exists (select 1 from public.tools t where t.id = tool_access_urls.tool_id and t.author_id = (select auth.uid())));

-- 承認済みのURLがある行は、出品者が消せない（消すと購入者が使えなくなるため）
drop policy if exists "owner can delete access url" on public.tool_access_urls;
create policy "owner can delete access url" on public.tool_access_urls for delete to authenticated
  using (
    approved_url is null
    and exists (select 1 from public.tools t where t.id = tool_access_urls.tool_id and t.author_id = (select auth.uid()))
  );
