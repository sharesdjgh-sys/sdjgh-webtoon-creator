import type { StoryboardDocument, StoryboardElement } from "@/lib/storage";
import { resolveCharacterRig } from "@/lib/storyboardRig";

export const CLEAN_ART_VERSION = "clean-art-v1";
export const isArtworkElement = (element: StoryboardElement) =>
  element.visible !== false && ["background", "character", "prop"].includes(element.type);

/** Guides and typography are editor-only. Never send their content as drawable objects. */
export function artworkOnlyStoryboard(document: StoryboardDocument): StoryboardDocument {
  return { ...document, elements: document.elements.filter(isArtworkElement) };
}

/** A separate reference, not a screenshot/export of the user's editor. */
export function layerReferenceSvg(document: StoryboardDocument, layerId: string): string {
  const layer = document.elements.find(element => element.id === layerId && isArtworkElement(element));
  if (!layer) throw new Error("생성 가능한 그림 레이어가 아닙니다.");
  const width = layer.type === "background" ? document.width : layer.width;
  const height = layer.type === "background" ? document.height : layer.height;
  let drawing = "";
  if (layer.type === "character") {
    const rig = resolveCharacterRig(layer);
    const edges = [
      ["head", "neck"], ["neck", "leftShoulder"], ["neck", "rightShoulder"],
      ["leftShoulder", "leftElbow"], ["leftElbow", "leftHand"],
      ["rightShoulder", "rightElbow"], ["rightElbow", "rightHand"],
      ["leftShoulder", "leftHip"], ["rightShoulder", "rightHip"], ["leftHip", "rightHip"],
      ["leftHip", "leftKnee"], ["leftKnee", "leftFoot"], ["rightHip", "rightKnee"], ["rightKnee", "rightFoot"],
    ] as const;
    const point = (key: keyof typeof rig) => ({
      x: (0.06 + Math.min(1, Math.max(0, rig[key].x)) * 0.88) * width,
      y: (0.06 + Math.min(1, Math.max(0, rig[key].y)) * 0.88) * height,
    });
    drawing = edges.map(([a, b]) => {
      const from = point(a), to = point(b);
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#777" stroke-width="${Math.max(2, Math.min(width, height) * 0.025)}" stroke-linecap="round"/>`;
    }).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${drawing}</svg>`;
}
