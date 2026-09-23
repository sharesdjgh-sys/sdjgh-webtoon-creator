import { sceneDirectionSchema } from "@/lib/visualSchemas";
import { BALLOON_STYLES, PANEL_RATIOS, SPEECH_ROLES } from "@/lib/webtoonDesign";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  characterInputSchema,
  detectCharacterRig,
  generateSceneImage,
  generateStoryboardLayout,
  generateStoryboardLayer,
  generateCharacterSheet,
  projectVisualContextSchema,
} from "@/lib/gemini";

export const maxDuration = 300;

const imagePayloadSchema = z.object({
  data: z.string().min(1).max(12_000_000),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

const characterReferenceSchema = z.object({
  character: characterInputSchema,
  ...imagePayloadSchema.shape,
  heroData: z.string().min(1).max(12_000_000),
  heroMimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

const episodeSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().trim().max(200),
  synopsis: z.string().trim().max(3_000),
  neighbors: z.string().max(8000).optional(),
});

const cutSchema = z.object({
  angle: z.string().trim().max(100),
  description: z.string().trim().max(2_000),
  dialogue: z.string().trim().max(1_000),
  soundEffect: z.string().trim().max(300),
  aspectRatio: z.enum(PANEL_RATIOS),
  scrollGap: z.enum(["short", "normal", "long"]).optional(),
});

const pointSchema = z.object({
  x: z.number().min(-1).max(2),
  y: z.number().min(-1).max(2),
});

const characterRigSchema = z.object({
  head: pointSchema,
  neck: pointSchema,
  leftShoulder: pointSchema,
  leftElbow: pointSchema,
  leftHand: pointSchema,
  rightShoulder: pointSchema,
  rightElbow: pointSchema,
  rightHand: pointSchema,
  leftHip: pointSchema,
  rightHip: pointSchema,
  leftKnee: pointSchema,
  leftFoot: pointSchema,
  rightKnee: pointSchema,
  rightFoot: pointSchema,
});

const storyboardSchema = z.object({
  direction: sceneDirectionSchema.optional(),
  sceneSketchAssetId: z.string().max(200).optional(),
  version: z.literal(2),
  aspectRatio: z.enum(PANEL_RATIOS),
  width: z.number().positive().max(10_000),
  height: z.number().positive().max(10_000),
  elements: z.array(z.object({
    id: z.string().max(100),
    type: z.enum(["background", "character", "prop", "shape", "arrow", "speech", "caption", "sfx"]),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number(),
    zIndex: z.number(),
    text: z.string().max(1_000),
    characterId: z.string().max(120).optional(),
    shape: z.enum(["rect", "ellipse"]).optional(),
    pose: z.string().max(300).optional(),
    poseReferenceAssetId: z.string().max(200).optional(),
    expression: z.string().max(300).optional(),
    fontFamily: z.enum(["clean", "serif", "handwritten", "cute", "comic", "impact"]).optional(),
    fontSize: z.number().positive().max(300).optional(),
    fontWeight: z.number().min(100).max(900).optional(),
    textColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    textGradient: z.boolean().optional(),
    textGradientColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    textGradientAngle: z.number().min(0).max(360).optional(),
    textStrokeColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    textStrokeWidth: z.number().min(0).max(12).optional(),
    balloonFill: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    balloonStroke: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    balloonStrokeWidth: z.number().min(0).max(12).optional(),
    characterRig: characterRigSchema.optional(),
    poseControlEdited: z.boolean().optional(),
    poseDescriptionEdited: z.boolean().optional(),
    placement: z.enum(["art", "before", "after", "top-edge", "bottom-edge", "canvas"]).optional(),
    balloonStyle: z.enum(BALLOON_STYLES).optional(),
    speechRole: z.enum(SPEECH_ROLES).optional(),
    tailVisible: z.boolean().optional(),
    lineHeight: z.number().min(1.05).max(1.8).optional(),
    textItalic: z.boolean().optional(),
    tailX: z.number().min(-2).max(3).optional(),
    tailY: z.number().min(-2).max(3).optional(),
    speakerCharacterId: z.string().max(120).optional(),
    assetId: z.string().max(200).optional(),
    assetSourceHash: z.string().max(200).optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    flipX: z.boolean().optional(),
  })).min(1).max(32),
});

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("detect-character-rig"),
    image: imagePayloadSchema,
  }),
  z.object({
    action: z.literal("storyboard-layer"),
    context: projectVisualContextSchema,
    episode: episodeSchema,
    cut: cutSchema,
    storyboard: storyboardSchema,
    layerId: z.string().max(100),
    layoutImage: imagePayloadSchema,
    references: z.array(characterReferenceSchema).max(4),
    poseReference: imagePayloadSchema.optional(),
  }),
  z.object({
    action: z.literal("character-sheet"),
    context: projectVisualContextSchema,
    character: characterInputSchema,
  }),
  z.object({
    action: z.literal("storyboard-layout"),
    context: projectVisualContextSchema,
    episode: episodeSchema,
    cut: cutSchema,
    characters: z.array(characterInputSchema).max(4),
  }),
  z.object({
    action: z.literal("scene-image"),
    stage: z.enum(["sketch", "finish"]).default("finish"),
    revision: z.string().trim().max(1500).optional(),
    referenceMode: z.enum(["layers", "direct"]).default("layers"),
    context: projectVisualContextSchema,
    episode: episodeSchema,
    cut: cutSchema,
    storyboard: storyboardSchema,
    layoutImage: imagePayloadSchema,
    structureImage: imagePayloadSchema.optional(),
    references: z.array(characterReferenceSchema).max(4),
  }),
]);

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/quota|resource.exhausted|rate.?limit|429/i.test(raw)) return "AI 이미지 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.";
  if (/safety|blocked|prohibited/i.test(raw)) return "안전 정책으로 이미지를 생성할 수 없습니다. 표현을 조정해 다시 시도해주세요.";
  if (/timeout|deadline/i.test(raw)) return "이미지 생성 시간이 초과되었습니다. 다시 시도해주세요.";
  if (/OPENAI_API_KEY/i.test(raw)) return "OpenAI API 키를 확인해주세요.";
  if (/GEMINI_API_KEY/i.test(raw)) return "Gemini API 키를 확인해주세요.";
  if (/api key|401|403/i.test(raw)) return "AI API 키와 모델 사용 권한을 확인해주세요.";
  return "AI 시각 자료 생성에 실패했습니다.";
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "JSON 요청만 지원합니다." }, { status: 415 });
    }
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "요청 정보가 올바르지 않습니다.", detail: parsed.error.issues }, { status: 400 });
    }

    const body = parsed.data;
    if (body.action === "character-sheet") {
      return NextResponse.json(await generateCharacterSheet(body.context, body.character));
    }
    if (body.action === "storyboard-layout") {
      return NextResponse.json({ storyboard: await generateStoryboardLayout(body) });
    }
    if (body.action === "detect-character-rig") {
      return NextResponse.json({ characterRig: await detectCharacterRig(body.image) });
    }
    if (body.action === "storyboard-layer") {
      return NextResponse.json(await generateStoryboardLayer(body));
    }
    return NextResponse.json(await generateSceneImage(body));
  } catch (error) {
    console.error("[visual]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
