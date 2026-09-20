import type { Project, Episode } from "@/lib/storage";
import { buildProjectContext } from "@/lib/projectContext";
export function autofillPayload(project: Project, step: string, episode?: Episode) {
  const messages = project.ideaChat?.length ? project.ideaChat.slice(-60) : [{ role: "user", content: project.brief?.idea || project.story.logline || "저장된 작품 설정을 바탕으로 초안을 제안해 주세요." }];
  return {
    ideaChat: messages, step, context: buildProjectContext(project),
    episode: episode ? { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis, goal: episode.goal ?? "", obstacle: episode.obstacle ?? "", turningPoint: episode.turningPoint ?? "", endingHook: episode.endingHook ?? "", script: episode.script.slice(0, 20000) } : undefined,
  };
}
