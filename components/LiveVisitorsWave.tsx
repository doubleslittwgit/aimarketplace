"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Visitor = {
  key: string;
  displayName: string | null;
  avatarUrl: string | null;
};

const MAX_VISIBLE = 15;
const ROTATE_INTERVAL_MS = 7000;
const ANON_ID_KEY = "buildbay-anon-presence-id";

/**
 * 「今まさにこのページを見ている人」を、波の上を漂うボートとして表示する。
 *
 * 実装の要点:
 * - Supabase Realtimeの Presence機能を使い、追加のサーバーは立てない。
 * - ログイン中は自分のアバター・表示名をそのまま使う。未ログインの場合は
 *   セッションごとのランダムIDだけを発行し、名前もアバターも出さない
 *   （プライバシー配慮。名前はホバー時のみ、ログイン中の人だけ表示）。
 * - 同時接続が15人を超える場合は、全員は出さず、数秒おきに表示するグループを
 *   入れ替えることで「大勢いる感じ」を出しつつ描画量を抑える。
 */
export default function LiveVisitorsWave() {
  const t = useTranslations("home");
  const [visitors, setVisitors] = useState<Record<string, Visitor>>({});
  const [rotationOffset, setRotationOffset] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function join() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let key: string;
      let displayName: string | null = null;
      let avatarUrl: string | null = null;

      if (user) {
        key = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        displayName = profile?.display_name ?? null;
        avatarUrl = profile?.avatar_url ?? null;
      } else {
        // タブ・リロードのたびに増えないよう、セッション単位で同じIDを使い回す
        let anonId = window.sessionStorage.getItem(ANON_ID_KEY);
        if (!anonId) {
          anonId = crypto.randomUUID();
          window.sessionStorage.setItem(ANON_ID_KEY, anonId);
        }
        key = anonId;
      }

      if (cancelled) return;

      channel = supabase.channel("homepage-presence", {
        config: { presence: { key } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!channel) return;
          const state = channel.presenceState<{ displayName: string | null; avatarUrl: string | null }>();
          const next: Record<string, Visitor> = {};
          for (const [presenceKey, entries] of Object.entries(state)) {
            const entry = entries[0];
            if (!entry) continue;
            next[presenceKey] = {
              key: presenceKey,
              displayName: entry.displayName,
              avatarUrl: entry.avatarUrl,
            };
          }
          setVisitors(next);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && channel) {
            await channel.track({ displayName, avatarUrl });
          }
        });
    }

    join();

    return () => {
      cancelled = true;
      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const allKeys = useMemo(() => Object.keys(visitors).sort(), [visitors]);

  // 表示上限を超える場合、数秒おきに表示メンバーをずらして入れ替える
  useEffect(() => {
    if (allKeys.length <= MAX_VISIBLE) return;
    const id = setInterval(() => {
      setRotationOffset((prev) => (prev + 4) % allKeys.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [allKeys.length]);

  const visibleKeys = useMemo(() => {
    if (allKeys.length <= MAX_VISIBLE) return allKeys;
    const rotated = [...allKeys.slice(rotationOffset), ...allKeys.slice(0, rotationOffset)];
    return rotated.slice(0, MAX_VISIBLE);
  }, [allKeys, rotationOffset]);

  if (visibleKeys.length === 0) return null;

  return (
    <div
      aria-hidden
      className="relative h-36 w-full overflow-hidden sm:h-48"
      title={t("liveVisitorsLabel")}
    >
      <WaveLayers />
      <div className="absolute inset-0">
        {visibleKeys.map((key) => (
          <Boat key={key} visitor={visitors[key]} guestLabel={t("guestVisitor")} />
        ))}
      </div>
      {/* 海の下端を背景色へ溶かし、次のセクションとの境目をなくす */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-bg sm:h-20" />
    </div>
  );
}

function WaveLayers() {
  // baselineの差を大きく取ることで、白っぽい奥の波ほど上に離れて配置され、
  // 上に行くほど白くなるグラデーションの幅が広がって見える。
  return (
    <div className="absolute inset-0">
      <WaveLayer className="bottom-0 text-accent-ai/15" duration="30s" baseline={8} amplitude={2} />
      <WaveLayer className="bottom-0 text-accent-ai/30" duration="24s" baseline={20} amplitude={4} />
      <WaveLayer className="bottom-0 text-accent-ai/50" duration="18s" baseline={32} amplitude={6} />
      <WaveLayer className="bottom-0 text-accent-ai/72" duration="13s" baseline={44} amplitude={8} />
      <WaveLayer className="bottom-0 text-accent-ai/95" duration="9s" baseline={56} amplitude={10} />
    </div>
  );
}

function WaveLayer({
  className,
  duration,
  baseline,
  amplitude,
}: {
  className: string;
  duration: string;
  baseline: number;
  amplitude: number;
}) {
  // パスを横に2枚並べ、幅の半分だけ左へ動かし続けることで
  // 途切れなくループする波にしている。
  // baselineを小さくする（=波の頂点を上に上げる）ほど、
  // viewBox全体に対して水面下の塗りつぶし面積が増え、海が「厚く」見える。
  return (
    <div
      data-live-wave
      className={`absolute left-0 h-full w-[200%] ${className}`}
      style={{ animation: `buildbay-wave-scroll ${duration} linear infinite` }}
    >
      <svg
        viewBox="0 0 1600 100"
        preserveAspectRatio="none"
        className="h-full w-full"
        fill="currentColor"
      >
        <path
          d={`M0,${baseline + amplitude} C100,${baseline - amplitude} 200,${baseline + amplitude * 2} 300,${baseline + amplitude} C400,${baseline - amplitude} 500,${baseline + amplitude * 2} 600,${baseline + amplitude} C700,${baseline - amplitude} 800,${baseline + amplitude * 2} 800,${baseline + amplitude} C900,${baseline - amplitude} 1000,${baseline + amplitude * 2} 1100,${baseline + amplitude} C1200,${baseline - amplitude} 1300,${baseline + amplitude * 2} 1400,${baseline + amplitude} C1500,${baseline - amplitude} 1550,${baseline + amplitude * 2} 1600,${baseline + amplitude} L1600,100 L0,100 Z`}
        />
      </svg>
    </div>
  );
}

function Boat({ visitor, guestLabel }: { visitor: Visitor; guestLabel: string }) {
  // idから安定した「ランダムっぽい」位置・速度を作る（再描画のたびに動き回らないように）
  const { leftPercent, bobDuration, bobDelay, driftDuration } = useMemo(
    () => seededLayout(visitor.key),
    [visitor.key]
  );
  const [hovered, setHovered] = useState(false);
  const label = visitor.displayName || guestLabel;
  const initials = (visitor.displayName || "?").slice(0, 1).toUpperCase();

  return (
    <div
      data-live-wave
      className="group absolute -translate-x-1/2"
      style={{
        left: `${leftPercent}%`,
        top: "52%",
        animation: `buildbay-boat-drift ${driftDuration} ease-in-out infinite alternate`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        data-live-wave
        style={{ animation: `buildbay-boat-bob ${bobDuration} ease-in-out infinite`, animationDelay: bobDelay }}
      >
        {hovered && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-text-primary px-2 py-0.5 text-[10px] font-medium text-bg shadow-sm">
            {label}
          </div>
        )}
        <div className="relative flex flex-col items-center">
          <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-bg bg-surface shadow-sm">
            {visitor.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={visitor.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : visitor.displayName ? (
              <span className="font-display text-[9px] font-semibold text-accent-ai">{initials}</span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-text-dim/50" />
            )}
          </div>
          <svg width="22" height="10" viewBox="0 0 22 10" className="-mt-0.5 text-accent-signal">
            <path d="M1 1 L21 1 L17 9 L5 9 Z" fill="currentColor" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function seededLayout(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const rand = (n: number) => ((hash >>> n) % 100) / 100;

  return {
    leftPercent: 6 + rand(0) * 88,
    bobDuration: `${(2.2 + rand(4) * 1.6).toFixed(2)}s`,
    bobDelay: `-${(rand(8) * 2).toFixed(2)}s`,
    driftDuration: `${(5 + rand(12) * 4).toFixed(2)}s`,
  };
}
