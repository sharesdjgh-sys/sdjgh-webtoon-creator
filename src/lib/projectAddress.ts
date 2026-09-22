/** Stable public aliases; media and storage continue to use the original IDs. */
export function ensureProjectAddresses<T extends { id: string; shortId?: string }>(projects: T[]): T[] {
  const used = new Set(projects.map(p => p.id));
  const owners = new Map<string, string>();
  for (const p of projects) {
    if (p.shortId && /^[a-z0-9]{8}$/.test(p.shortId) && !used.has(p.shortId) && !owners.has(p.shortId)) owners.set(p.shortId, p.id);
  }
  for (const alias of owners.keys()) used.add(alias);
  return projects.map(p => {
    if (p.shortId && owners.get(p.shortId) === p.id) return p;
    let alias: string;
    do { alias = crypto.randomUUID().replaceAll("-", "").slice(0, 8); } while (used.has(alias));
    used.add(alias);
    return { ...p, shortId: alias };
  });
}
