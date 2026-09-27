-- ============================================================
-- tools の審査ステータス保護を、出品者の正当な操作まで止めないように直す
-- ============================================================
-- protect_tool_columns.sql（2026-09-23）で「出品者は 公開⇔非公開 以外の
-- ステータス変更をできない」としたが、次の正当な操作まで止めてしまっていた:
--   - 下書き保存したツールを「審査に出す」（draft → pending_review）
--   - 公開中のツールの値上げ・ファイル/サムネイル/動画の差し替えで再審査に戻す（published → pending_review）
--   - 差し戻されたツールを直して再提出する（rejected → pending_review / draft）
--
-- 「審査待ちに戻す」「下書きに戻す」は、審査を迂回することにはならないので出品者に許可する。
-- 引き続き禁止するのは、出品者が自分で「公開（published）」や「却下（rejected）」にすること
-- （非公開→公開に戻すのだけは、一度審査を通ったツールなので従来どおり許可）。
-- ============================================================

create or replace function public.protect_tool_privileged_columns()
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

  if new.status is distinct from old.status then
    if not (
      -- 公開 ⇔ 非公開
      (old.status = 'published' and new.status = 'suspended') or
      (old.status = 'suspended' and new.status = 'published') or
      -- 審査に出す・再審査に戻す
      (new.status = 'pending_review' and old.status in ('draft', 'rejected', 'published')) or
      -- 下書きに戻す（差し戻し後の修正・審査の取り下げ）
      (new.status = 'draft' and old.status in ('rejected', 'pending_review'))
    ) then
      raise exception '審査ステータスは直接変更できません';
    end if;
  end if;

  new.author_id := old.author_id;

  -- 審査結果は出品者が書き換えられない。ただし審査待ち・下書きに戻すときは、
  -- 前回の審査結果を消して新しい審査を受け直す（古い結果が残らないようにする）
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

revoke execute on function public.protect_tool_privileged_columns() from public, anon, authenticated;
