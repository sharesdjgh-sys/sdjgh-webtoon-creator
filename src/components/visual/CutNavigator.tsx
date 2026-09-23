"use client";

import type { Cut } from "@/lib/storage";

export default function CutNavigator({ cuts, onNavigate }: {
  cuts: Pick<Cut, "id" | "description">[];
  onNavigate: (id: string) => void;
}) {
  if (!cuts.length) return null;
  return <nav aria-label="편집 컷 바로가기" className="sticky top-16 z-30 min-w-0 bg-[#FBF9F6] py-2">
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#DDD6FE] bg-white px-3 py-2">
    <span className="shrink-0 text-xs font-semibold text-[#5B21B6]">컷 이동 · {cuts.length}</span>
    <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1" aria-label="컷 번호 목록">
      {cuts.map((cut, index) => <button key={cut.id} type="button"
        title={cut.description || `${index + 1}컷`} aria-label={`${index + 1}컷으로 이동`}
        onClick={() => onNavigate(cut.id)}
        className="shrink-0 rounded-lg border border-[#E4DDF8] bg-[#FAF8FF] px-3 py-1.5 text-xs font-semibold text-[#5B21B6] hover:border-[#7C3AED] hover:bg-[#EDE9FE] focus-visible:outline-2 focus-visible:outline-[#7C3AED]">
        {index + 1}컷
      </button>)}
    </div>
    <select aria-label="편집 컷 선택" value="" onChange={event => { if (event.target.value) onNavigate(event.target.value); }} className="max-w-32 shrink-0 rounded-lg border border-[#E4DDF8] bg-white px-2 py-1.5 text-xs">
      <option value="" disabled>컷 선택</option>
      {cuts.map((cut, index) => <option key={cut.id} value={cut.id}>{index + 1}컷</option>)}
    </select>
    <button type="button" onClick={() => onNavigate(cuts[cuts.length - 1].id)} className="shrink-0 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white">마지막 컷 ↓</button>
    </div>
  </nav>;
}
