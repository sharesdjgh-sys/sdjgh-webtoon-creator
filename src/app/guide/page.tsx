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
              아이디어와 기획만 입력하면 각 단계의 AI 채우기로 제작 초안을 만들 수 있어요. 사용자는 검토하고 원하는 부분을 수정하면 돼요. 대본을 먼저 만들고 콘티와 작화를 진행해요.
            </p>
          </div>
        </ScrollReveal>

        <GuideCarousel />
        <section className="mt-8 rounded-2xl border border-[#EBE7E0] bg-white p-6">
          <h2 className="text-lg font-bold">처음이라면 이렇게 시작해요</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#7A7067]">
            <li>기획 카드에서 완결 단편과 12컷을 선택하고, 떠오르는 장면 하나를 적어요.</li>
            <li>캐릭터 AI 자동채우기로 인물과 외형 정보를 만들어요. 기존 인물은 외형 고정 정보 AI 채우기로 보완해요.</li>
            <li>세계관과 스토리 AI 채우기로 설정과 줄거리를 만들고, 회차 설계·대본 AI 채우기로 장면과 대사를 받아요.</li>
            <li>콘티 단계의 AI 컷 설계와 이미지 생성으로 장면을 만들어요. 말풍선·대사·효과음은 그림과 분리해 직접 편집하며, 도형·화살표는 편집용 가이드로만 사용돼요.</li>
            <li>크게 비교에서 말풍선·글자 표시를 끄고 AI 원본을 검수해요. 빈 말풍선·글자·가이드·내부 테두리·잘림이 없음을 확인하고 검수 체크 후 적용해요. 그림에 섞인 흔적은 글자 편집으로 지워지지 않으므로 해당 레이어부터 다시 생성해야 해요.</li>
            <li>작가 노트도 AI 초안으로 시작할 수 있어요. 최종 검수 체크와 완성 표시는 직접 확인해요.</li>
          </ol>
          <p className="mt-5 border-t border-[#EBE7E0] pt-4 text-xs leading-6 text-[#82798B]">기획 카드와 작가 노트는 자동 저장돼요. 다른 편집 화면은 저장 버튼을 눌러 주세요. 외형·세계관·회차 설계·작가 노트는 빈칸 채우기 또는 전체 다시 제안을 선택할 수 있어요. AI 제안은 초안이며 최종 결정은 내가 해요. 세계관의 확정 설정은 AI가 덮어쓰지 않아요.</p>
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
