import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CourseReviewClient, { type PendingCourse } from "./CourseReviewClient";
import { COURSE_PURCHASE_ENABLED } from "@/lib/academy/flags";

export const metadata = { title: "講座の審査 | 管理" };

export default async function AdminCoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/courses");
  const { data: isAdmin } = await supabase.rpc("is_admin", { p_user_id: user.id });
  if (!isAdmin) redirect("/");

  const { data } = await createAdminClient()
    .from("courses")
    .select("id, slug, title, price, toc, updated_at, profiles:author_id(display_name, handle)")
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/admin" className="text-[12px] text-text-muted hover:text-text-primary">
          ← 管理ダッシュボード
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold text-text-primary">講座の審査</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          BuildBay Academy に提出された講座です。プレビューで全文（有料部分を含む）を確認できます。
        </p>
        {!COURSE_PURCHASE_ENABLED && (
          <p className="mt-4 rounded-lg bg-accent-signal/10 px-3 py-2 text-[12px] text-accent-signal">
            購入機能が完成するまで、承認できるのは無料の講座だけです。
          </p>
        )}
        <CourseReviewClient courses={(data ?? []) as unknown as PendingCourse[]} />
      </main>
    </>
  );
}
