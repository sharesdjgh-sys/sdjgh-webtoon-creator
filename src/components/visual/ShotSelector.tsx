"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Check, ChevronDown, X } from "lucide-react";
import { normalizeWebtoonShot, WEBTOON_SHOTS, type WebtoonShotName } from "@/lib/webtoonShots";

type Props = {
  value: string;
  onChange: (value: WebtoonShotName) => void;
};

function ShotPreview({ shot }: { shot: WebtoonShotName }) {
  const info = WEBTOON_SHOTS.find((item) => item.name === shot)!;
  return (
    <Image src={info.imageSrc} alt={`${shot} 구도 예시`} fill sizes="(max-width: 640px) 44vw, 150px" className="object-cover" />
  );
}

export default function ShotSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = normalizeWebtoonShot(value);
  const selectedInfo = WEBTOON_SHOTS.find((shot) => shot.name === selected)!;

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
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 min-w-44 items-center gap-2 rounded-xl border border-[#DDD6FE] bg-white px-2 text-left shadow-sm transition hover:border-[#A78BFA] hover:bg-[#FAF8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/30"
      >
        <span className="relative h-9 w-14 flex-none overflow-hidden rounded-lg"><ShotPreview shot={selected} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-[#1A1A1A]">{selectedInfo.name}</span>
          <span className="block truncate text-[9px] text-[#7A7067]">{selectedInfo.shortLabel}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 flex-none text-[#7C3AED] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="dialog" aria-label="카메라 샷 선택" className="fixed inset-x-4 top-1/2 max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#DDD6FE] bg-white p-3 shadow-[0_18px_50px_rgba(55,48,107,0.2)] sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:w-[42rem] sm:max-w-[calc(100vw-3rem)] sm:translate-y-0 sm:overflow-visible sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#1A1A1A]"><Camera className="h-3.5 w-3.5 text-[#7C3AED]" /> 화면에 어떻게 보여줄까요?</p>
              <p className="mt-1 text-[10px] text-[#7A7067]">그림을 보고 고르세요. AI가 선택한 구도에 맞춰 장면을 설계합니다.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="샷 선택 닫기" className="rounded-lg p-1 text-[#ADA8A0] hover:bg-[#F4F1EC]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEBTOON_SHOTS.map((shot) => {
              const active = shot.name === selected;
              return (
                <button
                  type="button"
                  key={shot.name}
                  aria-pressed={active}
                  onClick={() => { onChange(shot.name); setOpen(false); }}
                  className={`group relative overflow-hidden rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/30 ${active ? "border-[#7C3AED] bg-[#F5F3FF] shadow-sm" : "border-[#EBE7E0] bg-white hover:-translate-y-0.5 hover:border-[#C4B5FD] hover:shadow-sm"}`}
                >
                  {active && <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED] text-white"><Check className="h-3 w-3" /></span>}
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-lg"><ShotPreview shot={shot.name} /></span>
                  <span className="mt-1.5 block px-1 text-[11px] font-bold text-[#1A1A1A]">{shot.name} <span className="font-normal text-[#7C3AED]">· {shot.shortLabel}</span></span>
                  <span className="block px-1 pb-1 text-[9px] leading-4 text-[#7A7067]">{shot.framing}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl bg-[#F7F5FF] px-3 py-2 text-[10px] text-[#5B556F]">
            <strong className="text-[#7C3AED]">{selectedInfo.name}</strong>은(는) {selectedInfo.bestFor}을 보여줄 때 좋아요.
          </div>
        </div>
      )}
    </div>
  );
}
