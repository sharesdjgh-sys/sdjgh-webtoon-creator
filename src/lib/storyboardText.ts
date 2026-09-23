import type { StoryboardElement } from "@/lib/storage";
import { balloonTail, connectedParts, textDecoration } from "@/lib/webtoonDecoration";

export function defaultElementFontSize(element: StoryboardElement): number {
  if (element.type === "sfx") return Math.max(28, Math.min(72, element.height * 0.65));
  if (element.type === "speech" || element.type === "caption") return 35;
  return Math.max(16, Math.min(28, element.height / 5));
}
export function elementFontWeight(element: StoryboardElement): number {
  return element.fontWeight ?? (element.type === "sfx" ? 900 : ["shout", "burst"].includes(element.balloonStyle ?? "") ? 800 : element.balloonStyle === "whisper" ? 400 : 600);
}

/** Explicit creation/resize operation only; never run while displaying saved lettering. */
export function sizeBalloonForFont(element: StoryboardElement, width: number, height: number, stack: string, fontSize = 35): StoryboardElement {
  if (element.type !== "speech" && element.type !== "caption") return element;
  const base = fitOverlayToCanvas({ ...element, fontSize }, width, height);
  const fits = (candidate: StoryboardElement) => layoutStoryboardText(candidate, stack).fontSize >= fontSize - .001;
  if (fits(base)) return base;
  const centerX = base.x + base.width / 2, centerY = base.y + base.height / 2;
  const atScale = (scale: number) => fitOverlayToCanvas({ ...base, width: base.width * scale, height: base.height * scale,
    x: centerX - base.width * scale / 2, y: centerY - base.height * scale / 2 }, width, height);
  const largest = atScale(Math.max(width / base.width, height / base.height) * 4);
  if (!fits(largest)) {
    // Wide, shallow balloons may exhaust horizontal space before their text fits.
    // Grow vertically as well, instead of shrinking the requested lettering.
    let grown = largest;
    for (let i = 0; i < 120 && !fits(grown); i++) {
      const candidate = fitOverlayToCanvas({ ...grown, height: grown.height + fontSize * .5 }, width, height);
      if (candidate.height <= grown.height + .001) break;
      grown = candidate;
    }
    return grown;
  }
  let low = 1, high = largest.width / base.width;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (fits(atScale(mid))) high = mid; else low = mid;
  }
  return atScale(high);
}
export function resolveFontStack(stack: string): string {
  return stack.replace(/var\((--[^)]+)\),?\s*/g, (_, key: string) => {
    if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return "";
    const value = window.getComputedStyle(window.document.body).getPropertyValue(key).trim();
    return value ? value + ", " : "";
  });
}

/** One layout for the editor, preview, SVG and PNG. No silent line truncation. */
function layoutSingleText(element: StoryboardElement, stack: string) {
  const fontFamily = resolveFontStack(stack);
  const weight = elementFontWeight(element);
  const leading = Math.min(1.8, Math.max(1.05, element.lineHeight ?? 1.3));
  const requestedSize = element.fontSize ?? defaultElementFontSize(element);
  const padding = Math.max(6, textDecoration(element).strokeWidth + 2);
  const availableWidth = Math.max(1, element.width * (element.type === "speech" ? element.balloonStyle === "shout" ? 0.54 : 0.64 : 0.84) - padding);
  const availableHeight = Math.max(1, element.height * (element.type === "speech" ? element.balloonStyle === "shout" ? 0.50 : 0.60 : 0.8) - padding);
  const context = typeof window !== "undefined" && window.document?.createElement
    ? window.document.createElement("canvas").getContext("2d") : null;
  const measure = (text: string, size: number) => {
    if (context && typeof context.measureText === "function") {
      context.font = `${element.textItalic || element.type === "sfx" ? "italic " : ""}${weight} ${size}px ${fontFamily}`;
      const width = context.measureText(text).width;
      if (Number.isFinite(width)) return width;
    }
    return Array.from(text).reduce((sum, char) => sum + (/\s/.test(char) ? 0.35 : char.codePointAt(0)! > 255 ? 1 : 0.65), 0) * size;
  };
  const wrap = (size: number) => {
    const lines: string[] = [];
    for (const paragraph of element.text.replace(/\r/g, "").split("\n")) {
      let line = "";
      for (const token of paragraph.match(/\s+|[^\s]+/gu) ?? []) {
        if (line && measure(line + token, size) > availableWidth && token.trim()) {
          lines.push(line.trimEnd()); line = "";
        }
        if (!line && !token.trim()) continue;
        for (const char of Array.from(token)) {
          if (line && measure(line + char, size) > availableWidth && !/^[、。，．！？!?…,:;)}\]」』]$/u.test(char)) {
            lines.push(line.trimEnd()); line = "";
          }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  let fontSize = requestedSize;
  let lines = wrap(fontSize);
  const fits = (size: number, wrapped: string[]) => wrapped.length * size * leading <= availableHeight && wrapped.every(line => measure(line, size) <= availableWidth);
  if (!fits(fontSize, lines)) {
    let low = 0, high = requestedSize;
    for (let attempt = 0; attempt < 24; attempt++) {
      const middle = (low + high) / 2;
      if (fits(middle, wrap(middle))) low = middle;
      else high = middle;
    }
    // Round down so the displayed setting also fits without hidden shrinkage.
    fontSize = Math.floor(low * 100) / 100 || low;
    lines = wrap(fontSize);
  }
  const lineHeight = fontSize * leading;
  return {
    fontFamily, fontSize, weight, lines, lineHeight,
    positions: lines.map((_, i) => ({ x: element.width / 2, y: element.height / 2 + (i - (lines.length - 1) / 2) * lineHeight })),
    widths: lines.map(line => Math.min(availableWidth, measure(line, fontSize))),
    startY: element.height / 2 - (lines.length - 1) * lineHeight / 2,
    availableWidth, availableHeight, tooSmall: Boolean(element.text.trim()) && fontSize * 390 / 900 < 12,
  };
}

/** Two connected lobes retain their own reading beats, using the same text runs in every renderer. */
export function layoutStoryboardText(element: StoryboardElement, stack: string): ReturnType<typeof layoutSingleText> {
  if (element.balloonStyle !== "connected") return layoutSingleText(element, stack);
  const paragraphs = element.text.split(/\n\s*\n/u);
  let first = paragraphs[0], second = paragraphs.slice(1).join("\n\n");
  if (!second) {
    const middle = Math.floor(element.text.length * .4);
    const space = element.text.indexOf(" ", middle);
    const cut = space > 0 ? space : middle;
    first = element.text.slice(0, cut); second = element.text.slice(cut).trimStart();
  }
  const parts = connectedParts(element);
  const initial = parts.map((part, i) => layoutSingleText({ ...part, text: i ? second : first }, stack));
  const size = Math.min(...initial.map(part => part.fontSize));
  const layouts = parts.map((part, i) => layoutSingleText({ ...part, text: i ? second : first, fontSize: size }, stack));
  return { ...layouts[0], fontSize: size, lines: layouts.flatMap(part => part.lines), widths: layouts.flatMap(part => part.widths),
    positions: layouts.flatMap((layout, i) => layout.positions.map(point => ({ x: point.x + parts[i].x, y: point.y + parts[i].y }))),
    tooSmall: layouts.some(part => part.tooSmall) };
}

/** Validate reading-canvas coordinates without moving or shrinking authored lettering. */
export function overlayOutsideCanvas(element: StoryboardElement, width: number, height: number): boolean {
  // Canvas and flow transforms produce fractional coordinates. A sub-pixel edge
  // cannot be seen and must not keep the editor in a permanent overflow state.
  const tolerance = Math.max(1, Math.min(width, height) * .001);
  const radians = element.rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const points = [[0, 0], [element.width, 0], [0, element.height], [element.width, element.height]];
  const tail = balloonTail(element);
  if (tail.enabled) points.push([tail.x, tail.y]);
  return points.some(([x, y]) => {
    const dx = x - element.width / 2, dy = y - element.height / 2;
    const px = element.x + element.width / 2 + dx * cos - dy * sin;
    const py = element.y + element.height / 2 + dx * sin + dy * cos;
    return px < -tolerance || py < -tolerance || px > width + tolerance || py > height + tolerance;
  });
}

/** Keep rotated overlay bodies and tails inside the panel; never mutate saved data. */
export function fitOverlayToCanvas(element: StoryboardElement, width: number, height: number): StoryboardElement {
  if (!["speech", "caption", "sfx"].includes(element.type)) return element;
  const margin = Math.min(12, width * 0.02, height * 0.02);
  for (let attempt = 0; attempt < 12; attempt++) {
    const radians = element.rotation * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    const offsets = [[0,0], [element.width,0], [0,element.height], [element.width,element.height]];
    const tail = balloonTail(element);
    if (tail.enabled) offsets.push([tail.x, tail.y]);
    const rotated = offsets.map(([x,y]) => ({ x: (x - element.width / 2) * cos - (y - element.height / 2) * sin, y: (x - element.width / 2) * sin + (y - element.height / 2) * cos }));
    const minX = Math.min(...rotated.map(p => p.x)), maxX = Math.max(...rotated.map(p => p.x));
    const minY = Math.min(...rotated.map(p => p.y)), maxY = Math.max(...rotated.map(p => p.y));
    const scale = Math.min(1, (width - margin * 2) / (maxX - minX), (height - margin * 2) / (maxY - minY));
    const centerX = Math.max(margin - minX * scale, Math.min(width - margin - maxX * scale, element.x + element.width / 2));
    const centerY = Math.max(margin - minY * scale, Math.min(height - margin - maxY * scale, element.y + element.height / 2));
    element = { ...element, x: centerX - element.width * scale / 2, y: centerY - element.height * scale / 2, width: element.width * scale, height: element.height * scale };
    // The capped tail length must be measured again after shrinking its body.
    if (scale >= 1) break;
  }
  return element;
}
