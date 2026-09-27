import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import ForgotPasswordForm from "./ForgotPasswordForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.reset");
  return { title: `${t("forgotTitle")} | BuildBay` };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.reset");
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center font-display text-2xl font-semibold text-text-primary">
            {t("forgotTitle")}
          </h1>
          <p className="mb-8 text-center text-[13px] text-text-muted">{t("forgotSubtitle")}</p>
          <Suspense fallback={null}>
            <ForgotPasswordForm />
          </Suspense>
          <p className="mt-6 text-center text-[13px] text-text-muted">
            <Link href="/login" className="text-accent-signal hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
