import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ログインセッションを、ページ移動のたびに自動更新する仕組み。
 *
 * これが無いと「ログインしたはずなのに、別のページに移動したら
 * ログアウトした状態に戻る」という不具合が起きる。
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッションを検証・更新する（この呼び出し自体が更新のトリガーになる）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 二段階認証を有効化済みのユーザーが、今回のセッションでまだ
  // コード確認（チャレンジ）を完了していない場合、確認ページへ誘導する。
  // getAuthenticatorAssuranceLevel はローカルのセッション情報から
  // 判定するだけなので、追加のAPI呼び出しは発生しない。
  const path = request.nextUrl.pathname;
  const isMfaVerifyPage = path.startsWith("/mfa/verify");
  const isAuthRoute =
    path.startsWith("/auth/") || path === "/login" || path === "/signup";

  if (user && !isMfaVerifyPage && !isAuthRoute) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa/verify";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }

  return response;
}
