import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildTranscript(messages: ChatMessage[]): string {
  return messages
    .filter((m) => !(m.role === "assistant" && m.content.startsWith("안녕하세요")))
    .map((m) => `[${m.role === "user" ? "사용자" : "AI"}]: ${m.content}`)
    .join("\n");
}

const AUTOFILL_PROMPTS: Record<string, string> = {
  story: `당신은 웹툰 창작 기획서 작성 도우미입니다.
아래 아이디어 발굴 대화 내용을 분석하여 스토리 구성 단계에 필요한 정보를 JSON으로 반환하세요.

반드시 아래 JSON 형식만 반환하고 다른 텍스트는 절대 포함하지 마세요:
{
  "logline": "웹툰 이야기를 한 문장으로 (예: ~하는 주인공의 성장 이야기)",
  "theme": "독자에게 전달하고 싶은 주제와 메시지 (2~4문장)",
  "setting": "이야기가 펼쳐지는 시간적·공간적 배경과 세계관 (2~4문장)",
  "plotOutline": "기승전결 구조의 전체 줄거리 (기: 발단, 승: 전개, 전: 위기와 반전, 결: 결말을 포함한 200자 이상)",
  "totalEpisodes": "계획하는 총 화 수 (숫자만, 예: 5)"
}`,

  character: `당신은 웹툰 창작 기획서 작성 도우미입니다.
아래 아이디어 발굴 대화 내용을 분석하여 캐릭터 설계에 필요한 정보를 JSON으로 반환하세요.

반드시 아래 JSON 형식만 반환하고 다른 텍스트는 절대 포함하지 마세요:
{
  "characters": [
    {
      "name": "캐릭터 이름",
      "role": "역할 (주인공 | 조력자 | 악당(빌런) | 조연 | 기타 중 하나)",
      "age": "나이 또는 학년 (예: 17세, 고2)",
      "appearance": "외모 묘사 (머리카락 색, 키, 특징적인 외모 등 구체적으로 2~3문장)",
      "personality": "성격 (장점과 단점 포함, 2~3문장)",
      "backstory": "배경 이야기 (과거, 목표, 동기 포함, 2~3문장)"
    }
  ]
}
캐릭터는 최소 1명, 최대 4명까지 포함하세요. 주인공을 반드시 포함하세요.`,

  episodes: `당신은 웹툰 창작 기획서 작성 도우미입니다.
아래 아이디어 발굴 대화 내용을 분석하여 화별 콘티 구성에 필요한 기본 정보를 JSON으로 반환하세요.

반드시 아래 JSON 형식만 반환하고 다른 텍스트는 절대 포함하지 마세요:
{
  "episodes": [
    {
      "title": "화 제목 (간결하게)",
      "synopsis": "이번 화의 줄거리 요약 (이 화에서 무슨 일이 일어나는지 2~3문장)"
    }
  ]
}
화는 최소 1개, 최대 5개까지 포함하세요. 이야기 흐름상 자연스러운 분량으로 나눠주세요.`,

  script: `당신은 웹툰 창작 기획서 작성 도우미입니다.
아래 아이디어 발굴 대화 내용을 분석하여 1화 대본 초안을 작성해주세요.

아래 형식으로 대본만 작성하고 다른 설명은 절대 포함하지 마세요:

[장면1: 장소, 시간대]
(장면 묘사)
캐릭터명: "대사"
(효과음/행동 지시)

[장면2: ...]
...`,
};

export async function POST(req: NextRequest) {
  const { ideaChat, step } = await req.json() as { ideaChat: ChatMessage[]; step: string };

  if (!ideaChat || ideaChat.length === 0) {
    return NextResponse.json({ error: "아이디어 발굴 대화 내용이 없습니다." }, { status: 400 });
  }

  const systemPrompt = AUTOFILL_PROMPTS[step];
  if (!systemPrompt) {
    return NextResponse.json({ error: "지원하지 않는 단계입니다." }, { status: 400 });
  }

  const transcript = buildTranscript(ideaChat);

  try {
    const isScriptStep = step === "script";
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: isScriptStep ? 4096 : 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: isScriptStep
            ? `아이디어 발굴 대화 내용:\n\n${transcript}\n\n위 내용을 바탕으로 1화 대본을 작성해주세요.`
            : `아이디어 발굴 대화 내용:\n\n${transcript}\n\n위 내용을 바탕으로 JSON을 생성해주세요.`,
        },
      ],
    });

    const raw = response.content[0];
    if (raw.type !== "text") throw new Error("Unexpected response type");

    if (isScriptStep) {
      return NextResponse.json({ script: raw.text.trim() });
    }

    const jsonMatch = raw.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON not found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "AI 자동채우기 실패" }, { status: 500 });
  }
}
