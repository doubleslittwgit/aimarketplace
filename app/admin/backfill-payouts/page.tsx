import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import BackfillPayoutsClient from "./BackfillPayoutsClient";

export default async function BackfillPayoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/backfill-payouts");

  const { data: isAdmin } = await supabase.rpc("is_admin", { p_user_id: user.id });
  if (!isAdmin) redirect("/");

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <h1 className="mb-1 font-display text-xl font-semibold text-text-primary">
            既存出品者への最低出金額の反映（一時ページ）
          </h1>
          <p className="mb-6 text-[13px] text-text-muted">
            新規登録時のみ自動設定される「残高1,000円までは出金しない」設定を、
            それ以前に登録済みだった出品者アカウントにまとめて反映します。
            何度実行しても安全です（既に設定済みのものは上書きされるだけです）。
          </p>
          <BackfillPayoutsClient />
        </div>
      </main>
    </>
  );
}
