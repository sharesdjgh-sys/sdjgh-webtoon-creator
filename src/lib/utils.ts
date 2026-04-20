import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STEPS = [
  { id: 1, label: "아이디어 발굴", icon: "💡", route: "idea" },
  { id: 2, label: "스토리 구성", icon: "📖", route: "story" },
  { id: 3, label: "캐릭터 설계", icon: "👤", route: "characters" },
  { id: 4, label: "콘티 제작", icon: "🎬", route: "episodes" },
  { id: 5, label: "대본 작성", icon: "✍️", route: "script" },
  { id: 6, label: "제출 준비", icon: "🏆", route: "submit" },
];

export const GENRES = [
  "판타지", "로맨스", "액션", "SF", "일상", "학원",
  "스포츠", "공포/스릴러", "개그/코미디", "역사", "음악", "기타"
];
