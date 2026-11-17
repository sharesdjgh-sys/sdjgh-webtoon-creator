import type { Character, Cut, Project } from "./storage";
import { artworkOnlyStoryboard } from "./cleanGeneration";

export type VisualIssue = { message: string; action: string; stage?: "characters" | "episodes" };

export function characterSheetIssue(character: Character): VisualIssue | null {
  return character.name.trim() ? null : {
    message: "캐릭터 이름이 없어 시트 생성을 시작할 수 없어요. 입력한 내용과 기존 시트는 유지됩니다.",
    action: "이 캐릭터의 이름을 입력해 주세요.", stage: "characters",
  };
}

export function storyboardLayerIssue(project: Project, cut: Cut, layerId: string): VisualIssue | null {
  const layer = cut.storyboard?.elements.find((item) => item.id === layerId);
  if (!layer) return { message: "생성할 콘티 레이어를 찾지 못했어요. 현재 콘티는 유지됩니다.", action: "콘티를 다시 확인해 주세요.", stage: "episodes" };
  if (layer.type !== "character") return null;
  const character = project.characters.find((item) => item.id === layer.characterId);
  if (character?.imageAssetId) return null;
  return {
    message: `${character?.name || layer.text || "선택한 인물"}의 캐릭터 시트가 없어 인물 그림을 만들 수 없어요. 현재 콘티는 유지됩니다.`,
    action: "캐릭터 단계에서 시트를 생성해 주세요.", stage: "characters",
  };
}

export function sceneImageIssue(project: Project, cut: Cut): VisualIssue | null {
  if (!cut.storyboard) return { message: "편집 가능한 콘티가 없어 장면을 만들 수 없어요.", action: "먼저 이 컷의 장면 콘티를 만들어 주세요.", stage: "episodes" };
  const artwork = artworkOnlyStoryboard(cut.storyboard);
  if (!artwork.elements.length) return { message: "장면에 그릴 배경·인물·소품이 없어요. 현재 콘티는 유지됩니다.", action: "콘티에 그림 요소를 추가해 주세요.", stage: "episodes" };
  const ids = new Set([
    ...cut.characterIds,
    ...artwork.elements.filter((item) => item.type === "character" && item.characterId).map((item) => item.characterId as string),
  ]);
  const missing = [...ids].map((id) => project.characters.find((item) => item.id === id)).filter((item) => !item?.imageAssetId);
  if (!missing.length) return null;
  return {
    message: `${missing.map((item) => item?.name || "선택한 인물").join(", ")}의 캐릭터 시트가 없어 완성 그림을 만들 수 없어요. 기존 그림은 유지됩니다.`,
    action: "캐릭터 단계에서 시트를 생성해 주세요.", stage: "characters",
  };
}

export function visualFailureMessage(error: unknown, task: string): string {
  const message = error instanceof Error ? error.message : "";
  if (error && typeof error === "object" && "name" in error && error.name === "QuotaExceededError") return `${task} 결과를 브라우저에 저장하지 못했어요. 저장 공간을 확인해 주세요. 기존 결과는 유지됩니다.`;
  if (/요청 정보|JSON 요청|형식|크기|4 MB|900 kB|참고 이미지/.test(message)) return `${message} 입력과 기존 결과는 유지됩니다.`;
  if (/한도|잠시 후|429/.test(message)) return `${task}을 시작하거나 완료하지 못했어요. AI 사용량 한도를 확인하고 잠시 후 다시 시도해 주세요. 기존 결과는 유지됩니다.`;
  if (/안전 정책|차단/.test(message)) return `${task}을 완료하지 못했어요. 표현을 조정해 다시 시도해 주세요. 기존 결과는 유지됩니다.`;
  if (/시간이 초과|시간 초과|timeout|네트워크|Failed to fetch|fetch failed/i.test(message)) return `${task}을 완료하지 못했어요. 연결 상태를 확인하고 잠시 후 다시 시도해 주세요. 기존 결과는 유지됩니다.`;
  if (/API 키|모델|권한|서버 설정/.test(message)) return `${task}을 완료하지 못했어요. 관리자에게 AI 설정과 사용 권한을 확인해 달라고 알려 주세요. 기존 결과는 유지됩니다.`;
  if (/응답|base64|InvalidCharacterError/i.test(message)) return `${task} 결과를 읽지 못했어요. 잠시 후 다시 시도해 주세요. 기존 결과는 유지됩니다.`;
  if (/^(먼저 |생성할 콘티 레이어|기존 그림은 보존됩니다|장면에 표시할|인물 스케치가 없습니다|포즈를 분석할|생성 가능한 그림 레이어)/.test(message)
    || /의 캐릭터 시트를 먼저 생성/.test(message)) return `${message} 기존 결과는 유지됩니다.`;
  return `${task}을 완료하지 못했어요. 잠시 후 다시 시도해 주세요. 같은 문제가 계속되면 관리자에게 알려 주세요. 기존 결과는 유지됩니다.`;
}
