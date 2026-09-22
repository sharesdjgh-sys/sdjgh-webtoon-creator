"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cut } from "@/lib/storage";
import { renderWebtoonBlock, exportWebtoonImage, legacyGap } from "@/lib/webtoonFlowRender";
import { webtoonFlowLayout, editableWebtoonDocument } from "@/lib/webtoonFlow";
import { webtoonFilename } from "@/lib/webtoonArchive";

type Props = { open: boolean; title: string; cuts: Cut[]; onClose: () => void };
export default function WebtoonPreviewModal({ open, title, cuts, onClose }: Props) {
  const [images, setImages] = useState<Record<string, { url?: string; error?: string; warning?: string; width?: number; height?: number }>>({});
  const [file, setFile] = useState<{ url: string; width: number; height: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const strip = useRef<HTMLDivElement>(null);
  const exportUrls = useRef<string[]>([]);
  const generation = useRef(0);
  const reader = useRef<HTMLDivElement>(null);
  const exportingRef = useRef(false);
  const filename = webtoonFilename(title);
  const finished = cuts.filter(cut => cut.sceneImageAssetId).length;
  const missing = cuts.flatMap((cut, index) => !cut.sceneImageAssetId || images[cut.id]?.error ? [index + 1] : []);
  const warnings = cuts.flatMap((cut, index) => images[cut.id]?.warning ? [index + 1] : []);
  const ready = cuts.length > 0 && cuts.every(cut => cut.sceneImageAssetId && images[cut.id]?.url && !images[cut.id]?.warning);
  const changeZoom = useCallback((value: number, pointer?: { x: number; y: number }) => {
    const next = Math.max(.5, Math.min(3, Math.round(value * 100) / 100));
    const viewport = reader.current, content = strip.current;
    if (!viewport || !content || next === zoomRef.current) return;
    const bounds = viewport.getBoundingClientRect(), old = content.getBoundingClientRect();
    if (!old.width) return;
    const x = pointer?.x ?? bounds.left + viewport.clientWidth / 2;
    const y = pointer?.y ?? bounds.top + viewport.clientHeight / 2;
    const relativeX = Math.max(0, Math.min(1, (x - old.left) / old.width));
    const relativeY = (y - old.top) / old.width;
    // Resize synchronously before restoring the point under the cursor (or viewport center).
    content.style.width = `${560 * next}px`;
    const updated = content.getBoundingClientRect();
    viewport.scrollLeft += updated.left + relativeX * updated.width - x;
    viewport.scrollTop += updated.top + relativeY * updated.width - y;
    zoomRef.current = next;
    setZoom(next);
  }, []);
  useEffect(() => {
    const viewport = reader.current;
    if (!open || !viewport) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      changeZoom(zoomRef.current * Math.exp(-Math.max(-100, Math.min(100, delta)) * .002), { x: event.clientX, y: event.clientY });
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [open, changeZoom]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", key); };
  }, [open, onClose]);
  useEffect(() => {
    const current = ++generation.current;
    const urls: string[] = [];
    exportingRef.current = false;
    Promise.resolve().then(() => { if (current === generation.current) { setImages({}); setFile(null); setExporting(false); setError(""); } });
    if (open) {
      (async () => {
        for (const cut of cuts) {
          if (current !== generation.current) break;
          try {
            const result = await renderWebtoonBlock(cut, { finishedOnly: true, preview: true });
            if (current !== generation.current) break;
            const url = URL.createObjectURL(result.blob); urls.push(url);
            setImages(prev => ({ ...prev, [cut.id]: { url, warning: result.warning, width: result.width, height: result.height } }));
          } catch (e) {
            if (current === generation.current) setImages(prev => ({ ...prev, [cut.id]: { error: e instanceof Error ? e.message : "미리보기 실패" } }));
          }
        }
      })();
    }
    return () => { generation.current = current + 1; urls.forEach(URL.revokeObjectURL); exportUrls.current.forEach(URL.revokeObjectURL); exportUrls.current = []; };
  }, [cuts, open]);
  const exportImages = async () => {
    if (exportingRef.current || !ready) return;
    exportingRef.current = true;
    const current = generation.current;
    setExporting(true); setError("");
    try {
      const result = await exportWebtoonImage(cuts, 900, { finishedOnly: true });
      if (current !== generation.current) return;
      exportUrls.current.forEach(URL.revokeObjectURL);
      const url = URL.createObjectURL(result.blob);
      exportUrls.current = [url];
      setFile({ url, width: result.width, height: result.height });
    } catch (e) {
      if (current === generation.current) setError(e instanceof Error ? e.message : "출력 실패");
    } finally { if (current === generation.current) { exportingRef.current = false; setExporting(false); } }
  };
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] grid grid-cols-[minmax(0,1fr)_300px] grid-rows-[48px_minmax(0,1fr)] bg-[#17151C]/95" role="dialog" aria-modal="true" aria-label={`${title} 웹툰 미리보기`}>
    <header className="col-span-2 flex min-w-0 items-center justify-between gap-4 border-b border-white/10 bg-[#211E29] px-5 text-white">
      <h2 title={title || "세로 웹툰 원고"} className="truncate text-sm font-bold">{title || "세로 웹툰 원고"}</h2>
      <div className="shrink-0">
        <button type="button" onClick={onClose} aria-label="미리보기 닫기" className="rounded-full bg-white/10 px-4 py-2 text-xs">닫기</button>
      </div>
    </header>
    <aside aria-label="이어보기 도구와 안내" className="col-start-2 row-start-2 min-h-0 min-w-0 space-y-5 overflow-y-auto overscroll-contain border-l border-white/10 bg-[#211E29] p-4 text-xs leading-relaxed text-white/80">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">감상 설정</h3>
        <p>총 {cuts.length}컷 · 완성 그림 {finished}컷</p>
      </div>
      <div role="group" aria-label="미리보기 확대·축소" className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="미리보기 축소" disabled={zoom <= .5} onClick={() => changeZoom(zoomRef.current - .25)} className="rounded-lg bg-white/10 px-3 py-2 disabled:opacity-40">−</button>
        <output aria-label="미리보기 배율" className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</output>
        <button type="button" aria-label="미리보기 확대" disabled={zoom >= 3} onClick={() => changeZoom(zoomRef.current + .25)} className="rounded-lg bg-white/10 px-3 py-2 disabled:opacity-40">+</button>
        <button type="button" onClick={() => changeZoom(1)} className="rounded-lg bg-white/10 px-3 py-2">배율 초기화</button>
        <span className="w-full text-white/60">Ctrl + 휠로 확대·축소 · 50~300%<br />일반 휠로 웹툰을 스크롤합니다.</span>
      </div>
      <label className="flex items-center gap-2">컷으로 이동
        <select aria-label="미리보기 컷 이동" defaultValue="" onChange={event => { reader.current?.querySelector(`[data-cut-index="${Number(event.target.value)}"]`)?.scrollIntoView({ block: "start" }); event.target.value = ""; }} className="rounded-lg bg-[#373140] px-3 py-1.5">
          <option value="" disabled>컷 선택</option>
          {cuts.map((cut, index) => <option key={cut.id} value={index}>{index + 1}컷 · {cut.sceneImageAssetId ? "완성 그림" : "그림 없음"}</option>)}
        </select>
      </label>
      <nav aria-label="컷 바로가기" className="flex flex-wrap gap-2">
        {cuts.map((cut, index) => <button key={cut.id} type="button"
          onClick={() => reader.current?.querySelector(`[data-cut-index="${index}"]`)?.scrollIntoView({ block: "start" })}
          className={`shrink-0 rounded-lg border px-3 py-2 ${missing.includes(index + 1) ? "border-amber-400/50 text-amber-200" : "border-white/20 bg-white/10"}`}>
          {index + 1}컷{missing.includes(index + 1) ? " · 그림 없음" : ""}
        </button>)}
      </nav>
      {missing.length > 0 && <p role="alert" className="text-amber-200">{missing.join(", ")}컷의 완성 그림이 없거나 파일을 불러올 수 없습니다. 콘티로 대체하지 않습니다. 전체 다운로드 전에 해당 컷을 확인해주세요.</p>}
      {warnings.length > 0 && <p role="alert" className="text-amber-200">{warnings.join(", ")}컷의 말풍선·자막이 영역을 벗어났습니다. 실제 그림은 표시하며, 식자 위치를 조정한 뒤 다운로드할 수 있습니다.</p>}
      <p>{ready ? "아래로 스크롤하면 한 화 전체가 이어집니다." : "완성 그림이 있는 컷부터 표시합니다."}</p>
      <div className="space-y-3 border-t border-white/10 pt-4">
        <button type="button" disabled={exporting || !ready} onClick={exportImages} className="w-full rounded-xl bg-[#7C3AED] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{exporting ? "단일 PNG 만드는 중…" : "이 화 단일 PNG 만들기"}</button>
        <p className="text-white/50">모든 컷과 여백·말풍선·자막을 현재 순서대로 이어 붙인 세로 PNG 한 장을 만듭니다. 프로젝트 저장은 별도입니다.</p>
      </div>
    {(error || file) && <div className="flex flex-wrap gap-3 rounded-xl bg-white p-3 text-xs text-[#373140]" role="status">
      {error || <span>한 화 전체를 합친 {file?.width}px × {file?.height.toLocaleString()}px PNG 한 장입니다.</span>}
      {file && <a href={file.url} download={`${filename}.png`} className="rounded-full bg-[#7C3AED] px-4 py-2 font-semibold text-white">한 화 PNG 다운로드</a>}
    </div>}
    </aside>
    <div ref={reader} aria-label="한 화 세로 스크롤 원고" className="col-start-1 row-start-2 min-h-0 min-w-0 overflow-auto overscroll-contain" style={{ overflowAnchor: "none" }}>
      <div ref={strip} aria-label="확대 가능한 원고" className="mx-auto min-h-full bg-white" style={{ width: 560 * zoom }}>
        {cuts.map((cut, index) => {
          const size = cut.storyboard ? webtoonFlowLayout(editableWebtoonDocument(cut.storyboard)).document : { width: 900, height: 1200 };
          const preview = images[cut.id];
          return <div key={cut.id} data-cut-index={index}>
            <div style={{ aspectRatio: `${preview?.width ?? size.width}/${preview?.height ?? size.height}` }} className="relative w-full overflow-hidden bg-white">
              {preview?.url
                // Local Blob URLs are already rendered at the exact reading dimensions.
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={preview.url} alt={`세로 원고 구간 ${index + 1}`} className="absolute inset-0 h-full w-full object-contain" />
                : <p className="p-8 text-center text-xs text-[#7A7067]">{index + 1}컷 · {preview?.error || "세로 원고 준비 중…"}</p>}
            </div>
            {index < cuts.length - 1 && <div style={{ aspectRatio: legacyGap(cut) ? `900/${legacyGap(cut)}` : undefined }} />}
          </div>;
        })}
        {!cuts.length && <p className="p-16 text-center text-sm">아직 장면이 없습니다.</p>}
      </div>
    </div>
  </div>;
}
