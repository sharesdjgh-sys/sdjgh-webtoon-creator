import type { PanelAspectRatio, StoryboardDocument, StoryboardElement, StoryboardElementType, WebtoonFontFamily } from "@/lib/storage";
import { resolveCharacterRig } from "@/lib/storyboardRig";

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
  return {
    "4:3": { width: 1200, height: 900 },
    "3:4": { width: 900, height: 1200 },
    "1:1": { width: 1000, height: 1000 },
    "9:16": { width: 900, height: 1600 },
  }[aspectRatio];
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
  return lines.slice(0, 10);
}

function svgText(element: StoryboardElement, fontSize: number, weight = 600): string {
  const resolvedFontSize = element.fontSize ?? fontSize;
  const resolvedWeight = element.fontWeight ?? weight;
  const fontFamily = webtoonFontStack(element.fontFamily ?? defaultWebtoonFont(element.type));
  const lines = storyboardTextLines(element.text, Math.max(5, Math.floor(element.width / (resolvedFontSize * 0.72))));
  const startY = element.height / 2 - ((lines.length - 1) * resolvedFontSize * 0.6);
  return `<text x="${element.width / 2}" y="${startY}" text-anchor="middle" dominant-baseline="middle" font-family="${fontFamily}" font-size="${resolvedFontSize}" font-weight="${resolvedWeight}" fill="#222">${lines.map((line, index) => `<tspan x="${element.width / 2}" dy="${index === 0 ? 0 : resolvedFontSize * 1.2}">${escapeXml(line)}</tspan>`).join("")}</text>`;
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
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, width = limb) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#5B21B6" stroke-width="${width}" stroke-linecap="round"/>`;
  return `${line(head, neck, limb * 0.7)}
    ${line(leftShoulder, leftElbow)}${line(leftElbow, leftHand, limb * 0.82)}
    ${line(rightShoulder, rightElbow)}${line(rightElbow, rightHand, limb * 0.82)}
    ${line(leftHip, leftKnee, limb * 1.15)}${line(leftKnee, leftFoot, limb)}
    ${line(rightHip, rightKnee, limb * 1.15)}${line(rightKnee, rightFoot, limb)}
    <polygon points="${leftShoulder.x},${leftShoulder.y} ${rightShoulder.x},${rightShoulder.y} ${rightHip.x},${rightHip.y} ${leftHip.x},${leftHip.y}" fill="#EDE9FE" stroke="#5B21B6" stroke-width="${Math.max(4, limb * 0.45)}" stroke-linejoin="round"/>
    <ellipse cx="${head.x}" cy="${head.y}" rx="${radius * 0.82}" ry="${radius}" fill="#fff" stroke="#5B21B6" stroke-width="${Math.max(4, limb * 0.45)}"/>
    <path d="M ${head.x} ${head.y + radius * 0.2} Q ${head.x + radius * 0.35} ${head.y + radius * 0.35} ${head.x + radius * 0.55} ${head.y + radius * 0.08}" fill="none" stroke="#7C3AED" stroke-width="${Math.max(2, limb * 0.25)}" stroke-linecap="round"/>
    <circle cx="${leftHand.x}" cy="${leftHand.y}" r="${limb * 0.62}" fill="#fff" stroke="#5B21B6" stroke-width="${Math.max(3, limb * 0.35)}"/>
    <circle cx="${rightHand.x}" cy="${rightHand.y}" r="${limb * 0.62}" fill="#fff" stroke="#5B21B6" stroke-width="${Math.max(3, limb * 0.35)}"/>
    <line x1="${leftFoot.x - limb}" y1="${leftFoot.y}" x2="${leftFoot.x + limb * 1.2}" y2="${leftFoot.y}" stroke="#5B21B6" stroke-width="${limb * 0.8}" stroke-linecap="round"/>
    <line x1="${rightFoot.x - limb}" y1="${rightFoot.y}" x2="${rightFoot.x + limb * 1.2}" y2="${rightFoot.y}" stroke="#5B21B6" stroke-width="${limb * 0.8}" stroke-linecap="round"/>
    <rect x="${Math.max(0, head.x - element.width * 0.24)}" y="0" width="${element.width * 0.48}" height="28" rx="10" fill="#5B21B6"/>
    <text x="${head.x}" y="15" text-anchor="middle" dominant-baseline="middle" font-family="Pretendard, sans-serif" font-size="16" font-weight="700" fill="#fff">${escapeXml(element.text || "캐릭터")}</text>`;
}

function elementMarkup(element: StoryboardElement): string {
  const transform = `translate(${element.x} ${element.y}) rotate(${element.rotation} ${element.width / 2} ${element.height / 2})`;
  let content = "";
  if (element.type === "character") {
    content = characterMarkup(element);
  } else if (element.type === "speech") {
    content = `<ellipse cx="${element.width / 2}" cy="${element.height / 2}" rx="${Math.max(1, element.width / 2 - 3)}" ry="${Math.max(1, element.height / 2 - 3)}" fill="#fff" stroke="#171717" stroke-width="4"/><path d="M ${element.width * 0.35} ${element.height * 0.86} L ${element.width * 0.22} ${element.height + 18} L ${element.width * 0.48} ${element.height * 0.91}" fill="#fff" stroke="#171717" stroke-width="4" stroke-linejoin="round"/>${svgText(element, Math.max(16, Math.min(30, element.height / 5)))}`;
  } else if (element.type === "caption") {
    content = `<rect width="${element.width}" height="${element.height}" rx="8" fill="#fff" stroke="#171717" stroke-width="4"/>${svgText(element, Math.max(16, Math.min(28, element.height / 4)))}`;
  } else if (element.type === "sfx") {
    const fontSize = element.fontSize ?? Math.max(28, Math.min(72, element.height * 0.65));
    const fontWeight = element.fontWeight ?? 900;
    const fontFamily = webtoonFontStack(element.fontFamily ?? "impact");
    const lines = storyboardTextLines(element.text || "효과음", Math.max(3, Math.floor(element.width / (fontSize * 0.72))));
    const startY = element.height / 2 - ((lines.length - 1) * fontSize * 0.6);
    content = `<text x="${element.width / 2}" y="${startY}" text-anchor="middle" dominant-baseline="middle" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="italic" fill="#171717" stroke="#fff" stroke-width="5" paint-order="stroke">${lines.map((line, index) => `<tspan x="${element.width / 2}" dy="${index === 0 ? 0 : fontSize * 1.2}">${escapeXml(line || " ")}</tspan>`).join("")}</text>`;
  } else if (element.type === "arrow") {
    content = `<line x1="8" y1="${element.height / 2}" x2="${Math.max(12, element.width - 18)}" y2="${element.height / 2}" stroke="#C2410C" stroke-width="7"/><path d="M ${element.width - 24} ${element.height / 2 - 16} L ${element.width - 4} ${element.height / 2} L ${element.width - 24} ${element.height / 2 + 16}" fill="none" stroke="#C2410C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    const shape = element.shape === "ellipse"
      ? `<ellipse cx="${element.width / 2}" cy="${element.height / 2}" rx="${element.width / 2 - 3}" ry="${element.height / 2 - 3}" fill="#F4F1EC" stroke="#7A7067" stroke-width="4" stroke-dasharray="12 8"/>`
      : `<rect width="${element.width}" height="${element.height}" rx="12" fill="#F4F1EC" stroke="#7A7067" stroke-width="4" stroke-dasharray="12 8"/>`;
    content = `${shape}${svgText(element, Math.max(16, Math.min(28, element.height / 4)))}`;
  }
  return `<g transform="${transform}" data-element-id="${escapeXml(element.id)}">${content}</g>`;
}

export function storyboardToSvg(
  document: StoryboardDocument,
  options: { overlaysOnly?: boolean; transparent?: boolean } = {},
): string {
  const elements = document.elements
    .filter((element) => !options.overlaysOnly || isOverlayElement(element))
    .sort((left, right) => left.zIndex - right.zIndex);
  const background = options.transparent ? "" : `<rect width="100%" height="100%" fill="#FBF9F6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">${background}${elements.map(elementMarkup).join("")}</svg>`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = source;
  });
}

export async function svgToPngBlob(storyboard: StoryboardDocument): Promise<Blob> {
  const svg = storyboardToSvg(storyboard);
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

export async function composeScenePng(storyboard: StoryboardDocument, sceneBlob: Blob): Promise<Blob> {
  const sceneUrl = URL.createObjectURL(sceneBlob);
  const overlaySvg = storyboardToSvg(storyboard, { overlaysOnly: true, transparent: true });
  const overlayUrl = URL.createObjectURL(new Blob([overlaySvg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const [scene, overlay] = await Promise.all([loadImage(sceneUrl), loadImage(overlayUrl)]);
    const canvas = window.document.createElement("canvas");
    canvas.width = storyboard.width;
    canvas.height = storyboard.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("캔버스를 생성하지 못했습니다.");
    context.drawImage(scene, 0, 0, canvas.width, canvas.height);
    context.drawImage(overlay, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("최종 이미지 합성에 실패했습니다.")), "image/png"));
  } finally {
    URL.revokeObjectURL(sceneUrl);
    URL.revokeObjectURL(overlayUrl);
  }
}
