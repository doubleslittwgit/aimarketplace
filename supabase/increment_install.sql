-- ============================================================
-- インストール数を安全に1つ増やす関数
-- ============================================================
-- 既存のSQLファイルを全て実行した後に、これを実行してください。
--
-- なぜ関数にするのか:
--   「現在の数を読む → +1する → 書き戻す」という手順でやると、
--   同時に2人が購入したとき、両方が同じ数字を読んでしまい、
--   +2されるべきところが +1 で終わってしまう（数え漏れ）。
--
--   データベース側で「count = count + 1」として実行すれば、
--   同時に何人購入しても正確に数えられる。
-- ============================================================

create or replace function public.increment_install_count(p_tool_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tools
  set install_count = install_count + 1
  where id = p_tool_id;
$$;

-- この関数はWebhook（サーバー側）からのみ呼ばれる。
-- 一般ユーザーが自由に呼べると、インストール数を不正に水増しできてしまう。
revoke execute on function public.increment_install_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_install_count(uuid) to service_role;
