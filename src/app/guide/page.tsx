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
              내 웹툰을 완성하는 제작 가이드
            </h1>
            <p className="text-sm text-[#7A7067] leading-relaxed">
              실제 작업실과 같은 7단계예요. 대본을 먼저 쓰고 콘티와 작화를 진행해요. 필요한 단계는 언제든 돌아가 수정할 수 있어요.
            </p>
          </div>
        </ScrollReveal>

        <GuideCarousel />
        <section className="mt-8 rounded-2xl border border-[#EBE7E0] bg-white p-6">
          <h2 className="text-lg font-bold">처음이라면 이렇게 시작해요</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#7A7067]">
            <li>기획 카드에서 완결 단편과 12컷을 선택하고, 떠오르는 장면 하나를 적어요.</li>
            <li>주인공 한 명의 목표와 두려움, 주요 장소와 규칙을 정해요.</li>
            <li>시작과 끝을 정하고 1화 시놉시스와 짧은 대본을 작성해요.</li>
            <li>대본을 컷으로 나누고 그림과 말풍선을 만든 뒤 세로 미리보기로 읽어요.</li>
            <li>스토리·그림·글자를 점검하고 내가 선택한 부분을 작가 노트에 남겨요.</li>
          </ol>
          <p className="mt-5 border-t border-[#EBE7E0] pt-4 text-xs leading-6 text-[#82798B]">기획 카드는 자동 저장돼요. 다른 편집 화면은 저장 버튼을 눌러 주세요. AI 제안은 초안이며 최종 결정은 내가 해요. 확정 설정과 미정 후보는 세계관 · 설정집에서 구분해 관리해요.</p>
        </section>

        <ScrollReveal>
          <div className="mt-10 relative overflow-hidden bg-[#7C3AED] rounded-3xl p-10 text-center">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white blob opacity-10 pointer-events-none" />
            <div className="relative z-10">
              <p className="text-white/70 text-xs font-medium tracking-widest uppercase mb-4">지금 바로</p>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-3">시작할 준비가 됐나요?</h2>
              <p className="text-sm text-white/70 mb-8 leading-relaxed">AI 멘토가 첫 아이디어부터 작품 완성까지 함께해요.</p>
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
