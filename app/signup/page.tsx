import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import SignupForm from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center font-display text-2xl font-semibold text-text-primary">
            {t("signupTitle")}
          </h1>
          <p className="mb-8 text-center text-[13px] text-text-muted">
            {t("signupSubtitle")}
          </p>

          <Suspense fallback={null}>
            <SignupForm />
          </Suspense>

          <p className="mt-6 text-center text-[13px] text-text-muted">
            {t("haveAccount")}{" "}
            <Link href={loginHref} className="text-accent-signal hover:underline">
              {t("loginLink")}
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
