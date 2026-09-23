import { panelDimensions } from "@/lib/webtoonDesign";
import type { PanelAspectRatio, StoryboardDocument, StoryboardElement, StoryboardElementType, WebtoonFontFamily } from "@/lib/storage";
import { fitOverlayToCanvas, layoutStoryboardText } from "@/lib/storyboardText";
import { fitImageRect } from "@/lib/panelGeometry";
import { resolveCharacterRig } from "@/lib/storyboardRig";
import { balloonTail, balloonMarkup, textDecoration, textGradientId, textGradientSvg } from "@/lib/webtoonDecoration";
import { webtoonFlowLayout } from "@/lib/webtoonFlow";

export const WEBTOON_FONT_OPTIONS: Array<{ value: WebtoonFontFamily; label: string; description: string }> = [
  { value: "clean", label: "깔끔한 대사체", description: "일반 대사와 설명" },
  { value: "serif", label: "감성 명조체", description: "내레이션과 회상" },
  { value: "handwritten", label: "손글씨체", description: "독백과 편지" },
  { value: "cute", label: "둥근 코믹체", description: "밝고 귀여운 대사" },
  { value: "comic", label: "자유로운 만화체", description: "코믹한 대사와 반응" },
  { value: "impact", label: "강한 효과음체", description: "제목과 효과음" },
];

export function defaultWebtoonFont(type: StoryboardElementType): WebtoonFontFamily {
  if (type === "caption") return "serif";
  if (type === "sfx") return "impact";
  return "clean";
}

export function webtoonFontStack(font: WebtoonFontFamily): string {
  return {
    clean: "var(--font-webtoon-clean), 'Noto Sans KR', 'Pretendard', sans-serif",
    serif: "var(--font-webtoon-serif), 'Nanum Myeongjo', 'Batang', serif",
    handwritten: "var(--font-webtoon-handwritten), 'Nanum Pen Script', cursive",
    cute: "var(--font-webtoon-cute), 'Jua', 'Noto Sans KR', sans-serif",
    comic: "var(--font-webtoon-comic), 'Gaegu', cursive",
    impact: "var(--font-webtoon-impact), 'Black Han Sans', 'Noto Sans KR', sans-serif",
  }[font];
}

export function storyboardDimensions(aspectRatio: PanelAspectRatio): { width: number; height: number } {
  return panelDimensions(aspectRatio);
}

export function isOverlayElement(element: StoryboardElement): boolean {
  return element.type === "speech" || element.type === "caption" || element.type === "sfx";
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

export function storyboardTextLines(text: string, maxCharacters: number): string[] {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    let rest = paragraph;
    if (!rest) {
      lines.push("");
      continue;
    }
    while (rest.length > maxCharacters) {
      const candidate = rest.slice(0, maxCharacters + 1);
      const space = candidate.lastIndexOf(" ");
      const breakAt = space >= Math.floor(maxCharacters * 0.55) ? space : maxCharacters;
      lines.push(rest.slice(0, breakAt).trimEnd());
      rest = rest.slice(breakAt).trimStart();
    }
    lines.push(rest);
  }
  return lines;
}

export function speechBalloonGeometry(element: StoryboardElement) {
  const tail = balloonTail(element);
  return { tailX: tail.x, tailY: tail.y, enabled: tail.enabled };
}

export function svgText(element: StoryboardElement): string {
  const layout = layoutStoryboardText(element, webtoonFontStack(element.fontFamily ?? defaultWebtoonFont(element.type)));
  const ink = textDecoration(element);
  const effects = ` stroke="${ink.stroke}" stroke-width="${ink.strokeWidth}" stroke-linejoin="round" paint-order="stroke fill"${element.textItalic || element.type === "sfx" ? ' font-style="italic"' : ""}`;
  return `${textGradientSvg(element)}<text xml:space="preserve" x="${element.width / 2}" y="${layout.startY}" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(layout.fontFamily)}" font-size="${layout.fontSize}" font-weight="${layout.weight}" fill="${ink.gradient ? `url(#${textGradientId(element)})` : ink.color}"${effects}>${layout.lines.map((line, index) => `<tspan x="${layout.positions[index].x}" y="${layout.positions[index].y}"${layout.widths[index] > 0 ? ` textLength="${layout.widths[index]}" lengthAdjust="spacingAndGlyphs"` : ""}>${escapeXml(line || " ")}</tspan>`).join("")}</text>`;
}

function characterMarkup(element: StoryboardElement): string {
  const rig = resolveCharacterRig(element);
  const point = (key: keyof typeof rig) => ({ x: rig[key].x * element.width, y: rig[key].y * element.height });
  const head = point("head");
  const neck = point("neck");
  const leftShoulder = point("leftShoulder");
  const rightShoulder = point("rightShoulder");
  const leftElbow = point("leftElbow");
  const rightElbow = point("rightElbow");
  const leftHand = point("leftHand");
  const rightHand = point("rightHand");
  const leftHip = point("leftHip");
  const rightHip = point("rightHip");
  const leftKnee = point("leftKnee");
  const rightKnee = point("rightKnee");
  const leftFoot = point("leftFoot");
  const rightFoot = point("rightFoot");
  const radius = Math.max(14, Math.min(element.width, element.height) * 0.09);
  const limb = Math.max(7, Math.min(element.width, element.height) * 0.035);
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, width = limb, color = "#DDD6FE") => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const outline = (a: { x: number; y: number }, b: { x: number; y: number }, width: number) => `${line(a, b, width + Math.max(3, limb * 0.38), "#5B21B6")}${line(a, b, width)}`;
  return `${outline(head, neck, limb * 1.15)}
    ${outline(leftShoulder, leftElbow, limb * 2.15)}${outline(leftElbow, leftHand, limb * 1.7)}
    ${outline(rightShoulder, rightElbow, limb * 2.15)}${outline(rightElbow, rightHand, limb * 1.7)}
    ${outline(leftHip, leftKnee, limb * 2.8)}${outline(leftKnee, leftFoot, limb * 2.15)}
    ${outline(rightHip, rightKnee, limb * 2.8)}${outline(rightKnee, rightFoot, limb * 2.15)}
    <path d="M ${leftShoulder.x} ${leftShoulder.y} Q ${head.x} ${neck.y + limb} ${rightShoulder.x} ${rightShoulder.y} L ${rightHip.x} ${rightHip.y} Q ${head.x} ${Math.max(leftHip.y, rightHip.y) + limb * 1.3} ${leftHip.x} ${leftHip.y} Z" fill="#EDE9FE" stroke="#5B21B6" stroke-width="${Math.max(4, limb * 0.45)}" stroke-linejoin="round"/>
    <path d="M ${leftHip.x - limb * 0.35} ${leftHip.y} Q ${head.x} ${leftHip.y + limb * 2.4} ${rightHip.x + limb * 0.35} ${rightHip.y}" fill="none" stroke="#7C3AED" stroke-width="${Math.max(3, limb * 0.35)}"/>
    <path d="M ${head.x - radius * 0.78} ${head.y - radius * 0.45} Q ${head.x - radius * 0.65} ${head.y - radius} ${head.x} ${head.y - radius} Q ${head.x + radius * 0.72} ${head.y - radius * 0.9} ${head.x + radius * 0.78} ${head.y - radius * 0.35} L ${head.x + radius * 0.6} ${head.y + radius * 0.42} Q ${head.x} ${head.y + radius * 1.08} ${head.x - radius * 0.6} ${head.y + radius * 0.42} Z" fill="#FFF7ED" stroke="#5B21B6" stroke-width="${Math.max(4, limb * 0.45)}"/>
    <path d="M ${head.x - radius * 0.8} ${head.y - radius * 0.35} Q ${head.x - radius * 0.45} ${head.y - radius * 1.18} ${head.x + radius * 0.72} ${head.y - radius * 0.52} Q ${head.x + radius * 0.25} ${head.y - radius * 0.62} ${head.x - radius * 0.05} ${head.y - radius * 0.18}" fill="#C4B5FD" stroke="#5B21B6" stroke-width="${Math.max(3, limb * 0.35)}" stroke-linecap="round"/>
    <path d="M ${head.x - radius * 0.48} ${head.y} Q ${head.x} ${head.y - radius * 0.08} ${head.x + radius * 0.48} ${head.y}" fill="none" stroke="#7C3AED" stroke-width="${Math.max(2, limb * 0.25)}" stroke-linecap="round"/>
    <path d="M ${head.x} ${head.y - radius * 0.55} L ${head.x + radius * 0.08} ${head.y + radius * 0.5}" fill="none" stroke="#A78BFA" stroke-width="${Math.max(2, limb * 0.2)}" stroke-dasharray="6 5"/>
    <circle cx="${leftHand.x}" cy="${leftHand.y}" r="${limb * 0.9}" fill="#FFF7ED" stroke="#5B21B6" stroke-width="${Math.max(3, limb * 0.35)}"/>
    <circle cx="${rightHand.x}" cy="${rightHand.y}" r="${limb * 0.9}" fill="#FFF7ED" stroke="#5B21B6" stroke-width="${Math.max(3, limb * 0.35)}"/>
    <path d="M ${leftFoot.x - limb * 1.1} ${leftFoot.y} Q ${leftFoot.x} ${leftFoot.y - limb * 0.7} ${leftFoot.x + limb * 1.65} ${leftFoot.y + limb * 0.15}" fill="none" stroke="#5B21B6" stroke-width="${limb * 1.15}" stroke-linecap="round"/>
    <path d="M ${rightFoot.x - limb * 1.1} ${rightFoot.y} Q ${rightFoot.x} ${rightFoot.y - limb * 0.7} ${rightFoot.x + limb * 1.65} ${rightFoot.y + limb * 0.15}" fill="none" stroke="#5B21B6" stroke-width="${limb * 1.15}" stroke-linecap="round"/>
    <rect x="${Math.max(0, head.x - element.width * 0.24)}" y="0" width="${element.width * 0.48}" height="28" rx="10" fill="#5B21B6"/>
    <text x="${head.x}" y="15" text-anchor="middle" dominant-baseline="middle" font-family="Pretendard, sans-serif" font-size="16" font-weight="700" fill="#fff">${escapeXml(element.text || "캐릭터")}</text>`;
}

function elementMarkup(element: StoryboardElement): string {
  const transform = `translate(${element.x} ${element.y}) rotate(${element.rotation} ${element.width / 2} ${element.height / 2})`;
  let content = "";
  if (element.type === "background") {
    content = `<rect width="${element.width}" height="${element.height}" fill="#fff" stroke="#A8A29E" stroke-width="4" stroke-dasharray="16 10"/><text x="${element.width / 2}" y="${element.height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Pretendard, sans-serif" font-size="28" font-weight="700" fill="#78716C">${escapeXml(element.text || "배경")}</text>`;
  } else if (element.type === "character") {
    content = characterMarkup(element);
  } else if (element.type === "speech" || element.type === "caption") {
    content = balloonMarkup(element) + svgText(element);
  } else if (element.type === "sfx") {
    content = svgText(element);
  } else if (element.type === "arrow") {
    content = `<line x1="8" y1="${element.height / 2}" x2="${Math.max(12, element.width - 18)}" y2="${element.height / 2}" stroke="#C2410C" stroke-width="7"/><path d="M ${element.width - 24} ${element.height / 2 - 16} L ${element.width - 4} ${element.height / 2} L ${element.width - 24} ${element.height / 2 + 16}" fill="none" stroke="#C2410C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    const shape = element.shape === "ellipse"
      ? `<ellipse cx="${element.width / 2}" cy="${element.height / 2}" rx="${element.width / 2 - 3}" ry="${element.height / 2 - 3}" fill="#F4F1EC" stroke="#7A7067" stroke-width="4" stroke-dasharray="12 8"/>`
      : `<rect width="${element.width}" height="${element.height}" rx="12" fill="#F4F1EC" stroke="#7A7067" stroke-width="4" stroke-dasharray="12 8"/>`;
    content = `${shape}${svgText(element)}`;
  }
  return `<g transform="${transform}" data-element-id="${escapeXml(element.id)}" opacity="${element.opacity ?? 1}">${content}</g>`;
}

export function storyboardToSvg(
  document: StoryboardDocument,
  options: { overlaysOnly?: boolean; transparent?: boolean; hideText?: boolean } = {},
): string {
  const elements = document.elements
    .filter((element) => element.visible !== false && (!options.overlaysOnly || isOverlayElement(element)))
    .map(element => element.placement === "canvas" ? element : fitOverlayToCanvas(element, document.width, document.height))
    .sort((left, right) => left.zIndex - right.zIndex);
  const background = options.transparent ? "" : `<rect width="100%" height="100%" fill="#FBF9F6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">${background}${elements.map(element => options.hideText ? elementMarkup(element).replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, "") : elementMarkup(element)).join("")}</svg>`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = source;
  });
}

export async function svgToPngBlob(storyboard: StoryboardDocument, svg = storyboardToSvg(storyboard)): Promise<Blob> {
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(source);
    const canvas = window.document.createElement("canvas");
    canvas.width = storyboard.width;
    canvas.height = storyboard.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("캔버스를 생성하지 못했습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG 변환에 실패했습니다.")), "image/png"));
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function drawStoryboardOverlays(context: CanvasRenderingContext2D, storyboard: StoryboardDocument): Promise<void> {
  if (window.document.fonts) await window.document.fonts.ready;
  const elements = storyboard.elements.filter(element => element.visible !== false && isOverlayElement(element))
    .map(element => element.placement === "canvas" ? element : fitOverlayToCanvas(element, storyboard.width, storyboard.height)).sort((a, b) => a.zIndex - b.zIndex);
  for (const element of elements) {
    const font = layoutStoryboardText(element, webtoonFontStack(element.fontFamily ?? defaultWebtoonFont(element.type)));
    if (window.document.fonts?.load) await window.document.fonts.load(`${element.textItalic || element.type === "sfx" ? "italic " : ""}${font.weight} ${font.fontSize}px ${font.fontFamily}`, element.text);
    const shapes = storyboardToSvg({ ...storyboard, elements: [element] }, { overlaysOnly: true, transparent: true, hideText: true });
    const url = URL.createObjectURL(new Blob([shapes], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = await loadImage(url);
      context.drawImage(image, 0, 0, storyboard.width, storyboard.height);
    } finally { URL.revokeObjectURL(url); }
    const layout = layoutStoryboardText(element, webtoonFontStack(element.fontFamily ?? defaultWebtoonFont(element.type)));
    context.save();
    context.globalAlpha = element.opacity ?? 1;
    context.translate(element.x + element.width / 2, element.y + element.height / 2);
    context.rotate(element.rotation * Math.PI / 180);
    context.font = `${element.textItalic || element.type === "sfx" ? "italic " : ""}${layout.weight} ${layout.fontSize}px ${layout.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const ink = textDecoration(element);
    let paint: string | CanvasGradient = ink.color;
    if (ink.gradient) {
      const gradient = context.createLinearGradient(ink.x1 - element.width / 2, ink.y1 - element.height / 2, ink.x2 - element.width / 2, ink.y2 - element.height / 2);
      gradient.addColorStop(0, ink.color);
      gradient.addColorStop(1, ink.end);
      paint = gradient;
    }
    context.fillStyle = paint;
    context.strokeStyle = ink.stroke;
    context.lineWidth = ink.strokeWidth;
    context.lineJoin = "round";
    layout.lines.forEach((line, index) => {
      if (!line) return;
      const y = layout.positions[index].y - element.height / 2;
      const x = layout.positions[index].x - element.width / 2;
      if (ink.strokeWidth > 0) context.strokeText(line, x, y);
      context.fillText(line, x, y);
    });
    context.restore();
  }
}

export async function composeScenePng(storyboard: StoryboardDocument, sceneBlob: Blob): Promise<Blob> {
  const sceneUrl = URL.createObjectURL(sceneBlob);
  try {
    const scene = await loadImage(sceneUrl);
    const canvas = window.document.createElement("canvas");
    canvas.width = storyboard.width;
    canvas.height = storyboard.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("캔버스를 생성하지 못했습니다.");
    const rect = fitImageRect(scene.naturalWidth, scene.naturalHeight, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(scene, rect.x, rect.y, rect.width, rect.height);
    await drawStoryboardOverlays(context, storyboard);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("최종 이미지 합성에 실패했습니다.")), "image/png"));
  } finally {
    URL.revokeObjectURL(sceneUrl);
  }
}

export function resizeStoryboard(document: StoryboardDocument, aspectRatio: PanelAspectRatio): StoryboardDocument {
  const dimensions = storyboardDimensions(aspectRatio);
  const rect = fitImageRect(document.width, document.height, dimensions.width, dimensions.height);
  const scale = rect.width / document.width;
  const previous = webtoonFlowLayout(document), next = webtoonFlowLayout({ ...document, ...dimensions });
  const oldArtScale = previous.art.width / document.width, newArtScale = next.art.width / dimensions.width;
  const resizeFreeOverlay = (element: StoryboardElement) => {
    const center = element.y + element.height / 2;
    let updated: StoryboardElement;
    if (center < previous.art.y || center > previous.art.y + previous.art.height) {
      updated = { ...element, x: element.x * dimensions.width / document.width,
        y: center < previous.art.y ? element.y : element.y + next.art.y + next.art.height - previous.art.y - previous.art.height };
    } else {
      const letterScale = scale * newArtScale / oldArtScale;
      updated = { ...element,
        x: next.art.x + rect.x * newArtScale + (element.x - previous.art.x) * letterScale,
        y: next.art.y + rect.y * newArtScale + (element.y - previous.art.y) * letterScale,
        width: element.width * letterScale, height: element.height * letterScale,
        ...(element.fontSize === undefined ? {} : { fontSize: element.fontSize * letterScale }),
      };
    }
    return updated;
  };
  return {
    ...document, aspectRatio, ...dimensions,
    elements: document.elements.map((element) => element.placement === "canvas" && isOverlayElement(element) ? resizeFreeOverlay(element) : ({
      ...element,
      x: rect.x + element.x * scale, y: rect.y + element.y * scale,
      width: element.width * scale, height: element.height * scale,
      ...(element.fontSize !== undefined ? { fontSize: element.fontSize * scale } : {}),
    })),
  };
}
