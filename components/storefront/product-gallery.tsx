/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) return <div className="aspect-square w-full bg-black/5" style={{ borderRadius: "var(--sf-radius)" }} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden bg-black/5" style={{ borderRadius: "var(--sf-radius)" }}>
        <img src={images[active]} alt={name} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <button key={src + i} onClick={() => setActive(i)} className={`aspect-square overflow-hidden border-2 ${i === active ? "border-[var(--sf-primary)]" : "border-transparent"}`} style={{ borderRadius: "var(--sf-radius)" }}>
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
