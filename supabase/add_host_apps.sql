-- ============================================================
-- host_apps
-- ============================================================
-- 「BuildBay Creative」ハブページ用。Blender・After Effects等の
-- 対応ソフトを持つプラグイン・拡張機能を、通常の単体ツールと
-- 区別するためのカラム。
-- 空配列 = 通常のツール（今まで通り）
-- 1つ以上入っている = BuildBay Creativeに表示されるプラグイン
-- ============================================================

alter table public.tools add column if not exists host_apps text[] not null default '{}';
create index if not exists tools_host_apps_idx on public.tools using gin (host_apps);
