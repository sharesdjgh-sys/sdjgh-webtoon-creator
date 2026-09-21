import type { StoryboardElement } from "@/lib/storage";
import { fitOverlayToCanvas } from "@/lib/storyboardText";

export const RESIZE_HANDLES = [
  { direction: "nw", x: 0, y: 0, label: "왼쪽 위" },
  { direction: "n", x: .5, y: 0, label: "위" },
  { direction: "ne", x: 1, y: 0, label: "오른쪽 위" },
  { direction: "e", x: 1, y: .5, label: "오른쪽" },
  { direction: "se", x: 1, y: 1, label: "오른쪽 아래" },
  { direction: "s", x: .5, y: 1, label: "아래" },
  { direction: "sw", x: 0, y: 1, label: "왼쪽 아래" },
  { direction: "w", x: 0, y: .5, label: "왼쪽" },
] as const;
export type ResizeDirection = typeof RESIZE_HANDLES[number]["direction"];

/** Screen delta -> rotated local axes, keeping the opposite edge/corner anchored. */
export function resizeOverlay(element: StoryboardElement, direction: ResizeDirection, dx: number, dy: number, canvasWidth: number, canvasHeight: number): StoryboardElement {
  const radians = element.rotation * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const localX = dx * cos + dy * sin, localY = -dx * sin + dy * cos;
  const candidate = (fraction: number) => {
    const left = direction.includes("w") ? Math.min(localX * fraction, element.width - Math.min(50, element.width)) : 0;
    const right = direction.includes("e") ? Math.max(localX * fraction, Math.min(50, element.width) - element.width) : 0;
    const top = direction.includes("n") ? Math.min(localY * fraction, element.height - Math.min(40, element.height)) : 0;
    const bottom = direction.includes("s") ? Math.max(localY * fraction, Math.min(40, element.height) - element.height) : 0;
    const width = element.width + right - left, height = element.height + bottom - top;
    const shiftX = (left + right) / 2, shiftY = (top + bottom) / 2;
    return {
      ...element, width, height,
      x: element.x + element.width / 2 + shiftX * cos - shiftY * sin - width / 2,
      y: element.y + element.height / 2 + shiftX * sin + shiftY * cos - height / 2,
    };
  };
  const fits = (next: StoryboardElement) => {
    const fitted = fitOverlayToCanvas(next, canvasWidth, canvasHeight);
    return Math.abs(fitted.x - next.x) + Math.abs(fitted.y - next.y) + Math.abs(fitted.width - next.width) + Math.abs(fitted.height - next.height) < 0.000001;
  };
  const full = candidate(1);
  if (fits(full)) return full;
  let low = 0, high = 1;
  for (let i = 0; i < 28; i++) {
    const middle = (low + high) / 2;
    if (fits(candidate(middle))) low = middle;
    else high = middle;
  }
  return candidate(low);
}

export function resizeCursor(direction: ResizeDirection, rotation: number): string {
  const handle = RESIZE_HANDLES.find(item => item.direction === direction)!;
  const angle = Math.atan2(handle.y - .5, handle.x - .5) * 180 / Math.PI + rotation;
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][((Math.round(angle / 45) % 4) + 4) % 4];
}
