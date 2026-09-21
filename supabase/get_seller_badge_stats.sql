-- ============================================================
-- get_seller_badge_stats
-- ============================================================
-- プロフィールページの実績バッジ（10件販売達成・回答が早い等）用。
-- purchases（決済情報を含む）や tool_questions（非公開のQ&A）は、
-- 他人の個別データをRLSで読めない設計になっているため、
-- 「集計値だけ」を安全に返す security definer 関数を用意する。
-- 個別の質問内容や購入金額そのものは、この関数からは一切返さない。
-- ============================================================

create or replace function public.get_seller_badge_stats(p_user_id uuid)
returns table(
  completed_sales_count integer,
  qa_answered_count integer,
  qa_avg_response_hours numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    (select count(*)::integer from public.purchases
       where seller_id = p_user_id and status = 'completed'),
    (select count(*)::integer from public.tool_questions tq
       join public.tools t on t.id = tq.tool_id
       where t.author_id = p_user_id and tq.answer is not null),
    (select avg(extract(epoch from (tq.answered_at - tq.created_at)) / 3600.0)
       from public.tool_questions tq
       join public.tools t on t.id = tq.tool_id
       where t.author_id = p_user_id and tq.answer is not null and tq.answered_at is not null);
end;
$$;

grant execute on function public.get_seller_badge_stats(uuid) to authenticated, anon;
