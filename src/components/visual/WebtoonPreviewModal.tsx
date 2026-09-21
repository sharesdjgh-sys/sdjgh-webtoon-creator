"use client";

import { useEffect, useRef, useState } from "react";
import type { Cut } from "@/lib/storage";
import { renderWebtoonBlock, exportWebtoonStrip, legacyGap } from "@/lib/webtoonFlowRender";
import { webtoonFlowLayout, editableWebtoonDocument } from "@/lib/webtoonFlow";
import { webtoonArchive, webtoonFilename } from "@/lib/webtoonArchive";

type Props = { open: boolean; title: string; cuts: Cut[]; onClose: () => void };
export default function WebtoonPreviewModal({ open, title, cuts, onClose }: Props) {
  const [images, setImages] = useState<Record<string, { url?: string; error?: string; warning?: string; width?: number; height?: number }>>({});
  const [files, setFiles] = useState<string[]>([]);
  const [archive, setArchive] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const exportUrls = useRef<string[]>([]);
  const generation = useRef(0);
  const reader = useRef<HTMLDivElement>(null);
  const exportingRef = useRef(false);
  const filename = webtoonFilename(title);
  const finished = cuts.filter(cut => cut.sceneImageAssetId).length;
  const missing = cuts.flatMap((cut, index) => !cut.sceneImageAssetId || images[cut.id]?.error ? [index + 1] : []);
  const warnings = cuts.flatMap((cut, index) => images[cut.id]?.warning ? [index + 1] : []);
  const ready = cuts.length > 0 && cuts.every(cut => cut.sceneImageAssetId && images[cut.id]?.url && !images[cut.id]?.warning);
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
    Promise.resolve().then(() => { if (current === generation.current) { setImages({}); setFiles([]); setArchive(""); setExporting(false); setError(""); } });
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
      const pages = await exportWebtoonStrip(cuts, 900, 4096, { finishedOnly: true });
      if (current !== generation.current) return;
      const zip = await webtoonArchive(pages.map((blob, index) => ({ name: `${filename}-${String(index + 1).padStart(3, "0")}.png`, blob })));
      if (current !== generation.current) return;
      exportUrls.current.forEach(URL.revokeObjectURL);
      const pngUrls = pages.map(blob => URL.createObjectURL(blob));
      const zipUrl = URL.createObjectURL(zip);
      exportUrls.current = [...pngUrls, zipUrl];
      setFiles(pngUrls); setArchive(zipUrl);
    } catch (e) {
      if (current === generation.current) setError(e instanceof Error ? e.message : "출력 실패");
    } finally { if (current === generation.current) { exportingRef.current = false; setExporting(false); } }
  };
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex flex-col bg-[#17151C]/95" role="dialog" aria-modal="true" aria-label={`${title} 웹툰 미리보기`}>
    <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#211E29] px-6 py-4 text-white">
      <div><h2 className="text-sm font-bold">{title || "세로 웹툰 원고"}</h2>
        <p className="mt-1 text-xs text-white/60">총 {cuts.length}컷 · 완성 그림 {finished}컷 · 실제 그림에 최신 말풍선·자막을 표시합니다</p>
        <p className="mt-1 text-xs text-white/60">현재 편집 내용의 그림·여백·대사를 반영합니다. 미리보기와 다운로드는 프로젝트 저장을 대신하지 않습니다.</p></div>
      <div className="flex gap-2">
        <button type="button" disabled={exporting || !ready} onClick={exportImages} className="rounded-full bg-[#7C3AED] px-4 py-2 text-xs disabled:opacity-50">{exporting ? "다운로드 준비 중…" : "이 화 다운로드 준비"}</button>
        <button type="button" onClick={onClose} aria-label="미리보기 닫기" className="rounded-full bg-white/10 px-4 py-2 text-xs">닫기</button>
      </div>
    </header>
    <div className="shrink-0 space-y-2 border-b border-white/10 bg-[#211E29] px-6 py-2 text-xs text-white/80">
      <label className="flex items-center gap-2">컷으로 이동
        <select aria-label="미리보기 컷 이동" defaultValue="" onChange={event => { reader.current?.querySelector(`[data-cut-index="${Number(event.target.value)}"]`)?.scrollIntoView({ block: "start" }); event.target.value = ""; }} className="rounded-lg bg-[#373140] px-3 py-1.5">
          <option value="" disabled>컷 선택</option>
          {cuts.map((cut, index) => <option key={cut.id} value={index}>{index + 1}컷 · {cut.sceneImageAssetId ? "완성 그림" : "그림 없음"}</option>)}
        </select>
      </label>
      <nav aria-label="컷 바로가기" className="flex gap-2 overflow-x-auto pb-1">
        {cuts.map((cut, index) => <button key={cut.id} type="button"
          onClick={() => reader.current?.querySelector(`[data-cut-index="${index}"]`)?.scrollIntoView({ block: "start" })}
          className={`shrink-0 rounded-lg border px-3 py-2 ${missing.includes(index + 1) ? "border-amber-400/50 text-amber-200" : "border-white/20 bg-white/10"}`}>
          {index + 1}컷{missing.includes(index + 1) ? " · 그림 없음" : ""}
        </button>)}
      </nav>
      {missing.length > 0 && <p role="alert" className="text-amber-200">{missing.join(", ")}컷의 완성 그림이 없거나 파일을 불러올 수 없습니다. 콘티로 대체하지 않습니다. 전체 다운로드 전에 해당 컷을 확인해주세요.</p>}
      {warnings.length > 0 && <p role="alert" className="text-amber-200">{warnings.join(", ")}컷의 말풍선·자막이 영역을 벗어났습니다. 실제 그림은 표시하며, 식자 위치를 조정한 뒤 다운로드할 수 있습니다.</p>}
      <p>{ready ? "아래로 스크롤하면 한 화 전체가 이어집니다." : "완성 그림이 있는 컷부터 표시합니다."}</p>
    </div>
    {(error || files.length > 0) && <div className="flex flex-wrap gap-3 bg-white p-3 text-xs" role="status">
      {error || <span>900px 폭 · 높이 최대 4096px의 PNG {files.length}개입니다. 번호 순서로 이어지는 한 화의 원고입니다.</span>}
      {archive && <a href={archive} download={`${filename}.zip`} className="rounded-full bg-[#7C3AED] px-4 py-2 font-semibold text-white">한 화 전체 ZIP 다운로드</a>}
      {files.map((url, index) => <a key={url} href={url} download={`${filename}-${String(index + 1).padStart(3, "0")}.png`} className="text-[#7C3AED] underline">PNG {index + 1}</a>)}
    </div>}
    <div ref={reader} aria-label="한 화 세로 스크롤 원고" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto min-h-full w-full max-w-[560px] bg-white">
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
