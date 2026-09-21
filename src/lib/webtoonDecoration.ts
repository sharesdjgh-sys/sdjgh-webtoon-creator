import type { StoryboardElement } from "@/lib/storage";

// Only validated hex colors reach SVG markup or Canvas paint settings.
export const decorationColor = (value: string | undefined, fallback: string) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
const bounded = (value: number | undefined, fallback: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, value!)) : fallback;
export function textDecoration(element: StoryboardElement) {
  const angle = bounded(element.textGradientAngle, 90, 360) * Math.PI / 180;
  const dx = Math.cos(angle) * element.width / 2, dy = Math.sin(angle) * element.height / 2;
  return {
    color: decorationColor(element.textColor, "#222222"),
    gradient: Boolean(element.textGradient),
    end: decorationColor(element.textGradientColor, "#ec4899"),
    stroke: decorationColor(element.textStrokeColor, "#ffffff"),
    strokeWidth: bounded(element.textStrokeWidth, element.type === "sfx" ? 5 : 0, 12),
    x1: element.width / 2 - dx, y1: element.height / 2 - dy,
    x2: element.width / 2 + dx, y2: element.height / 2 + dy,
  };
}
export function textGradientId(element: StoryboardElement) {
  return "webtoon-ink-" + Array.from(element.id).map(c => c.codePointAt(0)!.toString(16)).join("-");
}
export function textGradientSvg(element: StoryboardElement) {
  const ink = textDecoration(element);
  return ink.gradient ? `<defs><linearGradient id="${textGradientId(element)}" gradientUnits="userSpaceOnUse" x1="${ink.x1}" y1="${ink.y1}" x2="${ink.x2}" y2="${ink.y2}"><stop offset="0" stop-color="${ink.color}"/><stop offset="1" stop-color="${ink.end}"/></linearGradient></defs>` : "";
}

/** Shared balloon geometry for the live editor, SVG and raster exports. */
export function balloonMarkup(element: StoryboardElement): string {
  if (element.balloonStyle === "none" || element.type === "sfx") return "";
  const fill = decorationColor(element.balloonFill, "#ffffff");
  const stroke = decorationColor(element.balloonStroke, "#171717");
  const width = bounded(element.balloonStrokeWidth, 3, 12);
  const style = element.balloonStyle ?? "normal";
  const cx = element.width / 2, cy = element.height / 2;
  const rx = Math.max(1, cx - width / 2 - 1), ry = Math.max(1, cy - width / 2 - 1);
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;
  if (element.type === "caption" || style === "rounded") {
    const radius = style === "rounded" ? Math.min(rx, ry) * 0.32 : 4;
    return `<rect x="${width / 2}" y="${width / 2}" width="${Math.max(1, element.width - width)}" height="${Math.max(1, element.height - width)}" rx="${radius}" ${attrs}/>`;
  }
  const tx = (element.tailX ?? .25) * element.width, ty = (element.tailY ?? 1.22) * element.height;
  const angle = Math.atan2((ty - cy) / ry, (tx - cx) / rx);
  const point = (a: number, factor = 1) => [cx + Math.cos(a) * rx * factor, cy + Math.sin(a) * ry * factor];
  if (style === "thought") {
    const count = 14;
    let path = "M " + point(0, .87).join(" ");
    for (let i = 0; i < count; i++) {
      path += " Q " + point((i + .5) * Math.PI * 2 / count, 1.10).join(" ") + " " + point((i + 1) * Math.PI * 2 / count, .87).join(" ");
    }
    const edge = point(angle, .92);
    const dots = [.3, .62, .88].map((t, i) => `<circle cx="${edge[0] + (tx - edge[0]) * t}" cy="${edge[1] + (ty - edge[1]) * t}" r="${Math.max(3, Math.min(rx, ry) * (.075 - i * .02))}" ${attrs}/>`).join("");
    return `<path d="${path} Z" ${attrs}/>${dots}`;
  }
  if (style === "shout") {
    const points = Array.from({ length: 36 }, (_, i) => point(-Math.PI / 2 + i * Math.PI / 18, i % 2 ? .76 : 1).join(",")).join(" ");
    return `<polygon points="${points}" ${attrs}/>`;
  }
  // A single closed outline joins the ellipse and curved tail without a seam.
  const a = point(angle + .16), b = point(angle - .16);
  const inside = ((tx - cx) / rx) ** 2 + ((ty - cy) / ry) ** 2 <= 1;
  if (inside) return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${attrs}/>`;
  const path = `M ${a.join(" ")} A ${rx} ${ry} 0 1 1 ${b.join(" ")} Q ${(b[0] + tx) / 2} ${b[1]} ${tx} ${ty} Q ${a[0]} ${(a[1] + ty) / 2} ${a.join(" ")} Z`;
  return `<path d="${path}" ${attrs}${style === "whisper" ? ' stroke-dasharray="7 6"' : ""}/>`;
}
