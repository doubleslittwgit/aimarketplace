-- ============================================================
-- tool_versions / tools.remix_allowed
-- ============================================================
-- tool_versions:
--   ツールの更新履歴。「最終更新: 3ヶ月前」だけでは、中身が変わったのか
--   誤字を直しただけなのか分からず、有料で買う判断材料にならない。
--   ファイルを差し替えた時に、出品者がバージョン番号と変更内容を
--   書き残せるようにする。
--   ※ファイル差し替えを自動で「バージョンアップ」と見なす方式は採らない。
--     バグ修正と大型更新を区別できず、変更内容も残らないため。
--
-- remix_allowed:
--   「改造して再配布してよい」と出品者が明示できるフラグ。
--   既定はfalse（＝許可しない）。
-- ============================================================

create table public.tool_versions (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  version text not null,
  changelog text not null,
  created_at timestamptz not null default now()
);
create index tool_versions_tool_idx on public.tool_versions (tool_id, created_at desc);

alter table public.tool_versions enable row level security;

-- 公開中のツールの履歴は誰でも読める（購入判断の材料になるため）
create policy "tool versions are viewable by everyone"
  on public.tool_versions for select
  using (
    exists (
      select 1 from public.tools t
      where t.id = tool_id and (t.status = 'published' or t.author_id = auth.uid())
    )
  );

create policy "authors can add own tool versions"
  on public.tool_versions for insert
  with check (
    exists (select 1 from public.tools t where t.id = tool_id and t.author_id = auth.uid())
  );

grant select, insert on public.tool_versions to authenticated;
grant select on public.tool_versions to anon;
grant select, insert, update, delete on public.tool_versions to service_role;

alter table public.tools add column if not exists remix_allowed boolean not null default false;
