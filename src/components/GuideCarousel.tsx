"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Lightbulb, BookOpen, Users, Film, PenLine, Trophy, Globe } from "lucide-react";

import { STEPS } from "@/lib/utils";
import { CREATION_GUIDE } from "@/lib/creationGuide";

const STEP_COLORS = [
  "#E8924A",
  "#4A9B8E",
  "#8B67C9",
  "#D4845A",
  "#7C3AED",
  "#5B8FCA",
  "#598875",
];

const ICONS = [Lightbulb, Users, Globe, BookOpen, PenLine, Film, Trophy];
const GUIDE_STEPS = STEPS.map((step, index) => ({
  icon: ICONS[index], step: step.id, title: step.label, time: "내 속도로",
  ...CREATION_GUIDE[step.route],
}));

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
                        {s.time}
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
