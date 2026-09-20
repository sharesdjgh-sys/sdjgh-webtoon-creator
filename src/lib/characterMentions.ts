export type NamedCharacter = { id: string; name: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function cleanCharacterMentions(text: string, characters: NamedCharacter[]): string {
  let cleaned = text;
  for (const character of characters) {
    if (!character.id || !character.name) continue;
    const id = escapeRegExp(character.id);
    const name = escapeRegExp(character.name);
    cleaned = cleaned
      .replace(new RegExp(`${name}\\s*\\(\\s*${id}\\s*\\)`, "gi"), character.name)
      .replace(new RegExp(`\\(\\s*${id}\\s*\\)`, "gi"), "")
      .replace(new RegExp(id, "gi"), character.name);
  }
  return cleaned
    .replace(/\(\s*character-[a-z0-9-]+\s*\)/gi, "")
    .replace(/\bcharacter-[a-z0-9-]+\b/gi, "등장인물")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?，。！？])/g, "$1")
    .trim();
}
