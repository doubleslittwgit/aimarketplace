import { Suspense } from "react";
import Link from "next/link";
import HeaderSearch from "@/components/HeaderSearch";
import NotificationBell from "@/components/NotificationBell";
import MobileMenu from "@/components/MobileMenu";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "@/components/UserMenu";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = "";
  let avatarUrl: string | null = null;
  let isAdmin = false;

  if (user) {
    // profilesテーブルの表示名を優先。無ければGoogleログイン時の情報を使う。
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();

    displayName =
      profile?.display_name ||
      (user.user_metadata?.display_name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      "";

    avatarUrl =
      profile?.avatar_url || (user.user_metadata?.avatar_url as string | undefined) || null;

    const { data: isAdminData } = await supabase.rpc("is_admin", {
      p_user_id: user.id,
    });
    isAdmin = Boolean(isAdminData);
  }

  // 通知ベル用に、直近の通知を取得しておく（未ログイン時は取得しない）
  let notifications: {
    id: string;
    type: string;
    title: string;
    body: string | null;
    link_url: string | null;
    read_at: string | null;
    created_at: string;
  }[] = [];

  if (user) {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link_url, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    notifications = data ?? [];
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="BuildBay" className="h-7 w-auto" />
        </Link>

        <div className="hidden flex-1 md:block">
          <Suspense fallback={<div className="h-[38px] rounded-lg border border-border bg-surface" />}>
            <HeaderSearch />
          </Suspense>
        </div>

        <nav className="ml-auto flex items-center gap-3 text-sm sm:gap-5">
          <Link
            href="/browse"
            className="hidden text-text-secondary transition hover:text-text-primary sm:block"
          >
            探す
          </Link>
          <Link
            href="/submit"
            className="hidden text-text-secondary transition hover:text-text-primary sm:block"
          >
            出品する
          </Link>

          {user ? (
            <>
              <NotificationBell initialNotifications={notifications} />
              <UserMenu
                email={user.email ?? ""}
                displayName={displayName}
                avatarUrl={avatarUrl}
                isAdmin={isAdmin}
              />
            </>
          ) : (
            <Link
              href="/login"
              className="text-text-secondary transition hover:text-text-primary"
            >
              ログイン
            </Link>
          )}

          {/*
            スマホ幅では「公開する」ボタンを隠す（探す・出品するのテキストリンクと
            同様 sm 未満は非表示）。この操作自体は下のハンバーガーメニュー内の
            「出品する」や、ログイン時はUserMenu内の「ツールを公開する」からも
            変わらず行えるため、機能が失われるわけではない。
            ヘッダーの横幅を切り詰めて、通知ベル・ユーザーメニューと衝突しないようにするため。
          */}
          <Link
            href="/submit"
            className="hidden rounded-md bg-accent-signal px-3.5 py-2 font-medium text-white transition hover:brightness-110 sm:block"
          >
            公開する
          </Link>

          {/* スマホ幅でのみ表示するハンバーガーメニュー（検索・探す・出品する・ログイン） */}
          <MobileMenu isLoggedIn={Boolean(user)} />
        </nav>
      </div>
    </header>
  );
}
