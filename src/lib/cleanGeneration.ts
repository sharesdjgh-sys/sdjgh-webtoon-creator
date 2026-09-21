import type { StoryboardDocument, StoryboardElement } from "@/lib/storage";
import { resolveCharacterRig, sceneCharacterRig } from "@/lib/storyboardRig";

export const CLEAN_ART_VERSION = "clean-art-v1";
export const SCENE_REFERENCE_VERSION = "complete-people-safe-geometry-v3";
export const isArtworkElement = (element: StoryboardElement) =>
  element.visible !== false && ["background", "character", "prop"].includes(element.type);

/** Guides and typography are editor-only. Never send their content as drawable objects. */
export function artworkOnlyStoryboard(document: StoryboardDocument): StoryboardDocument {
  return { ...document, elements: document.elements.filter(isArtworkElement) };
}

/** Exact scene-space geometry, not a decorated editor screenshot. No typography or user guides. */
export function sceneStructureSvg(document: StoryboardDocument, transparent = false): string {
  const edges = [
    ["head", "neck"], ["neck", "leftShoulder"], ["neck", "rightShoulder"],
    ["leftShoulder", "leftElbow"], ["leftElbow", "leftHand"], ["rightShoulder", "rightElbow"], ["rightElbow", "rightHand"],
    ["leftShoulder", "leftHip"], ["rightShoulder", "rightHip"], ["leftHip", "rightHip"],
    ["leftHip", "leftKnee"], ["leftKnee", "leftFoot"], ["rightHip", "rightKnee"], ["rightKnee", "rightFoot"],
  ] as const;
  const drawings = artworkOnlyStoryboard(document).elements.slice().sort((a, b) => a.zIndex - b.zIndex).map(layer => {
    const box = `<rect width="${layer.width}" height="${layer.height}" fill="none" stroke="${layer.type === "character" ? "#2563eb" : "#a16207"}" stroke-width="2"/>`;
    let content = box;
    if (layer.type === "character") {
      const rig = sceneCharacterRig(layer);
      const point = (key: keyof typeof rig) => { const joint = rig[key]; return joint ? { x: (layer.flipX ? 1 - joint.x : joint.x) * layer.width, y: joint.y * layer.height } : undefined; };
      content += edges.map(([a, b]) => {
        const from = point(a), to = point(b);
        if (!from || !to) return "";
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#2563eb" stroke-width="5" stroke-linecap="round"/>`;
      }).join("");
      const head = point("head");
      if (head) content += `<circle cx="${head.x}" cy="${head.y}" r="${Math.max(5, Math.min(layer.width, layer.height) * .045)}" fill="#2563eb"/>`;
    }
    return `<g transform="translate(${layer.x} ${layer.y}) rotate(${layer.rotation} ${layer.width / 2} ${layer.height / 2})">${content}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">${transparent ? "" : '<rect width="100%" height="100%" fill="white"/>'}${drawings}</svg>`;
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
