import type { Project } from "@/lib/storage";

/** Excludes author identity, chat history and image data. */
export function buildProjectContext(project: Project): string {
  const short = (value: string | undefined, limit = 700) => (value ?? "").slice(0, limit);
  const summary = {
    title: short(project.title), genre: short(project.genre),
    brief: Object.fromEntries(Object.entries(project.brief ?? {}).map(([k, v]) => [k, short(v, 1500)])),
    world: Object.fromEntries(Object.entries(project.world ?? {}).map(([k, v]) => [k, short(v, 2000)])),
    story: Object.fromEntries(Object.entries(project.story).map(([key, value]) => [key, short(value, 2500)])),
    artDirection: { preset: project.artDirection.preset, custom: short(project.artDirection.custom) },
    characters: project.characters.slice(0, 20).map(c => ({
      name: short(c.name, 100), role: short(c.role, 100), personality: short(c.personality),
      appearance: short(c.appearance), backstory: short(c.backstory),
      goal: short(c.goal), fear: short(c.fear), weakness: short(c.weakness), growth: short(c.growth), speechStyle: short(c.speechStyle), relationships: short(c.relationships),
      visualProfile: Object.fromEntries(Object.entries(c.visualProfile).map(([key, value]) => [key, short(value, 150)])),
    })),
    episodes: project.episodes.slice(0, 50).map(e => ({
      goal: short(e.goal), obstacle: short(e.obstacle), turningPoint: short(e.turningPoint), endingHook: short(e.endingHook),
      number: e.episodeNumber, title: short(e.title, 100), synopsis: short(e.synopsis), script: short(e.script, 1500),
      cuts: e.cuts.slice(0, 100).map((c, i) => ({ number: i + 1, purpose: short(c.purpose, 150), emotion: short(c.emotion, 100), continuity: short(c.continuityNotes, 200), scrollGap: c.scrollGap, description: short(c.description, 250), dialogue: short(c.dialogue, 150) })),
    })),
  };
  const json = JSON.stringify(summary);
  return json.length <= 48000 ? json : json.slice(0, 47900) + "\n[분량 제한으로 일부 자료 생략. 보이지 않는 내용은 학생에게 확인]";
}
