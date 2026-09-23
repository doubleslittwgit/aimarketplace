-- ============================================================
-- tools.video_url
-- ============================================================
-- 商品ページの一番最初に表示する紹介動画。YouTube / Vimeo のみ。
-- 配信元の判定と埋め込みURLの組み立ては lib/video-embed.ts で行い、
-- 入力されたURLをそのまま iframe に渡すことはしない。
-- DB側でも最低限 https のURLであることを保証しておく。
-- ============================================================

alter table public.tools add column if not exists video_url text;
alter table public.tools add constraint tools_video_url_https
  check (video_url is null or video_url like 'https://%');
