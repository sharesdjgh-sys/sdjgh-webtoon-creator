export const WEBTOON_SHOT_NAMES = [
  "원경",
  "풀샷",
  "미디엄샷",
  "클로즈업",
  "익스트림 클로즈업",
  "버드뷰",
  "로우앵글",
  "오버숄더",
] as const;

export type WebtoonShotName = (typeof WEBTOON_SHOT_NAMES)[number];

export type WebtoonShot = {
  name: WebtoonShotName;
  shortLabel: string;
  framing: string;
  bestFor: string;
  imageSrc: string;
};

export const WEBTOON_SHOTS: readonly WebtoonShot[] = [
  { name: "원경", shortLabel: "장소를 넓게", framing: "인물보다 장소가 크게 보여요", bestFor: "새 장소 소개, 장면 전환, 외로운 분위기", imageSrc: "/shot-guides/extreme-wide.jpg" },
  { name: "풀샷", shortLabel: "온몸", framing: "머리부터 발끝까지 보여요", bestFor: "자세, 행동, 의상, 두 사람의 거리", imageSrc: "/shot-guides/full-shot.jpg" },
  { name: "미디엄샷", shortLabel: "허리 위", framing: "허리나 가슴 위를 보여요", bestFor: "대화, 손동작, 자연스러운 감정 표현", imageSrc: "/shot-guides/medium-shot.jpg" },
  { name: "클로즈업", shortLabel: "얼굴", framing: "얼굴이 화면을 크게 채워요", bestFor: "표정, 감정 변화, 중요한 한마디", imageSrc: "/shot-guides/close-up.jpg" },
  { name: "익스트림 클로즈업", shortLabel: "눈·입만", framing: "눈이나 입 같은 일부만 아주 크게 보여요", bestFor: "충격, 눈물, 결심, 결정적인 단서", imageSrc: "/shot-guides/extreme-close-up.jpg" },
  { name: "버드뷰", shortLabel: "위에서", framing: "카메라가 높은 곳에서 아래를 봐요", bestFor: "공간 관계, 작아 보이는 인물, 혼란스러운 상황", imageSrc: "/shot-guides/bird-view.jpg" },
  { name: "로우앵글", shortLabel: "아래에서", framing: "카메라가 낮은 곳에서 위를 봐요", bestFor: "강한 등장, 위압감, 결심한 순간", imageSrc: "/shot-guides/low-angle.jpg" },
  { name: "오버숄더", shortLabel: "어깨 너머", framing: "한 인물의 어깨 너머로 상대를 봐요", bestFor: "대화, 대치, 두 사람의 관계와 시선", imageSrc: "/shot-guides/over-shoulder.jpg" },
] as const;

export function isWebtoonShotName(value: string): value is WebtoonShotName {
  return WEBTOON_SHOT_NAMES.includes(value as WebtoonShotName);
}

export function normalizeWebtoonShot(value: string): WebtoonShotName {
  if (isWebtoonShotName(value)) return value;
  if (value === "오버더숄더") return "오버숄더";
  if (value === "웜뷰" || value === "웜즈아이뷰") return "로우앵글";
  if (value === "전경" || value === "와이드") return "원경";
  return "미디엄샷";
}

const SHOT_PROMPT_DESCRIPTIONS: Record<WebtoonShotName, string> = {
  "원경": "extreme wide establishing shot; environment dominates and the full character appears small",
  "풀샷": "full shot; show the complete character from head to toe with comfortable space around the body",
  "미디엄샷": "medium shot; frame the character approximately from the waist up",
  "클로즈업": "close-up portrait; the face and expression dominate the frame",
  "익스트림 클로즈업": "extreme close-up; isolate an eye, mouth, hand, or another decisive detail",
  "버드뷰": "high-angle bird's-eye view looking down from above; make spatial relationships clear",
  "로우앵글": "low-angle shot looking upward from below; emphasize presence, scale, or resolve",
  "오버숄더": "over-the-shoulder shot; foreground shoulder frames the other character and preserves their eye line",
};

export function webtoonShotPrompt(value: string): string {
  return SHOT_PROMPT_DESCRIPTIONS[normalizeWebtoonShot(value)];
}
