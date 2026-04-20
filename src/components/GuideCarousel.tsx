"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Lightbulb, BookOpen, Users, Film, PenLine, Trophy } from "lucide-react";

const STEP_COLORS = [
  "#E8924A",
  "#4A9B8E",
  "#8B67C9",
  "#D4845A",
  "#7C3AED",
  "#5B8FCA",
];

const GUIDE_STEPS = [
  { icon: Lightbulb, step: 1, title: "아이디어 발굴", time: "1~2일", desc: "웹툰의 주제, 장르, 소재를 정하는 단계예요.",
    tips: ["좋아하는 것, 관심 있는 것에서 시작해요", "일상 속 감동이나 불편함을 소재로 삼아봐요", "대회 주제와 연결될 수 있는 아이디어를 찾아봐요", "AI 멘토와 대화하며 아이디어를 발전시켜봐요"] },
  { icon: BookOpen, step: 2, title: "스토리 구성", time: "2~3일", desc: "기승전결 구조로 전체 이야기의 뼈대를 세워요.",
    tips: ["한 줄 소개(로그라인)를 먼저 써봐요", "주인공의 목표가 무엇인지 명확히 해요", "갈등과 위기가 있어야 재미있는 이야기가 돼요", "결말은 주인공이 성장하는 모습을 담아요"] },
  { icon: Users, step: 3, title: "캐릭터 설계", time: "2일", desc: "독자가 사랑할 입체적인 캐릭터를 만들어요.",
    tips: ["주인공에게 장점과 단점을 모두 부여해요", "각 캐릭터의 목표와 동기를 명확히 해요", "외모 묘사는 특징적인 요소를 중심으로 구체적으로", "캐릭터 간 관계가 이야기를 더 풍부하게 해요"] },
  { icon: Film, step: 4, title: "콘티 제작", time: "3~5일", desc: "장면 배치와 연출을 계획하는 단계예요.",
    tips: ["각 장면의 앵글을 다양하게 활용해요", "클로즈업은 감정 표현, 풀샷은 상황 설명에 효과적", "여백도 연출의 일부예요", "말풍선 위치와 크기가 가독성에 영향을 줘요"] },
  { icon: PenLine, step: 5, title: "대본 작성", time: "3~5일", desc: "각 장면의 대사와 지문을 완성해요.",
    tips: ["대사는 자연스럽게, 소리내어 읽어봐요", "나레이션은 꼭 필요한 것만 간결하게", "효과음은 분위기를 살려주는 중요한 요소예요", "각 화는 다음 화가 궁금하게 끝나면 좋아요"] },
  { icon: Trophy, step: 6, title: "제출 준비", time: "1~2일", desc: "작품을 다듬고 대회 규정에 맞게 준비해요.",
    tips: ["전체를 처음부터 끝까지 다시 읽어봐요", "오탈자와 문법 오류를 꼼꼼히 확인해요", "대회 파일 형식과 페이지 수 규정을 꼭 확인해요", "작가 노트에 진심을 담아 써봐요"] },
];

export default function GuideCarousel() {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(GUIDE_STEPS.length - 1, c + 1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 50) next();
    else if (diff < -50) prev();
  };

  const color = STEP_COLORS[current];

  return (
    <div className="flex flex-col gap-4">

      {/* Step progress track */}
      <div className="flex gap-1.5">
        {GUIDE_STEPS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className="group flex-1 flex flex-col gap-1.5"
            aria-label={`${s.step}단계 ${s.title}`}
          >
            <div
              className="h-1 rounded-full transition-all duration-500"
              style={{ backgroundColor: idx <= current ? STEP_COLORS[idx] : "#E8E3DC" }}
            />
            <span
              className="text-[9px] font-mono font-semibold tracking-wider transition-all duration-300 hidden sm:block"
              style={{ color: idx === current ? STEP_COLORS[idx] : "#C4BFB8" }}
            >
              {String(s.step).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>

      {/* Carousel track */}
      <div
        className="overflow-hidden rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-[#EBE7E0]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {GUIDE_STEPS.map((s, idx) => {
            const Icon = s.icon;
            const c = STEP_COLORS[idx];
            return (
              <div key={s.step} className="w-full flex-shrink-0">

                {/* Card header — colored section */}
                <div
                  className="relative overflow-hidden px-8 pt-8 pb-10"
                  style={{ backgroundColor: c + "18" }}
                >
                  {/* Watermark number */}
                  <span
                    className="absolute -right-3 -bottom-6 text-[160px] font-black leading-none select-none pointer-events-none"
                    style={{ color: c + "22" }}
                  >
                    {String(s.step).padStart(2, "0")}
                  </span>

                  <div className="relative z-10 flex items-start justify-between gap-6">
                    <div className="flex flex-col gap-3">
                      <span
                        className="text-[10px] font-mono font-semibold tracking-[0.18em] uppercase"
                        style={{ color: c }}
                      >
                        Step {String(s.step).padStart(2, "0")} — {String(GUIDE_STEPS.length).padStart(2, "0")}
                      </span>
                      <h2 className="text-[28px] font-bold text-[#1A1A1A] tracking-tight leading-tight">
                        {s.title}
                      </h2>
                      <span
                        className="inline-flex items-center gap-1.5 w-fit text-[11px] font-medium px-3 py-1 rounded-full border"
                        style={{ color: c, borderColor: c + "40", backgroundColor: c + "12" }}
                      >
                        예상 {s.time}
                      </span>
                    </div>

                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[0_2px_16px_rgba(0,0,0,0.10)]"
                      style={{ backgroundColor: c + "25" }}
                    >
                      <Icon className="w-8 h-8" style={{ color: c }} />
                    </div>
                  </div>
                </div>

                {/* Card body — white section */}
                <div className="bg-white px-8 py-7 flex flex-col gap-5">
                  <p className="text-sm text-[#7A7067] leading-[1.8]">{s.desc}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {s.tips.map((tip, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 text-xs text-[#5A5550] bg-[#FAFAF8] rounded-xl px-3.5 py-3 border border-[#EBE7E0]"
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[4px]"
                          style={{ backgroundColor: c }}
                        />
                        <span className="leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-1">
        <button
          onClick={prev}
          disabled={current === 0}
          className="flex items-center gap-1.5 text-sm font-medium text-[#7A7067] hover:text-[#1A1A1A] transition-colors duration-200 disabled:opacity-25 disabled:cursor-not-allowed py-2"
        >
          <ChevronLeft className="w-4 h-4" />
          이전
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {GUIDE_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: idx === current ? 28 : 8,
                backgroundColor: idx === current ? color : "#D4C9BC",
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={current === GUIDE_STEPS.length - 1}
          className="flex items-center gap-1.5 text-sm font-medium text-[#7A7067] hover:text-[#1A1A1A] transition-colors duration-200 disabled:opacity-25 disabled:cursor-not-allowed py-2"
        >
          다음
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
