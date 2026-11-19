/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useTransition } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { uploadImage } from "@/components/dashboard/image-uploader";
import { saveCategoryAction } from "./actions";

export function CategoryEditor({ category, onDone }: { category?: { id: string; name: string; imageUrl: string | null }; onDone?: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [image, setImage] = useState(category?.imageUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveCategoryAction({ id: category?.id, name, imageUrl: image });
          if (res.error) return setError(res.error);
          setError(null);
          if (!category) { setName(""); setImage(""); }
          onDone?.();
        });
      }}
    >
      <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50" title="Category image">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-4 w-4 text-zinc-400" />}
        <input type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setUploading(true);
          try { setImage(await uploadImage(f)); } catch (err) { setError((err as Error).message); }
          setUploading(false);
        }} />
      </label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" className="min-w-0 flex-1" />
      <Button disabled={pending || !name.trim()}>{category ? "Save" : "Add category"}</Button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
