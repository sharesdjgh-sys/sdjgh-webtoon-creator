import type { Project, Episode, Character } from "@/lib/storage";
import { buildProjectContext } from "@/lib/projectContext";
export function autofillPayload(project: Project, step: string, episode?: Episode, character?: Character) {
  const messages = project.ideaChat?.length ? project.ideaChat.slice(-60) : [{ role: "user", content: project.brief?.idea || project.story.logline || "저장된 작품 설정을 바탕으로 초안을 제안해 주세요." }];
  return {
    ideaChat: messages.map(message => ({ ...message, content: message.content.slice(0, 8000) })), step, context: buildProjectContext(project),
    authorNote: project.authorNote?.slice(0, 5000),
    character: character ? {
      name: character.name.slice(0, 100), role: character.role.slice(0, 100), age: character.age.slice(0, 50),
      appearance: character.appearance.slice(0, 1500), personality: character.personality.slice(0, 1000), backstory: character.backstory.slice(0, 1500),
      goal: character.goal?.slice(0, 3000) ?? "", fear: character.fear?.slice(0, 3000) ?? "", weakness: character.weakness?.slice(0, 3000) ?? "",
      growth: character.growth?.slice(0, 3000) ?? "", speechStyle: character.speechStyle?.slice(0, 3000) ?? "", relationships: character.relationships?.slice(0, 3000) ?? "",
      imageInstructions: character.imageInstructions?.slice(0, 3000) ?? "",
      visualProfile: Object.fromEntries(Object.entries(character.visualProfile).map(([key, value]) => [key, value.slice(0, 500)])),
    } : undefined,
    episode: episode ? { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis, goal: episode.goal ?? "", obstacle: episode.obstacle ?? "", turningPoint: episode.turningPoint ?? "", endingHook: episode.endingHook ?? "", script: episode.script.slice(0, 20000) } : undefined,
  };
}
