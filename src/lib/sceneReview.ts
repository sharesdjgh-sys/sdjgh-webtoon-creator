import type { SceneReview } from "@/lib/storage";

/** A checkbox cannot override failed, missing or inconclusive anatomy verification. */
export function canApplyScene(review: SceneReview | undefined, manuallyReviewed = false): boolean {
  return review?.status === "checked" && review.anatomy?.status === "pass" && (review.issues.length === 0 || manuallyReviewed);
}

export function sceneReviewSummary(review?: SceneReview): string {
  if (!review) return "인체 검수가 필요합니다. 그림을 다시 생성해주세요.";
  if (review.anatomy?.status === "fail") return "손·팔 등 신체 구조 오류가 발견되어 적용할 수 없습니다.";
  if (review.status === "unavailable" || review.anatomy?.status === "unavailable") return "AI 검수 미완료 · 그림은 보존되었으며 적용은 보류됩니다.";
  if (review.anatomy?.status !== "pass") return "신체 구조를 확인하지 못해 적용을 보류했습니다.";
  if (review.issues.length) return "인체 검수 완료 · 구도와 표현에서 확인할 점이 있습니다.";
  return review.repair?.outcome === "corrected" ? "신체 오류 자동 수정 후 재검수 완료" : "인체·그림 검수에서 뚜렷한 문제를 찾지 못했습니다.";
}
