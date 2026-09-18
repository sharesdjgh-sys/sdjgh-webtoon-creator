import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { PanelAspectRatio, StoryboardDocument, StoryboardElement } from "@/lib/storage";
import { resolveCharacterRig } from "@/lib/storyboardRig";

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
  balloonStyle: z.enum(["normal", "thought", "shout", "whisper"]).optional(),
  tailX: z.number().optional(),
  tailY: z.number().optional(),
  speakerCharacterId: z.string().max(120).optional(),
});

const generatedDocumentSchema = z.object({
  elements: z.array(generatedElementSchema).min(1).max(24),
});

const STORYBOARD_JSON_SCHEMA = {
  type: "object",
  properties: {
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
          balloonStyle: { type: "string", enum: ["normal", "thought", "shout", "whisper"] },
          tailX: { type: "number", description: "Speech-tail endpoint x in local normalized coordinates; 0..1 is inside the balloon" },
          tailY: { type: "number", description: "Speech-tail endpoint y in local normalized coordinates; 0..1 is inside the balloon" },
          speakerCharacterId: { type: "string", description: "Exact selected cast ID of the speaker" },
        },
        required: ["type", "x", "y", "width", "height", "rotation", "zIndex", "text"],
      },
    },
  },
  required: ["elements"],
} as const;

export type CharacterVisualInput = z.infer<typeof characterInputSchema>;
export type ProjectVisualContext = z.infer<typeof projectVisualContextSchema>;

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

function imageResult(interaction: { output_image?: { data?: string; mime_type?: string } }): { data: string; mimeType: string } {
  const data = interaction.output_image?.data;
  if (!data) throw new Error("Gemini가 이미지 결과를 반환하지 않았습니다.");
  return { data, mimeType: interaction.output_image?.mime_type ?? "image/jpeg" };
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

function clampElement(
  element: z.infer<typeof generatedElementSchema>,
  index: number,
  width: number,
  height: number,
  characterIds: Set<string>,
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
    characterId: element.characterId && characterIds.has(element.characterId) ? element.characterId : undefined,
    balloonStyle: element.type === "speech" ? (element.balloonStyle ?? "normal") : undefined,
    tailX: element.type === "speech" ? Math.min(2, Math.max(-1, element.tailX ?? 0.25)) : undefined,
    tailY: element.type === "speech" ? Math.min(2, Math.max(-1, element.tailY ?? 1.22)) : undefined,
    speakerCharacterId: element.type === "speech" && element.speakerCharacterId && characterIds.has(element.speakerCharacterId)
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
  cut: { angle: string; description: string; dialogue: string; soundEffect: string; aspectRatio: PanelAspectRatio };
  characters: CharacterVisualInput[];
}): Promise<StoryboardDocument> {
  const { width, height } = dimensions(input.cut.aspectRatio);
  const cast = input.characters.map((character) =>
    `- ${character.id}: ${character.name} (${character.role}), appearance=${character.appearance}, personality=${character.personality}`
  ).join("\n");
  const prompt = `You are a professional webtoon storyboard artist. Plan ONE editable panel as a sparse composition diagram.

Canvas viewBox: 0 0 ${width} ${height} (${input.cut.aspectRatio})
Episode ${input.episode.number}: ${input.episode.title}
Episode context: ${input.episode.synopsis}
Camera angle: ${input.cut.angle}
Scene: ${input.cut.description || "Infer a clear beat from the episode context"}
Dialogue: ${input.cut.dialogue || "None"}
Sound effect: ${input.cut.soundEffect || "None"}
Selected cast:
${cast || "No named character selected"}

Return a practical SVG scene graph using only the supplied JSON schema.
- Keep every element fully inside the canvas.
- Use character elements for blocking people; characterId must exactly match a selected cast ID.
- Every character element must include characterRig with all 14 normalized joints. Build the actual described action and weight balance — sitting must bend hips and knees onto a seat, running must show stride and arm counter-swing, looking back must turn the shoulder line and head. Never fall back to a generic standing pose.
- Use prop, shape, and arrow elements only when they clarify depth, motion, foreground, or background.
- Use speech/caption/sfx elements for exact Korean text; these remain editable overlays.
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
  const ids = new Set(input.characters.map((character) => character.id));
  return {
    version: 2,
    aspectRatio: input.cut.aspectRatio,
    width,
    height,
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
        text: "배경",
        visible: true,
        locked: true,
        opacity: 1,
        flipX: false,
      },
      ...parsed.elements.map((element, index) => clampElement(element, index, width, height, ids)),
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
  references: Array<{ character: CharacterVisualInput; data: string; mimeType: string }>;
}): Promise<{ data: string; mimeType: string; prompt: string }> {
  const layer = input.storyboard.elements.find((element) => element.id === input.layerId);
  if (!layer || !["background", "character", "prop"].includes(layer.type)) throw new Error("생성할 콘티 레이어를 찾지 못했습니다.");
  const reference = layer.type === "character"
    ? input.references.find(({ character }) => character.id === layer.characterId)
    : undefined;
  const rig = layer.type === "character" ? resolveCharacterRig(layer) : undefined;
  const rigText = rig ? Object.entries(rig).map(([name, point]) => `${name}=(${point.x.toFixed(3)},${point.y.toFixed(3)})`).join(", ") : "";
  const common = `Project: ${input.context.title}; genre=${input.context.genre}; setting=${input.context.setting}
Episode context: ${input.episode.synopsis}
Panel camera: ${input.cut.angle}
Panel action: ${input.cut.description}
Art direction: monochrome Korean webtoon storyboard rough, confident pencil/ink construction lines, selective hatching, readable acting, unfinished production drawing.`;
  const prompt = layer.type === "background"
    ? `Draw ONLY the empty environment/background layer for one webtoon storyboard panel.
${common}
Background direction: ${layer.text || input.context.setting}
Use input image 1 as the exact camera framing and perspective map. Establish horizon, depth, architecture, furniture and environmental context. Leave the character and major-prop areas visually open. Do not draw any people, body parts, foreground character silhouettes, speech balloons, letters, panel borders, labels or watermark. White paper background, monochrome rough line art.`
    : layer.type === "character"
      ? `Draw ONE isolated character layer for a professional webtoon storyboard.
${common}
Character: ${reference?.character.name ?? layer.text}; pose=${layer.pose || "follow the joint rig"}; expression=${layer.expression || "match the scene"}.
The normalized joint rig inside this layer is: ${rigText}.
Use input image 1 only for pose/blocking and input image 2, when present, as the approved character design. Preserve face shape, hair silhouette, body proportions, outfit and accessories. The pose must match every joint, weight balance and facing direction. Draw readable anatomy, hands and feet; do not replace it with a stick figure or generic standing pose.
Output exactly one character, centered and fully visible, on pure white with no floor, shadow, background, props, text, balloon, border, label or watermark. Monochrome rough line art only.`
      : `Draw ONE isolated major prop layer for a professional webtoon storyboard.
${common}
Prop: ${layer.text}. Use input image 1 for orientation and intended scale. Draw the complete prop centered on pure white, monochrome rough line art, with no person, hand, background, shadow, text, border, label or watermark.`;
  const interaction = await client().interactions.create({
    model: IMAGE_MODEL,
    input: [
      { type: "image" as const, mime_type: input.layoutImage.mimeType, data: input.layoutImage.data },
      ...(reference ? [{ type: "image" as const, mime_type: reference.mimeType, data: reference.data }] : []),
      { type: "text" as const, text: prompt },
    ],
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: layerAspectRatio(layer, input.cut.aspectRatio),
      image_size: layer.type === "background" ? "1K" : "512",
    },
  });
  return { ...imageResult(interaction), prompt };
}

export async function generateSceneImage(input: {
  context: ProjectVisualContext;
  episode: { number: number; title: string; synopsis: string };
  cut: { angle: string; description: string; dialogue: string; soundEffect: string; aspectRatio: PanelAspectRatio };
  storyboard: StoryboardDocument;
  layoutImage: { data: string; mimeType: string };
  references: Array<{ character: CharacterVisualInput; data: string; mimeType: string }>;
}): Promise<{ data: string; mimeType: string; prompt: string }> {
  const cast = input.references.map(({ character }, index) =>
    `Reference image ${index + 2} is the approved design sheet for ${character.name} (${character.role}). Preserve that character's face, hair, outfit, colors and proportions.`
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
        const purpose = ["speech", "caption", "sfx"].includes(element.type)
          ? `RESERVED TYPOGRAPHY AREA — leave visually quiet and do not draw text${element.type === "speech" ? `; balloon=${element.balloonStyle ?? "normal"}; speaker=${referenceNames.get(element.speakerCharacterId ?? "") ?? element.speakerCharacterId ?? "unassigned"}; tail=(${element.tailX ?? 0.25},${element.tailY ?? 1.22}) local` : ""}`
          : `visual=${element.text || element.type}`;
        return `- [${element.type.toUpperCase()} ${element.id}] ${elementBox(element)}; ${purpose}`;
      }
      const rig = resolveCharacterRig(element);
      const joints = Object.entries(rig).map(([name, point]) => {
        const localX = element.flipX ? (1 - point.x) * element.width : point.x * element.width;
        const position = rotate(element.x + localX, element.y + point.y * element.height, element);
        return `${name}=(${pct(position.x, input.storyboard.width)},${pct(position.y, input.storyboard.height)})`;
      }).join(", ");
      const identity = referenceNames.get(element.characterId ?? "") || element.text || "character";
      return `- [CHARACTER ${element.id}] identity=${identity}; ${elementBox(element)}; pose=${element.pose || "follow rig"}; expression=${element.expression || "follow scene"}; JOINTS ${joints}`;
    })
    .join("\n");
  const characterCount = input.storyboard.elements.filter((element) => element.visible !== false && element.type === "character").length;

  const prompt = `REDRAW the first image as one finished webtoon panel. This is a layout-locked image-to-image production task, not a new composition.

PROJECT
- Title: ${input.context.title}
- Genre: ${input.context.genre}
- Setting: ${input.context.setting}
- Art direction: ${artStyle(input.context)}

PANEL
- Aspect ratio: ${input.cut.aspectRatio}
- Camera: ${input.cut.angle}
- Scene: ${input.cut.description}
- Episode context: ${input.episode.synopsis}
${cast}

NON-NEGOTIABLE SPATIAL CONTRACT (coordinates are percentages of the final image):
${spatialContract}

COMPOSITION LOCK:
- Preserve the exact camera framing and canvas edges from reference image 1. Do not zoom, crop, pan, mirror, or choose a new angle.
- Render exactly ${characterCount} character figure(s). Do not add, remove, merge, duplicate, or swap them.
- Each character's head, hands, elbows, knees and feet must land on the listed JOINTS. Keep the complete body inside its listed bounding box.
- Preserve every element's bounding box, scale, rotation, overlap and front-to-back layer. Background perspective must support these placements, never move them.
- The characterId/design-sheet mapping is fixed. Use the matching design sheet only for that figure's identity, outfit, colors and proportions.
- Keep all RESERVED TYPOGRAPHY AREA boxes visually quiet. Do not place faces, hands or important props inside them.
- Replace diagram figures and boxes with finished art, but do not reinterpret their blocking. If written scene prose conflicts with the spatial contract, the spatial contract wins.
- Before returning the image, compare it against reference image 1 from edge to edge and correct any displaced figure or prop.

IMPORTANT: Produce artwork only. Do not draw speech balloons, dialogue, captions, sound-effect letters, labels, panel borders, logos or watermarks. The application will add exact editable Korean typography afterward.`;
  const imageInputs = [
    { type: "image" as const, mime_type: input.layoutImage.mimeType, data: input.layoutImage.data },
    ...input.references.map((reference) => ({ type: "image" as const, mime_type: reference.mimeType, data: reference.data })),
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
