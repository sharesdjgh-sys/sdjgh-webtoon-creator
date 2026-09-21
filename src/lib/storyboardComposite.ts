"use client";

import { fitImageRect } from "@/lib/panelGeometry";
import type { StoryboardDocument } from "@/lib/storage";
import { getMediaAsset } from "@/lib/mediaStorage";
import { isOverlayElement, drawStoryboardOverlays } from "@/lib/storyboardSvg";
import { sceneStructureSvg } from "@/lib/cleanGeneration";

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("콘티 레이어 이미지를 불러오지 못했습니다."));
    image.src = source;
  });
}

async function drawBlob(
  context: CanvasRenderingContext2D,
  blob: Blob,
  transform: { x: number; y: number; width: number; height: number; rotation: number; opacity?: number; flipX?: boolean; type?: string },
): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    context.save();
    context.globalAlpha = transform.opacity ?? 1;
    context.translate(transform.x + transform.width / 2, transform.y + transform.height / 2);
    context.rotate(transform.rotation * Math.PI / 180);
    context.scale(transform.flipX ? -1 : 1, 1);
    const rect = fitImageRect(image.naturalWidth, image.naturalHeight, transform.width, transform.height, transform.type === "background" ? "cover" : "contain");
    context.beginPath();
    context.rect(-transform.width / 2, -transform.height / 2, transform.width, transform.height);
    context.clip();
    context.drawImage(image, rect.x - transform.width / 2, rect.y - transform.height / 2, rect.width, rect.height);
    context.restore();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function composeStoryboardPng(
  storyboard: StoryboardDocument,
  options: { includeOverlays?: boolean; background?: string; strictAssets?: boolean; missingArtwork?: "geometry" } = {},
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = storyboard.width;
  canvas.height = storyboard.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("콘티 합성 캔버스를 만들 수 없습니다.");
  context.fillStyle = options.background ?? "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (storyboard.sceneSketchAssetId) {
    const scene = await getMediaAsset(storyboard.sceneSketchAssetId);
    if (!scene) throw new Error("장면 스케치 파일이 없습니다. 장면 스케치를 다시 생성해주세요.");
    await drawBlob(context, scene.blob, { x: 0, y: 0, width: storyboard.width, height: storyboard.height, rotation: 0 });
  }

  const imageLayers = storyboard.elements
    .filter((element) => !storyboard.sceneSketchAssetId && element.visible !== false && ["background", "character", "prop"].includes(element.type))
    .sort((left, right) => left.zIndex - right.zIndex);
  for (const layer of imageLayers) {
    const asset = layer.assetId ? await getMediaAsset(layer.assetId) : undefined;
    if (!asset && options.missingArtwork === "geometry") {
      const svg = sceneStructureSvg({ ...storyboard, elements: [layer] }, true);
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      try { context.drawImage(await loadImage(url), 0, 0, storyboard.width, storyboard.height); }
      finally { URL.revokeObjectURL(url); }
      continue;
    }
    if (!asset && options.strictAssets) throw new Error("콘티 그림 파일이 누락되었습니다. 해당 레이어를 다시 생성해주세요.");
    if (asset) await drawBlob(context, asset.blob, layer);
  }

  if (options.includeOverlays !== false) await drawStoryboardOverlays(context, storyboard);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("콘티 합성에 실패했습니다.")), "image/png"));
}

export function hasGeneratedStoryboardLayers(storyboard?: StoryboardDocument): boolean {
  if (!storyboard) return false;
  if (storyboard.sceneSketchAssetId) return true;
  return storyboard.elements.some((element) => element.visible !== false && ["background", "character", "prop"].includes(element.type) && Boolean(element.assetId));
}

export function editableOverlayCount(storyboard?: StoryboardDocument): number {
  return storyboard?.elements.filter((element) => element.visible !== false && isOverlayElement(element)).length ?? 0;
}
