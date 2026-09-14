import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ツールのダウンロード。
 *
 * URLを知っているだけではダウンロードできないようにするため、
 * 以下を順に確認してから、有効期限つきの一時URLを発行する。
 *
 *   1. ログインしているか
 *   2. そのツールを購入済みか（または無料ツール、または出品者本人か）
 *
 * 有効期限を短くしているのは、発行されたURLが第三者に共有されても、
 * すぐに使えなくなるようにするため。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    );
  }

  const { data: tool } = await supabase
    .from("tools")
    .select("id, slug, price, author_id, file_key, demo_url, runtime, status")
    .eq("id", toolId)
    .maybeSingle();

  if (!tool) {
    return NextResponse.json({ error: "ツールが見つかりません" }, { status: 404 });
  }

  const isOwner = tool.author_id === user.id;

  // 審査待ちのツールに限り、管理者は中身を確認するためにダウンロードできる。
  // （既に公開済み・他人が購入したツールにまで無条件でアクセスできると
  // 過剰な権限になるため、審査対象のときだけに絞る）
  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  const isReviewingAdmin = Boolean(isAdminData) && tool.status === "pending_review";

  // 購入済みかどうかを確認する
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("tool_id", tool.id)
    .eq("buyer_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  const hasAccess =
    isOwner || Boolean(purchase) || tool.price === 0 || isReviewingAdmin;

  if (!hasAccess) {
    return NextResponse.json(
      { error: "このツールを購入していません" },
      { status: 403 }
    );
  }

  // クラウド型のツールは、ファイルではなくデモURLへ案内する
  if (tool.runtime === "cloud") {
    if (!tool.demo_url) {
      return NextResponse.json(
        { error: "利用先URLが設定されていません" },
        { status: 404 }
      );
    }
    return NextResponse.redirect(tool.demo_url);
  }

  if (!tool.file_key) {
    return NextResponse.json(
      { error: "ダウンロードできるファイルがありません" },
      { status: 404 }
    );
  }

  // 60秒だけ有効な一時URLを発行する
  const { data: signed, error: signError } = await supabase.storage
    .from("tool-files")
    .createSignedUrl(tool.file_key, 60, { download: true });

  if (signError || !signed) {
    return NextResponse.json(
      { error: `ダウンロードURLの発行に失敗しました: ${signError?.message ?? ""}` },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
