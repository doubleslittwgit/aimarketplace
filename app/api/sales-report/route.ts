import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 出品者が、確定申告等のために「年間売上」をCSVでダウンロードできるようにする。
 * Server Actionではなく通常のAPIルートにしているのは、ブラウザに
 * ファイルとしてダウンロードさせるには、Content-Dispositionヘッダーを
 * 直接付けたHTTPレスポンスを返す必要があるため
 * （Server Actionはブラウザに直接ファイルを渡す仕組みを持たない）。
 *
 * Excel等で開いた時に文字化けしないよう、UTF-8のBOM付きで出力する。
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "不正な年です" }, { status: 400 });
  }

  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  const to = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

  const { data: sales, error } = await supabase
    .from("purchases")
    .select(
      "created_at, price_paid, platform_fee, seller_earnings, tools(name), profiles:buyer_id(display_name, handle)"
    )
    .eq("seller_id", user.id)
    .eq("status", "completed")
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = sales ?? [];

  const header = [
    "日付",
    "ツール名",
    "購入者",
    "販売価格",
    "手数料",
    "受取額",
  ];

  // CSVとして安全な形にエスケープする（カンマ・改行・ダブルクォートを含む値に対応）
  function escapeCsv(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  const lines = [header.map(escapeCsv).join(",")];
  let totalEarnings = 0;

  for (const row of rows) {
    const tool = row.tools as { name?: string } | null;
    const buyer = row.profiles as { display_name?: string; handle?: string } | null;
    totalEarnings += row.seller_earnings ?? 0;
    lines.push(
      [
        new Date(row.created_at).toLocaleDateString("ja-JP"),
        tool?.name ?? "",
        buyer?.display_name || buyer?.handle || "",
        String(row.price_paid),
        String(row.platform_fee),
        String(row.seller_earnings),
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  lines.push("");
  lines.push(escapeCsv(`合計件数: ${rows.length}件`));
  lines.push(escapeCsv(`合計受取額: ${totalEarnings}`));

  // Excelで文字化けしないよう、UTF-8のBOMを先頭に付ける
  const csv = "\uFEFF" + lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="buildbay-sales-${year}.csv"`,
    },
  });
}
