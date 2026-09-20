import Link from "next/link";
import {
  ArrowRight, Lightbulb, BookOpen, Users, Film,
  PenLine, Trophy, Sparkles, Star, Heart, Globe
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import styles from "@/components/home/home.module.css";
import HomeProjectPanel from "@/components/home/HomeProjectPanel";
import { STEPS as WORKFLOW_STEPS } from "@/lib/utils";
import { CREATION_GUIDE } from "@/lib/creationGuide";

const STEP_COLORS = ["#713DE3", "#713DE3", "#713DE3", "#713DE3", "#713DE3", "#713DE3", "#713DE3"];

const ICONS = [Lightbulb, Users, Globe, BookOpen, PenLine, Film, Trophy];
const STEPS = WORKFLOW_STEPS.map((step, index) => ({ icon: ICONS[index], label: step.label, desc: CREATION_GUIDE[step.route].desc }));

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FFFEFC] text-[#1A1A1A] overflow-x-hidden [word-break:keep-all]">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 bg-[#FFFEFC]/95 backdrop-blur-xl border-b border-[#E6DDF6]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#713DE3] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#1A1A1A]">웹툰 메이커 AI</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/guide" className="text-sm text-[#625B72] hover:text-[#1A1A1A] transition-colors duration-200">
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
      <section className={`${styles.hero} relative flex items-center px-5 sm:px-8 pt-24 pb-8 lg:min-h-[88dvh] overflow-hidden`}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#E6DDF6]" />

        <div className="relative z-10 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10 lg:gap-16 items-center py-10 lg:py-16">
          <div>
            {/* Badge */}
            <div className="hero-enter inline-flex items-center gap-2 border-2 border-[#302342] bg-[#FFE45C] text-[#302342] px-3.5 py-1.5 rounded-full text-xs font-medium mb-7">
              <Star className="w-3 h-3 fill-[#302342]" />
              PC에서 만드는 나의 웹툰 작업실
            </div>

            {/* Headline */}
            <h1 className="hero-enter-2 [text-wrap:balance] text-[clamp(2.6rem,6vw,4.5rem)] font-bold tracking-tight leading-[1.08] mb-6">
              내 이야기를<br />
              <span className={styles.titleAccent}>웹툰</span>으로<br />
              완성해봐요
            </h1>

            <p className="hero-enter-3 text-[#625B72] text-lg leading-relaxed max-w-md mb-10">
              아이디어가 막막해도 괜찮아요.<br />
              AI 멘토와 기획부터 대본, 콘티, 완성까지<br />
              7단계 전 과정을 함께해요.
            </p>

            <div className="hero-enter-3 flex items-center gap-4 flex-wrap">
              <Link
                href="/dashboard"
                className={`${styles.primaryButton} flex items-center gap-2 bg-[#713DE3] text-white px-8 py-4 rounded-xl font-semibold text-base hover:bg-[#5925BE] transition-all duration-200`}
              >
                작업실 열기 <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/guide"
                className="text-sm text-[#625B72] hover:text-[#1A1A1A] transition-colors duration-200 underline underline-offset-4 decoration-[#E6DDF6]"
              >
                제작 가이드 보기
              </Link>
            </div>
          </div>

          <div className="min-w-0 lg:pl-4">
            <HomeProjectPanel />
          </div>
        </div>
      </section>

      {/* 7단계 */}
      <section className="px-8 py-24 max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#713DE3] uppercase tracking-widest mb-3">만드는 순서</p>
            <h2 className="text-3xl font-bold tracking-tight">
              아이디어에서 완성까지,<br />
              <span className="font-bold">딱 7단계</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const color = STEP_COLORS[i];
            return (
              <ScrollReveal key={step.label} delay={i * 70}>
                <div className="group rounded-3xl overflow-hidden border border-[#E6DDF6] bg-white hover:shadow-[0_8px_48px_rgba(0,0,0,0.09)] hover:-translate-y-1.5 transition-all duration-300 cursor-default">

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
                    <p className="text-xs text-[#625B72] leading-[1.75]">{step.desc}</p>
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
            <p className="text-xs font-medium text-[#713DE3] uppercase tracking-widest mb-3">함께 만드는 즐거움</p>
            <h2 className="text-3xl font-bold tracking-tight">
              끝까지 완성할 수 있는<br />
              <span className="font-bold">이유가 있어요</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ScrollReveal delay={0} className="h-full">
            <div className="h-full bg-white rounded-3xl border border-[#E6DDF6] p-8 hover:shadow-[0_4px_32px_rgba(0,0,0,0.05)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-[#713DE3]/10 flex items-center justify-center mb-5">
                <Sparkles className="w-4.5 h-4.5 text-[#713DE3]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">AI 멘토 웹툰이</h3>
              <p className="text-sm text-[#625B72] leading-relaxed max-w-sm">
                각 단계마다 전문 AI가 질문에 답하고, 막힌 부분을 함께 돌파해요. 혼자 고민하지 않아도 돼요.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80} className="h-full">
            <div className="h-full bg-[#FFE45C] rounded-3xl p-8 text-[#302342] hover:shadow-[0_4px_32px_rgba(113,61,227,0.3)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center mb-5">
                <Heart className="w-4.5 h-4.5 text-[#713DE3]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">처음이어도 OK</h3>
              <p className="text-sm text-[#51435F] leading-relaxed">
                그림 실력이 없어도, 글쓰기가 익숙하지 않아도. AI가 처음부터 함께해요.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120} className="h-full">
            <div className="h-full bg-white rounded-3xl border border-[#E6DDF6] p-8 hover:shadow-[0_4px_32px_rgba(0,0,0,0.05)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-[#FFF4B8] flex items-center justify-center mb-5">
                <Trophy className="w-4.5 h-4.5 text-[#625B72]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">작품과 마감 관리</h3>
              <p className="text-sm text-[#625B72] leading-relaxed">
                마감일과 제작 상태를 한곳에서 확인하고, 내 속도에 맞춰 작품을 완성해요.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={160} className="h-full">
            <div className="h-full bg-[#FFF4B8] rounded-3xl border border-[#E6DDF6] p-8 hover:shadow-[0_4px_32px_rgba(0,0,0,0.05)] transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-5">
                <PenLine className="w-4.5 h-4.5 text-[#625B72]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2">대본 & 콘티 편집기</h3>
              <p className="text-sm text-[#625B72] leading-relaxed max-w-sm">
                화별 대본을 체계적으로 관리하고, AI가 연출 방향을 제안해요. 막히면 바로 멘토에게 물어봐요.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-xs text-[#713DE3] font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-[#713DE3] animate-pulse" />
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
            <p className="text-xs font-medium text-[#713DE3] uppercase tracking-widest">이제 내 이야기 차례</p>
          </div>
          <div className="relative overflow-hidden bg-[#713DE3] rounded-3xl p-12 text-center">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full opacity-10 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                대회 참가를 망설이고 있나요?
              </h2>
              <p className="text-white/90 text-sm mb-8 leading-relaxed">
                처음이어도 괜찮아요. AI 멘토가 첫 아이디어부터 마지막 제출까지 함께해요.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-[#FFE45C] text-[#302342] px-7 py-3.5 rounded-full font-semibold text-sm hover:bg-[#FFFEFC] transition-all duration-300 hover:scale-[1.02] shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
              >
                내 작품 시작하기 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Footer */}
      <footer className="border-t border-[#E6DDF6] px-8 py-8 bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#713DE3] flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs text-[#736B82] font-medium">웹툰 메이커 AI</span>
          </div>
          <p className="text-xs text-[#736B82]">© 2026 웹툰 메이커 AI</p>
        </div>
      </footer>
    </div>
  );
}
