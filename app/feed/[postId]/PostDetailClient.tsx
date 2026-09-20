"use client";

import { useRouter } from "next/navigation";
import PostCard from "@/components/PostCard";
import type { PostItem } from "@/app/feed/actions";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author: { display_name: string | null; handle: string; avatar_url: string | null };
};

export default function PostDetailClient({
  post,
  isLoggedIn,
  initialComments,
}: {
  post: PostItem;
  isLoggedIn: boolean;
  initialComments: Comment[];
}) {
  const router = useRouter();

  return (
    <PostCard
      post={post}
      isLoggedIn={isLoggedIn}
      onDeleted={() => router.push("/feed")}
      initialComments={initialComments}
      disableCardClick
    />
  );
}
