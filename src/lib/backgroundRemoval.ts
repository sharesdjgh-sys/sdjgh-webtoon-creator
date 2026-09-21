/**
 * Matte a monochrome subject against a green screen without deleting white skin.
 * Unmix green edge pixels against grayscale artwork to avoid a green fringe.
 * Refuse an unrecognized screen rather than silently erasing white artwork.
 */
export function removeGreenScreen(data: Uint8ClampedArray, width: number, height: number): void {
  if (data.length !== width * height * 4 || !width || !height) throw new Error("Invalid RGBA dimensions");
  let green = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 1] - Math.max(data[i], data[i + 2]) > 100 && data[i + 3] > 0) green++;
  }
  if (green < width * height * 0.01) throw new Error("AI가 배경 분리용 녹색 화면을 만들지 않았습니다. 기존 그림은 유지됩니다. 해당 레이어를 다시 생성해주세요.");
  for (let i = 0; i < data.length; i += 4) {
    const spill = data[i + 1] - Math.max(data[i], data[i + 2]);
    if (spill <= 12) continue;
    const alpha = Math.max(0, 1 - spill / 255);
    const gray = alpha > 0 ? Math.min(255, (data[i] + data[i + 2]) / (2 * alpha)) : 0;
    data[i] = data[i + 1] = data[i + 2] = gray;
    data[i + 3] = Math.round(data[i + 3] * alpha);
  }
}

/**
 * Remove only neutral white pixels connected to the image border.
 * Enclosed whites (skin, clothing, prop surfaces) remain opaque.
 * This is a conservative matte, not semantic segmentation.
 */
export function removeExteriorWhite(data: Uint8ClampedArray, width: number, height: number): void {
  if (data.length !== width * height * 4) throw new Error("Invalid RGBA dimensions");
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0, tail = 0;
  const enqueue = (pixel: number) => {
    if (visited[pixel]) return;
    visited[pixel] = 1;
    const i = pixel * 4;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    if (data[i + 3] === 0 || (min > 224 && max - min < 22)) queue[tail++] = pixel;
  };
  if (!width || !height) return;
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width), i = pixel * 4;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    data[i + 3] = Math.min(data[i + 3], Math.round(255 * (255 - min) / 31));
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }
}
