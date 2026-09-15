-- ============================================================
-- tool_likes: ツールへの「いいね」
-- ============================================================
-- tools.like_count 列は以前から存在していたが、実体となるテーブルが
-- 無かったため常に0のままだった。ここで実装する。
--
-- 設計方針:
--   ・誰がいいねしたかは本人にしか見せない（他人の趣味嗜好を露出しない）
--   ・合計数だけは tools.like_count として全員に見せる
--   ・like_count はトリガーで自動更新し、アプリ側から直接書かせない
--     （アプリが書けるようにすると、数字を自由に盛れてしまう）
-- ============================================================

create table if not exists public.tool_likes (
  tool_id uuid not null references public.tools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 同じ人が同じツールを二重にいいねできないようにする
  primary key (tool_id, user_id)
);

create index if not exists tool_likes_user_idx on public.tool_likes(user_id);
create index if not exists tool_likes_tool_idx on public.tool_likes(tool_id);

alter table public.tool_likes enable row level security;

-- 自分がいいねした記録だけ読める。
-- （全員に公開すると「誰が何を買いそうか」が筒抜けになる）
drop policy if exists "users can view own likes" on public.tool_likes;
create policy "users can view own likes"
  on public.tool_likes for select
  using (auth.uid() = user_id);

-- いいねできるのは自分名義でのみ。
-- かつ、自分から見えるツール（公開中 or 自分の出品 or 購入済み）に限る。
drop policy if exists "users can insert own likes" on public.tool_likes;
create policy "users can insert own likes"
  on public.tool_likes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.tools t where t.id = tool_id)
  );

-- 取り消せるのは自分のいいねだけ
drop policy if exists "users can delete own likes" on public.tool_likes;
create policy "users can delete own likes"
  on public.tool_likes for delete
  using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- like_count を自動で同期する
-- ------------------------------------------------------------
-- security definer にしている理由:
--   tools テーブルのRLSは「自分のツールしか更新できない」ため、
--   一般ユーザーが他人のツールにいいねしてもカウントを増やせない。
--   関数の所有者権限で実行することでこれを回避する。
--   引数を取らないトリガー関数なので、権限昇格の余地はない。
create or replace function public.sync_tool_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.tools
       set like_count = like_count + 1
     where id = new.tool_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.tools
       set like_count = greatest(like_count - 1, 0)
     where id = old.tool_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists tool_likes_sync_count on public.tool_likes;
create trigger tool_likes_sync_count
  after insert or delete on public.tool_likes
  for each row execute function public.sync_tool_like_count();


-- ------------------------------------------------------------
-- 既存データとの整合を取る（再実行しても安全）
-- ------------------------------------------------------------
update public.tools t
   set like_count = coalesce(c.cnt, 0)
  from (
    select id, (select count(*) from public.tool_likes l where l.tool_id = tools.id) as cnt
      from public.tools
  ) c
 where t.id = c.id
   and t.like_count is distinct from coalesce(c.cnt, 0);


-- ------------------------------------------------------------
-- GRANT（RLSとは別に、テーブルに触れる許可が必要）
-- ------------------------------------------------------------
grant select, insert, delete on public.tool_likes to authenticated;
grant select, insert, update, delete on public.tool_likes to service_role;
