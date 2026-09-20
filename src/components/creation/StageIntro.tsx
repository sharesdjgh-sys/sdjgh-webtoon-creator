const CONTENT: Record<string, [string, string, string]> = {
  idea: ["이야기의 씨앗을 골라요", "장르와 떠오르는 장면 하나면 시작할 수 있어요. 먼저 작은 작품을 완성해봐요.", "어떤 이야기를, 어떤 방식으로 만들까요?"],
  characters: ["주인공은 무엇을 원하나요?", "이름·성격·목표·두려움부터 정해요. 디자인은 이야기를 생각하며 발전시켜도 좋아요.", "목표와 말투가 다른 인물들"],
  world: ["이야기가 움직이는 규칙", "가능한 것, 불가능한 것, 대가를 정해요. 반복되는 장소와 물건도 기록해요.", "세계관과 확정 설정집"],
  story: ["주인공의 선택으로 이야기를 이어요", "일상 → 사건 → 문제 확대 → 가장 큰 선택 → 결과와 변화. 시작과 끝을 먼저 연결해요.", "중심 갈등과 전체 이야기"],
  script: ["회차를 설계하고 대본으로 옮겨요", "이번 화의 목표와 마지막 장면을 정한 다음 장소·시간·행동·대사를 써요.", "회차별 시놉시스 → 대본 → 다음 단계에서 콘티"],
  episodes: ["대본을 독자가 읽는 장면으로", "컷의 목적과 감정, 여백을 정하고 러프를 확인해요. 작화와 말풍선을 다듬어 세로로 읽어봐요.", "컷 설계 → 러프 → 작화 → 말풍선 → 미리보기"],
  submit: ["끝까지 만든 나의 첫 작품", "스토리·그림·글자를 차례로 확인해요. 시작과 끝이 있는 작품을 완성하는 것이 먼저예요.", "검수한 작품과 작가 노트"],
};
export default function StageIntro({ stage }: { stage: string }) {
  const content = CONTENT[stage];
  if (!content) return null;
  return <section className="rounded-2xl border border-[#DED5EF] bg-[#F4F0FA] p-5 sm:p-6">
    <span className="text-[10px] font-bold tracking-[0.16em] text-[#7C3AED]">MY WEBTOON STUDIO</span>
    <h2 className="mt-3 text-lg font-bold tracking-tight text-[#30223F]">{content[0]}</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#756584]">{content[1]}</p>
    <p className="mt-4 border-t border-[#DED5EF] pt-3 text-xs font-medium text-[#694C8E]">이번 단계 · {content[2]}</p>
  </section>;
}
