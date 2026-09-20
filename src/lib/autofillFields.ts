import { z } from "zod";

export const visualProfileSchema = z.object({
  gender: z.string().trim().min(1).max(500), heightBuild: z.string().trim().min(1).max(500),
  faceShape: z.string().trim().min(1).max(500), eyes: z.string().trim().min(1).max(500),
  noseMouth: z.string().trim().min(1).max(500), skinTone: z.string().trim().min(1).max(500),
  hair: z.string().trim().min(1).max(500), distinctiveFeatures: z.string().trim().min(1).max(500),
  outfit: z.string().trim().min(1).max(500), shoes: z.string().trim().min(1).max(500),
  accessories: z.string().trim().min(1).max(500), colorPalette: z.string().trim().min(1).max(500),
});
export const worldDraftSchema = z.object({
  era: z.string().trim().min(1).max(3000), mainLocation: z.string().trim().min(1).max(3000),
  possible: z.string().trim().min(1).max(3000), forbidden: z.string().trim().min(1).max(3000),
  cost: z.string().trim().min(1).max(3000), locations: z.string().trim().min(1).max(3000),
  props: z.string().trim().min(1).max(3000), undecided: z.string().max(3000),
  foreshadowing: z.string().trim().min(1).max(3000),
});
export const episodePlanSchema = z.object({
  title: z.string().trim().min(1).max(200), synopsis: z.string().trim().min(1).max(3000),
  goal: z.string().trim().min(1).max(3000), obstacle: z.string().trim().min(1).max(3000),
  turningPoint: z.string().trim().min(1).max(3000), endingHook: z.string().trim().min(1).max(3000),
});
export const authorNoteSchema = z.object({ authorNote: z.string().trim().min(1).max(5000) });
export function stringObjectSchema(keys: string[]) {
  return { type: "object", properties: Object.fromEntries(keys.map(key => [key, { type: "string" }])), required: keys, additionalProperties: false };
}
export const visualProfileJsonSchema = stringObjectSchema(Object.keys(visualProfileSchema.shape));
export const episodePlanJsonSchema = stringObjectSchema(Object.keys(episodePlanSchema.shape));
