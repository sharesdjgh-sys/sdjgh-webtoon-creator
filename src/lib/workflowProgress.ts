import type { Project } from "@/lib/storage";
/** Saved material checkpoints; these are not an assessment of artistic quality. */
export function workflowCheckpoints(p: Project): boolean[] {
  const filled = (s?: string) => Boolean(s?.trim());
  return [
    filled(p.brief?.idea) || p.ideaChat.some(m => m.role === "user" && filled(m.content)),
    p.characters.some(c => filled(c.name) && filled(c.goal)),
    filled(p.world?.mainLocation) && (filled(p.world?.possible) || filled(p.world?.confirmed)),
    filled(p.story.logline) && (filled(p.story.plotOutline) || filled(p.story.ending)),
    p.episodes.length > 0 && p.episodes.every(e => filled(e.synopsis) && filled(e.script)),
    p.episodes.length > 0 && p.episodes.every(e => e.cuts.length > 0 && e.cuts.every(c => filled(c.description) && Boolean(c.sceneImageAssetId || c.storyboard))),
    p.isCompleted,
  ];
}
export function workflowProgress(p: Project): number {
  return Math.round(workflowCheckpoints(p).filter(Boolean).length / 7 * 100);
}

export type WorkflowStatus = "시작 전" | "작성 중" | "초안 준비" | "검토 필요" | "검토 중" | "완료";

/** Page visits and default selections are not evidence of saved work. */
export function workflowStatuses(p: Project): WorkflowStatus[] {
  const filled = (value: unknown) => typeof value === "string" && Boolean(value.trim());
  const any = (values: unknown[]) => values.some(filled);
  const checkpoints = workflowCheckpoints(p);
  const started = [
    any([p.brief.idea, p.brief.tone, p.brief.feeling, p.brief.mustKeep]) || p.ideaChat.some(m => m.role === "user" && filled(m.content)),
    p.characters.some(c => any([c.name, c.goal, c.appearance, c.personality, c.backstory, c.imageAssetId, ...Object.values(c.visualProfile ?? {})])),
    any(Object.values(p.world)) || filled(p.story.setting),
    any(Object.entries(p.story).filter(([key]) => key !== "totalEpisodes" && key !== "setting").map(([, value]) => value)),
    p.episodes.some(e => any([e.title, e.synopsis, e.script, e.goal, e.obstacle, e.turningPoint, e.endingHook])),
    p.episodes.some(e => e.cuts.some(c => any([c.description, c.dialogue, c.soundEffect, c.sceneImageAssetId]) || Boolean(c.storyboard))),
  ];
  const statuses: WorkflowStatus[] = started.map((hasWork, index) => checkpoints[index] ? "초안 준비" : hasWork ? "작성 중" : "시작 전");
  statuses.push(p.isCompleted ? "완료"
    : Object.values(p.reviewChecks ?? {}).some(Boolean) || filled(p.authorNote) ? "검토 중"
    : checkpoints.slice(0, 6).every(Boolean) ? "검토 필요" : "시작 전");
  return statuses;
}
