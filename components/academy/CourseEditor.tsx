"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import { useTranslations } from "next-intl";
import { Paywall, VideoEmbed, LinkCard, CourseImage } from "@/lib/academy/extensions";
import { parseVideoUrl } from "@/lib/video-embed";
import type { JSONNode } from "@/lib/course-content";

/* ------------------------------------------------------------------ */
/* 本文中の部品の見た目（エディタ内だけの表示）                          */
/* ------------------------------------------------------------------ */

function PaywallView({ deleteNode }: NodeViewProps) {
  const t = useTranslations("academyEditor");
  return (
    <NodeViewWrapper className="course-paywall-editor" contentEditable={false} data-paywall="">
      <span className="course-paywall-label">{t("paywallLabel")}</span>
      <button
        type="button"
        onClick={deleteNode}
        className="course-paywall-remove"
        aria-label={t("removePaywall")}
        title={t("removePaywall")}
      >
        ×
      </button>
    </NodeViewWrapper>
  );
}

function VideoView({ node, deleteNode, selected }: NodeViewProps) {
  const t = useTranslations("academyEditor");
  const embed = parseVideoUrl(node.attrs.src as string);
  return (
    <NodeViewWrapper
      className={`course-video course-video-editor ${selected ? "is-selected" : ""}`}
      contentEditable={false}
    >
      {embed && <iframe src={embed.embedUrl} title={t("video")} />}
      {/* 編集中に動画をクリックしても再生されず、部品として選択できるよう覆いを置く */}
      <div className="course-video-shield" />
      <button type="button" onClick={deleteNode} className="course-node-remove" aria-label={t("remove")}>
        ×
      </button>
    </NodeViewWrapper>
  );
}

/* ------------------------------------------------------------------ */
/* ツールバーの部品                                                     */
/* ------------------------------------------------------------------ */

const TEXT_COLORS = ["#111827", "#6b7280", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#9333ea"];
const HIGHLIGHTS = ["#fef08a", "#fed7aa", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff"];

function Icon({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const I = {
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  bold: "M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z",
  italic: "M19 4h-9M14 20H5M15 4 9 20",
  underline: "M6 4v6a6 6 0 0 0 12 0V4M4 20h16",
  strike: "M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16",
  alignLeft: "M21 6H3M15 12H3M17 18H3",
  alignCenter: "M21 6H3M17 12H7M19 18H5",
  alignRight: "M21 6H3M21 12H9M21 18H7",
  bullet: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  ordered: "M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",
  quote: "M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  image: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  video: "m22 8-6 4 6 4V8zM2 6h14v12H2z",
  card: "M3 5h18v14H3zM7 9h10M7 13h6",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
};

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // mousedownで既定動作を止め、ボタンを押しても本文の選択範囲が外れないようにする
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 text-[13px] transition disabled:opacity-40 ${
        active ? "bg-accent-signal/15 text-accent-signal" : "text-text-secondary hover:bg-surface-raised"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

type Menu = null | "color" | "highlight" | "link" | "video" | "linkCard";

/* ------------------------------------------------------------------ */
/* エディタ本体                                                         */
/* ------------------------------------------------------------------ */

export default function CourseEditor({
  initialContent,
  onChange,
  uploadImage,
  isPaid,
  toolbarTop,
}: {
  initialContent: JSONNode;
  onChange: (doc: JSONNode) => void;
  /** 画像ファイルを保存し、公開URLを返す（失敗時はnull） */
  uploadImage: (file: File) => Promise<string | null>;
  /** 有料の講座のときだけ「ここから有料」を出す */
  isPaid: boolean;
  /** ツールバーを固定する位置（上部バーの高さ） */
  toolbarTop: number;
}) {
  const t = useTranslations("academyEditor");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [menuError, setMenuError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // 「ここから有料」タブの表示位置（カーソルのある段落のすぐ下）
  const [tab, setTab] = useState<{ top: number; left: number; afterPos: number } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          // javascript: などのリンクはエディタの段階でも受け付けない（保存時にも再検証する）
          isAllowedUri: (url, ctx) => /^https?:\/\//i.test(url) && ctx.defaultValidate(url),
        },
      }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CourseImage.configure({
        resize: {
          enabled: true,
          directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
          minWidth: 80,
          minHeight: 40,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Paywall.extend({ addNodeView: () => ReactNodeViewRenderer(PaywallView) }),
      VideoEmbed.extend({ addNodeView: () => ReactNodeViewRenderer(VideoView) }),
      LinkCard,
      Placeholder.configure({ placeholder: t("placeholder") }),
    ],
    content: initialContent,
    editorProps: { attributes: { class: "course-content course-editor-area" } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as JSONNode),
  });

  // カーソル位置が変わるたびに、「ここから有料」タブの位置を計算し直す
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const wrap = wrapperRef.current;
      if (!isPaid || !wrap || !editor.isFocused) return setTab(null);
      const { selection, doc } = editor.state;
      const $from = selection.$from;
      const topPos = $from.depth >= 1 ? $from.before(1) : selection.from;
      const block = doc.nodeAt(topPos);
      if (!block || block.type.name === "paywall") return setTab(null);
      const dom = editor.view.nodeDOM(topPos) as HTMLElement | null;
      if (!dom?.getBoundingClientRect) return setTab(null);
      const w = wrap.getBoundingClientRect();
      const r = dom.getBoundingClientRect();
      setTab({ top: r.bottom - w.top + 2, left: r.left - w.left, afterPos: topPos + block.nodeSize });
    };
    const hide = () => setTimeout(() => !editor.isFocused && setTab(null), 150);
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    editor.on("focus", update);
    editor.on("blur", hide);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
      editor.off("focus", update);
      editor.off("blur", hide);
    };
  }, [editor, isPaid]);

  if (!editor) {
    return <div className="min-h-[50vh] rounded-xl border border-border bg-surface" />;
  }

  const hasPaywall = (() => {
    let found = false;
    editor.state.doc.forEach((n) => {
      if (n.type.name === "paywall") found = true;
    });
    return found;
  })();

  /** 有料ラインを指定位置に引く。既に引いてあれば、そこから移動する（常に1本だけ） */
  function placePaywall(ed: Editor, afterPos: number) {
    const { state, view } = ed;
    let tr = state.tr;
    let existing: number | null = null;
    state.doc.forEach((n, offset) => {
      if (n.type.name === "paywall") existing = offset;
    });
    if (existing !== null) tr = tr.delete(existing, existing + 1);
    tr = tr.insert(tr.mapping.map(afterPos), state.schema.nodes.paywall.create());
    view.dispatch(tr.scrollIntoView());
    ed.commands.focus();
  }

  function placePaywallAtCursor() {
    if (!editor) return;
    const { selection } = editor.state;
    const $from = selection.$from;
    const topPos = $from.depth >= 1 ? $from.before(1) : selection.from;
    const block = editor.state.doc.nodeAt(topPos);
    placePaywall(editor, block ? topPos + block.nodeSize : editor.state.doc.content.size);
  }

  const blockType = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : "p";
  const defaultSize = blockType === "h2" ? 24 : blockType === "h3" ? 19 : 16;
  const fontSize =
    parseInt(String(editor.getAttributes("textStyle").fontSize ?? ""), 10) || defaultSize;
  const imageSelected = editor.isActive("image");

  function changeFontSize(delta: number) {
    const next = Math.min(64, Math.max(10, fontSize + delta));
    editor?.chain().focus().setFontSize(`${next}px`).run();
  }

  function openMenu(m: Menu) {
    setMenuError(null);
    setUrlInput(m === "link" ? String(editor?.getAttributes("link").href ?? "") : "");
    setTitleInput("");
    setMenu(menu === m ? null : m);
  }

  function submitUrl() {
    if (!editor) return;
    const url = urlInput.trim();
    if (menu === "link") {
      if (!url) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      } else if (!/^https?:\/\//i.test(url)) {
        return setMenuError(t("invalidUrl"));
      } else if (editor.state.selection.empty) {
        editor.chain().focus().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }
    } else if (menu === "video") {
      if (!parseVideoUrl(url)) return setMenuError(t("invalidVideo"));
      editor.chain().focus().insertContent({ type: "videoEmbed", attrs: { src: url } }).run();
    } else if (menu === "linkCard") {
      if (!/^https?:\/\//i.test(url)) return setMenuError(t("invalidUrl"));
      editor
        .chain()
        .focus()
        .insertContent({ type: "linkCard", attrs: { href: url, title: titleInput.trim() || null } })
        .run();
    }
    setMenu(null);
  }

  async function onPickImage(file: File | undefined) {
    if (!file || !editor) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }

  return (
    <div>
      {/* ------- ツールバー（Canvaのように上部に固定） ------- */}
      <div
        className="sticky z-30 -mx-4 border-b border-border bg-bg/95 px-4 py-1.5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border"
        style={{ top: toolbarTop }}
      >
        <div className="flex items-center gap-0.5 overflow-x-auto">
          <Btn label={t("undo")} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
            <Icon d={I.undo} />
          </Btn>
          <Btn label={t("redo")} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
            <Icon d={I.redo} />
          </Btn>
          <Sep />

          <select
            value={blockType}
            aria-label={t("blockType")}
            onChange={(e) => {
              const v = e.target.value;
              const c = editor.chain().focus();
              if (v === "p") c.setParagraph().run();
              else c.setHeading({ level: v === "h2" ? 2 : 3 }).run();
            }}
            className="h-8 shrink-0 rounded-md border border-border bg-surface px-2 text-[13px] text-text-primary outline-none"
          >
            <option value="p">{t("paragraph")}</option>
            <option value="h2">{t("heading2")}</option>
            <option value="h3">{t("heading3")}</option>
          </select>

          {/* 文字サイズ（Canvaと同じ － 数値 ＋ の形） */}
          <div className="ml-1 flex h-8 shrink-0 items-center rounded-md border border-border">
            <Btn label={t("smaller")} onClick={() => changeFontSize(-2)}>−</Btn>
            <span className="w-7 text-center font-mono text-[12px] text-text-primary">{fontSize}</span>
            <Btn label={t("larger")} onClick={() => changeFontSize(2)}>＋</Btn>
          </div>
          <Sep />

          <div className="relative flex">
            <Btn label={t("textColor")} active={menu === "color"} onClick={() => openMenu("color")}>
              <span className="flex flex-col items-center leading-none">
                <span className="text-[14px] font-semibold">A</span>
                <span className="mt-0.5 h-1 w-4 rounded-sm" style={{ background: editor.getAttributes("textStyle").color || "#111827" }} />
              </span>
            </Btn>
            <Btn label={t("highlight")} active={menu === "highlight"} onClick={() => openMenu("highlight")}>
              <span className="rounded-sm px-1 text-[13px] font-semibold" style={{ background: "#fef08a", color: "#111827" }}>A</span>
            </Btn>
          </div>
          <Sep />

          <Btn label={t("bold")} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Icon d={I.bold} />
          </Btn>
          <Btn label={t("italic")} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Icon d={I.italic} />
          </Btn>
          <Btn label={t("underline")} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <Icon d={I.underline} />
          </Btn>
          <Btn label={t("strike")} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Icon d={I.strike} />
          </Btn>
          <Sep />

          {/* 画像を選択中は、揃え方のボタンが「画像の配置」に切り替わる */}
          {(["left", "center", "right"] as const).map((al) => (
            <Btn
              key={al}
              label={t(imageSelected ? `image_${al}` : `align_${al}`)}
              active={
                imageSelected
                  ? (editor.getAttributes("image").align ?? "center") === al
                  : editor.isActive({ textAlign: al })
              }
              onClick={() =>
                imageSelected
                  ? editor.chain().focus().updateAttributes("image", { align: al }).run()
                  : editor.chain().focus().setTextAlign(al).run()
              }
            >
              <Icon d={al === "left" ? I.alignLeft : al === "center" ? I.alignCenter : I.alignRight} />
            </Btn>
          ))}
          {imageSelected && (
            <Btn label={t("deleteImage")} onClick={() => editor.chain().focus().deleteSelection().run()}>
              <Icon d={I.trash} />
            </Btn>
          )}
          <Sep />

          <Btn label={t("bulletList")} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <Icon d={I.bullet} />
          </Btn>
          <Btn label={t("orderedList")} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <Icon d={I.ordered} />
          </Btn>
          <Btn label={t("quote")} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Icon d={I.quote} />
          </Btn>
          <Btn label={t("code")} active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Icon d={I.code} />
          </Btn>
          <Sep />

          <Btn label={t("link")} active={editor.isActive("link") || menu === "link"} onClick={() => openMenu("link")}>
            <Icon d={I.link} />
          </Btn>
          <Btn label={t("image")} disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <span className="text-[11px]">…</span> : <Icon d={I.image} />}
          </Btn>
          <Btn label={t("video")} active={menu === "video"} onClick={() => openMenu("video")}>
            <Icon d={I.video} />
          </Btn>
          <Btn label={t("linkCard")} active={menu === "linkCard"} onClick={() => openMenu("linkCard")}>
            <Icon d={I.card} />
          </Btn>

          {isPaid && (
            <>
              <Sep />
              <Btn label={hasPaywall ? t("paywallMove") : t("paywallHere")} onClick={placePaywallAtCursor}>
                <span className="flex items-center gap-1 text-accent-signal">
                  <Icon d={I.lock} />
                  <span className="whitespace-nowrap text-[12px] font-medium">{t("paywallShort")}</span>
                </span>
              </Btn>
            </>
          )}
        </div>

        {/* ------- ツールバーから開く小さな入力欄 ------- */}
        {(menu === "color" || menu === "highlight") && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pb-1">
            {(menu === "color" ? TEXT_COLORS : HIGHLIGHTS).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const ch = editor.chain().focus();
                  if (menu === "color") ch.setColor(c).run();
                  else ch.setHighlight({ color: c }).run();
                  setMenu(null);
                }}
                className="h-6 w-6 rounded-full border border-border"
                style={{ background: c }}
              />
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const ch = editor.chain().focus();
                if (menu === "color") ch.unsetColor().run();
                else ch.unsetHighlight().run();
                setMenu(null);
              }}
              className="ml-1 rounded-md border border-border px-2 py-0.5 text-[12px] text-text-muted hover:bg-surface-raised"
            >
              {t("resetColor")}
            </button>
          </div>
        )}
        {(menu === "link" || menu === "video" || menu === "linkCard") && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 pb-1">
            <input
              autoFocus
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitUrl())}
              placeholder={t(menu === "video" ? "videoPlaceholder" : "urlPlaceholder")}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
            />
            {menu === "linkCard" && (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder={t("linkCardTitle")}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
              />
            )}
            <button type="button" onClick={submitUrl} className="rounded-md bg-accent-signal px-3 py-1.5 text-[12px] font-medium text-white">
              {menu === "link" && !urlInput.trim() ? t("removeLink") : t("insert")}
            </button>
            <button type="button" onClick={() => setMenu(null)} className="text-[12px] text-text-muted">
              {t("cancel")}
            </button>
            {menuError && <p className="w-full text-[12px] text-accent-danger">{menuError}</p>}
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onPickImage(e.target.files?.[0])}
      />

      {/* ------- 本文 ------- */}
      <div ref={wrapperRef} className="relative mt-5">
        <EditorContent editor={editor} />

        {/* カーソルのある段落のすぐ下に出る「ここから有料」タブ */}
        {tab && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => placePaywall(editor, tab.afterPos)}
            className="absolute z-10 flex items-center gap-1 rounded-full border border-dashed border-accent-signal/60 bg-bg px-2.5 py-0.5 text-[11px] font-medium text-accent-signal shadow-sm transition hover:bg-accent-signal/10"
            style={{ top: tab.top, left: Math.max(0, tab.left) }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d={I.lock} />
            </svg>
            {hasPaywall ? t("paywallMove") : t("paywallHere")}
          </button>
        )}
      </div>
    </div>
  );
}
