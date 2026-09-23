-- ============================================================
-- tool_access_urls（クラウド型ツールの「ツールのURL」を保管する金庫）
-- ============================================================
-- 【見つかった弱点】
-- 以前は tools.demo_url に保存していた。tools は公開中なら誰でも読める
-- （商品一覧のため）ので、画面には出していなくても、公開鍵でデータベースに
-- 直接問い合わせれば、購入していない人でも有料クラウド型ツールの
-- 本番URLを取得できてしまう状態だった。
--
-- 【対策】
-- URLだけをこの別テーブルに移し、読める人を
--   出品者本人 / 購入済みの人 / 無料で公開中のツールなら誰でも
-- に限定する。判定はデータベース自身が行うので、直接問い合わせても漏れない。
--
-- ※購入者がURLを第三者に教えることまでは防げない（ツール側のログイン機能が必要）。
-- ============================================================

create table public.tool_access_urls (
  tool_id uuid primary key references public.tools(id) on delete cascade,
  url text not null,
  updated_at timestamptz not null default now()
);

alter table public.tool_access_urls enable row level security;

create policy "access url readable by owner buyers or free"
  on public.tool_access_urls for select
  using (
    exists (
      select 1 from public.tools t
      where t.id = tool_access_urls.tool_id
        and (
          t.author_id = auth.uid()
          or (t.price = 0 and t.status = 'published')
          or exists (
            select 1 from public.purchases p
            where p.tool_id = t.id and p.buyer_id = auth.uid() and p.status = 'completed'
          )
        )
    )
  );

create policy "owner can insert access url"
  on public.tool_access_urls for insert
  with check (exists (select 1 from public.tools t where t.id = tool_id and t.author_id = auth.uid()));
create policy "owner can update access url"
  on public.tool_access_urls for update
  using (exists (select 1 from public.tools t where t.id = tool_id and t.author_id = auth.uid()))
  with check (exists (select 1 from public.tools t where t.id = tool_id and t.author_id = auth.uid()));
create policy "owner can delete access url"
  on public.tool_access_urls for delete
  using (exists (select 1 from public.tools t where t.id = tool_id and t.author_id = auth.uid()));

grant select, insert, update, delete on public.tool_access_urls to authenticated;
grant select on public.tool_access_urls to anon;
grant select, insert, update, delete on public.tool_access_urls to service_role;

-- 既存のURLを移し、元の列は空にして二度と使えないようにする
insert into public.tool_access_urls (tool_id, url)
select id, demo_url from public.tools where demo_url is not null
on conflict (tool_id) do nothing;

update public.tools set demo_url = null where demo_url is not null;
alter table public.tools add constraint tools_demo_url_retired check (demo_url is null);
