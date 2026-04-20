import Link from "next/link";
import {
  ArrowRight, Lightbulb, BookOpen, Users, Film,
  PenLine, Trophy, Sparkles, Star, Heart
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const STEP_COLORS = [
  "#E8924A", // 01 Amber   – 아이디어 발굴
  "#4A9B8E", // 02 Teal    – 스토리 구성
  "#8B67C9", // 03 Purple  – 캐릭터 설계
  "#D4845A", // 04 Sienna  – 콘티 제작
  "#7C3AED", // 05 Rose    – 대본 작성
  "#5B8FCA", // 06 Sky     – 제출 준비
];

const STEPS = [
  { icon: Lightbulb, label: "아이디어 발굴", desc: "AI와 함께 주제·소재 브레인스토밍" },
  { icon: BookOpen,  label: "스토리 구성",  desc: "기승전결 플롯을 체계적으로 설계" },
  { icon: Users,     label: "캐릭터 설계",  desc: "매력적인 인물과 관계도 완성" },
  { icon: Film,      label: "콘티 제작",    desc: "패널 구성과 연출 방향 계획" },
  { icon: PenLine,   label: "대본 작성",    desc: "대사·지문·효과음까지 완성" },
  { icon: Trophy,    label: "제출 준비",    desc: "대회 규정 최종 점검 및 마무리" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FBF9F6] text-[#1A1A1A] overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#FBF9F6]/85 backdrop-blur-xl border-b border-[#EBE7E0]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#1A1A1A]">웹툰 메이커 AI</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/guide" className="text-sm text-[#7A7067] hover:text-[#1A1A1A] transition-colors duration-200">
            가이드
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 bg-[#1A1A1A] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#2D2D2D] transition-all duration-300 hover:scale-[1.02]"
          >
            시작하기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[100dvh] flex items-center px-8 pt-20 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-24 right-[8%] w-[420px] h-[420px] bg-[#7C3AED] blob blob-anim pointer-events-none" />
        <div className="absolute bottom-12 left-[5%] w-[280px] h-[280px] bg-[#E8C9A0] blob pointer-events-none opacity-25" />

        <div className="relative z-10 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-16 items-center py-16">
          <div>
            {/* Badge */}
            <div className="hero-enter inline-flex items-center gap-2 border border-[#7C3AED]/25 bg-[#7C3AED]/[0.07] text-[#7C3AED] px-3.5 py-1.5 rounded-full text-xs font-medium mb-7">
              <Star className="w-3 h-3 fill-[#7C3AED]" />
              AI 창작 챌린지 대회 공식 준비 플랫폼
            </div>

            {/* Headline */}
            <h1 className="hero-enter-2 text-[clamp(2.6rem,6vw,4.5rem)] font-bold tracking-tight leading-[1.08] mb-6">
              내 이야기를<br />
              <span className="font-serif italic text-[#7C3AED]">웹툰</span>으로<br />
              완성해봐요
            </h1>

            <p className="hero-enter-3 text-[#7A7067] text-lg leading-relaxed max-w-md mb-10">
              아이디어가 막막해도 괜찮아요.<br />
              AI 멘토가 아이디어 발굴부터 대회 제출까지<br />
              6단계 전 과정을 함께해요.
            </p>

            <div className="hero-enter-3 flex items-center gap-4 flex-wrap">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 bg-[#7C3AED] text-white px-6 py-3.5 rounded-full font-semibold text-sm hover:bg-[#6D28D9] transition-all duration-300 hover:scale-[1.02] shadow-[0_4px_24px_rgba(124,58,237,0.35)]"
              >
                지금 시작하기 <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/guide"
                className="text-sm text-[#7A7067] hover:text-[#1A1A1A] transition-colors duration-200 underline underline-offset-4 decoration-[#EBE7E0]"
              >
                제작 가이드 보기
              </Link>
            </div>
          </div>

          {/* Preview card */}
          <div className="hidden lg:block hero-enter-3">
            <div className="bg-white rounded-3xl border border-[#EBE7E0] p-6 shadow-[0_8px_48px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-medium text-[#ADA8A0] uppercase tracking-wider">진행 중인 프로젝트</span>
                <span className="text-[10px] bg-[#7C3AED]/10 text-[#7C3AED] px-2.5 py-1 rounded-full font-medium">3 / 6단계</span>
              </div>
              <p className="text-base font-bold text-[#1A1A1A] mb-1">나의 첫 번째 웹툰</p>
              <p className="text-xs text-[#ADA8A0] mb-4">판타지 · 2026 AI 창작 챌린지</p>

              <div className="w-full bg-[#F4F1EC] rounded-full h-1.5 mb-5">
                <div className="bg-[#7C3AED] h-1.5 rounded-full" style={{ width: "45%" }} />
              </div>

              <div className="space-y-2">
                {[
                  { label: "스토리 구성", done: true },
                  { label: "캐릭터 설계", done: true },
                  { label: "콘티 제작", done: false, current: true },
                  { label: "대본 작성", done: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs ${
                      item.done ? "bg-[#F4F1EC] text-[#ADA8A0]" :
                      item.current ? "bg-[#7C3AED]/8 text-[#7C3AED] border border-[#7C3AED]/15" :
                      "text-[#D4CFC9]"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.done ? "bg-[#ADA8A0]" : item.current ? "bg-[#7C3AED]" : "bg-[#EBE7E0]"
                    }`} />
                    <span>{item.label}</span>
                    {item.done && <span className="ml-auto text-[10px]">완료</span>}
                    {item.current && <span className="ml-auto text-[10px] font-semibold">진행중</span>}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-[#EBE7E0]">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#7C3AED] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#ADA8A0] mb-0.5">AI 멘토 웹툰이</p>
                    <p className="text-xs text-[#7A7067] leading-relaxed">캐릭터 설계가 완성됐어요! 이제 1화 콘티부터 함께 잡아봐요.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6단계 */}
      <section className="px-8 py-24 max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#7C3AED] uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-3xl font-bold tracking-tight">
              아이디어에서 완성까지,<br />
              <span className="font-serif italic">딱 6단계</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const color = STEP_COLORS[i];
            return (
              <ScrollReveal key={step.label} delay={i * 70}>
                <div className="group rounded-3xl overflow-hidden border border-[#EBE7E0] bg-white hover:shadow-[0_8px_48px_rgba(0,0,0,0.09)] hover:-translate-y-1.5 transition-all duration-300 cursor-default">

                  {/* Colored header */}
                  <div className="relative px-6 pt-7 pb-6 overflow-hidden" style={{ backgroundColor: color + "14" }}>
                    <span
                      className="absolute -right-2 top-0 text-[88px] font-black leading-none select-none pointer-events-none tabular-nums"
                      style={{ color: color + "28" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="relative z-10 flex flex-col gap-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "28" }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold tracking-[0.15em] block mb-1" style={{ color }}>
                          STEP {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-lg font-bold text-[#1A1A1A] tracking-tight">{step.label}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="px-6 py-5">
                    <p className="text-xs text-[#7A7067] leading-[1.75]">{step.desc}</p>
                  </div>

                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* Bento features */}
      <section className="px-8 pb-24 max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#7C3AED] uppercase tracking-widest mb-3">Why us</p>
            <h2 className="text-3xl font-bold tracking-tight">
              끝까지 완성할 수 있는<br />
              <span className="font-serif italic">이유가 있어요</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ScrollReveal delay={0} className="h-full">
            <div className="h-full bg-white rounded-3xl border border-[#EBE7E0] p-8 hover:shadow-[0_4px_32px_rgba(0,0,0,0.05)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center mb-5">
                <Sparkles className="w-4.5 h-4.5 text-[#7C3AED]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">AI 멘토 웹툰이</h3>
              <p className="text-sm text-[#7A7067] leading-relaxed max-w-sm">
                각 단계마다 전문 AI가 질문에 답하고, 막힌 부분을 함께 돌파해요. 혼자 고민하지 않아도 돼요.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80} className="h-full">
            <div className="h-full bg-[#7C3AED] rounded-3xl p-8 text-white hover:shadow-[0_4px_32px_rgba(124,58,237,0.3)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-5">
                <Heart className="w-4.5 h-4.5 text-white" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">처음이어도 OK</h3>
              <p className="text-sm text-white/70 leading-relaxed">
                그림 실력이 없어도, 글쓰기가 익숙하지 않아도. AI가 처음부터 함께해요.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120} className="h-full">
            <div className="h-full bg-white rounded-3xl border border-[#EBE7E0] p-8 hover:shadow-[0_4px_32px_rgba(0,0,0,0.05)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-[#F4F1EC] flex items-center justify-center mb-5">
                <Trophy className="w-4.5 h-4.5 text-[#7A7067]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">대회 맞춤 일정</h3>
              <p className="text-sm text-[#7A7067] leading-relaxed">
                마감일을 입력하면 단계별 일정을 자동으로 계산해 드려요.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={160} className="h-full">
            <div className="h-full bg-[#F4F1EC] rounded-3xl border border-[#EBE7E0] p-8 hover:shadow-[0_4px_32px_rgba(0,0,0,0.05)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-5">
                <PenLine className="w-4.5 h-4.5 text-[#7A7067]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">대본 & 콘티 편집기</h3>
              <p className="text-sm text-[#7A7067] leading-relaxed max-w-sm">
                화별 대본을 체계적으로 관리하고, AI가 연출 방향을 제안해요. 막히면 바로 멘토에게 물어봐요.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-xs text-[#7C3AED] font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />
                AI 멘토가 실시간으로 함께해요
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA */}
      <ScrollReveal>
        <section className="px-8 pb-28 max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <p className="text-xs font-medium text-[#7C3AED] uppercase tracking-widest">Get Started</p>
          </div>
          <div className="relative overflow-hidden bg-[#7C3AED] rounded-3xl p-12 text-center">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white blob opacity-10 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                대회 참가를 망설이고 있나요?
              </h2>
              <p className="text-white/70 text-sm mb-8 leading-relaxed">
                처음이어도 괜찮아요. AI 멘토가 첫 아이디어부터 마지막 제출까지 함께해요.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-white text-[#7C3AED] px-7 py-3.5 rounded-full font-semibold text-sm hover:bg-[#FBF9F6] transition-all duration-300 hover:scale-[1.02] shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
              >
                무료로 시작하기 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Footer */}
      <footer className="border-t border-[#EBE7E0] px-8 py-8 bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#7C3AED] flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs text-[#ADA8A0] font-medium">웹툰 메이커 AI</span>
          </div>
          <p className="text-xs text-[#ADA8A0]">© 2026 웹툰 메이커 AI</p>
        </div>
      </footer>
    </div>
  );
}
