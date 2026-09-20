import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STEPS = [
  { id: 1, label: "아이디어 · 기획", icon: "💡", route: "idea" },
  { id: 2, label: "캐릭터", icon: "👤", route: "characters" },
  { id: 3, label: "세계관 · 설정집", icon: "🌍", route: "world" },
  { id: 4, label: "스토리 구조", icon: "📖", route: "story" },
  { id: 5, label: "회차 · 대본", icon: "✍️", route: "script" },
  { id: 6, label: "콘티 · 작화", icon: "🎬", route: "episodes" },
  { id: 7, label: "검수 · 완성", icon: "🏆", route: "submit" },
];

export const GENRES = [
  "판타지", "로맨스", "액션", "SF", "일상", "학원",
  "스포츠", "공포/스릴러", "개그/코미디", "역사", "음악", "기타"
];
