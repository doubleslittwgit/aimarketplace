-- ============================================================
-- tools の重要列を保護する
-- ============================================================
-- 【見つかった脆弱性】
-- RLSは「その行を更新してよいか」しか判定できず、「どの列を更新してよいか」
-- までは制御できない。tools の UPDATE ポリシーは author_id = auth.uid() のみ
-- だったため、出品者は公開鍵(ANON_KEY)を使って自分のツールの任意の列を
-- 直接書き換えられる状態だった。具体的には:
--
--   1. status を直接 'published' にして、管理者の審査を完全に迂回できる
--   2. install_count / like_count / view_count を水増しして
--      ランキングや人気度を操作できる
--   3. ai_review_risk / rejection_reason を書き換えて審査結果を偽装できる
--
-- 【対策】
-- 更新前トリガーで、これらの列を強制的に元の値へ戻す。
-- ただし「公開 ⇔ 非公開」の切り替えだけは、出品者の正当な操作として許可する。
--
-- カウント列は、いいね機能などの security definer 関数が内部的に更新している。
-- これらも一般ユーザーのセッションとして実行されるため、単純に戻すと
-- いいね数が増えなくなってしまう。そこで「セッション変数が立っている時だけ
-- 通す」方式にし、正規の関数側からその変数を立てている。
-- 一般ユーザーが直接updateしてもこの変数は立たないため、水増しはできない。
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
      (old.status = 'published' and new.status = 'suspended') or
      (old.status = 'suspended' and new.status = 'published')
    ) then
      raise exception '審査ステータスは直接変更できません';
    end if;
  end if;

  new.ai_review_risk := old.ai_review_risk;
  new.ai_review_summary := old.ai_review_summary;
  new.rejection_reason := old.rejection_reason;
  new.author_id := old.author_id;

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
  before update on public.tools
  for each row execute function public.protect_tool_privileged_columns();

-- 正規のカウント更新関数には、上記トリガー向けの合図を立てさせる
create or replace function public.sync_tool_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.counter_update', 'on', true);
  if (tg_op = 'INSERT') then
    update public.tools set like_count = like_count + 1 where id = new.tool_id;
    perform set_config('app.counter_update', '', true);
    return new;
  elsif (tg_op = 'DELETE') then
    update public.tools set like_count = greatest(like_count - 1, 0) where id = old.tool_id;
    perform set_config('app.counter_update', '', true);
    return old;
  end if;
  perform set_config('app.counter_update', '', true);
  return null;
end;
$$;

create or replace function public.increment_view_count(p_tool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.counter_update', 'on', true);
  update public.tools set view_count = view_count + 1 where id = p_tool_id;
  perform set_config('app.counter_update', '', true);
end;
$$;

create or replace function public.increment_install_count(p_tool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.counter_update', 'on', true);
  update public.tools set install_count = install_count + 1 where id = p_tool_id;
  perform set_config('app.counter_update', '', true);
end;
$$;
