import { notFound } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostDetailClient from "./PostDetailClient";
import { getPost, loadComments, incrementPostView } from "../actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const t = await getTranslations("feed");
  const post = await getPost(postId);
  if (!post) return {};

  const name = post.author.display_name ?? "";
  const excerpt = post.content.slice(0, 80);
  return {
    title: name ? t("postByTitle", { name }) : t("postTitle"),
    description: excerpt || undefined,
    openGraph: post.image_urls[0] ? { images: [post.image_urls[0]] } : undefined,
  };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const t = await getTranslations("feed");
  const post = await getPost(postId);
  if (!post) notFound();

  const [comments, supabase] = await Promise.all([loadComments(postId), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // フィードのカードと同じ「1閲覧」として計上する
  after(() => incrementPostView(postId));

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-6 py-10">
          <Link
            href="/feed"
            className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-text-muted transition hover:text-text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {t("pageTitle")}
          </Link>

          <PostDetailClient post={post} isLoggedIn={Boolean(user)} initialComments={comments} />
        </div>
      </main>
      <Footer />
    </>
  );
}
