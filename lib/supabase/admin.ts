import { createClient } from "@supabase/supabase-js";

/**
 * service_roleキーを使う管理者クライアント（RLSを迂回できる強い権限）。
 *
 * 【重要】このファイルは絶対にクライアントコンポーネントから import しないこと。
 * service_roleキーが漏洩すると、第三者がDB全体を自由に読み書きできてしまう。
 *
 * 使ってよいのは以下のような「サーバー側で本人確認を済ませた後」の処理のみ:
 *   - Stripe Webhook（ログインユーザーではないため管理者権限が必要）
 *   - seller_accounts への書き込み
 *     （このテーブルは authenticated に書き込み権限を与えていない。
 *       ユーザーが自分で「受取可能」フラグを立てて審査を迂回するのを防ぐため）
 *
 * 呼び出し側は、必ず先に通常のクライアントで auth.getUser() を行い、
 * 「誰の操作か」を確定させてから使うこと。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
