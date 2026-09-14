import Link from "next/link";
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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-display text-lg font-semibold tracking-tight text-text-primary">
            forge<span className="text-accent-signal">.</span>
          </span>
        </Link>

        <div className="hidden flex-1 md:block">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-muted transition focus-within:border-border-strong">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="ツールを検索... 例: 請求書 自動化"
              className="w-full bg-transparent font-mono text-[13px] outline-none placeholder:text-text-dim"
            />
          </div>
        </div>

        <nav className="ml-auto flex items-center gap-5 text-sm">
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
            <UserMenu
              email={user.email ?? ""}
              displayName={displayName}
              avatarUrl={avatarUrl}
              isAdmin={isAdmin}
            />
          ) : (
            <Link
              href="/login"
              className="text-text-secondary transition hover:text-text-primary"
            >
              ログイン
            </Link>
          )}

          <Link
            href="/submit"
            className="rounded-md bg-accent-signal px-3.5 py-2 font-medium text-white transition hover:brightness-110"
          >
            公開する
          </Link>
        </nav>
      </div>
    </header>
  );
}
