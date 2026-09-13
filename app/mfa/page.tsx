import { redirect } from "next/navigation";
import Header from "@/components/Header";
import MfaSettingsClient from "@/components/MfaSettingsClient";
import { createClient } from "@/lib/supabase/server";

export default async function MfaSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/mfa");
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <MfaSettingsClient />
      </main>
    </>
  );
}
