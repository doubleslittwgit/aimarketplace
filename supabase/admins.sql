-- ============================================================
-- admins: 出品審査などを行える管理者の一覧
-- ============================================================
-- 本番DBには直接 apply_migration で適用済みだったが、環境再構築用の
-- ソースとしてこのリポジトリに欠けていたため、実際の本番の定義に
-- 合わせて書き起こしたもの。
--
-- なぜ profiles に is_admin 列を足さず、専用テーブルに分離しているか:
--   seller_accounts と同じ理由。grants.sql が profiles 全体への
--   update を authenticated に許可しているため、profiles に
--   直接管理者フラグを持たせると、自分で自分を管理者にできてしまう。
--
-- なぜRLSポリシーを1つも作らないのか:
--   このテーブルは「誰が管理者か」という情報そのものであり、
--   一般ユーザーに見せる理由も、直接読み書きさせる理由もない。
--   RLSを有効にしたままポリシーを1つも作らないと、
--   authenticated/anon からは（テーブルへのGRANTがあっても）
--   常に0件になり、事実上アクセス不能になる。
--   判定は下の is_admin() 関数（security definer）を通してのみ行う。
-- ============================================================

create table if not exists public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- 意図的にポリシーを作らない（上記コメント参照）。


-- ------------------------------------------------------------
-- is_admin(): 指定したユーザーが管理者かどうかを判定する
-- ------------------------------------------------------------
-- security definer にしている理由:
--   admins テーブルには一般ユーザー向けのRLSポリシーが無いため、
--   通常の呼び出し方では authenticated から常に「該当なし」になる。
--   関数の所有者権限（postgres）で中身だけを判定させ、
--   テーブルの中身そのものは一切返さない。
--
-- 引数 p_user_id を取るが、これは「誰の権限を昇格させるか」ではなく
-- 「誰が管理者かを聞かれたときにtrue/falseを返すだけ」の関数のため、
-- 権限昇格には使えない（呼び出し元は app/admin/review/*, 
-- app/apps/download/[toolId]/route.ts で、必ず
-- auth.getUser() で確定させた自分自身のIDを渡している）。
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists(select 1 from public.admins where user_id = p_user_id);
$$;


-- ------------------------------------------------------------
-- GRANT
-- ------------------------------------------------------------
-- テーブル自体へは誰にも許可を与えない（is_admin() 経由のみ）。
-- 関数の実行権限だけ、判定が必要な全ロールに与える。
grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;
grant select, insert, update, delete on public.admins to service_role;


-- ------------------------------------------------------------
-- 初期管理者
-- ------------------------------------------------------------
-- 本番では shugoto1（ab206bd4-c81b-4ff4-9d99-9ec00718df8f）が
-- 唯一の管理者として登録済み。環境を作り直す場合は、
-- 該当ユーザーのUUIDを確認のうえ、次を実行すること。
--
-- insert into public.admins (user_id) values ('ここにUUID')
--   on conflict (user_id) do nothing;
