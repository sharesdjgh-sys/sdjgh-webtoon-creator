"use client";

import type { ArtDirection, ArtStylePreset } from "@/lib/storage";

const PRESETS: Array<{ value: ArtStylePreset; label: string; description: string }> = [
  { value: "clean-webtoon", label: "깔끔한 셀 채색", description: "선명한 선화와 현대적인 웹툰 채색" },
  { value: "romance-watercolor", label: "로맨스 수채화", description: "섬세한 선과 부드러운 빛·색감" },
  { value: "action-contrast", label: "액션 고대비", description: "역동적인 선과 강한 명암 대비" },
  { value: "dark-noir", label: "다크 누아르", description: "절제된 색과 영화적인 그림자" },
  { value: "pencil-sketch", label: "연필 스케치", description: "제작 콘티 같은 흑백 연필선" },
];

export default function ArtDirectionEditor({ value, onChange, compact = false }: {
  value: ArtDirection;
  onChange: (value: ArtDirection) => void;
  compact?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-[#EBE7E0] shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${compact ? "p-4" : "p-5"}`}>
      <div className="mb-3">
        <p className="text-sm font-bold text-[#1A1A1A]">프로젝트 공통 화풍</p>
        <p className="text-xs text-[#ADA8A0] mt-1">캐릭터 시트와 완성 장면에 같은 화풍을 적용해요.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.value}
            onClick={() => onChange({ ...value, preset: preset.value })}
            className={`text-left rounded-xl border p-2.5 transition-all ${value.preset === preset.value ? "border-[#7C3AED]/40 bg-[#7C3AED]/5 ring-2 ring-[#7C3AED]/10" : "border-[#EBE7E0] hover:bg-[#FBF9F6]"}`}
          >
            <span className="block text-[11px] font-bold text-[#1A1A1A]">{preset.label}</span>
            {!compact && <span className="block text-[10px] leading-relaxed text-[#ADA8A0] mt-1">{preset.description}</span>}
          </button>
        ))}
      </div>
      <textarea
        value={value.custom}
        onChange={(event) => onChange({ ...value, custom: event.target.value })}
        maxLength={600}
        rows={compact ? 2 : 3}
        placeholder="추가 화풍 설명 — 예: 청록색 밤 배경, 따뜻한 피부톤, 얇고 섬세한 선화"
        className="visual-input resize-none"
      />
    </div>
  );
}
