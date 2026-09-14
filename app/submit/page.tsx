import Header from "@/components/Header";
import SubmitClient from "./SubmitClient";
import { createClient } from "@/lib/supabase/server";

export default async function SubmitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canReceivePayments = false;
  if (user) {
    const { data } = await supabase.rpc("seller_can_receive_payments", {
      p_user_id: user.id,
    });
    canReceivePayments = Boolean(data);
  }

  return (
    <>
      <Header />
      <SubmitClient canReceivePayments={canReceivePayments} />
    </>
  );
}
