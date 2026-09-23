"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { Episode } from "@/lib/storage";

interface EpisodeListProps {
  episodes: Episode[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  stage: "script" | "episodes";
  defaultExpanded?: boolean;
}

export default function EpisodeList({ episodes, activeIndex, onSelect, onAdd, stage, defaultExpanded = true }: EpisodeListProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const listRef = useRef<HTMLUListElement>(null);
  const activeEpisode = episodes[activeIndex];

  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!expanded || !list || !selected) return;
    const top = selected.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + selected.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + selected.offsetHeight - list.clientHeight;
    }
  }, [activeIndex, episodes.length, expanded]);

  return (
    <div className="min-w-0">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-[#7C3AED]">
        <span className="text-[11px] font-semibold text-[#514A45]">화 목록</span>
        <span className="text-[10px] text-[#78716C]">{episodes.length}개</span>
        <span className="ml-auto text-[10px] font-semibold text-[#7C3AED]">{activeEpisode?.episodeNumber ?? 1}화 선택</span>
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-[#78716C] transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {!expanded && activeEpisode?.title && <p className="truncate px-2 pb-1 text-[11px] text-[#78716C]" title={activeEpisode.title}>{activeEpisode.title}</p>}
      <div hidden={!expanded}>
        <ul ref={listRef} aria-label={stage === "script" ? "대본 작업 회차" : "콘티·작화 작업 회차"}
          className="relative max-h-60 space-y-1 overflow-y-auto overscroll-contain p-1">
          {episodes.map((episode, index) => {
            const selected = activeIndex === index;
            const detail = stage === "script"
              ? episode.script?.trim() ? "대본 있음" : "대본 없음"
              : `${episode.cuts?.length ?? 0}컷 · 작화 ${episode.cuts?.filter(cut => cut.sceneImageAssetId).length ?? 0}`;
            return (
              <li key={episode.episodeNumber}>
                <button type="button" aria-current={selected ? "true" : undefined}
                  aria-label={`${episode.episodeNumber}화 · ${episode.title || "제목 없음"} · ${detail}`}
                  title={episode.title || "제목 없음"} onClick={() => onSelect(index)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#7C3AED] ${selected ? "border-[#DDD6FE] bg-[#F5F3FF]" : "border-transparent hover:bg-[#F4F1EC]"}`}>
                  <span className={`shrink-0 text-[11px] font-bold ${selected ? "text-[#7C3AED]" : "text-[#78716C]"}`}>{episode.episodeNumber}화</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs font-medium ${selected ? "text-[#5B21B6]" : "text-[#514A45]"}`}>{episode.title || "제목 없음"}</span>
                    <span className="mt-0.5 block text-[10px] text-[#78716C]">{detail}</span>
                  </span>
                  {selected && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={onAdd}
          className="mt-1 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#DDD6FE] text-[11px] font-semibold text-[#7C3AED] transition-colors hover:bg-[#F5F3FF] focus-visible:outline-2 focus-visible:outline-[#7C3AED]">
          <Plus aria-hidden="true" className="h-3.5 w-3.5" /> 화 추가
        </button>

      </div>
    </div>
  );
}
