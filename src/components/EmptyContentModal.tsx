"use client";

import { Wand2, Sparkles, ArrowRight, X } from "lucide-react";

interface EmptyContentModalProps {
  title: string;
  description: string;
  onAutofill: () => void;
  onAskMentor: () => void;
  onGoAnyway: () => void;
  onClose: () => void;
  autofilling?: boolean;
}

export default function EmptyContentModal({
  title,
  description,
  onAutofill,
  onAskMentor,
  onGoAnyway,
  onClose,
  autofilling,
}: EmptyContentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-[0_16px_64px_rgba(0,0,0,0.12)] w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#7C3AED]" />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F4F1EC] transition-colors"
          >
            <X className="w-4 h-4 text-[#ADA8A0]" />
          </button>
        </div>

        <h3 className="text-sm font-bold text-[#1A1A1A] mb-1.5">{title}</h3>
        <p className="text-xs text-[#7A7067] leading-relaxed mb-5">{description}</p>

        <div className="space-y-2">
          <button
            onClick={onAutofill}
            disabled={autofilling}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-200 disabled:opacity-60 text-left"
          >
            <Wand2 className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold">{autofilling ? "AI가 채우는 중..." : "AI 자동채우기"}</p>
              <p className="text-[10px] text-white/70">아이디어 발굴 대화를 바탕으로 자동 작성</p>
            </div>
          </button>

          <button
            onClick={onAskMentor}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#FBF9F6] border border-[#EBE7E0] hover:bg-[#F4F1EC] hover:border-[#7C3AED]/30 transition-all duration-200 text-left"
          >
            <Sparkles className="w-4 h-4 text-[#7C3AED] flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[#1A1A1A]">AI 멘토 웹툰이에게 질문</p>
              <p className="text-[10px] text-[#ADA8A0]">우측 채팅창에서 도움을 받아보세요</p>
            </div>
          </button>
        </div>

        <button
          onClick={onGoAnyway}
          className="w-full mt-3 text-xs text-[#ADA8A0] hover:text-[#7A7067] py-2 transition-colors flex items-center justify-center gap-1"
        >
          일단 다음으로 넘어가기 <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
