import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NotificationSettingsClient from "./NotificationSettingsClient";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationSettingsPage() {
  const t = await getTranslations("notificationSettings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings/notifications");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (profile?.notification_prefs as Record<string, boolean>) || {};
  const disabledTypes = Object.keys(prefs).filter((k) => prefs[k] === false);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
            {t("title")}
          </h1>
          <p className="mb-8 text-[13px] text-text-muted">{t("subtitle")}</p>

          <NotificationSettingsClient initialDisabledTypes={disabledTypes} />
        </div>
      </main>
      <Footer />
    </>
  );
}
