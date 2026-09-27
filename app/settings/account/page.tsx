import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import DeleteAccountForm from "./DeleteAccountForm";

export async function generateMetadata() {
  const t = await getTranslations("accountSettings");
  return { title: `${t("title")} | BuildBay` };
}

export default async function AccountSettingsPage() {
  const t = await getTranslations("accountSettings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/account");

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-xl space-y-6 px-6 py-10">
          <div>
            <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">{t("title")}</h1>
            <p className="text-[13px] text-text-muted">{user.email}</p>
          </div>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-[15px] font-semibold text-text-primary">{t("passwordTitle")}</h2>
            <p className="mt-1 text-[13px] text-text-muted">{t("passwordBody")}</p>
            <Link
              href="/reset-password"
              className="mt-3 inline-block rounded-lg border border-border px-4 py-2 text-[13px] text-text-primary transition hover:bg-surface-raised"
            >
              {t("passwordButton")}
            </Link>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-[15px] font-semibold text-text-primary">{t("otherTitle")}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
              <Link href="/settings/notifications" className="rounded-lg border border-border px-4 py-2 text-text-primary hover:bg-surface-raised">
                {t("notificationSettings")}
              </Link>
              <Link href="/mfa" className="rounded-lg border border-border px-4 py-2 text-text-primary hover:bg-surface-raised">
                {t("mfa")}
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-accent-danger/30 bg-accent-danger/[0.03] p-5">
            <h2 className="text-[15px] font-semibold text-accent-danger">{t("deleteTitle")}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-text-secondary">
              <li>{t("deletePoint1")}</li>
              <li>{t("deletePoint2")}</li>
              <li>{t("deletePoint3")}</li>
              <li>{t("deletePoint4")}</li>
              <li>{t("deletePoint5")}</li>
            </ul>
            <DeleteAccountForm email={user.email ?? ""} />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
