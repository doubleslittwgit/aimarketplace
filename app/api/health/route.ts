import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase接続の動作確認用エンドポイント。
 * カテゴリの一覧を1件だけ取得できるかで、接続が生きているか確認する。
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // toolsテーブルの行数を確認するだけ（データが無くてもエラーにならない）
    const { count, error } = await supabase
      .from("tools")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { connected: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connected: true,
      message: "Supabaseへの接続に成功しました",
      tools_count: count,
    });
  } catch (e) {
    return NextResponse.json(
      { connected: false, error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}
