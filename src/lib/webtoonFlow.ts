import type { StoryboardDocument, StoryboardElement } from "./storage";
import { overlayOutsideCanvas } from "@/lib/storyboardText";

const overlay = (e: StoryboardElement) => ["speech", "caption", "sfx"].includes(e.type);
const clamp = (v: number | undefined, fallback: number, max: number) => Number.isFinite(v) ? Math.max(0, Math.min(max, v!)) : fallback;
export const DEFAULT_WEBTOON_GAP = 150;
export const MAX_WEBTOON_GAP = 6000;
export function normalizeWebtoonFlow(flow?: StoryboardDocument["flow"]) {
  return { ...flow, before: clamp(flow?.before, DEFAULT_WEBTOON_GAP, MAX_WEBTOON_GAP),
    after: clamp(flow?.after, DEFAULT_WEBTOON_GAP, MAX_WEBTOON_GAP), inset: flow?.inset ?? 0 };
}
export const readingOrder = (a: StoryboardElement, b: StoryboardElement) => (a.flowOrder ?? a.y) - (b.flowOrder ?? b.y) || a.x - b.x;

/** Art and lettering share a reading canvas, not a mandatory enclosing panel. */
export function webtoonFlowLayout(source: StoryboardDocument) {
  const width = source.width;
  const flow = normalizeWebtoonFlow(source.flow);
  const inset = clamp(source.flow?.inset, 0, width * .35);
  const scale = (width - inset * 2) / width;
  const left = source.flow?.align === "left" ? 0 : source.flow?.align === "right" ? inset * 2 : inset;
  const items = source.elements.filter(e => e.visible !== false && overlay(e));
  const before = items.filter(e => e.placement === "before" || e.placement === "top-edge").sort(readingOrder);
  const after = items.filter(e => e.placement === "after" || e.placement === "bottom-edge").sort(readingOrder);
  const spacing = (e: StoryboardElement, i: number) => (i ? 40 : 0) + clamp(e.flowSpacing, 0, 1200);
  const stack = (list: StoryboardElement[]) => list.reduce((sum, e, i) => sum + e.height + spacing(e, i), 0);
  const topOverlap = before.at(-1)?.placement === "top-edge" ? before.at(-1)!.height * .25 : 0;
  const bottomOverlap = after[0]?.placement === "bottom-edge" ? after[0].height * .25 : 0;
  const requiredTop = before.length ? 24 + stack(before) - topOverlap : 0;
  const requiredBottom = after.length ? 24 + stack(after) - bottomOverlap : 0;
  const top = Math.min(MAX_WEBTOON_GAP, Math.max(flow.before, requiredTop));
  const bottom = Math.min(MAX_WEBTOON_GAP, Math.max(flow.after, requiredBottom));
  let overflow = requiredTop > MAX_WEBTOON_GAP || requiredBottom > MAX_WEBTOON_GAP
    ? "여백의 대사·독백이 한 구간의 최대 여백 안에 들어가지 않습니다. 대사를 여러 컷으로 나누어주세요." : undefined;
  const art = { x: left, y: top, width: width * scale, height: source.height * scale };
  const canvasHeight = Math.ceil(top + art.height + bottom);
  const elements: StoryboardElement[] = items.filter(e => !e.placement || e.placement === "art").map(e => ({
    ...e, x: left + e.x * scale, y: top + e.y * scale, width: e.width * scale, height: e.height * scale,
    fontSize: e.fontSize === undefined ? undefined : e.fontSize * scale,
  }));
  elements.push(...items.filter(e => e.placement === "canvas"));
  for (const [list, origin] of [[before, top - stack(before) + topOverlap], [after, top + art.height - bottomOverlap + (bottomOverlap ? 0 : 24)]] as const) {
    let y = origin;
    list.forEach((element, i) => {
      y += spacing(element, i);
      elements.push({ ...element, x: Math.max(16, Math.min(width - element.width - 16, element.x)), y,
        rotation: 0, tailX: element.tailX ?? .5, tailY: list === before ? 1.15 : -.15, fontSize: element.fontSize });
      y += element.height;
    });
  }
  const outside = !overflow ? elements.find(e => overlayOutsideCanvas(e, width, canvasHeight)) : undefined;
  if (outside) {
    const label = outside.text.trim().replace(/\s+/g, " ").slice(0, 24) || (outside.type === "speech" ? "빈 말풍선" : "빈 글자 요소");
    overflow = `“${label}${outside.text.trim().length > 24 ? "…" : ""}”의 회전된 외곽 또는 말풍선 꼬리가 이 컷의 그림과 여백 영역을 벗어났습니다. 해당 요소의 꼬리 끝과 회전된 모서리를 확인해주세요.`;
  }
  // Resolved coordinates must never be fitted again by SVG/PNG renderers.
  return { art, overflow, document: { ...source, flow, width, height: canvasHeight,
    elements: elements.map(e => ({ ...e, placement: "canvas" as const })) } };
}

/** Keep artwork in its original AI coordinates; lettering is freely editable on the reading canvas. */
export function editableWebtoonDocument(source: StoryboardDocument): StoryboardDocument {
  const layout = webtoonFlowLayout(source);
  const byId = new Map(layout.document.elements.map(e => [e.id, e]));
  const scale = layout.art.width / source.width;
  const flow = { ...normalizeWebtoonFlow(source.flow), before: layout.art.y,
    after: layout.document.height - layout.art.y - layout.art.height };
  return { ...source, flow, elements: source.elements.map(e => {
    if (!overlay(e)) return e;
    const rendered = byId.get(e.id) ?? (e.placement === "canvas" ? e : {
      ...e, x: layout.art.x + e.x * layout.art.width / source.width,
      y: layout.art.y + e.y * layout.art.width / source.width,
      width: e.width * scale, height: e.height * scale,
      fontSize: e.fontSize === undefined ? undefined : e.fontSize * scale,
    });
    return { ...rendered, placement: "canvas" };
  }) };
}

export function editorSceneElements(source: StoryboardDocument) {
  const { art } = webtoonFlowLayout(source), scale = art.width / source.width;
  return source.elements.map(e => overlay(e) ? e : {
    ...e, x: art.x + e.x * scale, y: art.y + e.y * scale, width: e.width * scale, height: e.height * scale,
  });
}

export function artworkEditFromCanvas(source: StoryboardDocument, changes: Partial<StoryboardElement>) {
  const { art } = webtoonFlowLayout(source), scale = art.width / source.width;
  return { ...changes,
    ...(changes.x === undefined ? {} : { x: (changes.x - art.x) / scale }),
    ...(changes.y === undefined ? {} : { y: (changes.y - art.y) / scale }),
    ...(changes.width === undefined ? {} : { width: changes.width / scale }),
    ...(changes.height === undefined ? {} : { height: changes.height / scale }),
  };
}

export function changeWebtoonFlow(source: StoryboardDocument, changes: Partial<NonNullable<StoryboardDocument["flow"]>>) {
  const current = editableWebtoonDocument(source), oldArt = webtoonFlowLayout(current).art;
  const next = { ...current, flow: normalizeWebtoonFlow({ ...current.flow!, ...changes }) };
  const nextArt = webtoonFlowLayout(next).art, ratio = nextArt.width / oldArt.width;
  return editableWebtoonDocument({ ...next, elements: current.elements.map(e => {
    if (!overlay(e)) return e;
    const center = e.y + e.height / 2;
    if (center < oldArt.y) return e;
    if (center > oldArt.y + oldArt.height) return { ...e, y: e.y + nextArt.y + nextArt.height - oldArt.y - oldArt.height };
    return { ...e, x: nextArt.x + (e.x - oldArt.x) * ratio, y: nextArt.y + (e.y - oldArt.y) * ratio,
      width: e.width * ratio, height: e.height * ratio, fontSize: e.fontSize === undefined ? undefined : e.fontSize * ratio };
  }) });
}
