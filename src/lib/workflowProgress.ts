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
