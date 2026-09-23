
/**
 * BuildBay Academy で使う小さなアイコン部品。
 * （以前はAcademy専用のヘッダーとフッターもここにあったが、BuildBay全体の
 *   見た目を揃えるため、サイト共通のヘッダー・フッターに置き換えた）
 */

export function AcIcon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export const AC_BOOK = "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5a2.5 2.5 0 0 1 0-5";

