import { z } from "zod";
export const sceneDirectionSchema = z.object({
  beat: z.enum(["quiet", "anticipation", "movement", "impact", "aftermath", "reveal"]),
  acting: z.string().max(1200), lighting: z.string().max(1200), effects: z.string().max(1200),
  continuity: z.string().max(1200), readingPath: z.string().max(1200),
});
export const SCENE_DIRECTION_JSON = {
  type: "object", properties: {
    beat: { type: "string", enum: ["quiet", "anticipation", "movement", "impact", "aftermath", "reveal"] },
    ...Object.fromEntries(["acting", "lighting", "effects", "continuity", "readingPath"].map(key => [key, { type: "string" }])),
  }, required: ["beat", "acting", "lighting", "effects", "continuity", "readingPath"],
} as const;
