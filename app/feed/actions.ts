"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins, notify } from "@/lib/notifications/create";
import { adminPostReported, postLiked, newPostComment } from "@/lib/notifications/content";
import { FEED_PAGE_SIZE, MAX_POST_IMAGES } from "./constants";

const MAX_POST_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
const PAGE_SIZE = FEED_PAGE_SIZE;

export type PostAuthor = {
  display_name: string | null;
  handle: string;
  avatar_url: string | null;
};

export type LinkedTool = {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
};

export type PostItem = {
  id: string;
  content: string;
  image_urls: string[];
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: PostAuthor;
  likedByMe: boolean;
  isOwn: boolean;
  relevantComment: RelevantComment | null;
  linkedTool: LinkedTool | null;
};

const REASON_LABELS: Record<string, string> = {
  spam: "スパム・宣伝",
  harassment: "誹謗中傷・嫌がらせ",
  illegal: "違法・危険な内容",
  other: "その他",
};

/** 取得した投稿の生データに、閲覧者ごとの付加情報（自分がいいね済みか等）を合成する */
async function hydratePosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: {
    id: string;
    content: string;
    image_urls: string[] | null;
    view_count: number;
    like_count: number;
    comment_count: number;
    created_at: string;
    author_id: string;
    tool_id: string | null;
    profiles: { display_name: string | null; handle: string; avatar_url: string | null } | null;
  }[]
): Promise<PostItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let likedIds = new Set<string>();
  if (user && rows.length > 0) {
    const { data: likes } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .in(
        "post_id",
        rows.map((r) => r.id)
      );
    likedIds = new Set((likes ?? []).map((l) => l.post_id));
  }

  const toolIds = [...new Set(rows.map((r) => r.tool_id).filter((id): id is string => Boolean(id)))];
  let toolsById = new Map<string, LinkedTool>();
  if (toolIds.length > 0) {
    const { data: linkedTools } = await supabase
      .from("tools")
      .select("id, name, slug, thumbnail_url")
      .in("id", toolIds);
    toolsById = new Map((linkedTools ?? []).map((t) => [t.id, t]));
  }

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    image_urls: r.image_urls ?? [],
    view_count: r.view_count,
    like_count: r.like_count,
    comment_count: r.comment_count,
    created_at: r.created_at,
    author: {
      display_name: r.profiles?.display_name ?? null,
      handle: r.profiles?.handle ?? "",
      avatar_url: r.profiles?.avatar_url ?? null,
    },
    likedByMe: likedIds.has(r.id),
    isOwn: user?.id === r.author_id,
    relevantComment: null,
    linkedTool: r.tool_id ? toolsById.get(r.tool_id) ?? null : null,
  }));
}

/** 投稿詳細ページ用に、1件だけ取得する */
export async function getPost(postId: string): Promise<PostItem | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("posts")
    .select("*, profiles:author_id(display_name, handle, avatar_url)")
    .eq("id", postId)
    .maybeSingle();

  if (!row) return null;
  const [post] = await hydratePosts(supabase, [row]);
  return post;
}

export type RelevantComment = {
  id: string;
  content: string;
  author: PostAuthor;
};

/**
 * フィード一覧向けに、各投稿につき「自分がフォローしている人によるコメント」を
 * 1件ずつ添える（Xのような、関係のある返信をその場でプレビューする挙動）。
 * 未ログイン、または誰もフォローしていない場合は全件nullを返す。
 */
export async function getRelevantComments(
  postIds: string[]
): Promise<Record<string, RelevantComment | null>> {
  const empty: Record<string, RelevantComment | null> = Object.fromEntries(
    postIds.map((id) => [id, null])
  );
  if (postIds.length === 0) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const followingIds = (following ?? []).map((f) => f.following_id);
  if (followingIds.length === 0) return empty;

  const { data: comments } = await supabase
    .from("post_comments")
    .select("*, profiles:author_id(display_name, handle, avatar_url)")
    .in("post_id", postIds)
    .in("author_id", followingIds)
    .order("created_at", { ascending: false });

  const result = { ...empty };
  for (const c of comments ?? []) {
    // 投稿ごとに一番新しいものだけを採用する（既に別のコメントが入っていればスキップ）
    if (result[c.post_id]) continue;
    result[c.post_id] = {
      id: c.id,
      content: c.content,
      author: {
        display_name: c.profiles?.display_name ?? null,
        handle: c.profiles?.handle ?? "",
        avatar_url: c.profiles?.avatar_url ?? null,
      },
    };
  }
  return result;
}

/**
 * フィードの投稿を取得する（初回表示・もっと見る・「フォロー中」タブの
 * 切り替え、すべてこの1つの関数でまかなう）。
 */
export async function fetchFeedPosts(params: {
  mode: "all" | "following";
  /** これより古い投稿を取得する（「もっと見る」用）。省略時は先頭から */
  before?: string;
}): Promise<{ posts: PostItem[]; hasMore: boolean }> {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select("*, profiles:author_id(display_name, handle, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (params.before) {
    query = query.lt("created_at", params.before);
  }

  if (params.mode === "following") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { posts: [], hasMore: false };

    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    const followingIds = (following ?? []).map((f) => f.following_id);
    if (followingIds.length === 0) return { posts: [], hasMore: false };

    query = query.in("author_id", followingIds);
  }

  const { data: rows } = await query;
  const hasMore = (rows?.length ?? 0) > PAGE_SIZE;
  const page = (rows ?? []).slice(0, PAGE_SIZE);
  const posts = await hydratePosts(supabase, page);
  const relevant = await getRelevantComments(posts.map((p) => p.id));
  return {
    posts: posts.map((p) => ({ ...p, relevantComment: relevant[p.id] ?? null })),
    hasMore,
  };
}

export async function createPost(
  formData: FormData
): Promise<{ error: string | null; post?: PostItem }> {
  const t = await getTranslations("errors");
  const tFeed = await getTranslations("feed");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: t("loginRequired") };

  const content = String(formData.get("content") || "").trim();
  const toolId = String(formData.get("toolId") || "").trim() || null;
  const images = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!content && images.length === 0) {
    return { error: tFeed("contentRequired") };
  }
  if (images.length > MAX_POST_IMAGES) {
    return { error: tFeed("tooManyImages", { max: MAX_POST_IMAGES }) };
  }
  const oversized = images.find((f) => f.size > MAX_POST_IMAGE_SIZE);
  if (oversized) {
    return { error: tFeed("imageTooLarge") };
  }

  // ビルドログとして紐付けるツールは、自分自身が出品したものだけに限定する
  // （他人のツールを勝手に紐付けて宣伝できてしまわないようにするため）
  if (toolId) {
    const { data: tool } = await supabase
      .from("tools")
      .select("id")
      .eq("id", toolId)
      .eq("author_id", user.id)
      .maybeSingle();
    if (!tool) {
      return { error: tFeed("buildLogToolNotOwned") };
    }
  }

  const imageUrls: string[] = [];
  for (const image of images) {
    const ext = image.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "png";
    const key = `${user.id}/post-${Date.now()}-${imageUrls.length}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("tool-images").upload(key, image);
    if (uploadError) {
      return { error: tFeed("imageUploadFailed", { message: uploadError.message }) };
    }
    imageUrls.push(supabase.storage.from("tool-images").getPublicUrl(key).data.publicUrl);
  }

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, content, image_urls: imageUrls, tool_id: toolId })
    .select(
      "*, profiles:author_id(display_name, handle, avatar_url)"
    )
    .single();

  if (error || !inserted) {
    return { error: t("saveFailed", { message: error?.message ?? "" }) };
  }

  revalidatePath("/feed");
  const [post] = await hydratePosts(supabase, [inserted]);
  return { error: null, post };
}

/** 投稿作成フォームで「ビルドログとして紐付けるツール」の選択肢に使う、自分の公開中ツール一覧 */
export async function getMyPublishedTools(): Promise<
  { id: string; name: string; thumbnail_url: string | null }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tools")
    .select("id, name, thumbnail_url")
    .eq("author_id", user.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function deletePost(postId: string): Promise<{ error: string | null }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", user.id);
  if (error) return { error: t("deleteFailed", { message: error.message }) };

  revalidatePath("/feed");
  return { error: null };
}

export async function togglePostLike(
  postId: string
): Promise<{ error: string | null; liked: boolean }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("likeLoginRequired"), liked: false };

  const { data: existing } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { error: t("unlikeFailed"), liked: true };
    return { error: null, liked: false };
  }

  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
  if (error) return { error: t("likeFailed"), liked: false };

  after(async () => {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id, content")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.author_id === user.id) return; // 自分の投稿への「いいね」は通知しない

    const { data: likerProfile } = await supabase
      .from("profiles")
      .select("display_name, handle")
      .eq("id", user.id)
      .maybeSingle();
    const name = likerProfile?.display_name || likerProfile?.handle || "";
    await notify(
      post.author_id,
      "post_liked",
      postLiked(name, post.content.slice(0, 60), postId),
      { email: false } // いいねは頻度が高くなりうるため、アプリ内通知のみ
    );
  });

  return { error: null, liked: true };
}

export async function addComment(
  postId: string,
  content: string
): Promise<{ error: string | null; comment?: { id: string; content: string; created_at: string; author: PostAuthor } }> {
  const t = await getTranslations("errors");
  const tFeed = await getTranslations("feed");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  const trimmed = content.trim();
  if (!trimmed) return { error: tFeed("commentRequired") };

  const { data: inserted, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: user.id, content: trimmed })
    .select("*, profiles:author_id(display_name, handle, avatar_url)")
    .single();

  if (error || !inserted) {
    return { error: t("postFailed", { message: error?.message ?? "" }) };
  }

  after(async () => {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.author_id === user.id) return; // 自分の投稿への自分のコメントは通知しない

    const commenterName = inserted.profiles?.display_name || inserted.profiles?.handle || "";
    await notify(
      post.author_id,
      "new_post_comment",
      newPostComment(commenterName, trimmed.slice(0, 60), postId),
      { email: true }
    );
  });

  revalidatePath("/feed");
  return {
    error: null,
    comment: {
      id: inserted.id,
      content: inserted.content,
      created_at: inserted.created_at,
      author: {
        display_name: inserted.profiles?.display_name ?? null,
        handle: inserted.profiles?.handle ?? "",
        avatar_url: inserted.profiles?.avatar_url ?? null,
      },
    },
  };
}

export async function loadComments(postId: string) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("post_comments")
    .select("*, profiles:author_id(display_name, handle, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  return (rows ?? []).map((r) => ({
    id: r.id,
    content: r.content,
    created_at: r.created_at,
    author: {
      display_name: r.profiles?.display_name ?? null,
      handle: r.profiles?.handle ?? "",
      avatar_url: r.profiles?.avatar_url ?? null,
    },
  }));
}

export async function deleteComment(
  commentId: string
): Promise<{ error: string | null }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", user.id);
  if (error) return { error: t("deleteFailed", { message: error.message }) };

  revalidatePath("/feed");
  return { error: null };
}

export async function reportPost(
  postId: string,
  reason: string,
  detail: string
): Promise<{ ok: boolean; error?: string }> {
  const t = await getTranslations("errors");
  if (!REASON_LABELS[reason]) return { ok: false, error: t("reportReasonRequired") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t("reportLoginRequired") };

  const { data: post } = await supabase
    .from("posts")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false, error: t("contentNotFound") };

  const { error } = await supabase
    .from("post_reports")
    .insert({ post_id: postId, reporter_id: user.id, reason, detail: detail || null });

  if (error) {
    if (error.code === "23505") return { ok: false, error: t("alreadyReported") };
    return { ok: false, error: t("reportFailed", { message: error.message }) };
  }

  after(() =>
    notifyAdmins(
      "admin_post_reported",
      adminPostReported(
        post.profiles?.display_name || post.profiles?.handle || "不明",
        REASON_LABELS[reason]
      )
    )
  );

  return { ok: true };
}

export async function incrementPostView(postId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("increment_post_view_count", { p_post_id: postId });
}
