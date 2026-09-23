/** Shared persistence, AI and editor vocabulary. Existing values remain valid. */
export const BALLOON_STYLES = ["normal", "thought", "shout", "whisper", "rounded", "none", "radiant", "burst", "rough", "broadcast", "connected"] as const;
export const PANEL_RATIOS = ["4:3", "3:4", "1:1", "9:16", "4:1", "1:4", "1:8"] as const;
export const SPEECH_ROLES = ["dialogue", "thought", "narration", "broadcast"] as const;
export function panelDimensions(ratio: typeof PANEL_RATIOS[number]) {
  return { "4:3": { width: 1200, height: 900 }, "3:4": { width: 900, height: 1200 },
    "1:1": { width: 1000, height: 1000 }, "9:16": { width: 900, height: 1600 },
    "4:1": { width: 1200, height: 300 }, "1:4": { width: 900, height: 3600 }, "1:8": { width: 900, height: 7200 } }[ratio];
}
