import { NextResponse, after } from "next/server";
import { clientInfoFromHeaders, logPurchaseAccess } from "@/lib/access-log";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ツールのダウンロード（クラウド型は利用先URLへの案内）。
 *
 * URLを知っているだけではダウンロードできないようにするため、
 * 以下を順に確認してから、有効期限つきの一時URLを発行する。
 *
 *   1. ログインしているか
 *   2. そのツールを購入済みか（または無料ツール、または出品者本人か）
 *
 * 【購入者に渡すのは「承認済み」のファイル・URLだけ】
 * 出品者が公開後にファイルやURLを差し替えると、ツールは審査待ちに戻る。
 * その間も購入者は使い続けられるよう、管理者が最後に承認した時点のもの
 * （tools.approved_file_key / tool_access_urls.approved_url）を渡す。
 * 差し替え後のものは、管理者が承認して初めて購入者に届く。
 *
 * 失敗した場合は、JSONではなく商品ページに戻して、翻訳済みの案内を出す
 * （components/DownloadErrorNotice.tsx）。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // ログイン後に、もう一度このダウンロードをやり直せるようにする
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(`/apps/download/${toolId}`)}`, site)
    );
  }

  const { data: tool } = await supabase
    .from("tools")
    .select("id, slug, price, author_id, file_key, approved_file_key, runtime, status")
    .eq("id", toolId)
    .maybeSingle();

  if (!tool) {
    return NextResponse.redirect(new URL("/browse", site));
  }

  const back = (code: string) =>
    NextResponse.redirect(new URL(`/apps/${tool.slug}?download_error=${code}`, site));

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
    .select("id, price_paid")
    .eq("tool_id", tool.id)
    .eq("buyer_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  const isFreeAndPublic = tool.price === 0 && tool.status === "published";
  const hasAccess = isOwner || Boolean(purchase) || isFreeAndPublic || isReviewingAdmin;

  if (!hasAccess) return back("not_purchased");

  // 出品者本人と、審査中の管理者は「最新の（審査前の）内容」、それ以外は「承認済みの内容」
  const seesLatest = isOwner || isReviewingAdmin;

  // 有料で購入した人がダウンロード・利用したことを記録する（返金の判断・チャージバックの証拠用。
  // lib/access-log.ts 参照）。出品者本人や無料の取得は記録しない。応答は遅らせない
  if (purchase && purchase.price_paid > 0 && !isOwner) {
    const info = clientInfoFromHeaders(request.headers);
    after(() =>
      logPurchaseAccess(createAdminClient(), {
        userId: user.id,
        kind: tool.runtime === "cloud" ? "open" : "download",
        toolId: tool.id,
        purchaseId: purchase.id,
        ...info,
      })
    );
  }

  // クラウド型のツールは、ファイルではなく利用先URLへ案内する
  if (tool.runtime === "cloud") {
    // この表を直接読めるのは出品者本人だけにしている（購入者に未承認のURLが漏れないように）。
    // 購入・無料の利用の確認は上で済ませているので、それ以外の人の分は管理者権限で読む
    const reader = isOwner ? supabase : createAdminClient();
    const { data: access } = await reader
      .from("tool_access_urls")
      .select("url, approved_url")
      .eq("tool_id", tool.id)
      .maybeSingle();

    const target = seesLatest ? access?.url : access?.approved_url;
    if (!target) return back(seesLatest ? "no_file" : "not_ready");
    return NextResponse.redirect(target);
  }

  const fileKey = seesLatest ? tool.file_key : tool.approved_file_key;
  if (!fileKey) return back(seesLatest ? "no_file" : "not_ready");

  // 60秒だけ有効な一時URLを発行する。
  // 審査中の管理者は、ファイル置き場の制限（出品者本人・購入者のみ）に当てはまらないので管理者権限で発行する
  const storage = isReviewingAdmin && !isOwner ? createAdminClient().storage : supabase.storage;
  const { data: signed, error: signError } = await storage
    .from("tool-files")
    .createSignedUrl(fileKey, 60, { download: true });

  if (signError || !signed) {
    console.error("[download] 一時URLの発行に失敗:", signError?.message, tool.id);
    return back("failed");
  }

  return NextResponse.redirect(signed.signedUrl);
}
