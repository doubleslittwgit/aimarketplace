import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "./ResetPasswordForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.reset");
  return { title: `${t("resetTitle")} | BuildBay` };
}

/**
 * 新しいパスワードを設定するページ。
 * メールの再設定リンクからログインした状態でだけ使える（ログインしていなければ、再申請を案内する）。
 */
export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center font-display text-2xl font-semibold text-text-primary">
            {t("resetTitle")}
          </h1>
          {user ? (
            <>
              <p className="mb-8 text-center text-[13px] text-text-muted">{t("resetSubtitle")}</p>
              <ResetPasswordForm />
            </>
          ) : (
            <div className="mt-6 space-y-4 text-center">
              <p className="text-[13px] text-text-muted">{t("expired")}</p>
              <Link href="/forgot-password" className="inline-block text-[13px] text-accent-signal hover:underline">
                {t("requestAgain")}
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
