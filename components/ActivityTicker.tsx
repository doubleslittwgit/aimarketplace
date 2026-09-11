import { tools, formatPrice } from "@/lib/mock-data";

// Simulated recent activity — in production this reads from real purchase events.
const activity = [
  { tool: tools[3], action: "購入", by: "台北のユーザー" },
  { tool: tools[5], action: "公開", by: tools[5].author.name },
  { tool: tools[0], action: "購入", by: "東京のユーザー" },
  { tool: tools[4], action: "購入", by: "大阪のユーザー" },
  { tool: tools[1], action: "更新 v1.9.2", by: tools[1].author.name },
  { tool: tools[2], action: "購入", by: "台中のユーザー" },
];

export default function ActivityTicker() {
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
                item.action === "購入"
                  ? "bg-accent-signal"
                  : item.action.startsWith("更新")
                    ? "bg-accent-ai"
                    : "bg-accent-success"
              }`}
            />
            <span className="text-text-secondary">{item.by}</span>
            <span>が</span>
            <span className="text-text-primary">{item.tool.name}</span>
            <span>を{item.action === "購入" ? `${formatPrice(item.tool.price)}で購入` : item.action}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
