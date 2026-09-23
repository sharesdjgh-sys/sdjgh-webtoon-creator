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

/** Short, narrow tails share the same geometry in the editor, bounds checks and PNG. */
export function balloonTail(element: StoryboardElement): { cx: number; cy: number; rx: number; ry: number; angle: number; delta: number; enabled: boolean; edgeX: number; edgeY: number; x: number; y: number } {
  if (element.balloonStyle === "connected") {
    const part = connectedParts(element)[1], tail = balloonTail(part);
    return { ...tail, cx: tail.cx + part.x, cy: tail.cy + part.y, edgeX: tail.edgeX + part.x, edgeY: tail.edgeY + part.y, x: tail.x + part.x, y: tail.y + part.y };
  }
  const cx = element.width / 2, cy = element.height / 2;
  const border = bounded(element.balloonStrokeWidth, 3, 12);
  const rx = Math.max(1, cx - border / 2 - 1), ry = Math.max(1, cy - border / 2 - 1);
  const targetX = (element.tailX ?? .25) * element.width, targetY = (element.tailY ?? 1.22) * element.height;
  const dx = targetX - cx, dy = targetY - cy;
  const distance = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy / ry, dx / rx);
  const edgeX = cx + Math.cos(angle) * rx, edgeY = cy + Math.sin(angle) * ry;
  const outside = (dx / rx) ** 2 + (dy / ry) ** 2 > 1;
  const length = Math.min(32, Math.max(0, distance - Math.hypot(edgeX - cx, edgeY - cy)));
  const enabled = element.type === "speech" && element.tailVisible !== false && !["none", "rounded", "shout", "burst", "radiant", "rough", "broadcast"].includes(element.balloonStyle ?? "normal") && !["thought", "narration", "broadcast"].includes(element.speechRole ?? "dialogue") && outside;
  const halfWidth = Math.min(9, Math.max(4, Math.min(element.width, element.height) * .025));
  const delta = Math.min(.15, halfWidth / Math.max(1, Math.hypot(rx * Math.sin(angle), ry * Math.cos(angle))));
  return { cx, cy, rx, ry, angle, delta, enabled, edgeX, edgeY,
    x: enabled ? edgeX + dx / distance * length : cx,
    y: enabled ? edgeY + dy / distance * length : cy };
}

export function connectedParts(element: StoryboardElement): [StoryboardElement, StoryboardElement] {
  const top = { ...element, balloonStyle: "normal" as const, x: 0, y: 0, width: element.width * .82, height: element.height * .50, tailVisible: false };
  const x = element.width * .16, y = element.height * .39;
  const bottom = { ...element, balloonStyle: "normal" as const, x, y, width: element.width * .84, height: element.height * .61,
    tailX: ((element.tailX ?? .5) * element.width - x) / (element.width * .84),
    tailY: ((element.tailY ?? 1.15) * element.height - y) / (element.height * .61) };
  return [top, bottom];
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
  if (style === "connected") {
    const [top, bottom] = connectedParts(element);
    const id = textGradientId(element) + "-join";
    const ellipse = (part: StoryboardElement, color: string) => {
      const t = balloonTail(part);
      return '<ellipse cx="' + (part.x + t.cx) + '" cy="' + (part.y + t.cy) + '" rx="' + t.rx + '" ry="' + t.ry + '" fill="' + color + '"/>';
    };
    return '<defs><mask id="' + id + '-top" maskUnits="userSpaceOnUse" x="-50" y="-50" width="' + (element.width + 100) + '" height="' + (element.height + 100) + '"><rect x="-50" y="-50" width="10000" height="10000" fill="white"/>' + ellipse(bottom, 'black') + '</mask><mask id="' + id + '-bottom" maskUnits="userSpaceOnUse" x="-50" y="-50" width="' + (element.width + 100) + '" height="' + (element.height + 100) + '"><rect x="-50" y="-50" width="10000" height="10000" fill="white"/>' + ellipse(top, 'black') + '</mask></defs>' + ellipse(top, fill) + ellipse(bottom, fill)
      + '<g mask="url(#' + id + '-top)">' + balloonMarkup(top) + '</g><g mask="url(#' + id + '-bottom)"><g transform="translate(' + bottom.x + ' ' + bottom.y + ')">' + balloonMarkup(bottom) + '</g></g>';
  }
  if (style === "broadcast") {
    return '<polygon points="' + [[.2,.02],[.8,.02],[.99,.5],[.8,.98],[.2,.98],[.01,.5]].map(([x,y]) => (x * element.width) + ',' + (y * element.height)).join(' ') + '" ' + attrs + '/>';
  }
  if (style === "radiant") {
    const rays = Array.from({ length: 320 }, (_, i) => {
      const a = i * Math.PI * 2 / 320, inner = .81 + .035 * Math.sin(i * 7), outer = .96 + .02 * Math.sin(i * 13);
      return '<path d="M ' + (cx + Math.cos(a) * rx * inner) + ' ' + (cy + Math.sin(a) * ry * inner) + ' L ' + (cx + Math.cos(a) * rx * outer) + ' ' + (cy + Math.sin(a) * ry * outer) + '" stroke="' + stroke + '" stroke-width="' + Math.max(.8, width * .55) + '"/>';
    }).join('');
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx * .9 + '" ry="' + ry * .9 + '" fill="' + fill + '"/>' + rays;
  }
  if (style === "rough") {
    const rings = [0,1,2].map(r => {
      const points = Array.from({ length: 80 }, (_, i) => {
        const a = i * Math.PI / 40, k = .93 + .012 * Math.sin(i * .37 + r * 2) + .006 * Math.sin(i * 1.7 + r) + r * .017;
        return (cx + Math.cos(a) * rx * k) + ',' + (cy + Math.sin(a) * ry * k);
      }).join(' ');
      return '<polygon points="' + points + '" fill="' + (r ? 'none' : fill) + '" stroke="' + stroke + '" stroke-width="' + Math.max(1, width * .65) + '" stroke-linejoin="round"/>';
    });
    return rings.join('');
  }
  if (style === "burst") {
    const points = Array.from({ length: 26 }, (_, i) => { const a = -Math.PI/2 + i*Math.PI/13; const k = i % 2 ? .77 + .05*Math.sin(i*3) : .93 + .04*Math.sin(i*7); return (cx+Math.cos(a)*rx*k)+','+(cy+Math.sin(a)*ry*k); }).join(' ');
    return '<polygon points="' + points + '" ' + attrs + '/>';
  }
  if ((element.type === "caption" && !element.balloonStyle) || style === "rounded") {
    const radius = style === "rounded" ? Math.min(rx, ry) * 0.32 : 4;
    return `<rect x="${width / 2}" y="${width / 2}" width="${Math.max(1, element.width - width)}" height="${Math.max(1, element.height - width)}" rx="${radius}" ${attrs}/>`;
  }
  const tail = balloonTail(element);
  const tx = tail.x, ty = tail.y, angle = tail.angle;
  const point = (a: number, factor = 1) => [cx + Math.cos(a) * rx * factor, cy + Math.sin(a) * ry * factor];
  if (style === "thought") {
    const count = 14;
    let path = "M " + point(0, .87).join(" ");
    for (let i = 0; i < count; i++) {
      path += " Q " + point((i + .5) * Math.PI * 2 / count, 1.10).join(" ") + " " + point((i + 1) * Math.PI * 2 / count, .87).join(" ");
    }
    const edge = point(angle, .92);
    const dots = [.3, .62, .88].map((t, i) => `<circle cx="${edge[0] + (tx - edge[0]) * t}" cy="${edge[1] + (ty - edge[1]) * t}" r="${Math.max(3, Math.min(rx, ry) * (.075 - i * .02))}" ${attrs}/>`).join("");
    return `<path d="${path} Z" ${attrs}/>${tail.enabled ? dots : ""}`;
  }
  if (style === "shout") {
    const points = Array.from({ length: 36 }, (_, i) => point(-Math.PI / 2 + i * Math.PI / 18, i % 2 ? .76 : 1).join(",")).join(" ");
    return `<polygon points="${points}" ${attrs}/>`;
  }
  // A single closed outline joins the ellipse and curved tail without a seam.
  const a = point(angle + tail.delta), b = point(angle - tail.delta);
  if (!tail.enabled) return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${attrs}${style === "whisper" ? ' stroke-dasharray="7 6"' : ""}/>`;
  const path = `M ${a.join(" ")} A ${rx} ${ry} 0 1 1 ${b.join(" ")} Q ${(b[0] + tx) / 2} ${(b[1] + ty) / 2} ${tx} ${ty} Q ${(a[0] + tx) / 2} ${(a[1] + ty) / 2} ${a.join(" ")} Z`;
  return `<path d="${path}" ${attrs}${style === "whisper" ? ' stroke-dasharray="7 6"' : ""}/>`;
}
