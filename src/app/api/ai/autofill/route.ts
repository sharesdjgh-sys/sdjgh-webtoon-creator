import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/geminiText";
import { PLAYBOOK_RULES } from "@/lib/prompts/playbook";

import { visualProfileSchema, visualProfileJsonSchema, worldDraftSchema, episodePlanSchema, episodePlanJsonSchema, authorNoteSchema, stringObjectSchema } from "@/lib/autofillFields";

export const maxDuration = 60;

const requestSchema = z.object({
  ideaChat: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8_000),
  })).min(1).max(60),
  step: z.enum(["story", "character", "episodes", "script", "world", "visualProfile", "episodePlan", "authorNote"]),
  context: z.string().max(48000).optional(),
  character: z.object({
    name: z.string().max(100), role: z.string().max(100), age: z.string().max(50),
    appearance: z.string().max(1500), personality: z.string().max(1000), backstory: z.string().max(1500),
    goal: z.string().max(3000), fear: z.string().max(3000), weakness: z.string().max(3000),
    growth: z.string().max(3000), speechStyle: z.string().max(3000), relationships: z.string().max(3000),
    imageInstructions: z.string().max(3000),
    visualProfile: z.record(z.string(), z.string().max(500)),
  }).optional(),
  authorNote: z.string().max(5000).optional(),
  episode: z.object({
    number: z.number().int().positive(), title: z.string().max(200), synopsis: z.string().max(5000),
    goal: z.string().max(3000), obstacle: z.string().max(3000), turningPoint: z.string().max(3000), endingHook: z.string().max(3000), script: z.string().max(20000),
  }).optional(),
});

const schemas = {
  story: {
    type: "object", properties: {
      conflict: { type: "string" },
      stakes: { type: "string" },
      ordinary: { type: "string" },
      incident: { type: "string" },
      escalation: { type: "string" },
      choice: { type: "string" },
      ending: { type: "string" },
      logline: { type: "string" }, theme: { type: "string" }, setting: { type: "string" },
      plotOutline: { type: "string" }, totalEpisodes: { type: "integer", minimum: 1, maximum: 50 },
    }, required: ["logline", "theme", "setting", "plotOutline", "totalEpisodes", "conflict", "stakes", "ordinary", "incident", "escalation", "choice", "ending"],
  },
  character: {
    type: "object", properties: {
      characters: { type: "array", minItems: 1, maxItems: 4, items: {
        type: "object", properties: {
          visualProfile: visualProfileJsonSchema,
          goal: { type: "string" },
          fear: { type: "string" },
          weakness: { type: "string" },
          growth: { type: "string" },
          speechStyle: { type: "string" },
          relationships: { type: "string" },
          name: { type: "string" }, role: { type: "string" }, age: { type: "string" },
          appearance: { type: "string" }, personality: { type: "string" }, backstory: { type: "string" },
        }, required: ["name", "role", "age", "appearance", "personality", "backstory", "goal", "fear", "weakness", "growth", "speechStyle", "relationships", "visualProfile"],
      } },
    }, required: ["characters"],
  },
  episodes: {
    type: "object", properties: {
      episodes: { type: "array", minItems: 1, maxItems: 5, items: {
        ...episodePlanJsonSchema,
      } },
    }, required: ["episodes"],
  },
} as const;

const outputs = {
  story: z.object({
    conflict: z.string().max(3000),
    stakes: z.string().max(3000),
    ordinary: z.string().max(3000),
    incident: z.string().max(3000),
    escalation: z.string().max(3000),
    choice: z.string().max(3000),
    ending: z.string().max(3000),
    logline: z.string().max(1_000), theme: z.string().max(2_000), setting: z.string().max(3_000),
    plotOutline: z.string().max(10_000), totalEpisodes: z.number().int().min(1).max(50),
  }),
  character: z.object({ characters: z.array(z.object({
    visualProfile: visualProfileSchema,
    goal: z.string().max(3000),
    fear: z.string().max(3000),
    weakness: z.string().max(3000),
    growth: z.string().max(3000),
    speechStyle: z.string().max(3000),
    relationships: z.string().max(3000),
    name: z.string().max(100), role: z.string().max(100), age: z.string().max(50),
    appearance: z.string().max(1_500), personality: z.string().max(1_000), backstory: z.string().max(1_500),
  })).min(1).max(4) }),
  episodes: z.object({ episodes: z.array(episodePlanSchema).min(1).max(5) }),
};

function transcript(messages: z.infer<typeof requestSchema>["ideaChat"]): string {
  return messages.map((message) =>
    `${message.role === "user" ? "학생" : "AI 멘토"}: ${message.content}`
  ).join("\n\n");
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/quota|resource.exhausted|rate.?limit|429/i.test(raw)) return "Gemini 사용량이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (/GEMINI_API_KEY/i.test(raw)) return "Gemini API 키를 확인해 주세요.";
  return "Gemini 자동 채우기에 실패했습니다. 아이디어를 한두 문장 더 적어 주세요.";
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "자동 채우기 요청 정보가 올바르지 않습니다." }, { status: 400 });
    const input = parsed.data;
    if (input.step === "visualProfile" && !input.character) return NextResponse.json({ error: "외형을 채울 캐릭터를 선택해 주세요." }, { status: 400 });
    const conversation = transcript(input.ideaChat) + "\n\n저장된 작품 설정:\n" + (input.context ?? "없음")
      + "\n\n이번에 작성할 회차:\n" + JSON.stringify(input.episode ?? { number: 1 });
    const common = `${PLAYBOOK_RULES}\n당신은 고등학생의 아이디어를 대신 빼앗지 않고 발전시키는 한국 웹툰 창작 코치입니다.
학생이 말한 핵심 설정, 장르, 인물 관계와 분위기를 보존하세요. 모호한 부분만 창의적으로 보완하세요.
결과는 실제 세로 스크롤 웹툰 한 화를 만들 수 있을 만큼 구체적이어야 하지만, 학생이 이해하기 쉬운 자연스러운 한국어로 작성하세요.
학교 과제처럼 딱딱한 설명 대신 행동, 갈등, 선택과 감정 변화가 보이는 이야기로 만드세요.
이 서비스는 아이디어와 기획만 있어도 AI가 후속 설정의 초안을 모두 작성합니다. 추가 질문으로 멈추거나 사용자에게 직접 작성하라고 하지 마세요. 비어 있는 창작 설정은 맥락에 맞게 제안하고, 기존 명시 설정은 존중하세요. 결과는 사용자가 수정·검토할 초안이지 검수 완료나 사용자 승인을 의미하지 않습니다.`;

    if (input.step === "world") {
      const raw = await generateGeminiJson({
        system: common,
        prompt: conversation + "\n기획과 인물에서 세계관 전체 초안을 만드세요. 시대, 주요 무대, 가능한 일, 금지와 한계, 대가, 반복 장소의 구조와 색, 소품의 모양·소유자, 복선 계획을 구체적으로 채우세요. 현실물의 능력이나 특수 규칙은 해당 없음과 현실적 제약으로 적으세요. undecided에는 추가 검토할 제안만 적고 이미 사용자가 확정한 사실과 모순되지 않게 하세요. confirmed 항목이나 승인 사실을 만들어내지 마세요.",
        schema: stringObjectSchema(Object.keys(worldDraftSchema.shape)),
      });
      return NextResponse.json({ world: worldDraftSchema.parse(raw) });
    }
    if (input.step === "visualProfile") {
      const raw = await generateGeminiJson({
        system: common,
        prompt: conversation + "\n이번에 외형 고정 정보를 작성할 캐릭터(미저장 편집 포함):\n" + JSON.stringify(input.character)
          + "\n이 캐릭터의 이름·역할·나이·외모·성격·배경과 추가 이미지 지시를 근거로 외형 12항목을 모두 채우세요. 현재 명시된 외형은 유지하며 빠진 시각 요소를 구체화하세요. 정면·측면·후면에서 반복 가능한 얼굴·머리·의상·신발·소품·색상 정보를 쓰세요. 없는 액세서리는 없음이라고 쓰고 다른 캐릭터의 외형을 섞지 마세요.",
        schema: visualProfileJsonSchema,
      });
      return NextResponse.json({ visualProfile: visualProfileSchema.parse(raw) });
    }
    if (input.step === "episodePlan" || input.step === "script") {
      const withScript = input.step === "script";
      const schema = withScript
        ? { ...episodePlanJsonSchema, properties: { ...episodePlanJsonSchema.properties, script: { type: "string" } }, required: [...episodePlanJsonSchema.required, "script"] }
        : episodePlanJsonSchema;
      const raw = await generateGeminiJson({
        system: common,
        prompt: conversation + "\n선택한 " + (input.episode?.number ?? 1) + "화의 제목·시놉시스·목표·장애물·새 정보·마지막 장면을 모두 작성하세요. 기존 회차 설정과 작품 형태를 따르고 단편은 결말을 완성하세요."
          + (withScript ? "\n" + (input.episode?.number ?? 1) + "화 대본 초안도 script에 작성하세요. [장면: 장소 / 시간], 화면에 보이는 행동·표정, 인물명: 대사, 효과음 형식으로 씁니다. 기획의 목표 컷 수에 맞추고 설정이 비어 있어도 아이디어에서 구체화하세요." : ""),
        schema,
      });
      return withScript
        ? NextResponse.json(episodePlanSchema.extend({ script: z.string().trim().min(1).max(20000) }).parse(raw))
        : NextResponse.json({ episodePlan: episodePlanSchema.parse(raw) });
    }
    if (input.step === "authorNote") {
      const raw = await generateGeminiJson({
        system: common,
        prompt: conversation + "\n기존 작가 노트: " + (input.authorNote ?? "") + "\n작품 소개·기획 의도·독자에게 전할 감정을 담은 작가 노트 초안을 쓰세요. 사용자의 실제 경험, 수상, 제작 시간, 사용 도구·기여 비율은 추측하지 말고 직접 검수나 승인했다고 주장하지 마세요.",
        schema: stringObjectSchema(["authorNote"]),
      });
      return NextResponse.json(authorNoteSchema.parse(raw));
    }

    const instructions = {
      story: "한 문장 로그라인, 핵심 주제, 시간·장소·규칙이 보이는 세계관, 시작-갈등-전환-결말 방향이 있는 전체 줄거리와 권장 회차 수를 작성하세요. conflict, stakes와 ordinary, incident, escalation, choice, ending의 다섯 단계를 각각 작성하세요.",
      character: "서로 외형 실루엣과 말투, 욕망, 약점이 구분되는 주요 인물 1~4명을 만드세요. 주인공을 반드시 포함하고 외형은 반복해서 그릴 수 있게 구체적으로 작성하세요. goal, fear, weakness, growth, speechStyle, relationships와 visualProfile의 외형 고정 12항목도 모두 작성하세요. 외형 설명과 고정 정보는 일치해야 합니다.",
      episodes: "저장된 작품 형태와 총 회차 수를 따라 최대 5개 회차의 제목과 줄거리를 만드세요. 각 회차의 goal, obstacle, turningPoint, endingHook도 빠짐없이 작성하세요. 단편이면 마지막 장면에서 결말을 완성하고 연재만 다음 궁금증을 남기세요.",
    }[input.step];
    const raw = await generateGeminiJson({
      system: common,
      prompt: `아이디어 대화:\n\n${conversation}\n\n작업: ${instructions}`,
      schema: schemas[input.step],
    });
    if (input.step === "story") {
      const story = outputs.story.parse(raw);
      return NextResponse.json({ ...story, totalEpisodes: String(story.totalEpisodes) });
    }
    return NextResponse.json(outputs[input.step].parse(raw));
  } catch (error) {
    console.error("[ai/autofill]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
