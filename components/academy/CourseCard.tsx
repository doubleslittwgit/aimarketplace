import Link from "next/link";
import { useTranslations } from "next-intl";

export type CourseCardData = {
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  authorName: string;
  /** 出品者がStripeの本人確認と受け取り設定を完了しているか */
  verified: boolean;
  /** 作者自身のツールと紐付いた講座か（「作った人の講座」） */
  byMaker: boolean;
  /** 章の数（大見出しの数） */
  chapters: number;
  /** 無料で読める章の数（有料ラインより上の大見出しの数） */
  freeChapters: number;
  /** 有料ラインが引かれているか */
  hasPaywall: boolean;
};

/**
 * Academyの講座カード。
 * 「どこまで無料で読めるか」を必ず表示するのが特徴。
 * 章の数・無料の範囲は、講座の目次と有料ラインの位置から計算した実際の値で、
 * 出品者が自由に書ける宣伝文句ではない。
 */
export default function CourseCard({ course }: { course: CourseCardData }) {
  const t = useTranslations("academyHome");
  const isFree = course.price === 0;

  const freeRange = isFree
    ? t("card.allFree")
    : !course.hasPaywall
      ? t("card.tocOnly")
      : course.freeChapters > 0
        ? t("card.freeUntil", { n: course.freeChapters })
        : t("card.introFree");

  return (
    <Link
      href={`/academy/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[#E6DFCC] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_rgba(23,63,53,0.35)]"
    >
      <div className="relative aspect-video overflow-hidden bg-[#173F35]">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="ac-serif absolute inset-0 flex items-center p-4 text-[18px] font-bold leading-snug text-[#F7F3E8]">
            {course.title}
          </span>
        )}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {course.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#1F7A4D]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4Zm-1.2 14.2-3.6-3.6 1.4-1.4 2.2 2.2 5-5 1.4 1.4-6.4 6.4Z" />
              </svg>
              {t("card.verified")}
            </span>
          )}
          {course.byMaker && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A227] px-2 py-0.5 text-[10px] font-semibold text-white">
              {t("card.byMaker")}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-[14px] font-bold leading-snug text-[#1D2B25]">
          {course.title}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#173F35] text-[10px] font-semibold text-[#F7F3E8]">
              {course.authorName.slice(0, 1)}
            </span>
            <span className="truncate text-[12px] text-[#5E6A62]">{course.authorName}</span>
          </span>
          <span
            className={`shrink-0 text-[15px] font-bold ${isFree ? "text-[#1F7A4D]" : "text-[#9C7A12]"}`}
          >
            {isFree ? t("card.free") : `¥${course.price.toLocaleString()}`}
          </span>
        </div>
      </div>

      <div className="border-t border-[#EFE9D8] bg-[#FBF8F0] px-3.5 py-2 text-[11px] text-[#5E6A62]">
        {course.chapters > 0 && <>{t("card.chapters", { n: course.chapters })}・</>}
        {freeRange}
      </div>
    </Link>
  );
}
