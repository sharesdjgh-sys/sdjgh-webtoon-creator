import type { PanelAspectRatio } from "@/lib/storage";

export type WebtoonAspectGuide = {
  value: PanelAspectRatio;
  label: string;
  shape: string;
  bestFor: string;
  imageSrc: string;
};

export const WEBTOON_ASPECTS: readonly WebtoonAspectGuide[] = [
  { value: "4:3", label: "가로", shape: "넓은 화면", bestFor: "장소 소개, 여러 인물, 큰 동작", imageSrc: "/aspect-guides/landscape-4x3.jpg" },
  { value: "3:4", label: "세로", shape: "기본 세로 컷", bestFor: "대화, 인물 행동, 감정 장면", imageSrc: "/aspect-guides/portrait-3x4.jpg" },
  { value: "1:1", label: "정사각형", shape: "짧고 안정적인 컷", bestFor: "리액션, 짧은 대사, 장면 연결", imageSrc: "/aspect-guides/square-1x1.jpg" },
  { value: "9:16", label: "긴 세로", shape: "아래로 긴 화면", bestFor: "강한 등장, 추락, 높이와 거리 강조", imageSrc: "/aspect-guides/tall-9x16.jpg" },
  { value: "4:1", label: "순간 클로즈업", shape: "매우 짧은 가로 컷", bestFor: "눈빛, 손동작, 충돌 직전의 순간", imageSrc: "/aspect-guides/landscape-4x3.jpg" },
  { value: "1:4", label: "세로 액션", shape: "긴 스크롤 컷", bestFor: "낙하, 돌진, 거대한 적, 마법 궤적", imageSrc: "/aspect-guides/tall-9x16.jpg" },
  { value: "1:8", label: "장면 펼치기", shape: "매우 긴 세로 컷", bestFor: "위에서 아래로 드러나는 공간과 규모", imageSrc: "/aspect-guides/tall-9x16.jpg" },
] as const;
