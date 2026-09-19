import { useTranslations } from "next-intl";
import { tools, formatPrice } from "@/lib/mock-data";

// Simulated recent activity — in production this reads from real purchase events.
const activity: (
  | { type: "purchased"; tool: (typeof tools)[number]; by: string }
  | { type: "published"; tool: (typeof tools)[number]; by: string }
  | { type: "updated"; tool: (typeof tools)[number]; by: string; version: string }
)[] = [
  { type: "purchased", tool: tools[3], by: "台北のユーザー" },
  { type: "published", tool: tools[5], by: tools[5].author.name },
  { type: "purchased", tool: tools[0], by: "東京のユーザー" },
  { type: "purchased", tool: tools[4], by: "大阪のユーザー" },
  { type: "updated", tool: tools[1], by: tools[1].author.name, version: "v1.9.2" },
  { type: "purchased", tool: tools[2], by: "台中のユーザー" },
];

export default function ActivityTicker() {
  const t = useTranslations("activity");
  const line = [...activity, ...activity]; // duplicate for seamless loop

  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/60 py-2.5">
      <div className="flex w-max animate-[ticker_32s_linear_infinite] gap-8">
        {line.map((item, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-2 font-mono text-[12px] text-text-muted"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                item.type === "purchased"
                  ? "bg-accent-signal"
                  : item.type === "updated"
                    ? "bg-accent-ai"
                    : "bg-accent-success"
              }`}
            />
            <span className="text-text-primary">
              {item.type === "purchased" &&
                t("purchased", { by: item.by, tool: item.tool.name, price: formatPrice(item.tool.price) })}
              {item.type === "published" &&
                t("published", { by: item.by, tool: item.tool.name })}
              {item.type === "updated" &&
                t("updated", { by: item.by, tool: item.tool.name, version: item.version })}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
