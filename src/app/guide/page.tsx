import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import GuideCarousel from "@/components/GuideCarousel";

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <header className="bg-white border-b border-[#EBE7E0] px-6 py-4 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#7C3AED] flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1A1A1A] tracking-tight">웹툰 메이커 AI</span>
          </Link>
          <Link href="/dashboard" className="flex items-center gap-1.5 bg-[#7C3AED] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[#6D28D9] transition-all duration-300">
            시작하기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <ScrollReveal>
          <div className="mb-10">
            <p className="text-xs font-medium text-[#7C3AED] uppercase tracking-widest mb-3">Guide</p>
            <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight mb-3">
              웹툰 제작 완벽 가이드
            </h1>
            <p className="text-sm text-[#7A7067] leading-relaxed">
              처음이어도 괜찮아요. 6단계로 나만의 웹툰을 완성해봐요.
            </p>
          </div>
        </ScrollReveal>

        <GuideCarousel />

        <ScrollReveal>
          <div className="mt-10 relative overflow-hidden bg-[#7C3AED] rounded-3xl p-10 text-center">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white blob opacity-10 pointer-events-none" />
            <div className="relative z-10">
              <p className="text-white/70 text-xs font-medium tracking-widest uppercase mb-4">지금 바로</p>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-3">시작할 준비가 됐나요?</h2>
              <p className="text-sm text-white/70 mb-8 leading-relaxed">AI 멘토가 첫 질문부터 마지막 제출까지 함께해요.</p>
              <Link href="/dashboard" className="inline-flex items-center gap-2 bg-white text-[#7C3AED] px-6 py-3 rounded-full text-sm font-semibold hover:bg-[#FBF9F6] transition-all duration-300 hover:scale-[1.02] shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
                무료로 시작하기 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </main>
    </div>
  );
}
