import type { StoryboardDocument } from "@/lib/storage";

export function pendingLayerIds(document: StoryboardDocument, staleIds: Set<string>): string[] {
  return document.elements.filter(layer =>
    layer.visible !== false && ["background", "character", "prop"].includes(layer.type)
    && (!layer.assetId || staleIds.has(layer.id))
  ).map(layer => layer.id);
}

/** One request per target; failures never trigger automatic paid retries. */
export async function runLayerBatch(
  ids: string[],
  generate: (id: string) => Promise<boolean>,
  onProgress: (completed: number, total: number) => void,
  cancelled: () => boolean,
) {
  const targets = [...new Set(ids)];
  const failed: string[] = [];
  let succeeded = 0, completed = 0;
  onProgress(0, targets.length);
  for (const id of targets) {
    if (cancelled()) break;
    try {
      if (await generate(id)) succeeded++;
      else failed.push(id);
    } catch { failed.push(id); }
    completed++;
    onProgress(completed, targets.length);
  }
  return { succeeded, failed, remaining: targets.length - completed };
}
