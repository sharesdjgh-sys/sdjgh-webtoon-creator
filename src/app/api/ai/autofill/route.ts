import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson, generateGeminiText } from "@/lib/geminiText";
import { PLAYBOOK_RULES } from "@/lib/prompts/playbook";

export const maxDuration = 60;

const requestSchema = z.object({
  ideaChat: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8_000),
  })).min(1).max(60),
  step: z.enum(["story", "character", "episodes", "script"]),
  context: z.string().max(48000).optional(),
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
    }, required: ["logline", "theme", "setting", "plotOutline", "totalEpisodes"],
  },
  character: {
    type: "object", properties: {
      characters: { type: "array", minItems: 1, maxItems: 4, items: {
        type: "object", properties: {
          goal: { type: "string" },
          fear: { type: "string" },
          weakness: { type: "string" },
          growth: { type: "string" },
          speechStyle: { type: "string" },
          relationships: { type: "string" },
          name: { type: "string" }, role: { type: "string" }, age: { type: "string" },
          appearance: { type: "string" }, personality: { type: "string" }, backstory: { type: "string" },
        }, required: ["name", "role", "age", "appearance", "personality", "backstory"],
      } },
    }, required: ["characters"],
  },
  episodes: {
    type: "object", properties: {
      episodes: { type: "array", minItems: 1, maxItems: 5, items: {
        type: "object", properties: { title: { type: "string" }, synopsis: { type: "string" } },
        required: ["title", "synopsis"],
      } },
    }, required: ["episodes"],
  },
} as const;

const outputs = {
  story: z.object({
    conflict: z.string().max(3000).optional(),
    stakes: z.string().max(3000).optional(),
    ordinary: z.string().max(3000).optional(),
    incident: z.string().max(3000).optional(),
    escalation: z.string().max(3000).optional(),
    choice: z.string().max(3000).optional(),
    ending: z.string().max(3000).optional(),
    logline: z.string().max(1_000), theme: z.string().max(2_000), setting: z.string().max(3_000),
    plotOutline: z.string().max(10_000), totalEpisodes: z.number().int().min(1).max(50),
  }),
  character: z.object({ characters: z.array(z.object({
    goal: z.string().max(3000).optional(),
    fear: z.string().max(3000).optional(),
    weakness: z.string().max(3000).optional(),
    growth: z.string().max(3000).optional(),
    speechStyle: z.string().max(3000).optional(),
    relationships: z.string().max(3000).optional(),
    name: z.string().max(100), role: z.string().max(100), age: z.string().max(50),
    appearance: z.string().max(1_500), personality: z.string().max(1_000), backstory: z.string().max(1_500),
  })).min(1).max(4) }),
  episodes: z.object({ episodes: z.array(z.object({
    title: z.string().max(200), synopsis: z.string().max(3_000),
  })).min(1).max(5) }),
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
    const conversation = transcript(input.ideaChat) + "\n\n저장된 작품 설정:\n" + (input.context ?? "없음")
      + "\n\n이번에 작성할 회차:\n" + JSON.stringify(input.episode ?? { number: 1 });
    const common = `${PLAYBOOK_RULES}\n당신은 고등학생의 아이디어를 대신 빼앗지 않고 발전시키는 한국 웹툰 창작 코치입니다.
학생이 말한 핵심 설정, 장르, 인물 관계와 분위기를 보존하세요. 모호한 부분만 창의적으로 보완하세요.
결과는 실제 세로 스크롤 웹툰 한 화를 만들 수 있을 만큼 구체적이어야 하지만, 학생이 이해하기 쉬운 자연스러운 한국어로 작성하세요.
학교 과제처럼 딱딱한 설명 대신 행동, 갈등, 선택과 감정 변화가 보이는 이야기로 만드세요.`;

    if (input.step === "script") {
      const script = await generateGeminiText({
        system: `${common}\n당신은 세로 스크롤 웹툰 대본 작가입니다. 선택한 회차 한 편의 초안을 쓰되 장면마다 장소·시간, 화면에 보이는 행동, 표정, 대사, 효과음을 분리합니다. 첫 장면에는 훅을, 마지막 장면은 선택한 작품 형태에 맞춥니다. 완결 단편이면 문제를 해결하고, 연재이면 다음 화의 궁금증을 남깁니다. 같은 구도의 대화만 이어지지 않게 원경·중경·근접 장면을 암시합니다.`,
        prompt: `아이디어 대화:\n\n${conversation}\n\n형식:\n[장면 1: 장소 / 시간]\n화면: 보이는 행동과 구도\n인물명: \"대사\"\n효과음: 필요한 경우만\n\n이 형식으로 ${input.episode?.number ?? 1}화 대본 초안을 작성하세요.`,
      });
      return NextResponse.json({ script });
    }

    const instructions = {
      story: "한 문장 로그라인, 핵심 주제, 시간·장소·규칙이 보이는 세계관, 시작-갈등-전환-결말 방향이 있는 전체 줄거리와 권장 회차 수를 작성하세요. conflict, stakes와 ordinary, incident, escalation, choice, ending의 다섯 단계를 각각 작성하세요.",
      character: "서로 외형 실루엣과 말투, 욕망, 약점이 구분되는 주요 인물 1~4명을 만드세요. 주인공을 반드시 포함하고 외형은 반복해서 그릴 수 있게 구체적으로 작성하세요. goal, fear, weakness, growth, speechStyle, relationships도 작성하세요.",
      episodes: "저장된 작품 형태와 총 회차 수를 따라 최대 5개 회차의 제목과 줄거리를 만드세요. 각 회차는 시작 훅, 사건의 진전, 감정 변화, 마지막 궁금증이 드러나야 합니다.",
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
