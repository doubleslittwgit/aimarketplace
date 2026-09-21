-- ============================================================
-- tool_requests / tool_request_upvotes / tool_request_links
-- ============================================================
-- 「こんなツールが欲しい」を買い手側から先に投稿できる、供給と需要を
-- つなぐための掲示板。既存のマーケットが「できたものを並べる」供給先行型
-- なのに対して、逆方向（需要が先にある状態）を作る狙い。
--
-- 出品者は、自分の（公開中の）ツールを「この要望に対する回答」として
-- 複数のリクエストに紐付けられる（tool_request_links）。1つのリクエストに
-- 複数の出品者が別々のツールを紐付けることもできる（早い者勝ちにしない）。
-- ============================================================

create table if not exists public.tool_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  upvote_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tool_requests_created_at_idx on public.tool_requests(created_at desc);
create index if not exists tool_requests_upvote_count_idx on public.tool_requests(upvote_count desc);

create table if not exists public.tool_request_upvotes (
  request_id uuid not null references public.tool_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table if not exists public.tool_request_links (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.tool_requests(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  linked_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (request_id, tool_id)
);

create index if not exists tool_request_links_request_id_idx on public.tool_request_links(request_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.tool_requests enable row level security;
alter table public.tool_request_upvotes enable row level security;
alter table public.tool_request_links enable row level security;

drop policy if exists "tool requests are viewable by everyone" on public.tool_requests;
create policy "tool requests are viewable by everyone"
  on public.tool_requests for select using (true);

drop policy if exists "users can create their own requests" on public.tool_requests;
create policy "users can create their own requests"
  on public.tool_requests for insert with check (auth.uid() = requester_id);

drop policy if exists "users can delete their own requests" on public.tool_requests;
create policy "users can delete their own requests"
  on public.tool_requests for delete using (auth.uid() = requester_id);

drop policy if exists "request upvotes are viewable by everyone" on public.tool_request_upvotes;
create policy "request upvotes are viewable by everyone"
  on public.tool_request_upvotes for select using (true);

drop policy if exists "users can upvote as themselves" on public.tool_request_upvotes;
create policy "users can upvote as themselves"
  on public.tool_request_upvotes for insert with check (auth.uid() = user_id);

drop policy if exists "users can remove their own upvote" on public.tool_request_upvotes;
create policy "users can remove their own upvote"
  on public.tool_request_upvotes for delete using (auth.uid() = user_id);

drop policy if exists "request links are viewable by everyone" on public.tool_request_links;
create policy "request links are viewable by everyone"
  on public.tool_request_links for select using (true);

-- 自分が出品者であるツールだけを、リクエストへの回答として紐付けられる
drop policy if exists "tool owners can link their own tool to a request" on public.tool_request_links;
create policy "tool owners can link their own tool to a request"
  on public.tool_request_links for insert
  with check (
    auth.uid() = linked_by
    and exists (
      select 1 from public.tools
      where tools.id = tool_request_links.tool_id
        and tools.author_id = auth.uid()
    )
  );

drop policy if exists "users can remove their own request link" on public.tool_request_links;
create policy "users can remove their own request link"
  on public.tool_request_links for delete using (auth.uid() = linked_by);

grant select, insert, delete on public.tool_requests to authenticated;
grant select on public.tool_requests to anon;
grant select, insert, delete on public.tool_request_upvotes to authenticated;
grant select on public.tool_request_upvotes to anon;
grant select, insert, delete on public.tool_request_links to authenticated;
grant select on public.tool_request_links to anon;

-- ------------------------------------------------------------
-- いいねの増減をupvote_countに反映するトリガー（posts.sqlのpost_likesと同じ考え方）
-- ------------------------------------------------------------
create or replace function public.handle_request_upvote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.tool_requests set upvote_count = upvote_count + 1 where id = new.request_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.tool_requests set upvote_count = greatest(upvote_count - 1, 0) where id = old.request_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists request_upvote_change on public.tool_request_upvotes;
create trigger request_upvote_change
  after insert or delete on public.tool_request_upvotes
  for each row execute function public.handle_request_upvote_change();
