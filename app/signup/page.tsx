import Link from "next/link";
import { Suspense } from "react";
import Header from "@/components/Header";
import SignupForm from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center font-display text-2xl font-semibold text-text-primary">
            アカウントを作成
          </h1>
          <p className="mb-8 text-center text-[13px] text-text-muted">
            無料で登録して、ツールの公開・購入を始める
          </p>

          <Suspense fallback={null}>
            <SignupForm />
          </Suspense>

          <p className="mt-6 text-center text-[13px] text-text-muted">
            すでにアカウントをお持ちの方は{" "}
            <Link href={loginHref} className="text-accent-signal hover:underline">
              ログイン
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
