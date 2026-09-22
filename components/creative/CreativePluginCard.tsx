import Link from "next/link";
import { formatInstalls } from "@/lib/mock-data";
import { CREATIVE_APPS } from "@/lib/creative-apps";
import type { Tool } from "@/lib/mock-data";

export default function CreativePluginCard({ tool }: { tool: Tool & { host_apps?: string[] } }) {
  const primaryApp = CREATIVE_APPS.find((a) => tool.host_apps?.includes(a.slug));

  return (
    <Link
      href={`/apps/${tool.slug}`}
      className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-white/25 hover:bg-white/[0.06]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-transparent">
        {tool.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tool.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-3xl font-bold text-white/15">{tool.name.slice(0, 1)}</span>
          </div>
        )}
        {primaryApp && (
          <span
            className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-lg"
            style={{ backgroundColor: primaryApp.color }}
          >
            {primaryApp.shortLabel}
          </span>
        )}
      </div>

      <div className="p-3.5">
        <p className="truncate text-[13px] font-semibold text-white">{tool.name}</p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-white/50">{tool.tagline}</p>

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-white">
            {tool.price === 0 ? "無料" : `¥${tool.price.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-2.5 text-[11px] text-white/40">
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
              {formatInstalls(tool.likes)}
            </span>
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
              </svg>
              {formatInstalls(tool.installs)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
