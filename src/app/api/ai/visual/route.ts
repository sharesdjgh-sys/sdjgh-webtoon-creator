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
  projectVisualContextSchema,
} from "@/lib/gemini";
import { generateCharacterSheet } from "@/lib/openaiImage";
import { MAX_CHARACTER_REFERENCES, MAX_CHARACTER_SHEET_BODY_BYTES, MAX_REFERENCE_BASE64_LENGTH, MAX_REFERENCE_SEND_BYTES } from "@/lib/characterReferenceLimits";

export const maxDuration = 300;

const imagePayloadSchema = z.object({
  data: z.string().min(1).max(12_000_000),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

const sheetReferenceSchema = z.object({
  data: z.string().min(1).max(MAX_REFERENCE_BASE64_LENGTH),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

// Buffer.from(base64)는 잘못된 문자를 조용히 무시하므로 인코딩과 파일 서명을 모두 확인한다.
function decodeSheetReference(reference: z.infer<typeof sheetReferenceSchema>): { bytes: Buffer; mimeType: typeof reference.mimeType } | null {
  const { data, mimeType } = reference;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) return null;
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > MAX_REFERENCE_SEND_BYTES || bytes.toString("base64") !== data) return null;
  const valid = mimeType === "image/png"
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return valid ? { bytes, mimeType } : null;
}

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
    references: z.array(sheetReferenceSchema).max(MAX_CHARACTER_REFERENCES).default([]),
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
  if (/IMAGE_MODEL_EDIT_UNSUPPORTED/i.test(raw)) return "설정된 이미지 모델이 참고 이미지 입력을 지원하지 않아요. 관리자에게 이미지 모델 설정을 확인해 달라고 해주세요.";
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
    const rawBody = await request.text();
    let json: unknown;
    try { json = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "JSON 요청을 읽을 수 없습니다." }, { status: 400 }); }
    if (json && typeof json === "object" && "action" in json && json.action === "character-sheet"
      && Buffer.byteLength(rawBody, "utf8") > MAX_CHARACTER_SHEET_BODY_BYTES) {
      return NextResponse.json({ error: "캐릭터 시트 요청이 4 MB를 넘었어요. 참고 이미지를 줄이거나 일부를 삭제해 주세요." }, { status: 413 });
    }
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "요청 정보가 올바르지 않습니다.", detail: parsed.error.issues }, { status: 400 });
    }

    const body = parsed.data;
    if (body.action === "character-sheet") {
      const references = body.references.map(decodeSheetReference);
      if (references.some((reference) => !reference)) {
        return NextResponse.json({ error: "참고 이미지의 내용 또는 크기가 올바르지 않아요. 이미지를 다시 첨부해 주세요." }, { status: 400 });
      }
      return NextResponse.json(await generateCharacterSheet(body.context, body.character, references as Array<NonNullable<typeof references[number]>>));
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
