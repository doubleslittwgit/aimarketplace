-- 商品詳細ページの閲覧数（インプレッション表示用）
alter table public.tools
  add column if not exists view_count integer not null default 0;

-- install_count と同じ考え方: RLSを経由せず確実に加算するための関数。
-- 認証の有無に関わらず（未ログインの訪問者でも）呼べる必要があるため
-- security definer にしている。引数を取るが「閲覧数を1増やす」以外のことは
-- 一切できないので、権限昇格の余地はない。
create or replace function public.increment_view_count(p_tool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tools set view_count = view_count + 1 where id = p_tool_id;
end;
$$;

grant execute on function public.increment_view_count(uuid) to anon, authenticated;
