-- サムネイルとは別に、商品詳細ページのギャラリー表示用に
-- 最大5枚までの追加画像URLを配列で保持する。
-- サムネイルと同じ tool-images バケット（公開）に保存し、公開URLをそのまま入れる。
alter table public.tools
  add column if not exists gallery_urls text[] not null default '{}';
