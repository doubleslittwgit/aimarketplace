import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { parseVideoUrl } from "@/lib/video-embed";

/**
 * BuildBay Academy の講座本文で使う独自の部品。
 *
 * エディタ（ブラウザ）と、講座ページの表示（サーバー）の両方で同じ定義を使う。
 * どちらかだけ直すと、書いた見た目と表示される見た目がずれてしまうため。
 * ここには画面部品（React）を含めず、HTMLへの書き出し方だけを定義する。
 */

/** 有料ライン。本文の最上位に1本だけ置ける（検証は lib/course-content.ts） */
export const Paywall = Node.create({
  name: "paywall",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  parseHTML() {
    return [{ tag: "div[data-paywall]" }];
  },
  renderHTML() {
    return ["div", { "data-paywall": "", class: "course-paywall" }];
  },
});

/** YouTube / Vimeo の動画。保存するのは元のURLで、埋め込み先は毎回組み立て直す */
export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-video-embed]",
        getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute("data-src") }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const embed = parseVideoUrl(HTMLAttributes.src as string);
    return [
      "div",
      { "data-video-embed": "", "data-src": HTMLAttributes.src, class: "course-video" },
      embed
        ? [
            "iframe",
            {
              src: embed.embedUrl,
              allow: "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
              allowfullscreen: "true",
              loading: "lazy",
              referrerpolicy: "strict-origin-when-cross-origin",
            },
          ]
        : ["span", {}, ""],
    ];
  },
});

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/** リンクカード（外部ページへの案内を、目立つ枠で表示する） */
export const LinkCard = Node.create({
  name: "linkCard",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return { href: { default: null }, title: { default: null } };
  },
  parseHTML() {
    return [
      {
        tag: "a[data-link-card]",
        getAttrs: (el) => ({
          href: (el as HTMLElement).getAttribute("href"),
          title: (el as HTMLElement).getAttribute("data-title"),
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const href = String(HTMLAttributes.href ?? "");
    const host = hostOf(href);
    return [
      "a",
      mergeAttributes({
        href,
        "data-link-card": "",
        "data-title": HTMLAttributes.title ?? "",
        target: "_blank",
        rel: "noopener noreferrer nofollow",
        class: "course-link-card",
      }),
      ["span", { class: "course-link-card-title" }, HTMLAttributes.title || host],
      ["span", { class: "course-link-card-host" }, host],
    ];
  },
});

/** 画像。標準の画像部品に「左・中央・右揃え」の情報を足したもの */
export const CourseImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    };
  },
});
