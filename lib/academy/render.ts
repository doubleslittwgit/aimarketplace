import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Paywall, VideoEmbed, LinkCard, CourseImage } from "@/lib/academy/extensions";
import { validateCourseDoc, type JSONNode } from "@/lib/course-content";

/**
 * 講座本文（TipTapのJSON）を、講座ページに表示するHTMLへ変換する。
 *
 * 保存時にも検証しているが、表示の直前にもう一度 validateCourseDoc を通す。
 * データベースが直接書き換えられた場合でも、許可した要素・属性以外は
 * 画面に出ないようにするため（二重の守り）。
 * エディタと同じ部品定義（lib/academy/extensions.ts）を使うので、
 * 書いた見た目と表示される見た目が一致する。
 */
const extensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  TextStyle,
  Color,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  CourseImage,
  Paywall,
  VideoEmbed,
  LinkCard,
];

export function renderCourseHtml(doc: JSONNode | null | undefined): string {
  if (!doc) return "";
  const v = validateCourseDoc(doc);
  if (!v.ok) return "";
  return generateHTML(v.doc, extensions);
}
