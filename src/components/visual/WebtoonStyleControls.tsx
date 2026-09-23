"use client";

import type { StoryboardElement } from "@/lib/storage";
import { decorationColor, textDecoration } from "@/lib/webtoonDecoration";

const presets: { label: string; values: Partial<StoryboardElement> }[] = [
  { label: "차가운 위압", values: { fontFamily: "clean", fontWeight: 700, textColor: "#ffffff", balloonFill: "#111111", balloonStroke: "#111111", balloonStyle: "normal" } },
  { label: "긴박한 속마음", values: { fontFamily: "clean", fontWeight: 700, balloonStyle: "radiant", speechRole: "thought", tailVisible: false } },
  { label: "방송·중계", values: { fontFamily: "clean", textItalic: true, balloonFill: "#cbd5e1", balloonStyle: "broadcast", speechRole: "broadcast", tailVisible: false } },
  { label: "기본 대사", values: { fontFamily: "clean", fontWeight: 600, textColor: "#222222", balloonStyle: "normal" } },
  { label: "설렘", values: { fontFamily: "handwritten", fontWeight: 600, textColor: "#be185d", textGradient: true, textGradientColor: "#fb7185", balloonFill: "#fff1f2", balloonStroke: "#f9a8d4", balloonStyle: "thought" } },
  { label: "폭발", values: { fontFamily: "impact", fontWeight: 900, textColor: "#ef4444", textGradient: true, textGradientColor: "#fbbf24", textStrokeWidth: 3, textStrokeColor: "#7f1d1d", balloonStyle: "shout" } },
  { label: "차가운 독백", values: { fontFamily: "serif", fontWeight: 600, textColor: "#e0f2fe", balloonFill: "#172554", balloonStroke: "#60a5fa", balloonStyle: "rounded" } },
  { label: "코믹 반응", values: { fontFamily: "comic", fontWeight: 700, textColor: "#7c3aed", textStrokeWidth: 3, textStrokeColor: "#ffffff", balloonFill: "#fef9c3", balloonStyle: "normal" } },
];
const defaults: Partial<StoryboardElement> = {
  speechRole: "dialogue", tailVisible: true, textItalic: false, textColor: "#222222", textGradient: false, textGradientColor: "#ec4899", textGradientAngle: 90,
  textStrokeColor: "#ffffff", textStrokeWidth: 0, balloonFill: "#ffffff", balloonStroke: "#171717", balloonStrokeWidth: 3,
};

export default function WebtoonStyleControls({ element, onChange }: {
  element: StoryboardElement; onChange: (changes: Partial<StoryboardElement>) => void;
}) {
  const ink = textDecoration(element);
  const color = (label: string, key: "textColor" | "textGradientColor" | "textStrokeColor" | "balloonFill" | "balloonStroke", fallback: string) => (
    <label className="flex items-center justify-between gap-2 text-[11px] text-[#675879]">
      {label}
      <input type="color" aria-label={label} value={decorationColor(element[key], fallback)}
        onChange={event => onChange({ [key]: event.target.value })}
        className="h-7 w-12 cursor-pointer rounded border border-[#DDD6FE] bg-white p-0.5" />
    </label>
  );
  return (
    <div className="space-y-3 border-t border-[#E4DDF8] pt-3">
      <p className="text-[11px] font-bold text-[#5B21B6]">웹툰 표현 스타일</p>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map(preset => <button key={preset.label} type="button"
          onClick={() => onChange({ ...defaults, ...preset.values })}
          className="rounded-lg border border-[#DDD6FE] px-2 py-2 text-[11px] font-bold hover:border-[#7C3AED]"
          style={{ color: preset.values.textColor, background: preset.values.balloonFill ?? "#ffffff" }}>{preset.label}</button>)}
      </div>
      <p className="text-[10px] leading-relaxed text-[#8B7EAE]">프리셋으로 시작한 뒤 색과 효과를 개별 조절하세요. AI 재생성 없이 미리보기와 내보내기에 반영됩니다.</p>
      {element.type !== "sfx" && <label className="block text-[11px]">말의 종류
        <select aria-label="말의 종류" className="visual-input mt-1" value={element.speechRole ?? (element.type === "caption" ? "narration" : "dialogue")} onChange={event => onChange({ speechRole: event.target.value as StoryboardElement["speechRole"] })}>
          <option value="dialogue">직접 하는 말</option><option value="thought">속마음</option><option value="narration">내레이션</option><option value="broadcast">방송·중계</option>
        </select>
      </label>}
      <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={element.textItalic ?? false} onChange={event => onChange({ textItalic: event.target.checked })} />기울임</label>
      <label className="block text-[11px]">행간
        <input aria-label="행간" type="range" min="1.05" max="1.8" step="0.05" value={element.lineHeight ?? 1.3} onChange={event => onChange({ lineHeight: Number(event.target.value) })} className="w-full" />
      </label>
      {element.type === "speech" && <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={element.tailVisible !== false} onChange={event => onChange({ tailVisible: event.target.checked })} />짧은 꼬리 표시</label>}
      {color("글자 색상", "textColor", "#222222")}
      <label className="flex items-center gap-2 text-[11px]">
        <input type="checkbox" aria-label="글자 그라데이션" checked={ink.gradient} onChange={event => onChange({ textGradient: event.target.checked })} />
        글자 그라데이션
      </label>
      {ink.gradient && <>
        {color("그라데이션 끝 색상", "textGradientColor", "#ec4899")}
        <label className="block text-[11px]">그라데이션 방향
          <select aria-label="그라데이션 방향" className="visual-input mt-1" value={element.textGradientAngle ?? 90}
            onChange={event => onChange({ textGradientAngle: Number(event.target.value) })}>
            <option value={90}>위 → 아래</option><option value={0}>왼쪽 → 오른쪽</option>
            <option value={45}>대각선</option><option value={270}>아래 → 위</option>
          </select>
        </label>
      </>}
      <label className="block text-[11px]">글자 외곽선 {ink.strokeWidth}px
        <input type="range" aria-label="글자 외곽선 두께" min="0" max="12" step="1" value={ink.strokeWidth}
          onChange={event => onChange({ textStrokeWidth: Number(event.target.value) })} className="mt-1 w-full accent-[#7C3AED]" />
      </label>
      {color("글자 외곽선 색상", "textStrokeColor", "#ffffff")}
      {element.type !== "sfx" && <>
        {color("말풍선 배경색", "balloonFill", "#ffffff")}
        {color("말풍선 테두리 색상", "balloonStroke", "#171717")}
        <label className="block text-[11px]">말풍선 테두리 {element.balloonStrokeWidth ?? 3}px
          <input type="range" aria-label="말풍선 테두리 두께" min="0" max="12" step="1" value={element.balloonStrokeWidth ?? 3}
            onChange={event => onChange({ balloonStrokeWidth: Number(event.target.value) })} className="mt-1 w-full accent-[#7C3AED]" />
        </label>
      </>}
      <button type="button" className="editor-tool" onClick={() => onChange({ ...defaults, textStrokeWidth: element.type === "sfx" ? 5 : 0 })}>색상·효과 초기화</button>
    </div>
  );
}
