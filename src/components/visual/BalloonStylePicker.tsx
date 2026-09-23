"use client";

import { useEffect, useRef, useState } from "react";
import type { StoryboardElement, SpeechBalloonStyle } from "@/lib/storage";
import { balloonMarkup } from "@/lib/webtoonDecoration";

const styles: { value: SpeechBalloonStyle; label: string; hint: string }[] = [
  { value: "normal", label: "일반 대사", hint: "인물이 직접 하는 말" },
  { value: "thought", label: "생각", hint: "마음속 생각과 망설임" },
  { value: "shout", label: "외침", hint: "강한 감정과 큰 목소리" },
  { value: "whisper", label: "속삭임", hint: "작고 조심스러운 목소리" },
  { value: "rounded", label: "독백 상자", hint: "내레이션과 상황 설명" },
  { value: "radiant", label: "긴박한 속마음", hint: "촘촘한 방사선으로 압박감 표현" },
  { value: "burst", label: "격한 외침", hint: "불규칙한 윤곽의 강한 발화" },
  { value: "rough", label: "거친 위압", hint: "겹쳐 그린 선으로 낮은 위협 표현" },
  { value: "broadcast", label: "방송·중계", hint: "육각형으로 전달 경로 구별" },
  { value: "connected", label: "이어지는 대사", hint: "빈 줄로 나눈 두 문장을 연결" },
  { value: "none", label: "테두리 없는 글", hint: "여백 위에 흐르는 독백" },
];

function Sample({ value }: { value: SpeechBalloonStyle }) {
  const element: StoryboardElement = { id: "sample", type: value === "rounded" || value === "none" ? "caption" : "speech",
    balloonStyle: value, x: 0, y: 0, width: 220, height: 110, rotation: 0, zIndex: 0, text: "", tailX: .28, tailY: 1.2 };
  return <svg viewBox="-12 -12 244 158" className="h-28 w-full" aria-hidden="true">
    <g dangerouslySetInnerHTML={{ __html: balloonMarkup(element) }} />
    <text x="110" y="58" textAnchor="middle" dominantBaseline="middle" fontSize="19" fontWeight="600" fill="#292332">{value === "shout" ? "정말이야!" : value === "thought" ? "어떻게 할까…" : value === "none" || value === "rounded" ? "그날의 이야기" : "안녕하세요"}</text>
  </svg>;
}

export default function BalloonStylePicker({ element, onChange }: { element: StoryboardElement; onChange: (changes: Partial<StoryboardElement>) => void }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = element.balloonStyle ?? (element.type === "caption" ? "rounded" : "normal");
  useEffect(() => {
    if (!open || !dialog.current) return;
    const popup = dialog.current;
    const opener = trigger.current;
    const body = window.document.body, previous = body.style.overflow;
    popup.showModal(); body.style.overflow = "hidden";
    return () => { popup.close(); body.style.overflow = previous; opener?.focus(); };
  }, [open]);
  return <div aria-label="대사 말풍선 종류" className="space-y-2">
    <label className="visual-label">말풍선 종류</label>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#DDD6FE] bg-white px-3 py-2 text-xs font-semibold text-[#5B21B6]">
      <span>{styles.find(style => style.value === current)?.label} · 모양 선택</span><span aria-hidden="true">▦</span>
    </button>
    <dialog ref={dialog} aria-label="말풍선 모양 선택" onCancel={event => { event.preventDefault(); event.stopPropagation(); setOpen(false); }}
      onClose={event => { event.stopPropagation(); setOpen(false); }}
      className="fixed inset-0 m-auto max-h-[85vh] w-[720px] max-w-[90vw] overflow-y-auto rounded-2xl border border-[#DDD6FE] bg-[#FAF8FF] p-6 shadow-2xl backdrop:bg-black/50">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div><h3 className="text-base font-bold text-[#35274D]">어떤 말풍선으로 표현할까요?</h3><p className="mt-1 text-xs text-[#82798B]">모양을 선택하면 현재 대사에 적용됩니다. 글자와 위치는 유지됩니다.</p></div>
        <button type="button" aria-label="말풍선 선택 닫기" onClick={() => setOpen(false)} className="editor-tool">닫기</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {styles.map(style => <button key={style.value} type="button" aria-label={style.label} aria-pressed={current === style.value}
          onClick={() => { onChange({ balloonStyle: style.value }); setOpen(false); }}
          className="rounded-xl border border-[#E4DDF8] bg-white p-3 text-left hover:border-[#7C3AED] aria-pressed:border-[#7C3AED] aria-pressed:ring-2 aria-pressed:ring-[#DDD6FE]">
          <Sample value={style.value} /><span className="block text-xs font-bold text-[#5B21B6]">{style.label}</span><span className="mt-1 block text-[11px] text-[#82798B]">{style.hint}</span>
        </button>)}
      </div>
    </dialog>
  </div>;
}
