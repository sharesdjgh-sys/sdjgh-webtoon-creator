import type { PanelAspectRatio } from "@/lib/storage";

export function fitImageRect(sourceWidth: number, sourceHeight: number, width: number, height: number, fit: "contain" | "cover" = "contain") {
  if (![sourceWidth, sourceHeight, width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("이미지와 컷의 크기는 양수여야 합니다.");
  }
  const scale = Math[fit === "cover" ? "max" : "min"](width / sourceWidth, height / sourceHeight);
  const fittedWidth = sourceWidth * scale;
  const fittedHeight = sourceHeight * scale;
  return { x: (width - fittedWidth) / 2, y: (height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight };
}

export function matchesPanelRatio(width: number, height: number, ratio: PanelAspectRatio): boolean {
  const [x, y] = ratio.split(":").map(Number);
  // Native model dimensions are rounded; allow 2% without accepting a different panel shape.
  return width > 0 && height > 0 && Math.abs((width / height) / (x / y) - 1) <= 0.02;
}

export async function validatePanelImage(blob: Blob, ratio: PanelAspectRatio): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("AI 장면 이미지를 읽지 못했습니다. 다시 생성해주세요."));
      image.src = url;
    });
    if (!matchesPanelRatio(image.naturalWidth, image.naturalHeight, ratio)) {
      throw new Error(`AI 응답 이미지(${image.naturalWidth}×${image.naturalHeight})가 선택한 ${ratio} 비율과 다릅니다. 기존 그림은 유지됩니다. 다시 생성해주세요.`);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
