import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import SentryTestButtons from "./SentryTestButtons";

export const metadata = { title: "エラー監視のテスト" };

/**
 * エラー監視（Sentry）が動いているかを確かめるための管理者専用ページ。
 * ボタンを押すと、わざとエラーを起こして Sentry に送る（利用者には影響しない）。
 */
export default async function SentryTestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/sentry-test");
  const { data: isAdmin } = await supabase.rpc("is_admin", { p_user_id: user.id });
  if (!isAdmin) redirect("/");

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">エラー監視のテスト</h1>
          <p className="mb-6 text-[13px] leading-relaxed text-text-muted">
            ボタンを押すと、わざとエラーを起こして Sentry に送ります。1〜2分後に Sentry の「Issues」に
            「BuildBay Sentry test」というエラーが出ていれば、監視は正しく動いています。
          </p>
          <SentryTestButtons />
        </div>
      </main>
    </>
  );
}
