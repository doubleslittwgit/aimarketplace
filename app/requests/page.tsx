import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RequestBoard from "@/components/RequestBoard";
import { createClient } from "@/lib/supabase/server";
import { fetchRequests } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("requests");
  return { title: t("pageTitle"), description: t("pageDescription") };
}

export default async function RequestsPage() {
  const t = await getTranslations("requests");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { requests: initialRequests, hasMore } = await fetchRequests({ sort: "top" });

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
            {t("pageTitle")}
          </h1>
          <p className="mb-6 text-[13px] text-text-muted">{t("pageSubtitle")}</p>

          <RequestBoard
            initialRequests={initialRequests}
            initialHasMore={hasMore}
            isLoggedIn={Boolean(user)}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
