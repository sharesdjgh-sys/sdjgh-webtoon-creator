import type { Character, Cut, Episode, Project, StoryboardDocument } from "@/lib/storage";
import { base64ToBlob, blobToBase64, getMediaAsset, sourceHash } from "@/lib/mediaStorage";
import { svgToPngBlob } from "@/lib/storyboardSvg";

type GeneratedImageResponse = { data: string; mimeType: string; prompt: string };
export type CharacterSheetProgressStage = "generating" | "receiving";

function context(project: Project) {
  return {
    title: project.title,
    genre: project.genre,
    setting: project.story.setting,
    artDirection: project.artDirection,
  };
}

function characterData(character: Character) {
  return {
    id: character.id,
    name: character.name,
    role: character.role,
    age: character.age,
    appearance: character.appearance,
    personality: character.personality,
    backstory: character.backstory,
    visualProfile: character.visualProfile,
    imageInstructions: character.imageInstructions ?? "",
  };
}

function cutData(cut: Cut) {
  return {
    angle: cut.angle,
    description: cut.description,
    dialogue: cut.dialogue,
    soundEffect: cut.soundEffect,
    aspectRatio: cut.aspectRatio,
  };
}

async function postVisual<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/ai/visual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "시각 자료 생성에 실패했습니다.");
  return data as T;
}

export function characterSheetHash(project: Project, character: Character): string {
  return sourceHash({ renderer: "openai-character-sheet-v3-3x2-safe-frame", context: context(project), character: characterData(character) });
}

export async function requestCharacterSheet(
  project: Project,
  character: Character,
  onProgress?: (stage: CharacterSheetProgressStage) => void,
): Promise<{ blob: Blob; prompt: string; sourceHash: string }> {
  onProgress?.("generating");
  const response = await postVisual<GeneratedImageResponse>({
    action: "character-sheet",
    context: context(project),
    character: characterData(character),
  });
  onProgress?.("receiving");
  return {
    blob: base64ToBlob(response.data, response.mimeType),
    prompt: response.prompt,
    sourceHash: characterSheetHash(project, character),
  };
}

export async function requestStoryboardLayout(project: Project, episode: Episode, cut: Cut): Promise<StoryboardDocument> {
  const selected = project.characters.filter((character) => cut.characterIds.includes(character.id)).slice(0, 4);
  const response = await postVisual<{ storyboard: StoryboardDocument }>({
    action: "storyboard-layout",
    context: context(project),
    episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis },
    cut: cutData(cut),
    characters: selected.map(characterData),
  });
  return response.storyboard;
}

export function sceneHash(project: Project, episode: Episode, cut: Cut): string {
  const references = project.characters
    .filter((character) => cut.characterIds.includes(character.id))
    .map((character) => ({ id: character.id, imageAssetId: character.imageAssetId, imageSourceHash: character.imageSourceHash }));
  return sourceHash({ context: context(project), episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis }, cut: cutData(cut), storyboard: cut.storyboard, references });
}

export async function requestSceneImage(project: Project, episode: Episode, cut: Cut): Promise<{ blob: Blob; prompt: string; sourceHash: string }> {
  if (!cut.storyboard) throw new Error("먼저 편집 가능한 콘티를 만들어주세요.");
  const layoutBlob = await svgToPngBlob(cut.storyboard);
  const selected = project.characters.filter((character) => cut.characterIds.includes(character.id)).slice(0, 4);
  const references = (await Promise.all(selected.map(async (character) => {
    const asset = await getMediaAsset(character.imageAssetId);
    if (!asset) return null;
    return {
      character: characterData(character),
      data: await blobToBase64(asset.blob),
      mimeType: asset.mimeType,
    };
  }))).filter((reference): reference is NonNullable<typeof reference> => reference !== null);
  const response = await postVisual<GeneratedImageResponse>({
    action: "scene-image",
    context: context(project),
    episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis },
    cut: cutData(cut),
    layoutImage: { data: await blobToBase64(layoutBlob), mimeType: "image/png" },
    references,
  });
  return {
    blob: base64ToBlob(response.data, response.mimeType),
    prompt: response.prompt,
    sourceHash: sceneHash(project, episode, cut),
  };
}
