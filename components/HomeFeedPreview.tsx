"use client";

import { useState } from "react";
import PostCard from "@/components/PostCard";
import type { PostItem } from "@/app/feed/actions";

export default function HomeFeedPreview({
  initialPosts,
  isLoggedIn,
}: {
  initialPosts: PostItem[];
  isLoggedIn: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);

  function handleDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  if (posts.length === 0) return null;

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} isLoggedIn={isLoggedIn} onDeleted={handleDeleted} />
      ))}
    </div>
  );
}
