-- ============================================================
-- legal_translations
-- ============================================================
-- 利用規約・プライバシーポリシー等の法務ページは長文かつ構造化された
-- HTMLなので、他の翻訳と同じ「テキストを1つずつ翻訳する」方式ではなく、
-- ページ全体のHTMLをDeepLにそのまま渡し（タグ構造を保ったまま翻訳する
-- tag_handling=htmlオプションを使用）、結果をまるごとキャッシュする。
--
-- 法的な文書は言い回しの正確さが特に重要なため、意訳ではなく原文に
-- 忠実な機械翻訳結果をそのまま使う設計にしている。
-- ============================================================

create table if not exists public.legal_translations (
  slug text not null,
  locale text not null,
  html text not null,
  translated_at timestamptz not null default now(),
  primary key (slug, locale)
);

alter table public.legal_translations enable row level security;

-- 法務ページはそもそも誰でも読めるものなので、翻訳も同様に公開する
drop policy if exists "legal translations are viewable by everyone" on public.legal_translations;
create policy "legal translations are viewable by everyone"
  on public.legal_translations for select
  using (true);

grant select on public.legal_translations to anon, authenticated;
grant select, insert, update, delete on public.legal_translations to service_role;
