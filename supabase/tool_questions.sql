-- ============================================================
-- tool_questions
-- ============================================================
-- 商品詳細ページの「購入前に質問できる」Q&A機能。
-- Amazon等の商品Q&Aと同じ考え方で、質問・回答は誰でも閲覧できる
-- （既に同じ質問をした人がいれば、新たに聞き直す必要が無くなるため）。
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

drop policy if exists "tool questions are viewable by everyone" on public.tool_questions;
create policy "tool questions are viewable by everyone"
  on public.tool_questions for select
  using (true);

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
