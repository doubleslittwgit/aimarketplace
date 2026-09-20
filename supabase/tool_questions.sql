-- ============================================================
-- tool_questions
-- ============================================================
-- 商品詳細ページの「購入前に質問できる」Q&A機能。
--
-- プライバシーへの配慮から、質問・回答は「質問した本人」と
-- 「そのツールの出品者」だけが閲覧できる非公開の設計にしている
-- （Amazon等の商品Q&Aのように全員に公開する形にはしていない）。
-- 管理者は、このプロジェクトの他の管理機能と同様、service_role
-- （RLSを経由しない管理者用クライアント）を通してアクセスする想定のため、
-- ここには管理者用の特別なポリシーは設けていない。
-- 回答できるのは、そのツールの出品者本人のみ。
-- ============================================================

create table if not exists public.tool_questions (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  asker_id uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tool_questions_tool_id_idx on public.tool_questions(tool_id);

alter table public.tool_questions enable row level security;

-- 閲覧できるのは「質問した本人」と「そのツールの出品者」だけ
drop policy if exists "tool questions are viewable by everyone" on public.tool_questions;
drop policy if exists "tool questions are viewable by asker and seller" on public.tool_questions;
create policy "tool questions are viewable by asker and seller"
  on public.tool_questions for select
  using (
    auth.uid() = asker_id
    or exists (
      select 1 from public.tools
      where tools.id = tool_questions.tool_id
        and tools.author_id = auth.uid()
    )
  );

drop policy if exists "users can ask questions as themselves" on public.tool_questions;
create policy "users can ask questions as themselves"
  on public.tool_questions for insert
  with check (auth.uid() = asker_id);

-- 回答（answerカラムの更新）は、そのツールの出品者本人だけができる
drop policy if exists "sellers can answer questions on their own tools" on public.tool_questions;
create policy "sellers can answer questions on their own tools"
  on public.tool_questions for update
  using (
    exists (
      select 1 from public.tools
      where tools.id = tool_questions.tool_id
        and tools.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tools
      where tools.id = tool_questions.tool_id
        and tools.author_id = auth.uid()
    )
  );

grant select, insert, update on public.tool_questions to authenticated;
grant select on public.tool_questions to anon;
