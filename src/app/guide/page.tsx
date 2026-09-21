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
          <h2 className="text-lg font-bold">장면을 그리고, 세로 흐름을 편집해요</h2>
          <p className="mt-3 text-sm leading-6 text-[#7A7067]">웹툰은 같은 네모 칸을 채우는 만화책이 아니에요. 그림의 폭과 높이, 긴 침묵의 여백, 그림 밖 대사의 순서로 한 화의 읽는 속도를 만드세요.</p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#7A7067]">
            <li>아이디어·캐릭터·세계관·회차 대본을 준비해요. 새 캐릭터 시트부터 스케치·완성 그림까지 Gemini 이미지 모델을 사용해요. 기존 시트는 보존되며 새 모델로 바꾸려면 직접 다시 생성하세요.</li>
            <li>‘AI 장면 콘티 만들기’는 구도를 설계한 뒤 인물·손·소품·배경을 한 장면으로 함께 그려요. 장면당 스케치 이미지 요청은 1회이며, 구도 설계 요청은 별도예요.</li>
            <li>배치 지시·포즈를 수정했다면 ‘수정한 구도로 장면 스케치 다시 그리기’를 눌러 확인해요. 새 콘티의 레이어는 독립 그림 조각이 아니라 구도 지시예요. 기존 레이어 콘티도 보존되며, 새로 제안하거나 장면 스케치로 전환할 수 있어요.</li>
            <li>‘현재 스케치 채색·마감’으로 같은 장면을 완성해요. 노트북 화면·힌지·키보드, 태블릿 앞뒤, 손과 소품의 접촉이 자연스러운지 비교 후 적용하세요. 구도 일치와 물체 구조는 AI가 보장하지 않아요.</li>
            <li>‘장면 콘티 · 세로 웹툰 연출’의 설정창에서 ‘그림 여백’을 조절해요. 위·아래 각각 기본 150px, 최대 300px이며 미리보기에도 그대로 보여요. 그림 폭·정렬은 같은 옵션의 펼침 메뉴에서 조절해요.</li>
            <li>말풍선·독백·효과음을 같은 콘티 미리보기에서 직접 끌어 그림 안, 위·아래 여백, 그림 경계 어디든 배치하세요. 자동으로 위아래에 정렬하지 않으며, 옮겨 놓은 위치가 유지돼요. 얼굴·손·소품을 가리지 않도록 자유롭게 조절하세요.</li>
            <li>식자의 모서리와 네 변을 끌어 크기를 바꾸고, 노란 핸들로 말풍선 꼬리를 조절해요. 오른쪽의 기존 대사 설정에서 독백 상자·테두리 없는 글·글꼴·크기·색·그라데이션도 수정해요. 여백 조절과 식자 편집 모두 실행 취소할 수 있어요.</li>
            <li>크게 비교의 양쪽 화면도 여백과 말풍선을 함께 표시해요. 한 화 이어보기, 콘티·최종 PNG, 오버레이 SVG도 같은 좌표를 사용해요. 보라색 여백 경계 점선은 편집용이며 출력되지 않아요.</li>
            <li>콘티 화면에서 화를 선택하고 ‘전체 이어보기 · 다운로드’를 누르세요. 해당 화의 모든 컷·여백·대사를 현재 편집 순서대로 이어 읽고, ‘컷으로 이동’으로 특정 장면도 확인할 수 있어요. 완성 그림이 없으면 콘티로 표시하며, 미제작 컷이나 파일 오류는 먼저 해결해야 전체 다운로드를 준비할 수 있어요.</li>
            <li>미리보기의 ‘이 화 다운로드 준비’를 누른 뒤 ‘한 화 전체 ZIP 다운로드’로 원고를 한 번에 받으세요. ZIP에는 900px 폭, 높이 최대 4096px의 번호순 PNG가 들어 있어요. 개별 PNG도 받을 수 있어요. 번호 순서로 이어지는 한 화의 원고이며, 분할은 파일 처리를 위한 것이지 페이지 연출이 아니에요. 미리보기·출력은 AI 호출 없이 현재 편집 내용을 사용하며, 프로젝트 저장은 별도예요.</li>
            <li>여백과 식자 수정에는 AI 생성 비용이 들지 않아요. 장면 스케치·채색을 다시 생성할 때만 이미지 요청이 발생해요. 편집 후 저장하고, 최종 검수·작가 노트를 마무리하세요.</li>
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
