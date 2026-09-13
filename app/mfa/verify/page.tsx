import { Suspense } from "react";
import Header from "@/components/Header";
import MfaVerifyClient from "@/components/MfaVerifyClient";

export default function MfaVerifyPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Suspense fallback={null}>
          <MfaVerifyClient />
        </Suspense>
      </main>
    </>
  );
}
