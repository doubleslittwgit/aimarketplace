import Link from "next/link";
import { Suspense } from "react";
import Header from "@/components/Header";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center font-display text-2xl font-semibold text-text-primary">
            おかえりなさい
          </h1>
          <p className="mb-8 text-center text-[13px] text-text-muted">
            アカウントにログインして続ける
          </p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-[13px] text-text-muted">
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="text-accent-signal hover:underline">
              新規登録
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
