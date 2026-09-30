-- =====================================================================
-- 外部の販売ページでの販売（海外の出品者向け）
-- =====================================================================
-- BuildBay の決済（日本の Stripe）では、日本国外の出品者に売上を送金できない。
-- そのため、海外の出品者は Gumroad・Lemon Squeezy・Polar などの販売ページで販売し、
-- BuildBay の商品ページには「外部で購入」のボタンだけを出せるようにする。
-- BuildBay はこの取引のお金を一切扱わない（Stripe の決済・送金・返金は動かない）。
--
--   external_purchase_url … 出品者が入力した販売ページのURL（出品者が編集できる）
--   approved_external_url … 管理者が審査で承認したURL（購入者に見せるのはこちらだけ）
--
-- 承認済みの列は、管理者の承認（app/admin/review/actions.ts、service_role）だけが書ける。
-- 公開中のツールで販売ページのURLを変えると、審査待ちに戻る（詐欺的なリンク差し替えを防ぐ）。
-- =====================================================================

alter table public.tools
  add column if not exists external_purchase_url text,
  add column if not exists approved_external_url text;

-- 外部販売は有料のツールだけ（無料なら普通に BuildBay で配布できる）。
-- URLは https のみ・対応している販売サービスのドメインのみ・長さに上限。
-- ドメインの一覧は lib/external-sales.ts の EXTERNAL_SALE_PLATFORMS と必ず揃えること
-- （出品フォームを通さずにデータベースへ直接書き込まれても、なりすましページを登録させないための二重の防御）。
-- セール価格は使わない（価格は販売ページ側で決まるため）。
alter table public.tools drop constraint if exists tools_external_purchase_url_check;
alter table public.tools add constraint tools_external_purchase_url_check check (
  external_purchase_url is null
  or (
    external_purchase_url ~ '^https://([a-z0-9-]+\.)*(gumroad\.com|lemonsqueezy\.com|polar\.sh|payhip\.com|ko-fi\.com|itch\.io|buymeacoffee\.com|portaly\.cc)\.?(/|\?|#|$)'
    and char_length(external_purchase_url) <= 500
    and price >= 100
    and sale_price is null
  )
);

comment on column public.tools.external_purchase_url is
  '外部の販売ページのURL（海外の出品者向け）。null なら BuildBay の決済で販売する。';
comment on column public.tools.approved_external_url is
  '管理者が承認した外部の販売ページのURL。購入者にはこちらだけを見せる。service_role のみ書き込み可。';

-- ---------------------------------------------------------------------
-- 審査のすり抜け防止トリガー（launch_hardening.sql の関数に、外部販売の2列の扱いを足したもの）
-- ---------------------------------------------------------------------
create or replace function public.protect_tool_privileged_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_needs_review boolean := false;
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
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
    new.approved_external_url := null;
    new.last_reviewed_snapshot := null;
    new.previous_rejection_reason := null;
    return new;
  end if;

  new.author_id := old.author_id;
  new.approved_file_key := old.approved_file_key;
  new.approved_external_url := old.approved_external_url;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.last_reviewed_snapshot := old.last_reviewed_snapshot;
  new.previous_rejection_reason := old.previous_rejection_reason;

  if old.status in ('published', 'suspended') then
    v_needs_review :=
      new.file_key is distinct from old.file_key
      or new.thumbnail_url is distinct from old.thumbnail_url
      or (new.video_url is not null and new.video_url is distinct from old.video_url)
      or new.price > old.price
      or new.runtime is distinct from old.runtime
      or new.external_purchase_url is distinct from old.external_purchase_url
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

  -- 審査に出し直すときは、直前の差し戻し・運営非公開の理由を、審査画面に出すために残しておく
  if new.status is distinct from old.status and new.status = 'pending_review' then
    new.previous_rejection_reason := old.rejection_reason;
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
$function$;
