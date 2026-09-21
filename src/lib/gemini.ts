import "server-only";
import { artworkOnlyStoryboard, sceneStructureSvg } from "@/lib/cleanGeneration";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { CharacterRig, PanelAspectRatio, StoryboardDocument, StoryboardElement } from "@/lib/storage";
import { resolveCharacterRig, sceneCharacterRig } from "@/lib/storyboardRig";
import { webtoonShotPrompt } from "@/lib/webtoonShots";
import { cleanCharacterMentions } from "@/lib/characterMentions";
import { normalizeWebtoonFlow } from "@/lib/webtoonFlow";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
const LAYOUT_MODEL = process.env.GEMINI_LAYOUT_MODEL ?? "gemini-3.8-flash";

export const artDirectionSchema = z.object({
  preset: z.enum(["clean-webtoon", "romance-watercolor", "action-contrast", "dark-noir", "pencil-sketch"]),
  custom: z.string().trim().max(600).default(""),
});

export const characterInputSchema = z.object({
  id: z.string().max(120),
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(50),
  age: z.string().trim().max(50),
  appearance: z.string().trim().max(1_500),
  personality: z.string().trim().max(1_000),
  backstory: z.string().trim().max(1_500),
  visualProfile: z.object({
    gender: z.string().trim().max(100),
    heightBuild: z.string().trim().max(300),
    faceShape: z.string().trim().max(300),
    eyes: z.string().trim().max(300),
    noseMouth: z.string().trim().max(300),
    skinTone: z.string().trim().max(200),
    hair: z.string().trim().max(500),
    distinctiveFeatures: z.string().trim().max(500),
    outfit: z.string().trim().max(800),
    shoes: z.string().trim().max(300),
    accessories: z.string().trim().max(600),
    colorPalette: z.string().trim().max(300),
  }),
  imageInstructions: z.string().trim().max(600).optional().default(""),
});

export const projectVisualContextSchema = z.object({
  title: z.string().trim().max(200),
  genre: z.string().trim().max(100),
  setting: z.string().trim().max(2_000),
  artDirection: artDirectionSchema,
});

const generatedJointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const generatedRigSchema = z.object({
  head: generatedJointSchema,
  neck: generatedJointSchema,
  leftShoulder: generatedJointSchema,
  leftElbow: generatedJointSchema,
  leftHand: generatedJointSchema,
  rightShoulder: generatedJointSchema,
  rightElbow: generatedJointSchema,
  rightHand: generatedJointSchema,
  leftHip: generatedJointSchema,
  rightHip: generatedJointSchema,
  leftKnee: generatedJointSchema,
  leftFoot: generatedJointSchema,
  rightKnee: generatedJointSchema,
  rightFoot: generatedJointSchema,
});

const CHARACTER_RIG_JSON_SCHEMA = {
  type: "object",
  properties: Object.fromEntries([
    "head", "neck", "leftShoulder", "leftElbow", "leftHand", "rightShoulder", "rightElbow", "rightHand",
    "leftHip", "rightHip", "leftKnee", "leftFoot", "rightKnee", "rightFoot",
  ].map((joint) => [joint, {
    type: "object",
    properties: { x: { type: "number" }, y: { type: "number" } },
    required: ["x", "y"],
  }])),
  required: [
    "head", "neck", "leftShoulder", "leftElbow", "leftHand", "rightShoulder", "rightElbow", "rightHand",
    "leftHip", "rightHip", "leftKnee", "leftFoot", "rightKnee", "rightFoot",
  ],
} as const;

const generatedElementSchema = z.object({
  id: z.string().max(100).optional(),
  type: z.enum(["character", "prop", "shape", "arrow", "speech", "caption", "sfx"]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().optional().default(0),
  zIndex: z.number().optional().default(0),
  text: z.string().max(500).optional().default(""),
  characterId: z.string().max(120).optional(),
  shape: z.enum(["rect", "ellipse"]).optional(),
  pose: z.string().max(200).optional(),
  expression: z.string().max(200).optional(),
  characterRig: generatedRigSchema.optional(),
  balloonStyle: z.enum(["normal", "thought", "shout", "whisper", "rounded", "none"]).optional(),
  tailX: z.number().optional(),
  tailY: z.number().optional(),
  speakerCharacterId: z.string().max(120).optional(),
  placement: z.enum(["art", "before", "after", "top-edge", "bottom-edge"]).optional(),
  flowOrder: z.number().optional(),
  flowSpacing: z.number().optional(),
});

const generatedDocumentSchema = z.object({
  backgroundDescription: z.string().trim().max(900).optional(),
  flow: z.object({ before: z.number(), after: z.number(), inset: z.number(), align: z.enum(["left", "center", "right"]) }).optional(),
  elements: z.array(generatedElementSchema).min(1).max(24),
});

const STORYBOARD_JSON_SCHEMA = {
  type: "object",
  properties: {
    backgroundDescription: { type: "string", description: "Korean environment art direction: concrete location, camera perspective/horizon, near/middle/far depth, architecture or landscape, visible furniture/fixtures, light source, time and atmosphere. Describe drawable details, not a short label. Maximum 900 characters." },
    flow: {
      type: "object", description: "Vertical reading rhythm outside the artwork. Whitespace is composed by the app, never drawn into the image.",
      properties: { before: { type: "number", minimum: 0, maximum: 300, description: "Whitespace above, default 150 pixels; maximum 300" }, after: { type: "number", minimum: 0, maximum: 300, description: "Whitespace below, default 150 pixels; maximum 300" }, inset: { type: "number", description: "Half the space left beside the art: 0..35% of canvas width. Vary art width to suit this beat." }, align: { type: "string", enum: ["left", "center", "right"] } },
      required: ["before", "after", "inset", "align"],
    },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["character", "prop", "shape", "arrow", "speech", "caption", "sfx"] },
          x: { type: "number", description: "Left coordinate in the provided SVG viewBox" },
          y: { type: "number", description: "Top coordinate in the provided SVG viewBox" },
          width: { type: "number" },
          height: { type: "number" },
          rotation: { type: "number" },
          zIndex: { type: "integer" },
          text: { type: "string" },
          characterId: { type: "string" },
          shape: { type: "string", enum: ["rect", "ellipse"] },
          pose: { type: "string" },
          expression: { type: "string" },
          characterRig: {
            type: "object",
            description: "Normalized 0..1 joint positions inside the character bounding box. Required for character elements.",
            properties: Object.fromEntries([
              "head", "neck", "leftShoulder", "leftElbow", "leftHand", "rightShoulder", "rightElbow", "rightHand",
              "leftHip", "rightHip", "leftKnee", "leftFoot", "rightKnee", "rightFoot",
            ].map((joint) => [joint, {
              type: "object",
              properties: { x: { type: "number" }, y: { type: "number" } },
              required: ["x", "y"],
            }])),
            required: [
              "head", "neck", "leftShoulder", "leftElbow", "leftHand", "rightShoulder", "rightElbow", "rightHand",
              "leftHip", "rightHip", "leftKnee", "leftFoot", "rightKnee", "rightFoot",
            ],
          },
          balloonStyle: { type: "string", enum: ["normal", "thought", "shout", "whisper", "rounded", "none"] },
          placement: { type: "string", enum: ["art", "before", "after", "top-edge", "bottom-edge"], description: "Vertical-webtoon lettering location. Prefer before/after whitespace or top-edge/bottom-edge for dialogue. Art is for SFX or intentional unobstructive placement only." },
          flowOrder: { type: "number", description: "Top-to-bottom reading order of lettering within its whitespace region" },
          flowSpacing: { type: "number", description: "Extra whitespace before this line of dialogue or narration, 0..1200 pixels" },
          tailX: { type: "number", description: "Speech-tail endpoint x in local normalized coordinates; 0..1 is inside the balloon" },
          tailY: { type: "number", description: "Speech-tail endpoint y in local normalized coordinates; 0..1 is inside the balloon" },
          speakerCharacterId: { type: "string", description: "Exact selected cast ID of the speaker" },
        },
        required: ["type", "x", "y", "width", "height", "rotation", "zIndex", "text"],
      },
    },
  },
  required: ["backgroundDescription", "flow", "elements"],
} as const;

export type CharacterVisualInput = z.infer<typeof characterInputSchema>;
export type ProjectVisualContext = z.infer<typeof projectVisualContextSchema>;
type CharacterReferenceInput = {
  character: CharacterVisualInput;
  data: string;
  mimeType: string;
  heroData: string;
  heroMimeType: string;
};

const STYLE_DESCRIPTIONS: Record<z.infer<typeof artDirectionSchema>["preset"], string> = {
  "clean-webtoon": "clean Korean webtoon line art, polished cel shading, readable silhouette, contemporary digital comic finish",
  "romance-watercolor": "romance webtoon aesthetic, delicate line art, soft watercolor-like color transitions, luminous gentle atmosphere",
  "action-contrast": "dynamic action webtoon aesthetic, confident angular ink lines, dramatic high-contrast cel shading, energetic silhouettes",
  "dark-noir": "dark noir webtoon aesthetic, restrained color palette, bold shadows, cinematic rim light and textured ink lines",
  "pencil-sketch": "professional webtoon pre-production pencil style, expressive clean graphite lines, light monochrome shading",
};

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  return new GoogleGenAI({ apiKey });
}

function artStyle(context: ProjectVisualContext): string {
  const base = STYLE_DESCRIPTIONS[context.artDirection.preset];
  return context.artDirection.custom ? `${base}. Additional art direction: ${context.artDirection.custom}` : base;
}

function identityLock(character: CharacterVisualInput): string {
  const profile = character.visualProfile;
  return `IMMUTABLE IDENTITY for ${character.name}:
- overall approved appearance=${character.appearance || "exactly as shown on the sheet"}
- apparent age=${character.age || "unspecified"}; gender/presentation=${profile.gender || "as shown on the sheet"}; height/build=${profile.heightBuild || "exactly as shown"}
- face/jaw=${profile.faceShape || "exactly as shown"}; eyes=${profile.eyes || "exactly as shown"}; nose/mouth=${profile.noseMouth || "exactly as shown"}; skin=${profile.skinTone || "exactly as shown"}
- hair silhouette/fringe/length/color=${profile.hair || "exactly as shown"}
- fixed distinguishing marks=${profile.distinctiveFeatures || "none beyond the sheet"}
- fixed outfit=${profile.outfit || "the approved sheet outfit"}; shoes=${profile.shoes || "as shown"}; accessories=${profile.accessories || "as shown"}
- fixed palette=${profile.colorPalette || "sample colors directly from the sheet"}
- additional lock=${character.imageInstructions || "none"}`;
}

function imageResult(interaction: { output_image?: { data?: string; mime_type?: string } }): { data: string; mimeType: string } {
  const data = interaction.output_image?.data;
  if (!data) throw new Error("Gemini가 이미지 결과를 반환하지 않았습니다.");
  return { data, mimeType: interaction.output_image?.mime_type ?? "image/jpeg" };
}

export async function detectCharacterRig(image: { data: string; mimeType: string }): Promise<CharacterRig> {
  const interaction = await client().interactions.create({
    model: LAYOUT_MODEL,
    input: [
      { type: "image" as const, mime_type: image.mimeType, data: image.data },
      { type: "text" as const, text: `Analyze the single character in this isolated image and locate the character's actual visible anatomy.
Return all 14 joints as normalized coordinates from 0 to 1 relative to the ENTIRE image: x=0 is the left image edge, x=1 the right edge, y=0 the top edge, y=1 the bottom edge.
Use the character's anatomical left/right, not the viewer's left/right. Put head at the center of the skull/face, neck at its base, shoulders at arm attachment points, hips at leg attachment points, and hands/feet at their visible centers. Infer covered joints from the body silhouette. Follow the artwork exactly; do not return an idealized standing skeleton.` },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: CHARACTER_RIG_JSON_SCHEMA,
    },
  });
  if (!interaction.output_text) throw new Error("생성된 캐릭터의 실제 포즈를 분석하지 못했습니다.");
  return generatedRigSchema.parse(JSON.parse(interaction.output_text));
}

export function buildCharacterSheetPrompt(
  context: ProjectVisualContext,
  character: CharacterVisualInput,
): string {
  const prompt = `Create a premium, studio-ready MASTER CHARACTER DESIGN SHEET for an original serialized webtoon. This is a practical visual bible that a webtoon art team will use to draw the same character consistently across many episodes — not a poster, splash art, or generic portrait.

PROJECT
- Title: ${context.title || "Untitled webtoon"}
- Genre: ${context.genre || "Webtoon"}
- World/setting: ${context.setting || "Not specified"}
- Art direction: ${artStyle(context)}

CHARACTER IDENTITY LOCK — every figure on the sheet must be unmistakably the exact same person
- Name: ${character.name}
- Gender/presentation: ${character.visualProfile.gender || "Infer carefully from the creator's description; do not exaggerate stereotypes"}
- Story role: ${character.role || "Character"}
- Age/school year: ${character.age || "Not specified"}
- Height and body type: ${character.visualProfile.heightBuild || "Infer a distinctive but natural silhouette appropriate to age and role"}
- Appearance: ${character.appearance || "Use a distinctive, production-ready design appropriate for the role"}
- Face shape and jawline: ${character.visualProfile.faceShape || "Derive consistently from the appearance description"}
- Eyes — shape, size and iris color: ${character.visualProfile.eyes || "Design distinctive, readable webtoon eyes and keep them identical in every view"}
- Nose and mouth: ${character.visualProfile.noseMouth || "Natural, repeatable shapes appropriate to the face"}
- Skin tone: ${character.visualProfile.skinTone || "Natural and consistent in every study"}
- Hairstyle — length, fringe, texture and color: ${character.visualProfile.hair || "Derive from the appearance description and show its construction clearly"}
- Distinctive physical features: ${character.visualProfile.distinctiveFeatures || "Use only details supported by the description"}
- Personality translated into posture, habitual gestures, facial tension and body language: ${character.personality || "Natural and readable"}
- Backstory cues that may subtly inform costume or props: ${character.backstory || "None"}
- Default outfit: ${character.visualProfile.outfit || "Create a role-appropriate, memorable but repeatable webtoon outfit"}
- Shoes: ${character.visualProfile.shoes || "Coordinate with the outfit and show clearly in full-body views"}
- Signature accessories and props: ${character.visualProfile.accessories || "Invent one restrained, story-relevant signature item only if useful"}
- Creator-defined color palette: ${character.visualProfile.colorPalette || "Build a coherent palette of 3–5 main colors from the written design"}
- Creator's extra visual direction: ${character.imageInstructions || "None"}

CANVAS AND VISUAL HIERARCHY
- Landscape 3:2 master sheet, high resolution, clean warm-white or very pale neutral studio background.
- Treat the outer 7% of the canvas on every side as a completely empty SAFE MARGIN. No hair, head, hand, foot, clothing, prop, swatch, guide, or detail panel may enter this margin or touch any canvas edge.
- Every study must be a complete self-contained drawing. Never use edge-cropped portrait boxes or detail fragments that continue beyond the canvas.
- Use an orderly professional concept-art grid with generous spacing. No overlapping studies and no cropped hands, feet, hair, clothing or props.
- The large hero figure occupies no more than the left 24%: clear head-to-toe three-quarter standing view in the default outfit, neutral readable pose. Leave visible background above the highest hair strand and below both shoe soles.
- Organize the remaining studies as compact rows inside the safe area: turnaround figures across the upper-middle, face and expression studies in the upper-right, and proportion/accessory/costume/pose studies across an inset lower row.
- If the layout becomes crowded, uniformly scale every study smaller and increase whitespace. Never solve a space problem by cropping, enlarging beyond its cell, overlapping, or pushing artwork against an edge.

MANDATORY STUDIES — include every numbered item on this single sheet
1. Full-body FRONT view in a neutral standing pose.
2. Full-body THREE-QUARTER view that clearly shows face and costume volume.
3. Full-body SIDE profile.
4. Full-body BACK view. Front, side and back must use the same scale, baseline and body proportions.
5. Large FACE FRONT close-up, unobstructed and expression-neutral, useful as the primary facial reference.
6. Large FACE SIDE profile close-up showing forehead, nose, lips, chin, ear and hair silhouette accurately.
7. Six-expression sheet: neutral, gentle smile, open-mouth laugh, anger, sadness, and surprise. Preserve facial structure, eye shape, features and hair exactly.
8. Hair construction studies showing a clear FRONT and BACK view, including fringe division, crown volume, length and tied sections where relevant.
9. Enlarged ACCESSORY AND PROP CALLOUTS: signature jewelry, glasses, bag, weapon, device, footwear or story-relevant personal object. Show attachment points and construction clearly.
10. Enlarged COSTUME AND MATERIAL DETAILS: two or three close-ups for garment layers, closures, seams, pattern, fabric texture, scars, tattoos or unique design features.
11. A clean COLOR PALETTE of six to eight swatches covering skin, hair, eyes, main clothing, accent, footwear and accessories. Match every depiction exactly.
12. A FULL-BODY PROPORTION GUIDE with a simple head-unit guide beside the neutral figure so height, shoulder width, limb length and overall silhouette are easy to reproduce. Do not use written measurements.
13. Three additional STORYTELLING POSES: a signature everyday pose, a dynamic movement/action pose, and a strong emotional/dramatic pose. Make their silhouettes distinct and useful for webtoon panel staging.
14. Two or three HAND/GESTURE studies showing a habitual gesture and how the character holds their key prop.

CONSISTENCY AND PRODUCTION RULES
- Same face, apparent age, body proportions, skin tone, eye color, hairstyle, outfit, accessories and palette across every depiction. Never create alternate people, clones with changed features, or costume redesigns.
- Favor a clear, repeatable webtoon design with a memorable silhouette and details that an artist can reproduce panel after panel.
- Match this project's art direction precisely while keeping construction lines and material separation readable.
- No environment, scenery, finished story panel, cinematic background, decorative frame, manga page layout, logo, watermark, artist signature or extra character.
- Do not render names, headings, captions, measurements, letters or pseudo-text. Separate sections visually using whitespace only; the application will handle any labels.
- Framing priority is absolute: safe margin and fully visible anatomy/props take precedence over making any individual study large. All four canvas edges must remain visibly clear.

Quality check before finishing: inspect the top, bottom, left and right edges. Confirm that the outer safe margin is empty; every head has air above the hair; every standing figure has background below the shoe soles; every seated or action pose, hand, accessory and detail callout is fully enclosed; and nothing appears cut off. Then confirm every required study is present, accessories are readable, and identity consistency is strict. The result must look like a professional webtoon production reference sheet, not an AI image collage.`;

  return prompt;
}

function dimensions(aspectRatio: PanelAspectRatio): { width: number; height: number } {
  return {
    "4:3": { width: 1200, height: 900 },
    "3:4": { width: 900, height: 1200 },
    "1:1": { width: 1000, height: 1000 },
    "9:16": { width: 900, height: 1600 },
  }[aspectRatio];
}

export async function generateCharacterSheet(context: ProjectVisualContext, character: CharacterVisualInput) {
  const prompt = buildCharacterSheetPrompt(context, character);
  const result = await client().interactions.create({
    model: IMAGE_MODEL, input: prompt,
    response_format: { type: "image", mime_type: "image/png", aspect_ratio: "3:2", image_size: "2K" },
  });
  return { ...imageResult(result), prompt };
}

function clampElement(
  element: z.infer<typeof generatedElementSchema>,
  index: number,
  width: number,
  height: number,
  characters: Map<string, string>,
): StoryboardElement {
  const elementWidth = Math.min(Math.max(element.width, 50), width);
  const elementHeight = Math.min(Math.max(element.height, 40), height);
  return {
    ...element,
    id: element.id || `element-${crypto.randomUUID()}`,
    x: Math.min(Math.max(element.x, 0), width - elementWidth),
    y: Math.min(Math.max(element.y, 0), height - elementHeight),
    width: elementWidth,
    height: elementHeight,
    rotation: Math.min(Math.max(element.rotation, -180), 180),
    zIndex: index,
    text: cleanCharacterMentions(element.text, [...characters].map(([id, name]) => ({ id, name }))),
    characterId: element.characterId && characters.has(element.characterId) ? element.characterId : undefined,
    balloonStyle: element.type === "speech" ? (element.balloonStyle ?? "normal") : element.type === "caption" ? (element.balloonStyle ?? "rounded") : undefined,
    placement: element.placement ?? (element.type === "caption" ? "before" : element.type === "speech" ? (element.y < height * .45 ? "before" : "after") : "art"),
    flowOrder: element.flowOrder ?? index * 100,
    flowSpacing: Math.min(1200, Math.max(0, element.flowSpacing ?? 0)),
    tailX: element.type === "speech" ? Math.min(2, Math.max(-1, element.tailX ?? 0.25)) : undefined,
    tailY: element.type === "speech" ? Math.min(2, Math.max(-1, element.tailY ?? 1.22)) : undefined,
    speakerCharacterId: element.type === "speech" && element.speakerCharacterId && characters.has(element.speakerCharacterId)
      ? element.speakerCharacterId
      : undefined,
    visible: true,
    locked: false,
    opacity: 1,
    flipX: false,
  };
}

export async function generateStoryboardLayout(input: {
  context: ProjectVisualContext;
  episode: { number: number; title: string; synopsis: string };
  cut: { angle: string; description: string; dialogue: string; soundEffect: string; aspectRatio: PanelAspectRatio; scrollGap?: "short" | "normal" | "long" };
  characters: CharacterVisualInput[];
}): Promise<StoryboardDocument> {
  const { width, height } = dimensions(input.cut.aspectRatio);
  const cast = input.characters.map((character) =>
    `- ${character.id}: ${character.name} (${character.role}), appearance=${character.appearance}, personality=${character.personality}`
  ).join("\n");
  const prompt = `You are a professional webtoon storyboard artist. Plan ONE editable panel with readable acting AND a concrete, drawable environment.

Canvas viewBox: 0 0 ${width} ${height} (${input.cut.aspectRatio})
Episode ${input.episode.number}: ${input.episode.title}
Episode context: ${input.episode.synopsis}
World setting: ${input.context.setting || "Infer from this scene"}
Camera angle: ${input.cut.angle} — ${webtoonShotPrompt(input.cut.angle)}
Scene: ${input.cut.description || "Infer a clear beat from the episode context"}
Dialogue: ${input.cut.dialogue || "None"}
Sound effect: ${input.cut.soundEffect || "None"}
Scroll pacing: ${input.cut.scrollGap || "normal"}
Selected cast:
${cast || "No named character selected"}

Return a practical SVG scene graph using only the supplied JSON schema.
- Write backgroundDescription in Korean as actual visual art direction, not "background" or a location name alone. Specify camera perspective/horizon, near/middle/far spatial depth, key architecture/landscape, at least three scene-appropriate fixtures/details, lighting direction, time of day and mood. The environment will be DRAWN as a full-canvas background sketch.
- Use the scene and world context to infer a coherent setting when details are sparse. Keep it consistent with the action, and do not introduce unrelated story facts.
- Do not use labeled shape boxes to substitute for walls, windows, furniture or scenery. Put fixed environmental fixtures in backgroundDescription; use prop elements for independently editable interaction objects without duplicating them in the background.
- Keep every element fully inside the canvas.
- Use character elements for blocking people; characterId must exactly match a selected cast ID.
- Every character element must include characterRig with all 14 normalized joints. Build the actual described action and weight balance — sitting must bend hips and knees onto a seat, running must show stride and arm counter-swing, looking back must turn the shoulder line and head. Never fall back to a generic standing pose.
- Use prop, shape, and arrow elements only when they clarify depth, motion, foreground, or background.
- Use speech/caption/sfx elements for exact Korean text; these remain editable overlays.
- Design for a VERTICAL SCROLL WEBTOON, not a printed comic page or four-panel grid. Dialogue belongs primarily in whitespace BEFORE/AFTER the art or lightly across its top/bottom edge. Never cover faces, hands, interaction props, or important scenery. Narration/inner monologue may be separate caption boxes or unboxed text in whitespace; SFX can cross an art boundary. Preserve top-to-bottom reading order. Do not force all speech inside the artwork.
- Plan flow.before/after as reading time: short gaps for quick exchanges, longer gaps for hesitation, silence, time passing or scene transitions. Vary art width with flow.inset and left/center/right alignment where it serves the beat; establishing scenery can be wide, reactions/detail shots can be narrow. Do not mechanically make every image the same width. The art canvas remains fully drawn; the app creates these surrounding spaces. Use flowOrder/flowSpacing to separate monologue beats and dialogue in a natural reading sequence, without changing or inventing the supplied text.
- Both top and bottom whitespace default to 150px and have a HARD 300px maximum. Keep each side's total lettering height plus flowSpacing, 40px between elements and 24px outer padding within 300px. Distribute dialogue between the two sides when needed; never allocate oversized whitespace or clip text.
- For every speech element, choose balloonStyle: normal for ordinary dialogue, thought for inner monologue, shout for yelling, or whisper for quiet/breathing dialogue. Set speakerCharacterId to the exact cast ID and aim tailX/tailY toward that speaker. tail coordinates are local to the balloon: (0,0) top-left, (1,1) bottom-right, and may extend outside the box.
- text for character and prop elements is a short Korean label. Include concise pose and expression notes for characters.
- Avoid overlaps that obscure faces or key action. Keep 10% safe margins for text.
- zIndex must describe back-to-front order.`;

  const interaction = await client().interactions.create({
    model: LAYOUT_MODEL,
    input: prompt,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: STORYBOARD_JSON_SCHEMA,
    },
  });
  if (!interaction.output_text) throw new Error("Gemini가 콘티 구성을 반환하지 않았습니다.");
  const parsed = generatedDocumentSchema.parse(JSON.parse(interaction.output_text));
  const characterNames = new Map(input.characters.map((character) => [character.id, character.name]));
  return {
    version: 2,
    aspectRatio: input.cut.aspectRatio,
    width,
    height,
    flow: { ...normalizeWebtoonFlow(parsed.flow),
      inset: Math.min(width * .35, Math.max(0, parsed.flow?.inset ?? 0)), align: parsed.flow?.align ?? "center" },
    elements: [
      {
        id: `background-${crypto.randomUUID()}`,
        type: "background",
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        zIndex: -100,
        text: parsed.backgroundDescription || [input.cut.description, input.context.setting, `카메라: ${input.cut.angle}. 전경·중경·원경, 공간 구조와 주요 시설, 광원과 명암이 읽히는 배경 스케치.`].filter(Boolean).join("\n").slice(0, 900),
        visible: true,
        locked: true,
        opacity: 1,
        flipX: false,
      },
      ...parsed.elements.map((element, index) => clampElement(element, index, width, height, characterNames)),
    ],
  };
}

function layerAspectRatio(layer: StoryboardElement, fallback: PanelAspectRatio): PanelAspectRatio {
  if (layer.type === "background") return fallback;
  const ratio = layer.width / layer.height;
  if (ratio < 0.68) return "9:16";
  if (ratio < 0.9) return "3:4";
  if (ratio > 1.18) return "4:3";
  return "1:1";
}

export async function generateStoryboardLayer(input: {
  context: ProjectVisualContext;
  episode: { number: number; title: string; synopsis: string };
  cut: { angle: string; description: string; dialogue: string; soundEffect: string; aspectRatio: PanelAspectRatio };
  storyboard: StoryboardDocument;
  layerId: string;
  layoutImage: { data: string; mimeType: string };
  references: CharacterReferenceInput[];
  poseReference?: { data: string; mimeType: string };
}): Promise<{ data: string; mimeType: string; prompt: string; characterRig?: CharacterRig }> {
  const layer = input.storyboard.elements.find((element) => element.id === input.layerId);
  if (!layer || !["background", "character", "prop"].includes(layer.type)) throw new Error("생성할 콘티 레이어를 찾지 못했습니다.");
  const reference = layer.type === "character"
    ? input.references.find(({ character }) => character.id === layer.characterId)
    : undefined;
  if (layer.type === "character" && !reference) {
    throw new Error(`${layer.text || "선택한 캐릭터"}의 캐릭터 시트 참조가 요청에 포함되지 않았습니다.`);
  }
  const rig = layer.type === "character" ? resolveCharacterRig(layer) : undefined;
  const rigText = rig ? Object.entries(rig).map(([name, point]) => `${name}=(${point.x.toFixed(3)},${point.y.toFixed(3)})`).join(", ") : "";
  const common = `Project: ${input.context.title}; genre=${input.context.genre}; setting=${input.context.setting}
Episode context: ${input.episode.synopsis}
Panel camera: ${input.cut.angle} — ${webtoonShotPrompt(input.cut.angle)}
Panel action: ${input.cut.description}
Art direction: monochrome Korean webtoon storyboard rough, confident pencil/ink construction lines, selective hatching, readable acting, unfinished production drawing.`;
  const prompt = layer.type === "background"
    ? `Draw ONLY the empty environment/background layer for one webtoon storyboard panel.
${common}
Background direction: ${layer.text && !/^(배경|background)$/i.test(layer.text.trim()) ? layer.text : [input.cut.description, input.context.setting].filter(Boolean).join("; ")}
Draw recognizable ENVIRONMENT ART, never a word card, label, empty rectangle, abstract location symbol or bare perspective grid. Rough means unfinished line quality, not missing scenery. Show foreground/middle/background depth, coherent horizon/vanishing lines, at least three scene-appropriate environmental fixtures, and readable light/shadow with selective gray hatching. Continue the architecture/landscape behind the planned character positions; do not leave blank cutout holes for them. Avoid duplicating independently editable props: ${input.storyboard.elements.filter(element => element.type === "prop" && element.visible !== false).map(element => element.text).join(", ") || "none"}.
Input image 1 is a clean empty canvas defining the aspect ratio, NOT a scene or diagram to copy. Use the camera and environment descriptions to build perspective. Render the environment full-bleed to ALL FOUR canvas edges without an inset frame or blank page bands. Establish horizon, depth, architecture, furniture and environmental context. Leave the character and major-prop areas visually open. Do not draw any people, body parts, foreground character silhouettes, speech balloons, letters, panel borders, labels or watermark. White paper background, monochrome rough line art.`
    : layer.type === "character"
      ? `Draw ONE isolated character layer for a professional webtoon storyboard.
${common}
Character: ${reference?.character.name ?? layer.text}; pose=${layer.pose || "follow the joint rig"}; expression=${layer.expression || "match the scene"}.
${reference ? identityLock(reference.character) : ""}
The normalized joint rig inside this layer is: ${rigText}.
REFERENCE PRIORITY: input image 2 is the complete approved design sheet and input image 3 is an enlarged crop of its canonical full-body hero figure. These two images are the single source of truth for identity and design. ${input.poseReference ? "Input image 4 is the creator-selected POSE REFERENCE: copy its body gesture, limb bends, weight balance and facing direction, but never copy that person's identity, face, clothes or background." : "Input image 1 supplies pose and placement."} If the layout diagram conflicts with the approved identity references, keep ONLY its placement/pose and discard its face, hair, body design and clothes. Do not redesign, beautify, simplify, age up/down, recolor, change hairstyle, change uniform, remove accessories, or blend in features from another person.
Preserve the exact face geometry, eye design, hair silhouette, body proportions, outfit construction, shoes, accessories and palette from the approved sheet. Change only pose, expression, viewing angle and lighting. The pose must match every joint, weight balance and facing direction. Draw readable anatomy, hands and feet; do not replace it with a stick figure or generic standing pose.
Output exactly one character at the specified joint positions and scale. Do not center, enlarge or shrink the figure independently of the rig. Preserve intentional partial-body framing; never invent a full body to fit the layer. BACKGROUND MATTE CONTRACT: paint ALL empty space outside the subject, including gaps between limbs, solid chroma green #00FF00. This overrides the white background of reference images. Skin, hair and clothes must be opaque grayscale, never green, even in highlights or sketch gaps. Render a solid grayscale silhouette beneath the line art, not bare floating lines. Identity palette applies to grayscale values only in this sketch. No green reflected light, gradients or shadows. No floor, background objects, props, text, balloon, border, label or watermark. Monochrome subject on green screen.`
      : `Draw ONE isolated major prop layer for a professional webtoon storyboard.
${common}
Prop: ${layer.text}. Use input image 1 for orientation and intended scale. Draw the complete prop as an opaque grayscale silhouette and line art on solid chroma green #00FF00. All empty space and holes must be green; every object surface must remain opaque grayscale, not green. No green reflected light, person, hand, background objects, shadow, text, border, label or watermark.`;
  const interaction = await client().interactions.create({
    model: IMAGE_MODEL,
    input: [
      { type: "image" as const, mime_type: input.layoutImage.mimeType, data: input.layoutImage.data },
      ...(reference ? [
        { type: "image" as const, mime_type: reference.mimeType, data: reference.data },
        { type: "image" as const, mime_type: reference.heroMimeType, data: reference.heroData },
      ] : []),
      ...(input.poseReference ? [{ type: "image" as const, mime_type: input.poseReference.mimeType, data: input.poseReference.data }] : []),
      { type: "text" as const, text: prompt },
    ],
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: layerAspectRatio(layer, input.cut.aspectRatio),
      image_size: layer.type === "prop" ? "512" : "1K",
    },
  });
  const image = imageResult(interaction);
  // A successful drawing must not depend on a second AI analysis request.
  // Keep the creator's rig; pose analysis remains an explicit editor action.
  return { ...image, prompt };
}

export async function generateSceneImage(input: {
  stage?: "sketch" | "finish";
  referenceMode?: "layers" | "direct";
  context: ProjectVisualContext;
  episode: { number: number; title: string; synopsis: string };
  cut: { angle: string; description: string; dialogue: string; soundEffect: string; aspectRatio: PanelAspectRatio };
  storyboard: StoryboardDocument;
  layoutImage: { data: string; mimeType: string };
  structureImage?: { data: string; mimeType: string };
  references: CharacterReferenceInput[];
}): Promise<{ data: string; mimeType: string; prompt: string }> {
  input = { ...input, storyboard: artworkOnlyStoryboard(input.storyboard) };
  const requiredCharacterIds = new Set(input.storyboard.elements
    .filter((element) => element.visible !== false && element.type === "character" && element.characterId)
    .map((element) => element.characterId as string));
  const providedCharacterIds = new Set(input.references.map(({ character }) => character.id));
  const missingReference = [...requiredCharacterIds].find((id) => !providedCharacterIds.has(id));
  if (missingReference) {
    const element = input.storyboard.elements.find((item) => item.characterId === missingReference);
    throw new Error(`${element?.text || "장면 속 캐릭터"}의 캐릭터 시트 참조가 누락되었습니다.`);
  }
  const cast = input.references.map(({ character }, index) =>
    `REFERENCE IMAGES ${index * 2 + (input.structureImage ? 3 : 2)} and ${index * 2 + (input.structureImage ? 4 : 3)} = the approved full design sheet and enlarged canonical full-body reference for ${character.name} (${character.role}). These are the ONLY identity sources for this character.\n${identityLock(character)}`
  ).join("\n");
  const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(1)}%`;
  const rotate = (x: number, y: number, element: StoryboardElement) => {
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const radians = element.rotation * Math.PI / 180;
    const dx = x - centerX;
    const dy = y - centerY;
    return {
      x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
    };
  };
  const elementBox = (element: StoryboardElement) =>
    `left=${pct(element.x, input.storyboard.width)}, top=${pct(element.y, input.storyboard.height)}, width=${pct(element.width, input.storyboard.width)}, height=${pct(element.height, input.storyboard.height)}, rotation=${element.rotation.toFixed(1)}deg, mirrored=${element.flipX ? "yes" : "no"}, layer=${element.zIndex}`;
  const referenceNames = new Map(input.references.map(({ character }) => [character.id, character.name]));
  const spatialContract = input.storyboard.elements
    .slice()
    .filter((element) => element.visible !== false)
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((element) => {
      if (element.type !== "character") {
        const purpose = element.type === "background" ? `environment=${element.text || input.cut.description}; fills the ENTIRE canvas; never draw its bounding box or label` : `physical prop=${element.text || "object"}; never render its label`;
        return `- [${element.type.toUpperCase()} ${element.id}] ${elementBox(element)}; ${purpose}`;
      }
      const rig = sceneCharacterRig({ ...element, assetId: input.storyboard.sceneSketchAssetId || element.assetId });
      const joints = Object.entries(rig).map(([name, point]) => {
        const localX = element.flipX ? (1 - point.x) * element.width : point.x * element.width;
        const position = rotate(element.x + localX, element.y + point.y * element.height, element);
        return `${name}=(${pct(position.x, input.storyboard.width)},${pct(position.y, input.storyboard.height)})`;
      }).join(", ");
      const identity = referenceNames.get(element.characterId ?? "") || element.text || "character";
      return `- [CHARACTER ${element.id}] identity=${identity}; ${elementBox(element)}; expression=${element.expression || "follow scene"}; ${element.poseDescriptionEdited ? `REQUESTED POSE CHANGE: ${element.pose || "follow scene"}. Apply this creator edit within the existing framing, updating hand contacts and connected props coherently; this explicit edit overrides the old raster pose and default joints.` : joints ? `EXPLICIT EDITED JOINTS ${joints}` : "RASTER POSE LOCK: trace the visible head, hands, silhouette and crop in reference image 1; no inferred full-body pose"}`;
    })
    .join("\n");
  const characterCount = input.storyboard.elements.filter((element) => element.visible !== false && element.type === "character").length;

  const task = input.stage === "sketch"
    ? "DRAW a complete grayscale storyboard scene using reference image 1 and the edited control map. Existing artwork is a composition reference, not separate pieces to paste. Keep all people, hands and connected objects in a single coherent perspective. Draw the environment visibly rather than writing its name. Never add dialogue, balloons, labels or guides."
    : input.referenceMode === "direct"
    ? "FINISH the complete user-edited storyboard as one webtoon panel in a SINGLE image generation. This is faithful rendering, NOT recomposition. Reference image 1 contains the full current layer composition including existing images of edited layers. Missing raster assets are represented by control geometry rather than omitted. Preserve the user's framing, figure sizes, positions, hand contacts, props, desk/monitor layout and overlaps. Draw EVERY object in the spatial contract. Do not return separate layers, a collage, a contact sheet or intermediate drafts."
    : "REDRAW the first image as one finished webtoon panel. This is a layout-locked image-to-image production task, not a new composition.";
  const stageDirection = input.stage === "sketch"
    ? "STORYBOARD SKETCH STAGE: Draw ONE coherent grayscale scene, including ALL people, their hands, contact objects and environment together in a single perspective. This is one art region of a vertical-scroll webtoon, never a four-panel comic, page grid or contact sheet. Draw whole connected objects: laptop screen/hinge/keyboard must connect; tablet front/back/stand must be physically consistent; hands must contact the correct surface. Do not separate people or props onto independent canvases. Grayscale rough artwork with opaque surfaces, no green-screen or transparency."
    : "FINISH STAGE: Color and finish the approved full-scene sketch. Preserve object topology, visible front/back, hand contacts, laptop screen/hinge/keyboard and tablet/stand orientation. Do not redesign the scene or complete clipped objects by changing camera framing. This is one art region within a vertical-scroll webtoon, not a page grid.";
  const prompt = `${stageDirection}
${task}

PROJECT
- Title: ${input.context.title}
- Genre: ${input.context.genre}
- Setting: ${input.context.setting}
- Art direction: ${input.stage === "sketch" ? "Grayscale storyboard line art in the project's established drawing style; no color." : artStyle(input.context)}

PANEL
- Aspect ratio: ${input.cut.aspectRatio}
- Camera: ${input.cut.angle} — ${webtoonShotPrompt(input.cut.angle)}
- Scene: ${input.cut.description}
- Episode context: ${input.episode.synopsis}
${cast}

NON-NEGOTIABLE SPATIAL CONTRACT (coordinates are percentages of the final image):
${spatialContract}

CONTROL GEOMETRY:
${input.structureImage ? "Reference image 2 is a STRUCTURAL CONTROL MAP, not artwork or a character design sheet. Its boxes and joint lines specify the CURRENT edited placement and pose. Never draw its blue/brown lines, rectangles or markers in the output." : "The SVG below specifies the CURRENT edited placement and pose."}
The following SVG is geometric input only, never typography or artwork to reproduce:
${sceneStructureSvg(input.storyboard)}
Collapsed leg joints from cropped-image analysis are deliberately omitted. Unlisted joints are unknown, NOT a request to draw extra limbs or expand the framing. Preserve the visible silhouette and crop in reference image 1.
If the older raster pose in image 1 conflicts with the control map/JOINTS, use the control map/JOINTS while retaining the overall composition. Neither prose nor character-sheet poses may move these coordinates.
Only explicitly edited joints override the raster pose. Boxes describe layer placement, NOT the person's silhouette or head size. For a character with RASTER POSE LOCK, the structure image intentionally has no skeleton: preserve its visible drawing exactly. Do not infer a standing body from its rectangular layer.
REQUESTED POSE CHANGE is also an explicit creator edit: apply that instruction within its box instead of tracing the old pose. Never let an unedited default rig override this request; keep hand/prop contact and perspective coherent with the rest of the scene.

COMPOSITION LOCK:
- Preserve the exact camera framing and canvas edges from reference image 1. Do not zoom, crop, pan, mirror, or choose a new angle.
- Render exactly ${characterCount} character figure(s). Do not add, remove, merge, duplicate, or swap them.
- Each character's head, hands, elbows, knees and feet must land on the listed JOINTS. Descriptions refine expression and appearance ONLY within this fixed pose; never reposition joints to satisfy prose. Preserve partial-body framing and intentional canvas-edge cropping; do not shrink or reposition a foreground figure to force its entire body into view.
- Preserve the listed ARTWORK objects, scale, rotation, overlap and front-to-back layer. The coordinate boxes are metadata, NOT rectangles to draw. Background perspective must support these placements. Fill the ENTIRE canvas edge-to-edge; never put the scene inside a smaller frame, page, border or blank margin.
- The control map and spatial contract govern placement, scale and pose. Character sheets govern face, hairstyle, outfit and palette ONLY; never resize, move or re-pose a figure to imitate a sheet. Reference image 1 governs composition and object detail, not new character identity.
- The characterId/design-sheet mapping is fixed. For each figure, reproduce the matching sheet's facial geometry, apparent age, eye shape, hair silhouette, body proportions, exact outfit construction, shoes, accessories and palette. Change only pose, expression, camera angle and scene lighting.
- Never average or blend features between reference sheets. Never turn distinct cast members into similar-looking generic students. Never redesign a school uniform, remove a signature feature, or substitute a different hairstyle.
- No typography or editorial guides are part of the artwork. Speech balloons, empty balloons, captions, effect letters, arrows, handles, skeletons, labels, dashed rectangles and page frames must not appear, even if a reference accidentally contains them.
- Replace diagram figures and boxes with finished art, but do not reinterpret their blocking. If written scene prose conflicts with the spatial contract, the spatial contract wins.
- Before returning the image, compare composition against reference image 1, then compare every character separately against their assigned design sheet. Correct any face, hair, apparent age, outfit, accessory, palette or proportion mismatch before finalizing.

IMPORTANT: Produce artwork only. Do not draw speech balloons, dialogue, captions, sound-effect letters, labels, panel borders, logos or watermarks. The application will add exact editable Korean typography afterward.`;
  const imageInputs = [
    { type: "image" as const, mime_type: input.layoutImage.mimeType, data: input.layoutImage.data },
    ...(input.structureImage ? [{ type: "image" as const, mime_type: input.structureImage.mimeType, data: input.structureImage.data }] : []),
    ...input.references.flatMap((reference) => [
      { type: "image" as const, mime_type: reference.mimeType, data: reference.data },
      { type: "image" as const, mime_type: reference.heroMimeType, data: reference.heroData },
    ]),
    { type: "text" as const, text: prompt },
  ];
  const interaction = await client().interactions.create({
    model: IMAGE_MODEL,
    input: imageInputs,
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: input.cut.aspectRatio,
      image_size: "1K",
    },
  });
  return { ...imageResult(interaction), prompt };
}
