import { NextRequest, NextResponse } from "next/server";
import { chatWithGemini } from "@/lib/geminiText";
import { z } from "zod";
import { PLAYBOOK_RULES, COACH_RULES } from "@/lib/prompts/playbook";
import {
  IDEA_ASSISTANT_PROMPT,
  STORY_ASSISTANT_PROMPT,
  CHARACTER_ASSISTANT_PROMPT,
  PANEL_ASSISTANT_PROMPT,
  SCRIPT_ASSISTANT_PROMPT,
  COMPLETION_ASSISTANT_PROMPT,
} from "@/lib/prompts";

const PROMPTS: Record<string, string> = {
  idea: IDEA_ASSISTANT_PROMPT,
  story: STORY_ASSISTANT_PROMPT,
  character: CHARACTER_ASSISTANT_PROMPT,
  panel: PANEL_ASSISTANT_PROMPT,
  script: SCRIPT_ASSISTANT_PROMPT,
  completion: COMPLETION_ASSISTANT_PROMPT,
};

export async function POST(req: NextRequest) {
  try {
    const parsed = z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) })).min(1).max(60),
      step: z.enum(["idea", "story", "character", "panel", "script", "completion"]),
      context: z.string().max(48000).optional(),
      creationMode: z.enum(["together", "auto", "manual"]).optional(),
    }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "대화 요청을 확인해 주세요. 메시지는 8,000자까지 보낼 수 있어요." }, { status: 400 });
    const { messages, step, context, creationMode } = parsed.data;
    const modeRule = creationMode === "manual" ? "직접 만들기: 먼저 학생이 쓴 내용에 피드백한다. 초안을 요청하지 않으면 대신 작성하지 않는다." : creationMode === "auto" ? "AI 초안부터: 요청한 단계의 초안을 제안하고 검토할 결정 하나를 남긴다." : "함께 만들기: 선택지를 제시하고 학생의 결정 하나씩 받아 진행한다.";
    const systemPrompt = `${PLAYBOOK_RULES}\n${COACH_RULES}\n${modeRule}\n${PROMPTS[step]}\n저장된 작품 자료 (일부 생략 가능, 승인 상태 별도 확인):\n${context || "없음. 필요한 설정 하나를 질문하세요."}`;
    const reply = await chatWithGemini(messages, systemPrompt);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[ai/chat]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Gemini 응답 생성에 실패했습니다." }, { status: 500 });
  }
}
