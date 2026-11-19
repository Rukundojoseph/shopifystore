/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import { CategoryEditor } from "./category-editor";

export function CategoryRow({ c, count, deleteForm }: { c: { id: string; name: string; slug: string; imageUrl: string | null }; count: number; deleteForm: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <div className="px-5 py-3"><CategoryEditor category={c} onDone={() => setEditing(false)} /></div>;
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100">{c.imageUrl && <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
      <div className="flex-1"><p className="font-medium">{c.name}</p><p className="text-xs text-zinc-500">/collections/{c.slug} · {count} products</p></div>
      <button onClick={() => setEditing(true)} className="text-sm text-brand-700 hover:underline">Edit</button>
      {deleteForm}
    </div>
  );
}
