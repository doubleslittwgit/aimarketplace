-- 1つの出品に複数カテゴリを持たせられるようにする。
-- 既存の category（単一）列は、一覧のパンくず表示や関連ツール抽出など
-- 「代表カテゴリ」として使う箇所がまだあるため残し、
-- categories[0] を常にそこへ同期させる形にする。
alter table public.tools
  add column if not exists categories text[] not null default '{}';

-- 既存データの移行: 単一categoryを配列の先頭要素として複製する
update public.tools
set categories = array[category]
where categories = '{}' and category is not null and category <> '';
