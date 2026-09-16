import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ログイン中ユーザー自身の売上をCSVでダウンロードさせる。
 *
 * 他人の売上を見る手段は無い —
 * クエリは常に .eq("seller_id", user.id) で自分の行だけに絞っており、
 * これに加えてRLS（purchasesは buyer_id/seller_id が auth.uid() の行のみ）
 * が二重に保護している。
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("purchases")
    .select(
      "created_at, tools(name), price_paid, platform_fee, seller_earnings, profiles:buyer_id(display_name, handle)"
    )
    .eq("seller_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    created_at: string;
    tools: { name: string } | null;
    price_paid: number;
    platform_fee: number;
    seller_earnings: number;
    profiles: { display_name: string | null; handle: string } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  // Excelでの文字化け対策としてUTF-8 BOMを先頭に付ける
  const header = [
    "購入日時",
    "ツール名",
    "購入者",
    "販売価格",
    "手数料",
    "売上（手取り）",
  ];

  const escapeCsv = (value: string) => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        new Date(r.created_at).toLocaleString("ja-JP"),
        r.tools?.name ?? "",
        r.profiles?.display_name || r.profiles?.handle || "",
        r.price_paid,
        r.platform_fee,
        r.seller_earnings,
      ]
        .map((v) => escapeCsv(String(v)))
        .join(",")
    ),
  ];

  const csv = "\uFEFF" + lines.join("\r\n");
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="buildbay-sales-${dateStr}.csv"`,
    },
  });
}
