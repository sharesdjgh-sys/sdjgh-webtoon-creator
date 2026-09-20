export const DEFAULT_BRIEF = {
  idea: "", tone: "", audience: "중·고등학생", feeling: "", format: "short",
  mode: "together", targetCuts: "12", purpose: "첫 작품 완성", mustKeep: "",
};
export const DEFAULT_WORLD = {
  era: "", mainLocation: "", possible: "", forbidden: "", cost: "",
  locations: "", props: "", confirmed: "", undecided: "", foreshadowing: "",
};
export type CreativeBrief = typeof DEFAULT_BRIEF;
export type WorldBible = typeof DEFAULT_WORLD;
export const CHARACTER_STORY_FIELDS = [
  { key: "goal", label: "가장 원하는 것", hint: "주인공이 지금 이루려는 목표" },
  { key: "fear", label: "가장 두려운 것", hint: "목표 앞에서 망설이게 만드는 것" },
  { key: "weakness", label: "약점", hint: "실수하거나 어려움을 겪는 이유" },
  { key: "growth", label: "이야기를 통해 배우는 것", hint: "처음과 끝에서 어떻게 달라지나요?" },
  { key: "speechStyle", label: "말투", hint: "이 인물만의 짧은 대사 예시" },
  { key: "relationships", label: "인물 관계", hint: "누구와 친하고, 누구와 갈등하나요?" },
] as const;
export const STORY_FIELDS = [
  { key: "conflict", label: "중심 갈등", hint: "주인공의 목표를 막는 가장 큰 문제" },
  { key: "stakes", label: "실패하면 잃는 것", hint: "왜 지금 이 문제를 해결해야 하나요?" },
  { key: "ordinary", label: "1. 평범한 일상", hint: "사건 전 주인공의 모습" },
  { key: "incident", label: "2. 사건 발생", hint: "일상을 깨뜨리는 사건" },
  { key: "escalation", label: "3. 문제 확대", hint: "해결하려 할수록 어려워지는 이유" },
  { key: "choice", label: "4. 가장 큰 선택", hint: "주인공이 스스로 결정하는 순간" },
  { key: "ending", label: "5. 결과와 변화", hint: "문제의 해결과 인물의 변화" },
] as const;
export const EPISODE_FIELDS = [
  { key: "goal", label: "이번 화의 작은 목표", hint: "이번 화에서 무엇을 이루려 하나요?" },
  { key: "obstacle", label: "장애물", hint: "그 목표를 막는 것은 무엇인가요?" },
  { key: "turningPoint", label: "새로운 정보 / 변화", hint: "어떤 발견이나 선택으로 상황이 바뀌나요?" },
  { key: "endingHook", label: "마지막 장면", hint: "단편은 결과와 여운, 연재는 다음 화의 궁금증" },
] as const;
