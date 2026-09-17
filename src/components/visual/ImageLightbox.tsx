"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import StoredImage, { BlobImage } from "@/components/visual/StoredImage";

export type LightboxImage = {
  assetId?: string;
  blob?: Blob;
  alt: string;
};

export default function ImageLightbox({ image, onClose }: { image: LightboxImage; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") setScale((value) => Math.min(3, value + 0.25));
      if (event.key === "-") setScale((value) => Math.max(0.5, value - 0.25));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${image.alt} 확대 보기`}
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between text-white" onClick={(event) => event.stopPropagation()}>
        <p className="text-sm font-semibold truncate">{image.alt}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setScale((value) => Math.max(0.5, value - 0.25))} className="p-2 rounded-full bg-white/10 hover:bg-white/20" title="축소"><Minus className="w-4 h-4" /></button>
          <button type="button" onClick={() => setScale(1)} className="min-w-14 px-2 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs" title="원래 크기">{Math.round(scale * 100)}%</button>
          <button type="button" onClick={() => setScale((value) => Math.min(3, value + 0.25))} className="p-2 rounded-full bg-white/10 hover:bg-white/20" title="확대"><Plus className="w-4 h-4" /></button>
          <button type="button" onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 ml-2" title="닫기"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div
        className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center"
        onClick={onClose}
        onWheel={(event) => {
          event.preventDefault();
          setScale((value) => Math.min(3, Math.max(0.5, value + (event.deltaY < 0 ? 0.15 : -0.15))));
        }}
      >
        <div
          className="relative flex-shrink-0 w-[min(92vw,1400px)] h-[min(80vh,933px)] transition-transform duration-150 origin-center"
          style={{ transform: `scale(${scale})` }}
          onClick={(event) => event.stopPropagation()}
        >
          {image.blob
            ? <BlobImage blob={image.blob} alt={image.alt} className="w-full h-full object-contain" />
            : <StoredImage assetId={image.assetId} alt={image.alt} className="w-full h-full object-contain" />}
        </div>
      </div>
      <p className="pb-4 text-center text-[11px] text-white/60">마우스 휠 또는 +/- 키로 확대 · Esc로 닫기</p>
    </div>
  );
}
