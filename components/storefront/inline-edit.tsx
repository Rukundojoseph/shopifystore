"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType } from "react";
import type { ListItem, SettingValue } from "@/lib/editor/schema";

// In-canvas text editing. The editor canvas wraps each section in an
// <InlineEditProvider>; storefront pages don't, so <Editable> renders plain
// text there and nothing about the public site changes.

/** `settings` is a section's settings or a layout node's props. */
type InlineEditApi = { settings: Record<string, unknown>; onChange: (key: string, value: SettingValue) => void };

const InlineEditContext = createContext<InlineEditApi | null>(null);
export const InlineEditProvider = InlineEditContext.Provider;

type Props = {
  /** Setting key on the section, e.g. "heading" — or the list key when `item` is set. */
  k: string;
  value: string;
  /** For list settings: index of the item and the field inside it. */
  item?: number;
  field?: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Enter inserts a line break instead of finishing the edit. */
  multiline?: boolean;
};

type CaretDoc = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** Collapsed range at a screen point, so the caret lands where the user double-clicked. */
function rangeAtPoint(x: number, y: number): Range | null {
  const doc = document as CaretDoc;
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const r = document.createRange();
    r.setStart(pos.offsetNode, pos.offset);
    r.collapse(true);
    return r;
  }
  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

export function Editable({ k, value, item, field, as: Tag = "span", className, style, multiline }: Props) {
  const api = useContext(InlineEditContext);
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  // Bumped after every edit so React remounts the node instead of
  // reconciling against DOM text the browser has already changed.
  const [version, setVersion] = useState(0);
  const clickPoint = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    el.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (!sel) return;
    const p = clickPoint.current;
    let range = p ? rangeAtPoint(p.x, p.y) : null;
    if (!range || !el.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }, [editing]);

  if (!api) return <Tag className={className} style={style}>{value}</Tag>;

  const finish = (save: boolean) => {
    const el = ref.current;
    if (save && el) {
      let text = el.innerText.replace(/ /g, " ").replace(/\n$/, "");
      if (!multiline) text = text.replace(/\s*\n\s*/g, " ").trim();
      if (text !== value) {
        if (item !== undefined && field) {
          const current = api.settings[k];
          const items: ListItem[] = Array.isArray(current) ? current : [];
          api.onChange(k, items.map((it, i) => (i === item ? { ...it, [field]: text } : it)));
        } else {
          api.onChange(k, text);
        }
      }
    }
    setEditing(false);
    setVersion((v) => v + 1);
  };

  return (
    <Tag
      key={version}
      ref={ref}
      className={[
        className,
        "cursor-text rounded-[2px] outline-offset-2",
        editing ? "outline-2 outline-solid outline-brand-500" : "hover:outline-1 hover:outline-dashed hover:outline-current/50",
        !value && "inline-block min-w-[4ch] opacity-50",
      ].filter(Boolean).join(" ")}
      style={style}
      title={editing ? undefined : "Double-click to edit"}
      contentEditable={editing ? "plaintext-only" : undefined}
      suppressContentEditableWarning
      spellCheck={editing}
      draggable={false}
      onDoubleClick={(e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (editing) return;
        clickPoint.current = { x: e.clientX, y: e.clientY };
        setEditing(true);
      }}
      onClick={editing ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
      onBlur={editing ? () => finish(true) : undefined}
      onKeyDown={editing ? (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
        else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); ref.current?.blur(); }
      } : undefined}
      onPaste={editing ? (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, multiline ? text : text.replace(/\s*\n\s*/g, " "));
      } : undefined}
    >
      {value}
    </Tag>
  );
}
