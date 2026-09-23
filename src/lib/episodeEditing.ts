import type { Episode } from "@/lib/storage";

export function removeEpisode(episodes: Episode[], index: number) {
  if (episodes.length <= 1 || !Number.isInteger(index) || index < 0 || index >= episodes.length) return null;
  const remaining = episodes.filter((_, current) => current !== index)
    .map((episode, current) => ({ ...episode, episodeNumber: current + 1 }));
  return { episodes: remaining, activeIndex: Math.min(index, remaining.length - 1) };
}
