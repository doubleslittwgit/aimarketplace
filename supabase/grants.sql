-- ============================================================
-- テーブルへのアクセス許可（GRANT）
-- ============================================================
-- schema.sql / storage.sql / functions.sql の後に実行してください。
--
-- なぜこれが必要か:
--   プロジェクト作成時に「Automatically expose new tables」を
--   オフにしたため（セキュリティ上、正しい判断です）、
--   新しく作ったテーブルには、APIからアクセスするための
--   基本的な許可（GRANT）が自動で付与されませんでした。
--
--   RLS（行レベルのルール）はすでに正しく設定されていますが、
--   その手前の「そもそもこのテーブルに触れてよいか」という許可が
--   無い状態だったため、401エラーが発生していました。
--
--   この2つは別物です。
--     GRANT = テーブルに触れる許可（扉を開ける）
--     RLS   = 触れた後、どの行が見えるか（扉の中の仕切り）
--   両方揃って、初めて正しく機能します。
-- ============================================================

-- publicスキーマ自体へのアクセスを許可（これが無いと何も見えない）
grant usage on schema public to anon, authenticated;


-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
-- 閲覧は誰でも（ログインしていない人も含む）
grant select on public.profiles to anon, authenticated;
-- 作成・更新はログイン済みユーザーのみ（RLSで「自分の分だけ」に絞られる）
grant insert, update on public.profiles to authenticated;


-- ------------------------------------------------------------
-- tools
-- ------------------------------------------------------------
grant select on public.tools to anon, authenticated;
grant insert, update, delete on public.tools to authenticated;


-- ------------------------------------------------------------
-- purchases
-- ------------------------------------------------------------
-- 閲覧のみ許可（RLSで「自分の購入・売上だけ」に絞られる）。
-- 書き込み系のGRANTは意図的に付与しない。
-- 購入記録はSECURITY DEFINER関数（functions.sql）経由でのみ作られる。
grant select on public.purchases to authenticated;


-- ------------------------------------------------------------
-- reviews
-- ------------------------------------------------------------
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;


-- ------------------------------------------------------------
-- seller_earnings_summary（売上集計ビュー）
-- ------------------------------------------------------------
grant select on public.seller_earnings_summary to authenticated;
