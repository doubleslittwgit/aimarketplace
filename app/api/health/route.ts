import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase接続の動作確認用エンドポイント。
 * カテゴリの一覧を1件だけ取得できるかで、接続が生きているか確認する。
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { count, error, status, statusText } = await supabase
      .from("tools")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          connected: false,
          error: {
            message: error.message || "(空)",
            details: error.details || null,
            hint: error.hint || null,
            code: error.code || null,
          },
          http_status: status,
          http_status_text: statusText,
          url_used: process.env.NEXT_PUBLIC_SUPABASE_URL || "(未設定)",
          key_prefix: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0, 15) || "(未設定)",
        },
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
      {
        connected: false,
        caught_error: e instanceof Error ? e.message : String(e),
        url_used: process.env.NEXT_PUBLIC_SUPABASE_URL || "(未設定)",
        key_prefix: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0, 15) || "(未設定)",
      },
      { status: 500 }
    );
  }
}
