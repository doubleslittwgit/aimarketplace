import { parseVideoUrl } from "@/lib/video-embed";

/**
 * BuildBay Academy の講座本文（TipTapのJSON）を扱う共通処理。
 *
 * 【なぜサーバーで検証するのか】
 * 本文はブラウザのエディタで作られたJSONだが、送信内容は改ざんできる。
 * 検証せずに保存・表示すると、任意の外部画像や `javascript:` リンク、
 * 想定外の要素を講座ページに埋め込めてしまう。許可した要素と属性だけを
 * 通し、それ以外は保存前に拒否する（許可リスト方式）。
 *
 * 【有料ラインと保存場所】
 * 本文の最上位にある paywall ノードより前が「無料で見せる部分」。
 * 無料部分と目次だけを誰でも読める courses に保存し、全文は
 * 購入者などに限定した course_bodies（金庫）にだけ保存する。
 */

export type JSONNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type TocItem = { level: 2 | 3; text: string };

const ALLOWED_NODES = new Set([
  "doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem",
  "blockquote", "codeBlock", "hardBreak", "horizontalRule",
  "image", "paywall", "videoEmbed", "linkCard",
]);
const ALLOWED_MARKS = new Set([
  "bold", "italic", "underline", "strike", "code", "link", "textStyle", "highlight",
]);

const MAX_JSON_LENGTH = 1_000_000;
const MAX_DEPTH = 24;

const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|var\(--[a-z0-9-]+\))$/;
const SAFE_FONT_SIZE = /^\d{1,3}(\.\d+)?px$/;
const SAFE_ALIGN = new Set(["left", "center", "right", "justify"]);
const IMAGE_ALIGN = new Set(["left", "center", "right"]);

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** 画像は、自分たちのストレージに置かれたものだけを許可する */
function isOwnStorageImage(src: unknown): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    typeof src === "string" &&
    !!base &&
    src.startsWith(`${base}/storage/v1/object/public/tool-images/`)
  );
}

/** reason はエラーの種類を表すコード（画面側で各言語の文に変換する） */
export type ValidationResult = { ok: true; doc: JSONNode } | { ok: false; reason: string };

/** 本文を検証し、属性を安全な値だけに整えたコピーを返す */
export function validateCourseDoc(input: unknown): ValidationResult {
  let raw: string;
  try {
    raw = JSON.stringify(input);
  } catch {
    return { ok: false, reason: "invalidFormat" };
  }
  if (raw.length > MAX_JSON_LENGTH) {
    return { ok: false, reason: "tooLong" };
  }

  const root = input as JSONNode;
  if (!root || root.type !== "doc") {
    return { ok: false, reason: "invalidFormat" };
  }

  let paywallCount = 0;

  function walk(node: JSONNode, depth: number, isTopLevel: boolean): JSONNode | string {
    if (depth > MAX_DEPTH) return "tooDeep";
    if (!node || typeof node.type !== "string" || !ALLOWED_NODES.has(node.type)) {
      return "disallowedNode";
    }

    const out: JSONNode = { type: node.type };
    const a = node.attrs ?? {};

    switch (node.type) {
      case "text":
        if (typeof node.text !== "string") return "invalidFormat";
        out.text = node.text;
        break;
      case "heading": {
        const level = a.level === 3 ? 3 : 2;
        out.attrs = { level, textAlign: SAFE_ALIGN.has(String(a.textAlign)) ? a.textAlign : null };
        break;
      }
      case "paragraph":
        out.attrs = { textAlign: SAFE_ALIGN.has(String(a.textAlign)) ? a.textAlign : null };
        break;
      case "orderedList":
        out.attrs = { start: Number.isInteger(a.start) ? a.start : 1 };
        break;
      case "codeBlock":
        out.attrs = { language: typeof a.language === "string" ? a.language.slice(0, 20) : null };
        break;
      case "image": {
        if (!isOwnStorageImage(a.src)) return "imageNotAllowed";
        const num = (v: unknown) =>
          typeof v === "number" && v > 0 && v < 5000 ? Math.round(v) : null;
        out.attrs = {
          src: a.src,
          alt: typeof a.alt === "string" ? a.alt.slice(0, 200) : null,
          width: num(a.width),
          height: num(a.height),
          align: IMAGE_ALIGN.has(String(a.align)) ? a.align : "center",
        };
        break;
      }
      case "videoEmbed":
        if (typeof a.src !== "string" || !parseVideoUrl(a.src)) {
          return "invalidVideo";
        }
        out.attrs = { src: a.src };
        break;
      case "linkCard":
        if (!isHttpUrl(a.href)) return "invalidLinkCard";
        out.attrs = {
          href: a.href,
          title: typeof a.title === "string" ? a.title.slice(0, 200) : null,
        };
        break;
      case "paywall":
        if (!isTopLevel) return "paywallNested";
        paywallCount += 1;
        if (paywallCount > 1) return "multiplePaywalls";
        break;
    }

    if (node.marks?.length) {
      const marks: NonNullable<JSONNode["marks"]> = [];
      for (const m of node.marks) {
        if (!ALLOWED_MARKS.has(m.type)) return "disallowedMark";
        const ma = m.attrs ?? {};
        if (m.type === "link") {
          if (!isHttpUrl(ma.href)) return "invalidLink";
          marks.push({ type: "link", attrs: { href: ma.href, target: "_blank", rel: "noopener noreferrer nofollow" } });
        } else if (m.type === "textStyle") {
          marks.push({
            type: "textStyle",
            attrs: {
              color: SAFE_COLOR.test(String(ma.color ?? "")) ? ma.color : null,
              fontSize: SAFE_FONT_SIZE.test(String(ma.fontSize ?? "")) ? ma.fontSize : null,
            },
          });
        } else if (m.type === "highlight") {
          marks.push({ type: "highlight", attrs: { color: SAFE_COLOR.test(String(ma.color ?? "")) ? ma.color : null } });
        } else {
          marks.push({ type: m.type });
        }
      }
      out.marks = marks;
    }

    if (node.content?.length) {
      const children: JSONNode[] = [];
      for (const child of node.content) {
        const r = walk(child, depth + 1, node.type === "doc");
        if (typeof r === "string") return r;
        children.push(r);
      }
      out.content = children;
    }
    return out;
  }

  const result = walk(root, 0, false);
  if (typeof result === "string") return { ok: false, reason: result };
  return { ok: true, doc: result };
}

/** 有料ラインの位置で、無料部分と全文に分ける */
export function splitAtPaywall(doc: JSONNode): { free: JSONNode; hasPaywall: boolean } {
  const blocks = doc.content ?? [];
  const idx = blocks.findIndex((b) => b.type === "paywall");
  if (idx === -1) return { free: doc, hasPaywall: false };
  return { free: { type: "doc", content: blocks.slice(0, idx) }, hasPaywall: true };
}

function textOf(node: JSONNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textOf).join("");
}

/**
 * 目次を全文の見出しから作る。
 * 目次は有料部分の見出しも含めて必ず公開する（「何が学べるか」を
 * 買う前に必ず確認できるようにするルール）。見出しの文字だけで、本文は含まない。
 */
export function buildToc(doc: JSONNode): TocItem[] {
  return (doc.content ?? [])
    .filter((b) => b.type === "heading")
    .map((b) => ({ level: (b.attrs?.level === 3 ? 3 : 2) as 2 | 3, text: textOf(b).trim().slice(0, 120) }))
    .filter((t) => t.text.length > 0)
    .slice(0, 100);
}

export const EMPTY_DOC: JSONNode = { type: "doc", content: [{ type: "paragraph" }] };
