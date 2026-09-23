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

  // BuildBay Academy の講座の売上も同じ年のものを取り、日付順に1本の表へまとめる
  // （確定申告などで使う資料なので、売上の取りこぼしがないようにする）
  const { data: courseSales, error: courseError } = await supabase
    .from("course_purchases")
    .select("created_at, price_paid, platform_fee, seller_earnings, courses(title), profiles:buyer_id(display_name, handle)")
    .eq("seller_id", user.id)
    .eq("status", "completed")
    .gte("created_at", from)
    .lt("created_at", to);
  if (courseError) {
    return NextResponse.json({ error: courseError.message }, { status: 500 });
  }

  type Buyer = { display_name?: string; handle?: string } | null;
  const rows = [
    ...(sales ?? []).map((r) => ({
      created_at: r.created_at as string,
      kind: "ツール",
      name: (r.tools as { name?: string } | null)?.name ?? "",
      buyer: r.profiles as Buyer,
      price_paid: r.price_paid as number,
      platform_fee: r.platform_fee as number,
      seller_earnings: r.seller_earnings as number,
    })),
    ...(courseSales ?? []).map((r) => ({
      created_at: r.created_at as string,
      kind: "講座",
      name: (r.courses as { title?: string } | null)?.title ?? "",
      buyer: r.profiles as Buyer,
      price_paid: r.price_paid as number,
      platform_fee: r.platform_fee as number,
      seller_earnings: r.seller_earnings as number,
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const header = [
    "日付",
    "種類",
    "商品名",
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
    const buyer = row.buyer;
    totalEarnings += row.seller_earnings ?? 0;
    lines.push(
      [
        new Date(row.created_at).toLocaleDateString("ja-JP"),
        row.kind,
        row.name,
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
