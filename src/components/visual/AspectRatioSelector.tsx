"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, RectangleVertical, X } from "lucide-react";
import type { PanelAspectRatio } from "@/lib/storage";
import { WEBTOON_ASPECTS } from "@/lib/webtoonAspects";

type Props = {
  disabled?: boolean;
  value: PanelAspectRatio;
  onChange: (value: PanelAspectRatio) => void;
};

export default function AspectRatioSelector({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = WEBTOON_ASPECTS.find((aspect) => aspect.value === value) ?? WEBTOON_ASPECTS[1];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${open ? "z-50" : "z-10"}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 min-w-32 items-center gap-2 rounded-xl border border-[#EBE7E0] bg-white px-2 text-left shadow-sm transition hover:border-[#A78BFA] hover:bg-[#FAF8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/30"
      >
        <span className="flex h-9 w-12 flex-none items-center justify-center">
          <span className="relative block overflow-hidden rounded-md bg-[#F4F1EC]" style={{ aspectRatio: value.replace(":", "/"), height: 32, maxWidth: 48 }}>
          <Image src={selected.imageSrc} alt="" fill sizes="48px" className="object-cover" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-[#1A1A1A]">{selected.value}</span>
          <span className="block text-[9px] text-[#7A7067]">{selected.label}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-[#7C3AED] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <div role="dialog" aria-label="컷 비율 선택" className="fixed inset-x-4 top-1/2 max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#DDD6FE] bg-white p-3 shadow-[0_18px_50px_rgba(55,48,107,0.2)] sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:w-[36rem] sm:max-w-[calc(100vw-3rem)] sm:translate-y-0 sm:overflow-visible sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#1A1A1A]"><RectangleVertical className="h-3.5 w-3.5 text-[#7C3AED]" /> 컷의 모양을 골라보세요</p>
              <p className="mt-1 text-[10px] text-[#7A7067]">같은 웹툰도 컷의 모양에 따라 속도와 느낌이 달라져요.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="비율 선택 닫기" className="rounded-lg p-1 text-[#ADA8A0] hover:bg-[#F4F1EC]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEBTOON_ASPECTS.map((aspect) => {
              const active = aspect.value === value;
              return (
                <button
                  type="button"
                  key={aspect.value}
                  aria-pressed={active}
                  onClick={() => { onChange(aspect.value); setOpen(false); }}
                  className={`group relative rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/30 ${active ? "border-[#7C3AED] bg-[#F5F3FF] shadow-sm" : "border-[#EBE7E0] hover:-translate-y-0.5 hover:border-[#C4B5FD] hover:shadow-sm"}`}
                >
                  {active && <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED] text-white"><Check className="h-3 w-3" /></span>}
                  <span className="flex h-32 items-center justify-center rounded-lg bg-[#F4F1EC] p-2">
                    <span className="relative block max-h-full max-w-full overflow-hidden rounded-md shadow-sm" style={{ aspectRatio: aspect.value.replace(":", "/"), height: aspect.value === "9:16" ? "100%" : aspect.value === "3:4" ? "88%" : aspect.value === "1:1" ? "72%" : "58%" }}>
                      <Image src={aspect.imageSrc} alt={`${aspect.value} ${aspect.label} 웹툰 컷 예시`} fill sizes="140px" className="object-cover" />
                    </span>
                  </span>
                  <span className="mt-2 block text-[11px] font-bold text-[#1A1A1A]">{aspect.value} · {aspect.label}</span>
                  <span className="mt-0.5 block text-[9px] leading-4 text-[#7A7067]">{aspect.shape}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl bg-[#F7F5FF] px-3 py-2 text-[10px] text-[#5B556F]">
            <strong className="text-[#7C3AED]">{selected.value}</strong>은(는) {selected.bestFor}을 보여줄 때 좋아요.
          </div>
        </div>
      )}
    </div>
  );
}
