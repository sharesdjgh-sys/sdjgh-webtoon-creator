import type { StoryboardElement } from "@/lib/storage";
import { textDecoration } from "@/lib/webtoonDecoration";

export function defaultElementFontSize(element: StoryboardElement): number {
  if (element.type === "sfx") return Math.max(28, Math.min(72, element.height * 0.65));
  if (element.type === "speech" || element.type === "caption") return 35;
  return Math.max(16, Math.min(28, element.height / 5));
}
export function elementFontWeight(element: StoryboardElement): number {
  return element.fontWeight ?? (element.type === "sfx" ? 900 : element.balloonStyle === "shout" ? 800 : element.balloonStyle === "whisper" ? 400 : 600);
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
  if (!fits(largest)) return largest;
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
export function layoutStoryboardText(element: StoryboardElement, stack: string) {
  const fontFamily = resolveFontStack(stack);
  const weight = elementFontWeight(element);
  const requestedSize = element.fontSize ?? defaultElementFontSize(element);
  const padding = Math.max(6, textDecoration(element).strokeWidth + 2);
  const availableWidth = Math.max(1, element.width * (element.type === "speech" ? element.balloonStyle === "shout" ? 0.54 : 0.64 : 0.84) - padding);
  const availableHeight = Math.max(1, element.height * (element.type === "speech" ? element.balloonStyle === "shout" ? 0.50 : 0.60 : 0.8) - padding);
  const context = typeof window !== "undefined" && window.document?.createElement
    ? window.document.createElement("canvas").getContext("2d") : null;
  const measure = (text: string, size: number) => {
    if (context && typeof context.measureText === "function") {
      context.font = `${element.type === "sfx" ? "italic " : ""}${weight} ${size}px ${fontFamily}`;
      const width = context.measureText(text).width;
      if (Number.isFinite(width)) return width;
    }
    return Array.from(text).reduce((sum, char) => sum + (/\s/.test(char) ? 0.35 : char.codePointAt(0)! > 255 ? 1 : 0.65), 0) * size;
  };
  const wrap = (size: number) => {
    const lines: string[] = [];
    for (const paragraph of element.text.replace(/\r/g, "").split("\n")) {
      let line = "";
      for (const char of Array.from(paragraph)) {
        if (line && measure(line + char, size) > availableWidth) { lines.push(line); line = ""; }
        line += char;
      }
      lines.push(line);
    }
    return lines;
  };
  let fontSize = requestedSize;
  let lines = wrap(fontSize);
  const fits = (size: number, wrapped: string[]) => wrapped.length * size * 1.2 <= availableHeight && wrapped.every(line => measure(line, size) <= availableWidth);
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
  const lineHeight = fontSize * 1.2;
  return {
    fontFamily, fontSize, weight, lines, lineHeight,
    widths: lines.map(line => Math.min(availableWidth, measure(line, fontSize))),
    startY: element.height / 2 - (lines.length - 1) * lineHeight / 2,
    availableWidth, availableHeight, tooSmall: Boolean(element.text.trim()) && fontSize < 12,
  };
}

/** Validate reading-canvas coordinates without moving or shrinking authored lettering. */
export function overlayOutsideCanvas(element: StoryboardElement, width: number, height: number): boolean {
  // Canvas and flow transforms produce fractional coordinates. A sub-pixel edge
  // cannot be seen and must not keep the editor in a permanent overflow state.
  const tolerance = Math.max(1, Math.min(width, height) * .001);
  const radians = element.rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const points = [[0, 0], [element.width, 0], [0, element.height], [element.width, element.height]];
  if (element.type === "speech" && !["none", "rounded", "shout"].includes(element.balloonStyle ?? "normal")) {
    points.push([(element.tailX ?? .25) * element.width, (element.tailY ?? 1.22) * element.height]);
  }
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
  const radians = element.rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const offsets = [[0,0], [element.width,0], [0,element.height], [element.width,element.height]];
  if (element.type === "speech" && !["none", "rounded", "shout"].includes(element.balloonStyle ?? "normal")) offsets.push([(element.tailX ?? .25) * element.width, (element.tailY ?? 1.22) * element.height]);
  const rotated = offsets.map(([x,y]) => ({ x: (x - element.width / 2) * cos - (y - element.height / 2) * sin, y: (x - element.width / 2) * sin + (y - element.height / 2) * cos }));
  const minX = Math.min(...rotated.map(p => p.x)), maxX = Math.max(...rotated.map(p => p.x));
  const minY = Math.min(...rotated.map(p => p.y)), maxY = Math.max(...rotated.map(p => p.y));
  const scale = Math.min(1, (width - margin * 2) / (maxX - minX), (height - margin * 2) / (maxY - minY));
  const centerX = Math.max(margin - minX * scale, Math.min(width - margin - maxX * scale, element.x + element.width / 2));
  const centerY = Math.max(margin - minY * scale, Math.min(height - margin - maxY * scale, element.y + element.height / 2));
  return { ...element, x: centerX - element.width * scale / 2, y: centerY - element.height * scale / 2, width: element.width * scale, height: element.height * scale };
}
