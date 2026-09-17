import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic } from "@/lib/claude";

export const maxDuration = 60;

const aspectRatioSchema = z.enum(["4:3", "3:4", "1:1", "9:16"]);

const requestSchema = z.object({
  mode: z.enum(["next", "current"]).default("next"),
  currentCutIndex: z.number().int().nonnegative().optional(),
  project: z.object({
    title: z.string().max(200),
    genre: z.string().max(100),
    logline: z.string().max(2_000),
    theme: z.string().max(2_000),
    setting: z.string().max(3_000),
    plotOutline: z.string().max(10_000),
  }),
  episode: z.object({
    number: z.number().int().positive(),
    title: z.string().max(200),
    synopsis: z.string().max(5_000),
    script: z.string().max(20_000),
  }),
  characters: z.array(z.object({
    id: z.string().max(120),
    name: z.string().max(100),
    role: z.string().max(100),
    appearance: z.string().max(1_500),
    personality: z.string().max(1_000),
  })).max(20),
  existingCuts: z.array(z.object({
    angle: z.string().max(100),
    description: z.string().max(2_000),
    dialogue: z.string().max(1_000),
    soundEffect: z.string().max(300),
    characterIds: z.array(z.string().max(120)).max(10),
    aspectRatio: aspectRatioSchema,
  })).max(100),
});

const generatedCutSchema = z.object({
  angle: z.enum(["풀샷", "미디엄샷", "클로즈업", "익스트림 클로즈업", "버드뷰", "웜뷰", "오버더숄더"]),
  description: z.string().trim().min(1).max(2_000),
  dialogue: z.string().trim().max(1_000),
  soundEffect: z.string().trim().max(300),
  characterIds: z.array(z.string().max(120)).max(4),
  aspectRatio: aspectRatioSchema,
});

const CUT_TOOL = {
  name: "design_webtoon_cut",
  description: "에피소드 흐름에 맞는 웹툰 컷 하나를 구체적으로 설계합니다.",
  input_schema: {
    type: "object" as const,
    properties: {
      angle: { type: "string", enum: ["풀샷", "미디엄샷", "클로즈업", "익스트림 클로즈업", "버드뷰", "웜뷰", "오버더숄더"] },
      description: { type: "string", description: "인물 위치, 행동, 표정, 배경과 화면 구도를 포함한 구체적인 장면 묘사" },
      dialogue: { type: "string", description: "이 컷에서 실제로 말하는 짧은 대사. 없으면 빈 문자열" },
      soundEffect: { type: "string", description: "이 컷의 효과음. 없으면 빈 문자열" },
      characterIds: { type: "array", items: { type: "string" }, description: "등장인물 ID. 제공된 ID만 사용" },
      aspectRatio: { type: "string", enum: ["4:3", "3:4", "1:1", "9:16"] },
    },
    required: ["angle", "description", "dialogue", "soundEffect", "characterIds", "aspectRatio"],
  },
};

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "컷 생성 요청 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const input = parsed.data;
    if (input.mode === "current" && (input.currentCutIndex === undefined || !input.existingCuts[input.currentCutIndex])) {
      return NextResponse.json({ error: "설계할 현재 컷을 찾을 수 없습니다." }, { status: 400 });
    }
    const cast = input.characters.map((character) =>
      `- ${character.id}: ${character.name} / ${character.role} / 외형: ${character.appearance} / 성격: ${character.personality}`
    ).join("\n");
    const previousCuts = input.existingCuts.length > 0
      ? input.existingCuts.map((cut, index) =>
          `${index + 1}. [${cut.aspectRatio}, ${cut.angle}] ${cut.description} / 대사: ${cut.dialogue || "없음"} / 효과음: ${cut.soundEffect || "없음"}`
        ).join("\n")
      : "아직 컷이 없음";

    const currentInstruction = input.mode === "current"
      ? `현재 배열의 ${input.currentCutIndex! + 1}번째 컷을 설계하거나 개선하세요. 컷을 새로 추가하지 말고, 앞뒤 컷과 자연스럽게 이어지도록 현재 컷의 앵글·장면·대사·효과음·등장인물을 완성하세요. 현재 입력값은 창작자의 메모로 존중하되, 비어 있거나 모호한 부분을 구체화하세요.`
      : "현재 컷 배열 바로 다음에 이어질 새로운 컷 하나를 설계하세요.";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1_500,
      system: `당신은 한국 웹툰의 전문 콘티 연출가입니다. ${currentInstruction}
- 다음 컷 모드에서는 기존 마지막 컷을 반복하지 말고 이야기의 다음 정보·행동·감정 비트를 전진시키세요. 컷이 없다면 에피소드의 핵심 상황을 명확히 여는 첫 컷을 만드세요.
- 현재 컷 모드에서는 그 컷의 서사적 역할을 유지하면서 화면에 그릴 수 있을 정도로 구체화하세요.
- 이전 컷과 샷 크기 및 카메라 각도를 적절히 변화시켜 리듬을 만드세요.
- 장면 묘사는 실제로 그릴 수 있도록 인물 배치, 시선, 행동, 표정, 전경/배경을 구체적으로 적으세요.
- 대사와 효과음은 한 컷에 어울리게 짧게 쓰고, 필요 없으면 빈 문자열을 사용하세요.
- characterIds에는 제공된 등장인물 ID만 사용하세요.
- 세로 진행 웹툰에서 감정·대화는 3:4, 넓은 공간은 4:3, 짧은 비트는 1:1, 강한 낙차·등장·전환은 9:16을 우선 고려하세요.
- design_webtoon_cut 도구를 정확히 한 번 호출하세요.`,
      tools: [CUT_TOOL],
      tool_choice: { type: "tool", name: CUT_TOOL.name },
      messages: [{
        role: "user",
        content: `프로젝트: ${input.project.title || "제목 미정"}
장르: ${input.project.genre || "미정"}
로그라인: ${input.project.logline || "미정"}
주제: ${input.project.theme || "미정"}
세계관: ${input.project.setting || "미정"}
전체 줄거리: ${input.project.plotOutline || "미정"}

에피소드 ${input.episode.number}: ${input.episode.title || "제목 미정"}
에피소드 줄거리: ${input.episode.synopsis || "미정"}
작성된 대본: ${input.episode.script || "없음"}

등장인물:
${cast || "등록된 인물 없음"}

현재 컷 순서:
${previousCuts}

${input.mode === "current" ? `${input.currentCutIndex! + 1}번째 현재 컷을 완성하세요.` : "이 흐름 다음에 올 컷 하나를 제안하세요."}`, 
      }],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("컷 생성 결과가 없습니다.");
    const cut = generatedCutSchema.parse(toolUse.input);
    const validCharacterIds = new Set(input.characters.map((character) => character.id));
    return NextResponse.json({
      cut: {
        ...cut,
        characterIds: cut.characterIds.filter((characterId) => validCharacterIds.has(characterId)),
      },
    });
  } catch (error) {
    console.error("[ai/cuts]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "AI 컷 생성에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
