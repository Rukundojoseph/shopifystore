"use client";

import { useState, type ReactNode } from "react";
import { Link2, Link2Off, Monitor, RotateCcw, Smartphone, Tablet } from "lucide-react";
import { COLOR_TOKENS, type Device } from "@/lib/editor/schema";
import { cn } from "@/components/ui";

// Small, reusable inputs for the Style / Advanced tabs.

export const inputCls = "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
export const DEVICE_ICON: Record<Device, typeof Monitor> = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

export type Length = { v: number; u: string };
export type Box = { t: number; r: number; b: number; l: number; u: "px" | "%" | "em" | "rem" };

/**
 * One labelled control row. Shows which device the value comes from; when it
 * is set on the device being edited, offers a reset back to the inherited value.
 */
export function Field({ label, device, source, onReset, children, inline }: {
  label: string;
  device: Device;
  source: Device | null;
  onReset: () => void;
  children: ReactNode;
  inline?: boolean;
}) {
  const Icon = DEVICE_ICON[device];
  const here = source === device;
  return (
    <div className={cn("flex gap-2", inline ? "items-center justify-between" : "flex-col")}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
        {label}
        {device !== "desktop" && <Icon className={cn("h-3 w-3", here ? "text-brand-600" : "text-zinc-300")} aria-label={here ? `Set for ${device}` : `Inherited${source ? ` from ${source}` : ""}`} />}
        {here && (
          <button type="button" onClick={onReset} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" title={device === "desktop" ? "Clear" : `Reset to ${source === "mobile" ? "tablet/desktop" : "desktop"} value`}>
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className={inline ? "shrink-0" : ""}>{children}</div>
    </div>
  );
}

export function ButtonGroup<T extends string>({ value, options, onChange }: { value: T | undefined; options: { value: T; label: string; icon?: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md border border-zinc-300 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("flex flex-1 items-center justify-center rounded px-1.5 py-1 text-[11px]", value === o.value ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  );
}

export function NumberInput({ value, onChange, min, max, step = 1, placeholder, suffix }: { value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; step?: number; placeholder?: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className={inputCls}
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder ?? "Auto"}
        onChange={(e) => {
          if (e.target.value === "") return onChange(undefined);
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
        }}
      />
      {suffix && <span className="text-[11px] text-zinc-400">{suffix}</span>}
    </div>
  );
}

const LENGTH_UNITS = ["px", "%", "em", "rem", "vw", "vh"] as const;

export function LengthInput({ value, onChange, units = LENGTH_UNITS, min = -5000, max = 5000 }: { value: Length | undefined; onChange: (v: Length | undefined) => void; units?: readonly string[]; min?: number; max?: number }) {
  const unit = value?.u ?? units[0];
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className={inputCls}
        value={value?.v ?? ""}
        min={min}
        max={max}
        placeholder="Auto"
        onChange={(e) => {
          if (e.target.value === "") return onChange(undefined);
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange({ v: Math.min(max, Math.max(min, n)), u: unit });
        }}
      />
      <select className={cn(inputCls, "w-14 px-1")} value={unit} onChange={(e) => onChange({ v: value?.v ?? 0, u: e.target.value })} aria-label="Unit">
        {units.map((u) => <option key={u}>{u}</option>)}
      </select>
    </div>
  );
}

/** Elementor-style four-sided spacing input with a link toggle. */
export function BoxInput({ value, onChange, allowNegative }: { value: Box | undefined; onChange: (v: Box | undefined) => void; allowNegative?: boolean }) {
  const [linked, setLinked] = useState(() => !value || (value.t === value.r && value.r === value.b && value.b === value.l));
  const v: Box = value ?? { t: 0, r: 0, b: 0, l: 0, u: "px" };
  const min = allowNegative ? -2000 : 0;
  const set = (side: "t" | "r" | "b" | "l", raw: string) => {
    if (raw === "" && linked) return onChange(undefined);
    const n = Math.min(2000, Math.max(min, Number(raw) || 0));
    onChange(linked ? { ...v, t: n, r: n, b: n, l: n } : { ...v, [side]: n });
  };
  return (
    <div className="flex items-end gap-1">
      {(["t", "r", "b", "l"] as const).map((side) => (
        <label key={side} className="flex flex-1 flex-col items-center gap-0.5">
          <input type="number" className={cn(inputCls, "px-1 text-center")} min={min} max={2000} value={value ? v[side] : ""} placeholder="–" onChange={(e) => set(side, e.target.value)} />
          <span className="text-[10px] uppercase text-zinc-400">{{ t: "Top", r: "Right", b: "Bottom", l: "Left" }[side]}</span>
        </label>
      ))}
      <div className="flex flex-col items-center gap-0.5">
        <button type="button" onClick={() => setLinked((x) => !x)} className={cn("rounded-md border p-1", linked ? "border-brand-500 bg-brand-50 text-brand-700" : "border-zinc-300 text-zinc-500")} title={linked ? "Linked: all sides change together" : "Unlinked"}>
          {linked ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
        </button>
        <select className="bg-transparent text-[10px] text-zinc-500" value={v.u} onChange={(e) => onChange({ ...v, u: e.target.value as Box["u"] })} aria-label="Unit">
          {["px", "%", "em", "rem"].map((u) => <option key={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );
}

const TOKEN_LABEL: Record<string, string> = { primary: "Brand", secondary: "Soft", bg: "Page", text: "Text", white: "White", black: "Black", transparent: "None" };
const TOKEN_SWATCH: Record<string, string> = { primary: "var(--sf-primary)", secondary: "var(--sf-secondary)", bg: "var(--sf-bg)", text: "var(--sf-text)", white: "#fff", black: "#000", transparent: "transparent" };

/** Theme colour tokens (follow theme changes) or a custom hex. */
export function ColorInput({ value, onChange, themeVars }: { value: string | undefined; onChange: (v: string | undefined) => void; themeVars: React.CSSProperties }) {
  const isHex = !!value && /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="flex flex-col gap-1.5" style={themeVars}>
      <div className="flex flex-wrap gap-1">
        {COLOR_TOKENS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            title={`${TOKEN_LABEL[t]} (theme)`}
            className={cn("h-6 w-6 rounded-full border", value === t ? "ring-2 ring-brand-500 ring-offset-1" : "border-zinc-300", t === "transparent" && "bg-[repeating-conic-gradient(#e4e4e7_0_25%,#fff_0_50%)] bg-[length:8px_8px]")}
            style={t === "transparent" ? undefined : { background: TOKEN_SWATCH[t] }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input type="color" value={isHex ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-7 w-8 cursor-pointer rounded border border-zinc-300 bg-white p-0.5" />
        <input className={cn(inputCls, "font-mono")} placeholder={value && !isHex ? TOKEN_LABEL[value] : "Default"} value={isHex ? value : ""} maxLength={7} onChange={(e) => { const x = e.target.value; if (x === "") onChange(undefined); else if (/^#[0-9a-fA-F]{6}$/.test(x)) onChange(x); }} />
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-brand-600" : "bg-zinc-300")}>
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

export function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-t border-zinc-200 pt-3 first:border-t-0 first:pt-0">
      <summary className="mb-3 cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-zinc-500 marker:hidden">
        <span className="mr-1 inline-block transition group-open:rotate-90">›</span>{title}
      </summary>
      <div className="flex flex-col gap-3">{children}</div>
    </details>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex border-b border-zinc-200">
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)} className={cn("-mb-px flex-1 border-b-2 py-2 text-xs font-semibold", value === t.value ? "border-brand-600 text-brand-700" : "border-transparent text-zinc-500 hover:text-zinc-800")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
