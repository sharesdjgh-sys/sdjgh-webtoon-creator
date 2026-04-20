import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildTranscript(messages: ChatMessage[]): string {
  return messages
    .filter((m) => !(m.role === "assistant" && m.content.startsWith("안녕하세요")))
    .map((m) => `[${m.role === "user" ? "사용자" : "AI"}]: ${m.content}`)
    .join("\n");
}

const TOOLS = {
  story: {
    name: "fill_story",
    description: "웹툰 스토리 구성 정보를 구조화하여 반환합니다",
    input_schema: {
      type: "object" as const,
      properties: {
        logline: { type: "string", description: "웹툰 이야기를 한 문장으로 요약" },
        theme: { type: "string", description: "독자에게 전달할 주제와 메시지 (2~4문장)" },
        setting: { type: "string", description: "시간적·공간적 배경과 세계관 (2~4문장)" },
        plotOutline: { type: "string", description: "기승전결 구조의 전체 줄거리 (200자 이상)" },
        totalEpisodes: { type: "string", description: "총 화 수 (숫자만, 예: 5)" },
      },
      required: ["logline", "theme", "setting", "plotOutline", "totalEpisodes"],
    },
  },
  character: {
    name: "fill_characters",
    description: "웹툰 캐릭터 정보를 구조화하여 반환합니다",
    input_schema: {
      type: "object" as const,
      properties: {
        characters: {
          type: "array",
          description: "최소 1명, 최대 4명. 주인공 반드시 포함",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string", enum: ["주인공", "조력자", "악당(빌런)", "조연", "기타"] },
              age: { type: "string" },
              appearance: { type: "string" },
              personality: { type: "string" },
              backstory: { type: "string" },
            },
            required: ["name", "role", "age", "appearance", "personality", "backstory"],
          },
        },
      },
      required: ["characters"],
    },
  },
  episodes: {
    name: "fill_episodes",
    description: "웹툰 화별 구성 정보를 구조화하여 반환합니다",
    input_schema: {
      type: "object" as const,
      properties: {
        episodes: {
          type: "array",
          description: "최소 1개, 최대 5개",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              synopsis: { type: "string" },
            },
            required: ["title", "synopsis"],
          },
        },
      },
      required: ["episodes"],
    },
  },
};

const SYSTEM_PROMPTS: Record<string, string> = {
  story: "당신은 웹툰 창작 기획서 작성 도우미입니다. 아이디어 발굴 대화를 분석하여 스토리 구성 정보를 추출하고 fill_story 도구로 반환하세요.",
  character: "당신은 웹툰 창작 기획서 작성 도우미입니다. 아이디어 발굴 대화를 분석하여 등장인물 정보를 추출하고 fill_characters 도구로 반환하세요.",
  episodes: "당신은 웹툰 창작 기획서 작성 도우미입니다. 아이디어 발굴 대화를 분석하여 화별 구성 정보를 추출하고 fill_episodes 도구로 반환하세요.",
  script: "당신은 웹툰 창작 기획서 작성 도우미입니다. 아이디어 발굴 대화를 분석하여 1화 대본 초안을 작성하세요.\n\n형식:\n[장면1: 장소, 시간대]\n(장면 묘사)\n캐릭터명: \"대사\"\n(효과음/행동 지시)",
};

export async function POST(req: NextRequest) {
  const { ideaChat, step } = await req.json() as { ideaChat: ChatMessage[]; step: string };

  if (!ideaChat || ideaChat.length === 0) {
    return NextResponse.json({ error: "아이디어 발굴 대화 내용이 없습니다." }, { status: 400 });
  }

  const systemPrompt = SYSTEM_PROMPTS[step];
  if (!systemPrompt) {
    return NextResponse.json({ error: "지원하지 않는 단계입니다." }, { status: 400 });
  }

  const transcript = buildTranscript(ideaChat);
  if (!transcript.trim()) {
    return NextResponse.json({ error: "아이디어 발굴 대화 내용이 충분하지 않습니다." }, { status: 400 });
  }

  try {
    const isScriptStep = step === "script";
    const tool = TOOLS[step as keyof typeof TOOLS];

    if (isScriptStep) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: `아이디어 발굴 대화 내용:\n\n${transcript}\n\n위 내용을 바탕으로 1화 대본을 작성해주세요.` }],
      });
      const raw = response.content[0];
      if (raw.type !== "text") throw new Error("Unexpected response type");
      return NextResponse.json({ script: raw.text.trim() });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: `아이디어 발굴 대화 내용:\n\n${transcript}\n\n위 내용을 분석하여 정보를 추출해주세요.` }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("Tool use block not found in response");
    }

    return NextResponse.json(toolBlock.input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[autofill]", message);
    return NextResponse.json({ error: "AI 자동채우기 실패", detail: message }, { status: 500 });
  }
}
