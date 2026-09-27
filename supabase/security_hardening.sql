-- ============================================================
-- セキュリティ診断（Supabase Advisors）の指摘への対応
-- ============================================================

-- 1. トリガー専用の関数は、APIから直接呼べないようにする
--    （トリガーとしての動作には影響しない。トリガーの実行時には EXECUTE 権限は確認されない）
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_post_comment_change() from public, anon, authenticated;
revoke execute on function public.handle_post_like_change() from public, anon, authenticated;
revoke execute on function public.handle_request_upvote_change() from public, anon, authenticated;
revoke execute on function public.protect_course_status() from public, anon, authenticated;
revoke execute on function public.protect_tool_privileged_columns() from public, anon, authenticated;
revoke execute on function public.sync_tool_like_count() from public, anon, authenticated;

-- 2. 閲覧数を増やす関数は、サーバー（管理者権限）からだけ呼ぶ。
--    誰でも呼べると、APIを直接叩いて閲覧数を水増しできてしまうため。
revoke execute on function public.increment_view_count(uuid) from public, anon, authenticated;
revoke execute on function public.increment_post_view_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_view_count(uuid) to service_role;
grant execute on function public.increment_post_view_count(uuid) to service_role;

-- 3. 無料ツールの取得はログインしている人だけ
revoke execute on function public.claim_free_tool(uuid) from public, anon;
grant execute on function public.claim_free_tool(uuid) to authenticated, service_role;

-- 4. 関数の検索パスを固定する（同名のテーブル・関数を別スキーマに作られて、すり替えられるのを防ぐ）
alter function public.platform_fee_rate() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.lock_published_course_content() set search_path = public;
alter function public.lock_published_course_body() set search_path = public;

-- 5. admins はRLSのみ有効でポリシー無し（＝APIからは誰も読めない）。意図どおり。
--    管理者かどうかの判定は is_admin()（security definer）だけで行う。
comment on table public.admins is 'Intentionally no RLS policies: readable only via is_admin() and service_role.';
