import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center font-display text-2xl font-semibold text-text-primary">
            {t("loginTitle")}
          </h1>
          <p className="mb-8 text-center text-[13px] text-text-muted">
            {t("loginSubtitle")}
          </p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-[13px] text-text-muted">
            {t("noAccount")}{" "}
            <Link href={signupHref} className="text-accent-signal hover:underline">
              {t("signupLink")}
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
