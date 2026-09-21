"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/create";
import { newRequestLink } from "@/lib/notifications/content";
import { isRateLimited } from "@/lib/rate-limit";

const PAGE_SIZE = 20;

export type RequestAuthor = {
  display_name: string | null;
  handle: string;
  avatar_url: string | null;
};

export type LinkedRequestTool = {
  linkId: string;
  toolId: string;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  linkedByMe: boolean;
};

export type RequestItem = {
  id: string;
  title: string;
  description: string;
  upvoteCount: number;
  createdAt: string;
  requester: RequestAuthor;
  upvotedByMe: boolean;
  isOwn: boolean;
  linkedTools: LinkedRequestTool[];
};

async function hydrateRequests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: {
    id: string;
    title: string;
    description: string;
    upvote_count: number;
    created_at: string;
    requester_id: string;
    profiles: { display_name: string | null; handle: string; avatar_url: string | null } | null;
  }[]
): Promise<RequestItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ids = rows.map((r) => r.id);
  let upvotedIds = new Set<string>();
  if (user && ids.length > 0) {
    const { data: upvotes } = await supabase
      .from("tool_request_upvotes")
      .select("request_id")
      .eq("user_id", user.id)
      .in("request_id", ids);
    upvotedIds = new Set((upvotes ?? []).map((u) => u.request_id));
  }

  const linksByRequest = new Map<string, LinkedRequestTool[]>();
  if (ids.length > 0) {
    const { data: links } = await supabase
      .from("tool_request_links")
      .select("*, tools:tool_id(name, slug, thumbnail_url)")
      .in("request_id", ids);
    for (const l of links ?? []) {
      if (!l.tools) continue;
      const entry: LinkedRequestTool = {
        linkId: l.id,
        toolId: l.tool_id,
        name: l.tools.name,
        slug: l.tools.slug,
        thumbnailUrl: l.tools.thumbnail_url,
        linkedByMe: user?.id === l.linked_by,
      };
      const list = linksByRequest.get(l.request_id) ?? [];
      list.push(entry);
      linksByRequest.set(l.request_id, list);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    upvoteCount: r.upvote_count,
    createdAt: r.created_at,
    requester: {
      display_name: r.profiles?.display_name ?? null,
      handle: r.profiles?.handle ?? "",
      avatar_url: r.profiles?.avatar_url ?? null,
    },
    upvotedByMe: upvotedIds.has(r.id),
    isOwn: user?.id === r.requester_id,
    linkedTools: linksByRequest.get(r.id) ?? [],
  }));
}

export async function fetchRequests(params: {
  sort: "top" | "new";
  before?: { createdAt: string; upvoteCount: number };
}): Promise<{ requests: RequestItem[]; hasMore: boolean }> {
  const supabase = await createClient();

  let query = supabase
    .from("tool_requests")
    .select("*, profiles:requester_id(display_name, handle, avatar_url)")
    .limit(PAGE_SIZE + 1);

  if (params.sort === "top") {
    query = query.order("upvote_count", { ascending: false }).order("created_at", { ascending: false });
    if (params.before) {
      query = query.lt("upvote_count", params.before.upvoteCount);
    }
  } else {
    query = query.order("created_at", { ascending: false });
    if (params.before) {
      query = query.lt("created_at", params.before.createdAt);
    }
  }

  const { data: rows } = await query;
  const hasMore = (rows?.length ?? 0) > PAGE_SIZE;
  const page = (rows ?? []).slice(0, PAGE_SIZE);
  return { requests: await hydrateRequests(supabase, page), hasMore };
}

export async function createRequest(
  title: string,
  description: string
): Promise<{ error: string | null; item?: RequestItem }> {
  const t = await getTranslations("errors");
  const tReq = await getTranslations("requests");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  // 荒らし・スパム対策: 直近10分間に3件以上リクエストしている場合は弾く
  if (await isRateLimited(supabase, "tool_requests", "requester_id", user.id, 10, 3)) {
    return { error: t("rateLimited") };
  }

  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  if (!trimmedTitle) return { error: tReq("titleRequired") };
  if (!trimmedDesc) return { error: tReq("descriptionRequired") };

  const { data: inserted, error } = await supabase
    .from("tool_requests")
    .insert({ requester_id: user.id, title: trimmedTitle, description: trimmedDesc })
    .select("*, profiles:requester_id(display_name, handle, avatar_url)")
    .single();

  if (error || !inserted) {
    return { error: t("saveFailed", { message: error?.message ?? "" }) };
  }

  revalidatePath("/requests");
  const [item] = await hydrateRequests(supabase, [inserted]);
  return { error: null, item };
}

export async function deleteRequest(requestId: string): Promise<{ error: string | null }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  const { error } = await supabase
    .from("tool_requests")
    .delete()
    .eq("id", requestId)
    .eq("requester_id", user.id);
  if (error) return { error: t("deleteFailed", { message: error.message }) };

  revalidatePath("/requests");
  return { error: null };
}

export async function toggleRequestUpvote(
  requestId: string
): Promise<{ error: string | null; upvoted: boolean }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("likeLoginRequired"), upvoted: false };

  const { data: existing } = await supabase
    .from("tool_request_upvotes")
    .select("request_id")
    .eq("request_id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("tool_request_upvotes")
      .delete()
      .eq("request_id", requestId)
      .eq("user_id", user.id);
    if (error) return { error: t("unlikeFailed"), upvoted: true };
    return { error: null, upvoted: false };
  }

  const { error } = await supabase
    .from("tool_request_upvotes")
    .insert({ request_id: requestId, user_id: user.id });
  if (error) return { error: t("likeFailed"), upvoted: false };
  return { error: null, upvoted: true };
}

/** 自分が出品しているツールを、このリクエストへの回答として紐付ける */
export async function linkToolToRequest(
  requestId: string,
  toolId: string
): Promise<{ error: string | null; item?: LinkedRequestTool }> {
  const t = await getTranslations("errors");
  const tReq = await getTranslations("requests");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  const { data: tool } = await supabase
    .from("tools")
    .select("id, name, slug, thumbnail_url")
    .eq("id", toolId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (!tool) return { error: tReq("toolNotOwned") };

  const { data: inserted, error } = await supabase
    .from("tool_request_links")
    .insert({ request_id: requestId, tool_id: toolId, linked_by: user.id })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error?.code === "23505") return { error: tReq("alreadyLinked") };
    return { error: t("saveFailed", { message: error?.message ?? "" }) };
  }

  after(async () => {
    const { data: request } = await supabase
      .from("tool_requests")
      .select("requester_id, title")
      .eq("id", requestId)
      .maybeSingle();
    if (!request || request.requester_id === user.id) return;
    await notify(
      request.requester_id,
      "new_request_link",
      newRequestLink(tool.name, request.title, requestId),
      { email: true }
    );
  });

  revalidatePath("/requests");
  return {
    error: null,
    item: {
      linkId: inserted.id,
      toolId: tool.id,
      name: tool.name,
      slug: tool.slug,
      thumbnailUrl: tool.thumbnail_url,
      linkedByMe: true,
    },
  };
}

export async function unlinkToolFromRequest(linkId: string): Promise<{ error: string | null }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("loginRequired") };

  const { error } = await supabase
    .from("tool_request_links")
    .delete()
    .eq("id", linkId)
    .eq("linked_by", user.id);
  if (error) return { error: t("deleteFailed", { message: error.message }) };

  revalidatePath("/requests");
  return { error: null };
}
