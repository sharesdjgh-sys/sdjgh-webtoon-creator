import type { Character, Cut, Episode, Project, StoryboardDocument } from "@/lib/storage";
import { base64ToBlob, blobToBase64, getMediaAsset, sourceHash } from "@/lib/mediaStorage";
import { svgToPngBlob } from "@/lib/storyboardSvg";
import { composeStoryboardPng } from "@/lib/storyboardComposite";

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

async function characterReferences(project: Project, cut: Cut) {
  const selected = project.characters.filter((character) => cut.characterIds.includes(character.id)).slice(0, 4);
  return (await Promise.all(selected.map(async (character) => {
    const asset = await getMediaAsset(character.imageAssetId);
    if (!asset) return null;
    return {
      character: characterData(character),
      data: await blobToBase64(asset.blob),
      mimeType: asset.mimeType,
    };
  }))).filter((reference): reference is NonNullable<typeof reference> => reference !== null);
}

export function storyboardLayerHash(project: Project, episode: Episode, cut: Cut, layerId: string): string {
  const layer = cut.storyboard?.elements.find((element) => element.id === layerId);
  const character = layer?.characterId ? project.characters.find((item) => item.id === layer.characterId) : undefined;
  return sourceHash({
    renderer: "gemini-storyboard-layer-v1",
    context: context(project),
    episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis },
    cut: { angle: cut.angle, description: cut.description, soundEffect: cut.soundEffect, aspectRatio: cut.aspectRatio },
    layer: layer ? {
      type: layer.type,
      text: layer.text,
      characterId: layer.characterId,
      pose: layer.pose,
      expression: layer.expression,
      characterRig: layer.characterRig,
    } : null,
    characterReference: character ? { imageAssetId: character.imageAssetId, imageSourceHash: character.imageSourceHash } : null,
  });
}

export async function requestStoryboardLayer(project: Project, episode: Episode, cut: Cut, layerId: string): Promise<{ blob: Blob; prompt: string; sourceHash: string }> {
  if (!cut.storyboard) throw new Error("먼저 콘티 구성을 만들어주세요.");
  const layer = cut.storyboard.elements.find((element) => element.id === layerId);
  if (!layer) throw new Error("생성할 콘티 레이어를 찾지 못했습니다.");
  if (layer.type === "character") {
    const character = project.characters.find((item) => item.id === layer.characterId);
    if (!character?.imageAssetId) throw new Error(`${character?.name || layer.text || "선택한 인물"}의 캐릭터 시트를 먼저 생성해주세요.`);
  }
  const layoutBlob = await svgToPngBlob(cut.storyboard);
  const references = await characterReferences(project, cut);
  const response = await postVisual<GeneratedImageResponse>({
    action: "storyboard-layer",
    context: context(project),
    episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis },
    cut: cutData(cut),
    storyboard: cut.storyboard,
    layerId,
    layoutImage: { data: await blobToBase64(layoutBlob), mimeType: "image/png" },
    references: layer.type === "character" ? references.filter(({ character }) => character.id === layer.characterId) : [],
  });
  return {
    blob: base64ToBlob(response.data, response.mimeType),
    prompt: response.prompt,
    sourceHash: storyboardLayerHash(project, episode, cut, layerId),
  };
}

export function sceneHash(project: Project, episode: Episode, cut: Cut): string {
  const references = project.characters
    .filter((character) => cut.characterIds.includes(character.id))
    .map((character) => ({ id: character.id, imageAssetId: character.imageAssetId, imageSourceHash: character.imageSourceHash }));
  return sourceHash({ context: context(project), episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis }, cut: cutData(cut), storyboard: cut.storyboard, storyboardImageAssetId: cut.storyboardImageAssetId, storyboardImageSourceHash: cut.storyboardImageSourceHash, references });
}

export async function requestSceneImage(project: Project, episode: Episode, cut: Cut): Promise<{ blob: Blob; prompt: string; sourceHash: string }> {
  if (!cut.storyboard) throw new Error("먼저 편집 가능한 콘티를 만들어주세요.");
  const layoutBlob = await composeStoryboardPng(cut.storyboard, { includeOverlays: false });
  const layoutMimeType = "image/png";
  const references = await characterReferences(project, cut);
  const response = await postVisual<GeneratedImageResponse>({
    action: "scene-image",
    context: context(project),
    episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis },
    cut: cutData(cut),
    storyboard: cut.storyboard,
    layoutImage: { data: await blobToBase64(layoutBlob), mimeType: layoutMimeType },
    references,
  });
  return {
    blob: base64ToBlob(response.data, response.mimeType),
    prompt: response.prompt,
    sourceHash: sceneHash(project, episode, cut),
  };
}
