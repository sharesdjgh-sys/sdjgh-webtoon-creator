import type { StoryboardDocument, StoryboardElement } from "@/lib/storage";
import { layoutStoryboardText } from "@/lib/storyboardText";
import { defaultWebtoonFont, webtoonFontStack } from "@/lib/storyboardSvg";
import { editableWebtoonDocument, normalizeWebtoonFlow, webtoonFlowLayout } from "@/lib/webtoonFlow";

/** Preserve every character; prefer sentence/word boundaries when dividing a long beat. */
export function splitLetteringText(text: string, limit = 100): string[] {
  const result: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const candidate = rest.slice(0, limit + 1);
    const sentences = [...candidate.matchAll(/[.!?。！？…]\s*/gu)].map(m => m.index! + m[0].length).filter(i => i >= limit * .35);
    const words = [...candidate.matchAll(/\s+/gu)].map(m => m.index! + m[0].length).filter(i => i >= limit * .45);
    const at = sentences.at(-1) ?? words.at(-1) ?? limit;
    result.push(rest.slice(0, at)); rest = rest.slice(at);
  }
  if (rest || !result.length) result.push(rest);
  return result;
}

/** Explicit generation/reflow operation. Never invoked just by opening saved work. */
export function arrangeWebtoonLettering(source: StoryboardDocument): StoryboardDocument {
  const previous = webtoonFlowLayout(source);
  const fontSize = source.width * 35 / 900;
  const existingIds = new Set(source.elements.map(e => e.id));
  const elements = source.elements.flatMap((original, index): StoryboardElement[] => {
    if (original.visible === false || !["speech", "caption"].includes(original.type)) return [original];
    const canvasY = original.placement === "canvas" ? original.y : previous.art.y + original.y * previous.art.width / source.width;
    const before = ["before", "top-edge"].includes(original.placement ?? "") || (!["after", "bottom-edge"].includes(original.placement ?? "") && canvasY < previous.art.y + previous.art.height * .5);
    return splitLetteringText(original.text, original.balloonStyle === "connected" ? 150 : 100).map((text, part) => {
      let id = part ? original.id + "-beat-" + part : original.id;
      while (part && existingIds.has(id)) id += "-new";
      existingIds.add(id);
      const width = Math.min(source.width * .82, Math.max(source.width * .34, Math.sqrt(Math.max(1, text.length)) * fontSize * 1.8));
      let element: StoryboardElement = { ...original, id, text, width, height: fontSize * 4,
        fontSize, rotation: 0, placement: before ? "before" : "after", flowOrder: (original.flowOrder ?? index * 100) + part,
        flowSpacing: part ? 12 : original.flowSpacing, x: Math.max(20, Math.min(source.width - width - 20, original.x)),
        tailX: .5, tailY: before ? 1.15 : -.15,
        tailVisible: original.tailVisible ?? original.type === "speech" };
      const stack = webtoonFontStack(element.fontFamily ?? defaultWebtoonFont(element.type));
      for (let i = 0; i < 100 && layoutStoryboardText(element, stack).fontSize < fontSize - .01; i++) element = { ...element, height: element.height + fontSize * .5 };
      return element;
    });
  });
  const next = editableWebtoonDocument({ ...source, flow: normalizeWebtoonFlow(source.flow), elements });
  const art = webtoonFlowLayout(next).art;
  const scale = art.width / source.width;
  return { ...next, elements: next.elements.map(element => {
    if (element.type !== "speech" || !element.speakerCharacterId) return element;
    const speaker = source.elements.find(e => e.type === "character" && e.characterId === element.speakerCharacterId);
    if (!speaker) return element;
    return { ...element, tailX: (art.x + (speaker.x + speaker.width / 2) * scale - element.x) / element.width,
      tailY: (art.y + (speaker.y + speaker.height * .25) * scale - element.y) / element.height };
  }) };
}
