import { NextRequest, NextResponse } from "next/server";
import { chat, Message } from "@/lib/claude";
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
  const { messages, step } = await req.json() as { messages: Message[]; step: string };

  const systemPrompt = PROMPTS[step] ?? IDEA_ASSISTANT_PROMPT;

  try {
    const reply = await chat(messages, systemPrompt);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "AI 응답 실패" }, { status: 500 });
  }
}
