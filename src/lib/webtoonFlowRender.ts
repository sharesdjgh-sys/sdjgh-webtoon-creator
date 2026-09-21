"use client";
import type { Cut } from "@/lib/storage";
import { getMediaAsset } from "@/lib/mediaStorage";
import { composeStoryboardPng } from "@/lib/storyboardComposite";
import { drawStoryboardOverlays, storyboardDimensions } from "@/lib/storyboardSvg";
import { webtoonFlowLayout, editableWebtoonDocument } from "@/lib/webtoonFlow";
import { fitImageRect } from "@/lib/panelGeometry";

async function imageFromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("세로 편집 이미지를 읽지 못했습니다.")); image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}
function png(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("세로 PNG를 만들지 못했습니다.")), "image/png"));
}

export async function renderWebtoonBlock(cut: Pick<Cut, "storyboard" | "sceneImageAssetId"> & Partial<Pick<Cut, "aspectRatio">>, options: { finishedOnly?: boolean; preview?: boolean } = {}) {
  if (options.finishedOnly && !cut.sceneImageAssetId) throw new Error("완성 그림이 없습니다.");
  if (!cut.storyboard && !cut.sceneImageAssetId) throw new Error("장면 스케치를 먼저 만들어주세요.");
  const storyboard = editableWebtoonDocument(cut.storyboard ?? {
    version: 2, aspectRatio: cut.aspectRatio ?? "3:4", ...storyboardDimensions(cut.aspectRatio ?? "3:4"), elements: [],
  });
  const layout = webtoonFlowLayout(storyboard);
  if (layout.overflow && !options.preview) throw new Error(layout.overflow);
  let artwork: Blob;
  if (cut.sceneImageAssetId) {
    const asset = await getMediaAsset(cut.sceneImageAssetId);
    if (!asset) throw new Error("완성 그림 파일이 없습니다.");
    artwork = asset.blob;
  } else {
    artwork = await composeStoryboardPng(storyboard, { includeOverlays: false, strictAssets: !storyboard.sceneSketchAssetId });
  }
  const canvas = document.createElement("canvas");
  canvas.width = layout.document.width; canvas.height = layout.document.height;
  if (canvas.height > 16000) throw new Error("이 구간의 대사·여백이 너무 깁니다. 장면을 나눠주세요.");
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("캔버스를 만들지 못했습니다.");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const image = await imageFromBlob(artwork);
  const fit = fitImageRect(image.naturalWidth, image.naturalHeight, layout.art.width, layout.art.height);
  ctx.drawImage(image, layout.art.x + fit.x, layout.art.y + fit.y, fit.width, fit.height);
  await drawStoryboardOverlays(ctx, layout.document);
  return { blob: await png(canvas), width: canvas.width, height: canvas.height, warning: layout.overflow };
}

export function legacyGap(cut: Cut) {
  // Every block now includes its own normalized top/bottom spacing, including old documents.
  void cut;
  return 0;
}

/** Export the same reading strip as bounded PNG segments, without allocating a huge canvas. */
export async function exportWebtoonStrip(cuts: Cut[], width = 900, pageHeight = 4096, options: { finishedOnly?: boolean } = {}) {
  if (!Number.isInteger(width) || width < 1 || width > 4000 || !Number.isInteger(pageHeight) || pageHeight < 1 || pageHeight > 16000) {
    throw new Error("원고 출력 크기가 올바르지 않습니다.");
  }
  const pages: Blob[] = [];
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = pageHeight;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("캔버스를 만들지 못했습니다.");
  let filled = 0;
  const clear = () => { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, pageHeight); };
  const flush = async () => { pages.push(await png(canvas)); filled = 0; clear(); };
  clear();
  for (let index = 0; index < cuts.length; index++) {
    const block = await renderWebtoonBlock(cuts[index], options);
    const image = await imageFromBlob(block.blob);
    const scale = width / block.width, total = Math.round(block.height * scale);
    let consumed = 0;
    while (consumed < total) {
      const amount = Math.min(pageHeight - filled, total - consumed);
      ctx.drawImage(image, 0, consumed / scale, block.width, amount / scale, 0, filled, width, amount);
      consumed += amount; filled += amount;
      if (filled === pageHeight) await flush();
    }
    let gap = index < cuts.length - 1 ? legacyGap(cuts[index]) * width / 900 : 0;
    while (gap > 0) {
      const amount = Math.min(pageHeight - filled, gap); gap -= amount; filled += amount;
      if (filled === pageHeight) await flush();
    }
  }
  if (filled) {
    const last = document.createElement("canvas"); last.width = width; last.height = Math.ceil(filled);
    last.getContext("2d")!.drawImage(canvas, 0, 0); pages.push(await png(last));
  }
  return pages;
}
