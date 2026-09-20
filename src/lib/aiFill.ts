export type FillMode = "missing" | "replace";

export function textFields(source: object, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map(key => [key, String((source as Record<string, unknown>)[key] ?? "")]));
}

/** Only requested text fields are writable. Edits made during a request always win. */
export function mergeAiFields<T extends object>(current: T, before: Record<string, string>, draft: Record<string, string>, mode: FillMode): T {
  const next = { ...current } as T & Record<string, unknown>;
  for (const key of Object.keys(before)) {
    const now = (current as Record<string, unknown>)[key] ?? "";
    if (now !== before[key] || (mode === "missing" && String(now).trim())) continue;
    if (typeof draft[key] === "string") Object.assign(next, { [key]: draft[key] });
  }
  return next;
}
