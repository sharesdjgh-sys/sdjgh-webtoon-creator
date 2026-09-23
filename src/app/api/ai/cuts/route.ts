import { PANEL_RATIOS } from "@/lib/webtoonDesign";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/geminiText";
import { WEBTOON_SHOT_NAMES } from "@/lib/webtoonShots";
import { cleanCharacterMentions } from "@/lib/characterMentions";
import { PLAYBOOK_RULES } from "@/lib/prompts/playbook";

export const maxDuration = 60;

const aspectRatioSchema = z.enum(PANEL_RATIOS);
const cameraSchema = z.enum(WEBTOON_SHOT_NAMES);

const requestSchema = z.object({
  mode: z.enum(["next", "current"]).default("next"),
  context: z.string().max(48000).optional(),
  currentCutIndex: z.number().int().nonnegative().optional(),
  project: z.object({
    title: z.string().max(200), genre: z.string().max(100), logline: z.string().max(2_000),
    theme: z.string().max(2_000), setting: z.string().max(3_000), plotOutline: z.string().max(10_000),
  }),
  episode: z.object({
    number: z.number().int().positive(), title: z.string().max(200),
    synopsis: z.string().max(5_000), script: z.string().max(20_000),
  }),
  characters: z.array(z.object({
    id: z.string().max(120), name: z.string().max(100), role: z.string().max(100),
    appearance: z.string().max(1_500), personality: z.string().max(1_000),
  })).max(20),
  existingCuts: z.array(z.object({
    angle: z.string().max(100), description: z.string().max(2_000), dialogue: z.string().max(1_000),
    soundEffect: z.string().max(300), characterIds: z.array(z.string().max(120)).max(10), aspectRatio: aspectRatioSchema,
  })).max(100),
});

const generatedCutSchema = z.object({
  purpose: z.string().max(500), emotion: z.string().max(500), continuityNotes: z.string().max(2000), scrollGap: z.enum(["short", "normal", "long"]),
  angle: cameraSchema,
  description: z.string().trim().min(1).max(2_000),
  dialogue: z.string().trim().max(1_000),
  soundEffect: z.string().trim().max(300),
  characterIds: z.array(z.string().max(120)).max(4),
  aspectRatio: aspectRatioSchema,
});

const CUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    purpose: { type: "string" }, emotion: { type: "string" }, continuityNotes: { type: "string" }, scrollGap: { type: "string", enum: ["short", "normal", "long"] },
    angle: { type: "string", enum: cameraSchema.options },
    description: { type: "string" }, dialogue: { type: "string" }, soundEffect: { type: "string" },
    characterIds: { type: "array", items: { type: "string" }, maxItems: 4 },
    aspectRatio: { type: "string", enum: aspectRatioSchema.options },
  },
  required: ["purpose", "emotion", "continuityNotes", "scrollGap", "angle", "description", "dialogue", "soundEffect", "characterIds", "aspectRatio"],
} as const;

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/quota|resource.exhausted|rate.?limit|429/i.test(raw)) return "Gemini 사용량이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (/GEMINI_API_KEY/i.test(raw)) return "Gemini API 키를 확인해 주세요.";
  return "Gemini가 컷을 설계하지 못했습니다. 장면 설명을 조금 더 구체적으로 적어 주세요.";
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "컷 생성 요청 정보가 올바르지 않습니다." }, { status: 400 });
    const input = parsed.data;
    if (input.mode === "current" && (input.currentCutIndex === undefined || !input.existingCuts[input.currentCutIndex])) {
      return NextResponse.json({ error: "다시 설계할 현재 컷을 찾을 수 없습니다." }, { status: 400 });
    }

    const cast = input.characters.map((character) =>
      `- ${character.id}: ${character.name} / ${character.role} / 외형: ${character.appearance} / 성격: ${character.personality}`
    ).join("\n");
    const existing = input.existingCuts.length
      ? input.existingCuts.map((cut, index) =>
        `${index + 1}. [${cut.aspectRatio}, ${cut.angle}] ${cut.description} / 대사: ${cut.dialogue || "없음"} / 효과음: ${cut.soundEffect || "없음"}`
      ).join("\n")
      : "아직 컷이 없음";
    const task = input.mode === "current"
      ? `${input.currentCutIndex! + 1}번 컷을 앞뒤 흐름에 맞게 개선하세요. 새 컷을 추가하지 마세요.`
      : "기존 마지막 컷을 반복하지 말고, 이야기의 다음 정보·행동·감정 비트를 보여주는 컷 하나를 설계하세요.";

    const raw = await generateGeminiJson({
      system: `${PLAYBOOK_RULES}\n당신은 고등학생 창작자를 돕는 한국 세로 스크롤 웹툰 콘티 연출가입니다.
컷의 목적(purpose), 감정(emotion), 유지할 설정(continuityNotes), 다음 컷까지 여백(scrollGap)을 함께 정합니다.\n결과는 예쁜 한 장의 일러스트가 아니라, 한 화의 스크롤 리듬을 이어가는 단일 컷 설계여야 합니다.
- 학생의 아이디어는 존중하되 인물 위치, 행동, 표정, 시선, 배경, 카메라를 실제로 그릴 수 있게 구체화합니다.
- 이전 컷과 샷 크기와 카메라 각도를 적절히 바꾸고, 같은 구도의 반복을 피합니다.
- 대사와 효과음은 꼭 필요할 때만 짧게 씁니다.
- characterIds에는 제공된 ID만 사용합니다.
- description, dialogue, soundEffect에는 내부 ID를 절대 쓰지 않습니다. 인물을 부를 때는 자연스러운 이름이나 역할만 씁니다.
- "미정(character-...)"처럼 이름 뒤에 ID를 괄호로 붙이지 않습니다. ID는 오직 characterIds 배열에만 넣습니다.
- 컷의 목적에 맞춰 가로 폭과 세로 길이를 선택합니다. 4:1은 눈빛·손동작의 순간, 3:4는 대화·감정, 4:3은 공간 소개, 1:1은 반응, 9:16은 등장, 1:4는 낙하·돌진·거대한 적, 1:8은 스크롤하며 드러나는 특별한 장면에 사용합니다. 매우 긴 컷은 필요한 절정에만 사용합니다.
- 공격 준비→이동→충돌→여파의 단계와 감정 강약을 설계합니다. description에는 표정의 눈·입·시선과 몸의 반응, 광원·그림자, 필요한 이펙트의 발생점·방향·강도를 함께 지시합니다. 사용자가 채색·이펙트를 따로 설정할 필요 없이 완성할 수 있게 합니다.
- continuityNotes에는 무기를 쥔 손, 이동 방향, 위치 관계, 상처, 능력의 색과 형태처럼 앞뒤 컷에서 이어져야 할 사실을 기록합니다.
- 이해하기 쉬운 한국어를 사용하고 선정적이거나 과도하게 잔혹한 묘사는 피합니다.`,
      prompt: `추가 설정집: ${input.context ?? "없음"}\n\n작품: ${input.project.title || "제목 미정"}
장르: ${input.project.genre || "미정"}
로그라인: ${input.project.logline || "미정"}
주제: ${input.project.theme || "미정"}
세계관: ${input.project.setting || "미정"}
전체 줄거리: ${input.project.plotOutline || "미정"}

${input.episode.number}화: ${input.episode.title || "제목 미정"}
회차 줄거리: ${input.episode.synopsis || "미정"}
대본: ${input.episode.script || "없음"}

등장인물:
${cast || "등록된 등장인물 없음"}

현재 컷 순서:
${existing}

작업: ${task}`,
      schema: CUT_JSON_SCHEMA,
    });
    const cut = generatedCutSchema.parse(raw);
    const validCharacterIds = new Set(input.characters.map((character) => character.id));
    return NextResponse.json({ cut: {
      ...cut,
      description: cleanCharacterMentions(cut.description, input.characters),
      dialogue: cleanCharacterMentions(cut.dialogue, input.characters),
      soundEffect: cleanCharacterMentions(cut.soundEffect, input.characters),
      characterIds: cut.characterIds.filter((id) => validCharacterIds.has(id)),
    } });
  } catch (error) {
    console.error("[ai/cuts]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
