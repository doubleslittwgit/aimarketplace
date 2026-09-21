"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatInstalls } from "@/lib/mock-data";
import { compressImage, COMPRESS_PRESET_AVATAR } from "@/lib/compress-image";
import { updateProfile } from "@/app/u/[handle]/actions";
import { toggleFollow } from "@/app/u/[handle]/follow-actions";

type Profile = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

type Stats = { apps: number; views: number; likes: number; downloads: number };
type Badges = { firstListing: boolean; tenSales: boolean; fastResponder: boolean };

export default function ProfileHeader({
  profile,
  isOwner,
  stats,
  badges,
  isLoggedIn,
  initialIsFollowing,
  followerCount,
  followingCount,
}: {
  profile: Profile;
  isOwner: boolean;
  stats: Stats;
  badges: Badges;
  isLoggedIn: boolean;
  initialIsFollowing: boolean;
  followerCount: number;
  followingCount: number;
}) {
  const t = useTranslations("profile");
  const tAnalytics = useTranslations("analytics");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followers, setFollowers] = useState(followerCount);
  const [isFollowPending, startFollowTransition] = useTransition();
  const [followHovered, setFollowHovered] = useState(false);

  const initials = profile.display_name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  async function handleAvatarPick(file: File | undefined) {
    if (!file) return;
    const compressed = await compressImage(file, COMPRESS_PRESET_AVATAR);
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(compressed);
      fileInputRef.current.files = dataTransfer.files;
    }
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(compressed);
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateProfile(profile.handle, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  }

  function handleFollowClick() {
    // 押した瞬間に見た目を先に更新し、失敗したら戻す（体感速度優先）
    const optimisticFollowing = !isFollowing;
    setIsFollowing(optimisticFollowing);
    setFollowers((n) => n + (optimisticFollowing ? 1 : -1));
    startFollowTransition(async () => {
      const result = await toggleFollow(profile.handle, profile.id);
      if (result.error) {
        setIsFollowing(!optimisticFollowing);
        setFollowers((n) => n - (optimisticFollowing ? 1 : -1));
      } else {
        setIsFollowing(result.following);
      }
    });
  }

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* ホームページと同じ、淡い青×コーラルのブラー背景でトーンを揃える */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-accent-ai/15 blur-[110px]" />
        <div className="absolute -top-10 right-[10%] h-72 w-72 rounded-full bg-accent-signal/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-14">
        {editing ? (
          <form action={handleSubmit} className="mx-auto max-w-lg">
            <div className="mb-6 flex justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-surface-raised"
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-2xl font-semibold text-accent-ai">
                    {initials}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-bg/0 text-[11px] font-medium text-white opacity-0 transition group-hover:bg-bg/50 group-hover:opacity-100">
                  {t("changeAvatar")}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                name="avatar"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleAvatarPick(e.target.files?.[0])}
                className="hidden"
              />
            </div>

            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">
              {t("displayNameLabel")}
            </label>
            <input
              type="text"
              name="displayName"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mb-4 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
            />

            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">
              {t("bioLabel")}
            </label>
            <textarea
              name="bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("bioPlaceholder")}
              className="mb-4 w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
            />

            {error && (
              <p className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-[12px] text-accent-danger">
                {error}
              </p>
            )}

            <div className="flex justify-center gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-accent-signal px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {isPending ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setDisplayName(profile.display_name);
                  setBio(profile.bio ?? "");
                  setAvatarPreview(profile.avatar_url);
                }}
                className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-text-secondary hover:bg-surface"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-surface-raised shadow-sm">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-2xl font-semibold text-accent-ai">
                  {initials}
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              {profile.display_name}
            </h1>
            <p className="mt-1 font-mono text-[13px] text-text-muted">@{profile.handle}</p>

            {(badges.firstListing || badges.tenSales || badges.fastResponder) && (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                {badges.firstListing && (
                  <BadgeChip icon="rocket" label={t("badgeFirstListing")} />
                )}
                {badges.tenSales && <BadgeChip icon="star" label={t("badgeTenSales")} />}
                {badges.fastResponder && (
                  <BadgeChip icon="bolt" label={t("badgeFastResponder")} />
                )}
              </div>
            )}

            <div className="mt-3 flex items-center gap-4 text-[13px]">
              <span>
                <span className="font-display font-semibold text-text-primary">
                  {formatInstalls(followers)}
                </span>{" "}
                <span className="text-text-muted">{t("followers")}</span>
              </span>
              <span>
                <span className="font-display font-semibold text-text-primary">
                  {formatInstalls(followingCount)}
                </span>{" "}
                <span className="text-text-muted">{t("following")}</span>
              </span>
            </div>

            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-text-secondary">
              {profile.bio || t("noBio")}
            </p>

            {isOwner ? (
              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-full border border-border bg-bg px-5 py-2 text-[13px] font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface"
                >
                  {t("editProfile")}
                </button>
                <Link
                  href="/dashboard/analytics"
                  className="rounded-full border border-border bg-bg px-5 py-2 text-[13px] font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface"
                >
                  {tAnalytics("viewAnalytics")}
                </Link>
              </div>
            ) : isLoggedIn ? (
              <button
                type="button"
                onClick={handleFollowClick}
                disabled={isFollowPending}
                onMouseEnter={() => setFollowHovered(true)}
                onMouseLeave={() => setFollowHovered(false)}
                className={`mt-5 min-w-[128px] rounded-full px-5 py-2 text-[13px] font-medium transition disabled:opacity-60 ${
                  isFollowing
                    ? followHovered
                      ? "border border-accent-danger/40 bg-accent-danger/5 text-accent-danger"
                      : "border border-border bg-bg text-text-secondary hover:border-border-strong"
                    : "bg-accent-signal text-white hover:brightness-105"
                }`}
              >
                {isFollowing ? (followHovered ? t("unfollowHover") : t("unfollow")) : t("follow")}
              </button>
            ) : null}

            <div className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-5 border-t border-border pt-8">
              <Stat label={t("apps")} value={String(stats.apps)} />
              <Stat label={t("views")} value={formatInstalls(stats.views)} />
              <Stat label={t("likes")} value={formatInstalls(stats.likes)} accent />
              <Stat label={t("downloads")} value={formatInstalls(stats.downloads)} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p
        className={`font-display text-2xl font-semibold ${
          accent ? "text-accent-signal" : "text-text-primary"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-text-muted">{label}</p>
    </div>
  );
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  rocket: (
    <path d="M12 2c-1.5 3-2 6-2 9 0 1 .2 2 .5 3l-2.5 2.5V19h2.5L13 16.5c1 .3 2 .5 3 .5 3 0 6-.5 9-2-3-3-6-4-9-4s-6 1-9 4c1.5-1.5 3-3 5-4" />
  ),
  star: (
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2l-5-4.9 6.9-1L12 2Z" />
  ),
  bolt: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
};

function BadgeChip({ icon, label }: { icon: keyof typeof BADGE_ICONS; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-accent-signal-dim px-2.5 py-1 text-[11px] font-medium text-accent-signal">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        {BADGE_ICONS[icon]}
      </svg>
      {label}
    </span>
  );
}
