-- ============================================================
-- tool_translations / review_translations
-- ============================================================
-- 出品者・購入者が自由に書いた文章（商品名・キャッチコピー・概要・
-- レビューのコメント）を、DeepL APIで日本語→英語／繁体字中国語に
-- 翻訳した結果をキャッシュしておくテーブル。
--
-- 【なぜキャッシュするのか】
-- ページを開くたびにDeepLへ問い合わせると、無料枠（月50万文字）を
-- あっという間に使い切ってしまい、表示も毎回遅くなる。
-- 出品・レビュー投稿のタイミングで1回だけ翻訳し、ここに保存しておいて、
-- 閲覧時は保存済みの結果を返すだけにする。
--
-- 【書き込みをservice_roleに限定する理由】
-- 翻訳はDeepL APIキーを使うサーバー側の処理でのみ発生する
-- （ユーザーが直接「翻訳文はこれです」と書き込めてしまうと、
--   実際の原文と無関係な文章を混入させられてしまうため）。
-- ============================================================

create table if not exists public.tool_translations (
  tool_id uuid not null references public.tools(id) on delete cascade,
  locale text not null,
  name text not null,
  tagline text not null,
  description text not null,
  translated_at timestamptz not null default now(),
  primary key (tool_id, locale)
);

alter table public.tool_translations enable row level security;

-- 翻訳先の元ツールが公開されている場合のみ閲覧可能にする。
-- （非公開ツールの内容が、翻訳テーブル経由で漏れないようにするため）
drop policy if exists "tool translations follow tool visibility" on public.tool_translations;
create policy "tool translations follow tool visibility"
  on public.tool_translations for select
  using (
    exists (
      select 1 from public.tools
      where tools.id = tool_translations.tool_id
        and tools.status = 'published'
    )
  );

grant select on public.tool_translations to anon, authenticated;
grant select, insert, update, delete on public.tool_translations to service_role;

create table if not exists public.review_translations (
  review_id uuid not null references public.reviews(id) on delete cascade,
  locale text not null,
  comment text not null,
  translated_at timestamptz not null default now(),
  primary key (review_id, locale)
);

alter table public.review_translations enable row level security;

-- レビュー自体は誰でも見られる設計（reviews are viewable by everyone）
-- なので、翻訳も同様に誰でも見られてよい。
drop policy if exists "review translations are viewable by everyone" on public.review_translations;
create policy "review translations are viewable by everyone"
  on public.review_translations for select
  using (true);

grant select on public.review_translations to anon, authenticated;
grant select, insert, update, delete on public.review_translations to service_role;
