/**
 * BuildBay Academy の講座カテゴリ。
 * DBの courses.category にはこのスラッグだけが入る（DB側のcheck制約と一致させること）。
 * 表示名は messages/*.json の academyHome.categories.<slug> にある。
 */
export const COURSE_CATEGORIES = [
  "beginner",
  "productivity",
  "product",
  "webapp",
  "automation",
  "creative",
  "monetize",
  "ai-usage",
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export function isCourseCategory(v: unknown): v is CourseCategory {
  return typeof v === "string" && (COURSE_CATEGORIES as readonly string[]).includes(v);
}

/** カテゴリごとのアイコン（SVGのpath） */
export const CATEGORY_ICONS: Record<CourseCategory, string> = {
  beginner: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5a2.5 2.5 0 0 1 0-5",
  productivity: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  product: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  webapp: "M2 4h20v13H2zM8 21h8M12 17v4",
  automation: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  creative: "M12 22a10 10 0 1 1 10-10c0 2-1.5 3-3 3h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22zM6.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM9.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM14.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  monetize: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  "ai-usage": "M12 2a4 4 0 0 1 4 4 4 4 0 0 1 2 7.5A4 4 0 0 1 14 20h-4a4 4 0 0 1-4-6.5A4 4 0 0 1 8 6a4 4 0 0 1 4-4zM12 2v18",
};
