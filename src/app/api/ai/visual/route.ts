import { NextResponse } from "next/server";
import { z } from "zod";
import {
  characterInputSchema,
  generateSceneImage,
  generateStoryboardLayout,
  projectVisualContextSchema,
} from "@/lib/gemini";
import { generateCharacterSheet } from "@/lib/openaiImage";

export const maxDuration = 120;

const imagePayloadSchema = z.object({
  data: z.string().min(1).max(12_000_000),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

const episodeSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().trim().max(200),
  synopsis: z.string().trim().max(3_000),
});

const cutSchema = z.object({
  angle: z.string().trim().max(100),
  description: z.string().trim().max(2_000),
  dialogue: z.string().trim().max(1_000),
  soundEffect: z.string().trim().max(300),
  aspectRatio: z.enum(["4:3", "3:4", "1:1", "9:16"]),
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
  version: z.literal(1),
  aspectRatio: z.enum(["4:3", "3:4", "1:1", "9:16"]),
  width: z.number().positive().max(4_000),
  height: z.number().positive().max(4_000),
  elements: z.array(z.object({
    id: z.string().max(100),
    type: z.enum(["character", "prop", "shape", "arrow", "speech", "caption", "sfx"]),
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
    expression: z.string().max(300).optional(),
    fontFamily: z.enum(["clean", "serif", "handwritten", "cute", "comic", "impact"]).optional(),
    fontSize: z.number().positive().max(300).optional(),
    fontWeight: z.number().min(100).max(900).optional(),
    characterRig: characterRigSchema.optional(),
  })).min(1).max(32),
});

const requestSchema = z.discriminatedUnion("action", [
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
    context: projectVisualContextSchema,
    episode: episodeSchema,
    cut: cutSchema,
    storyboard: storyboardSchema,
    layoutImage: imagePayloadSchema,
    references: z.array(z.object({ character: characterInputSchema, ...imagePayloadSchema.shape })).max(4),
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
    return NextResponse.json(await generateSceneImage(body));
  } catch (error) {
    console.error("[visual]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
