import { artworkOnlyStoryboard, layerReferenceSvg, sceneStructureSvg, CLEAN_ART_VERSION, SCENE_REFERENCE_VERSION } from "@/lib/cleanGeneration";
import { validatePanelImage } from "@/lib/panelGeometry";
import type { Character, CharacterRig, Cut, Episode, Project, StoryboardDocument } from "@/lib/storage";
import { base64ToBlob, blobToBase64, cropImageBlob, getMediaAsset, sourceHash } from "@/lib/mediaStorage";
import { svgToPngBlob, webtoonFontStack, defaultWebtoonFont } from "@/lib/storyboardSvg";
import { sizeBalloonForFont } from "@/lib/storyboardText";
import { editableWebtoonDocument, webtoonFlowLayout } from "@/lib/webtoonFlow";
import { composeStoryboardPng } from "@/lib/storyboardComposite";

type GeneratedImageResponse = { data: string; mimeType: string; prompt: string; characterRig?: CharacterRig };
export type CharacterSheetProgressStage = "generating" | "receiving";

function context(project: Project) {
  return {
    title: project.title,
    genre: project.genre,
    setting: [project.story.setting, ...Object.entries(project.world ?? {}).filter(([key]) => !["undecided", "foreshadowing"].includes(key)).map(([key, value]) => `${key}: ${value}`)].join("\n").slice(0, 2000),
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
    description: [cut.description, cut.purpose && `목적: ${cut.purpose}`, cut.emotion && `감정: ${cut.emotion}`, cut.continuityNotes && `연속성: ${cut.continuityNotes}`].filter(Boolean).join("\n").slice(0, 2000),
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
  return sourceHash({ renderer: "gemini-character-sheet-v1-3x2", context: context(project), character: characterData(character) });
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
    cut: { ...cutData(cut), scrollGap: cut.scrollGap },
    characters: selected.map(characterData),
  });
  const storyboard = editableWebtoonDocument(response.storyboard);
  const canvas = webtoonFlowLayout(storyboard).document;
  return { ...storyboard, elements: storyboard.elements.map(element =>
    sizeBalloonForFont(element, canvas.width, canvas.height, webtoonFontStack(element.fontFamily ?? defaultWebtoonFont(element.type)))) };
}

export async function requestCharacterRig(assetId: string): Promise<CharacterRig> {
  const asset = await getMediaAsset(assetId);
  if (!asset) throw new Error("포즈를 분석할 캐릭터 그림을 찾지 못했습니다.");
  const response = await postVisual<{ characterRig: CharacterRig }>({
    action: "detect-character-rig",
    image: { data: await blobToBase64(asset.blob), mimeType: asset.mimeType },
  });
  return response.characterRig;
}

async function characterReferences(project: Project, cut: Cut) {
  const selected = project.characters.filter((character) => cut.characterIds.includes(character.id)).slice(0, 4);
  return (await Promise.all(selected.map(async (character) => {
    const asset = await getMediaAsset(character.imageAssetId);
    if (!asset) return null;
    const heroReference = await cropImageBlob(asset.blob, { x: 0.025, y: 0.035, width: 0.31, height: 0.93 });
    return {
      character: characterData(character),
      data: await blobToBase64(asset.blob),
      mimeType: asset.mimeType,
      heroData: await blobToBase64(heroReference),
      heroMimeType: heroReference.type || "image/jpeg",
    };
  }))).filter((reference): reference is NonNullable<typeof reference> => reference !== null);
}

export function storyboardLayerHash(project: Project, episode: Episode, cut: Cut, layerId: string): string {
  const layer = cut.storyboard?.elements.find((element) => element.id === layerId);
  const character = layer?.characterId ? project.characters.find((item) => item.id === layer.characterId) : undefined;
  return sourceHash({
    renderer: CLEAN_ART_VERSION,
    context: context(project),
    episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis },
    cut: { angle: cut.angle, description: cut.description, aspectRatio: cut.aspectRatio },
    layer: layer ? {
      type: layer.type,
      width: layer.width,
      height: layer.height,
      text: layer.text,
      characterId: layer.characterId,
      pose: layer.pose,
      poseReferenceAssetId: layer.poseReferenceAssetId,
      expression: layer.expression,
      characterRig: layer.characterRig,
    } : null,
    characterReference: character ? { imageAssetId: character.imageAssetId, imageSourceHash: character.imageSourceHash } : null,
  });
}

export async function requestStoryboardLayer(project: Project, episode: Episode, cut: Cut, layerId: string): Promise<{ blob: Blob; prompt: string; sourceHash: string; characterRig?: CharacterRig }> {
  if (!cut.storyboard) throw new Error("먼저 콘티 구성을 만들어주세요.");
  const layer = cut.storyboard.elements.find((element) => element.id === layerId);
  if (!layer) throw new Error("생성할 콘티 레이어를 찾지 못했습니다.");
  if (layer.type === "character") {
    const character = project.characters.find((item) => item.id === layer.characterId);
    if (!character?.imageAssetId) throw new Error(`${character?.name || layer.text || "선택한 인물"}의 캐릭터 시트를 먼저 생성해주세요.`);
  }
  const referenceDocument = { ...cut.storyboard, width: layer.type === "background" ? cut.storyboard.width : layer.width, height: layer.type === "background" ? cut.storyboard.height : layer.height };
  const layoutBlob = await svgToPngBlob(referenceDocument, layerReferenceSvg(cut.storyboard, layerId));
  const references = await characterReferences(project, cut);
  const poseReference = layer.type === "character" ? await getMediaAsset(layer.poseReferenceAssetId) : null;
  const response = await postVisual<GeneratedImageResponse>({
    action: "storyboard-layer",
    context: context(project),
    episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis },
    cut: cutData(cut),
    storyboard: artworkOnlyStoryboard(cut.storyboard),
    layerId,
    layoutImage: { data: await blobToBase64(layoutBlob), mimeType: "image/png" },
    references: layer.type === "character" ? references.filter(({ character }) => character.id === layer.characterId) : [],
    poseReference: poseReference ? { data: await blobToBase64(poseReference.blob), mimeType: poseReference.mimeType } : undefined,
  });
  const generatedBlob = base64ToBlob(response.data, response.mimeType);
  const ratio = layer.width / layer.height;
  const expectedRatio = layer.type === "background" ? cut.aspectRatio : ratio < 0.68 ? "9:16" : ratio < 0.9 ? "3:4" : ratio > 1.18 ? "4:3" : "1:1";
  await validatePanelImage(generatedBlob, expectedRatio);
  const renderedCut = response.characterRig ? {
    ...cut,
    storyboard: {
      ...cut.storyboard,
      elements: cut.storyboard.elements.map((element) => element.id === layerId
        ? { ...element, characterRig: response.characterRig }
        : element),
    },
  } : cut;
  return {
    blob: base64ToBlob(response.data, response.mimeType),
    prompt: response.prompt,
    sourceHash: storyboardLayerHash(project, episode, renderedCut, layerId),
    characterRig: response.characterRig,
  };
}

export function sceneHash(project: Project, episode: Episode, cut: Cut): string {
  const references = project.characters
    .filter((character) => cut.characterIds.includes(character.id))
    .map((character) => ({ id: character.id, imageAssetId: character.imageAssetId, imageSourceHash: character.imageSourceHash }));
  return sourceHash({ renderer: SCENE_REFERENCE_VERSION, context: context(project), episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis }, cut: { ...cutData(cut), dialogue: "", soundEffect: "" }, storyboard: cut.storyboard ? artworkOnlyStoryboard(cut.storyboard) : undefined, references });
}

export async function requestSceneImage(project: Project, episode: Episode, cut: Cut, referenceMode: "layers" | "direct" = "layers", stage: "sketch" | "finish" = "finish"): Promise<{ blob: Blob; prompt: string; sourceHash: string }> {
  if (!cut.storyboard) throw new Error("먼저 편집 가능한 콘티를 만들어주세요.");
  const incomplete = cut.storyboard.elements.filter(layer => ["background", "character", "prop"].includes(layer.type) && layer.visible !== false && (!layer.assetId || layer.assetSourceHash !== storyboardLayerHash(project, episode, cut, layer.id)));
  if (stage !== "sketch" && !cut.storyboard.sceneSketchAssetId && referenceMode === "layers" && incomplete.length) throw new Error("기존 그림은 보존됩니다. 말풍선·가이드가 섞일 수 있는 이전 레이어를 먼저 다시 생성해주세요.");
  const artwork = artworkOnlyStoryboard(cut.storyboard);
  if (!artwork.elements.length) throw new Error("장면에 표시할 배경·인물·소품을 먼저 추가해주세요.");
  const missingPeople: string[] = [];
  for (const layer of artwork.elements.filter(element => stage !== "sketch" && !artwork.sceneSketchAssetId && element.type === "character")) {
    if (!layer.assetId || !await getMediaAsset(layer.assetId)) missingPeople.push(layer.text || "인물");
  }
  if (missingPeople.length) throw new Error(`인물 스케치가 없습니다: ${missingPeople.join(", ")}. 누락 인물 스케치를 먼저 생성하고 콘티를 확인해주세요. 완성 그림 생성은 시작하지 않았습니다.`);
  // Keep the COMPLETE current layout, even when a layer's prompt/pose has changed.
  // Editable typography is excluded; missing raster assets get geometry, never silent omission.
  const layoutBlob = await composeStoryboardPng(artwork, { includeOverlays: false, strictAssets: stage !== "sketch" && referenceMode === "layers", missingArtwork: referenceMode === "direct" ? "geometry" : undefined });
  const structureBlob = await svgToPngBlob(artwork, sceneStructureSvg(artwork));
  const layoutMimeType = "image/png";
  const references = await characterReferences(project, cut);
  const response = await postVisual<GeneratedImageResponse>({
    action: "scene-image",
    stage,
    referenceMode,
    context: context(project),
    episode: { number: episode.episodeNumber, title: episode.title, synopsis: episode.synopsis },
    cut: cutData(cut),
    storyboard: artwork,
    layoutImage: { data: await blobToBase64(layoutBlob), mimeType: layoutMimeType },
    structureImage: { data: await blobToBase64(structureBlob), mimeType: "image/png" },
    references,
  });
  const blob = base64ToBlob(response.data, response.mimeType);
  await validatePanelImage(blob, cut.aspectRatio);
  return {
    blob,
    prompt: response.prompt,
    sourceHash: sceneHash(project, episode, cut),
  };
}
