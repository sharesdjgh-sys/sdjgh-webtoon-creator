"use client";

import { useEffect, useState } from "react";
import { Eye, LoaderCircle, Smartphone, X } from "lucide-react";
import type { Cut } from "@/lib/storage";
import { getMediaAsset } from "@/lib/mediaStorage";
import { composeScenePng } from "@/lib/storyboardSvg";
import { composeStoryboardPng } from "@/lib/storyboardComposite";

type Props = {
  open: boolean;
  title: string;
  cuts: Cut[];
  onClose: () => void;
};

type PreviewImage = {
  cutId: string;
  url?: string;
  state: "loading" | "ready" | "missing" | "error";
};

export default function WebtoonPreviewModal({ open, title, cuts, onClose }: Props) {
  const [gap, setGap] = useState(56);
  const [showGuides, setShowGuides] = useState(false);
  const [images, setImages] = useState<PreviewImage[]>([]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const urls: string[] = [];
    Promise.resolve().then(() => {
      if (active) setImages(cuts.map((cut) => ({ cutId: cut.id, state: "loading" })));
    });

    Promise.all(cuts.map(async (cut): Promise<PreviewImage> => {
      try {
        let blob: Blob | undefined;
        if (cut.sceneImageAssetId) {
          const asset = await getMediaAsset(cut.sceneImageAssetId);
          if (asset) blob = cut.storyboard ? await composeScenePng(cut.storyboard, asset.blob) : asset.blob;
        } else if (cut.storyboard) {
          blob = await composeStoryboardPng(cut.storyboard);
        }
        if (!blob) return { cutId: cut.id, state: "missing" };
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { cutId: cut.id, state: "ready", url };
      } catch {
        return { cutId: cut.id, state: "error" };
      }
    })).then((next) => {
      if (active) setImages(next);
    });

    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [cuts, open]);

  if (!open) return null;
  const imageByCut = new Map(images.map((image) => [image.cutId, image]));

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#17151C]/95" role="dialog" aria-modal="true" aria-label={`${title} 웹툰 미리보기`}>
      <header className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#211E29]/95 px-4 py-3 text-white backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED]"><Smartphone className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{title || "제목 없는 회차"}</p>
            <p className="text-[10px] text-white/55">독자가 휴대폰에서 보는 순서대로 스크롤해보세요</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
          <label className="hidden items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-[10px] text-white/70 md:flex">
            기본 여백 (컷별 설정 우선)
            <input aria-label="컷 사이 여백" type="range" min="0" max="180" step="8" value={gap} onChange={(event) => setGap(Number(event.target.value))} className="w-24 accent-[#A78BFA]" />
            <span className="w-8 tabular-nums">{gap}px</span>
          </label>
          <button type="button" onClick={() => setShowGuides((current) => !current)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-semibold transition ${showGuides ? "bg-[#7C3AED] text-white" : "bg-white/8 text-white/70 hover:bg-white/15"}`}>
            <Eye className="h-3.5 w-3.5" /> 컷 경계
          </button>
          <button type="button" onClick={onClose} aria-label="미리보기 닫기" className="rounded-full bg-white/8 p-2 text-white/70 transition hover:bg-white/15 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto min-h-full w-full max-w-[480px] bg-white shadow-[0_0_80px_rgba(0,0,0,0.45)]">
          <div className="flex min-h-[38vh] flex-col items-center justify-center bg-gradient-to-b from-[#F7F5FF] to-white px-8 text-center">
            <p className="text-[10px] font-semibold tracking-[0.3em] text-[#7C3AED]">WEBTOON PREVIEW</p>
            <h2 className="mt-3 text-xl font-black text-[#1A1A1A]">{title || "제목 없는 회차"}</h2>
            <p className="mt-2 text-xs text-[#ADA8A0]">아래로 스크롤해서 읽어보세요</p>
          </div>

          {cuts.length === 0 ? (
            <div className="flex min-h-[50vh] items-center justify-center px-8 text-center text-sm text-[#ADA8A0]">아직 미리 볼 컷이 없습니다.</div>
          ) : cuts.map((cut, index) => {
            const preview = imageByCut.get(cut.id);
            return (
              <div key={cut.id}>
                <div className={`relative w-full bg-white ${showGuides ? "ring-2 ring-inset ring-[#A78BFA]" : ""}`} style={{ aspectRatio: cut.aspectRatio.replace(":", "/") }}>
                  {preview?.state === "ready" && preview.url ? (
                    // Generated local Blob URLs do not benefit from Next image optimization.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.url} alt={`컷 ${index + 1}`} className="h-full w-full object-cover" draggable={false} />
                  ) : preview?.state === "loading" || !preview ? (
                    <div className="flex h-full items-center justify-center bg-[#F7F5FF] text-[#7C3AED]"><LoaderCircle className="h-5 w-5 animate-spin" /></div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center bg-[#F4F1EC] px-8 text-center">
                      <span className="text-xs font-bold text-[#7A7067]">컷 {index + 1} · 아직 그림이 없어요</span>
                      <span className="mt-2 line-clamp-3 text-[10px] leading-5 text-[#ADA8A0]">{cut.description || "콘티나 장면 이미지를 만들면 여기에 표시됩니다."}</span>
                    </div>
                  )}
                  {showGuides && <span className="absolute left-2 top-2 rounded-full bg-[#7C3AED] px-2 py-1 text-[9px] font-bold text-white shadow">컷 {index + 1} · {cut.aspectRatio}</span>}
                </div>
                {index < cuts.length - 1 && <div aria-label={`컷 ${index + 1}과 ${index + 2} 사이 여백`} className="bg-white transition-[height]" style={{ height: cut.scrollGap === "short" ? 16 : cut.scrollGap === "long" ? 160 : gap }} />}
              </div>
            );
          })}

          <div className="flex min-h-[38vh] items-center justify-center bg-gradient-to-b from-white to-[#F7F5FF] text-xs font-semibold text-[#ADA8A0]">이번 화 끝</div>
        </div>
      </div>
    </div>
  );
}
