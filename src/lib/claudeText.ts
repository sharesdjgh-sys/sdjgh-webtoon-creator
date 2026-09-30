import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_TEXT_MODEL = process.env.CLAUDE_TEXT_MODEL ?? "claude-sonnet-5-5";

function claudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  return new Anthropic({ apiKey });
}

export async function generateClaudeJson(input: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<unknown> {
  // 회차 대본처럼 긴 출력도 HTTP 제한 시간에 걸리지 않도록 스트리밍으로 받습니다.
  const response = await claudeClient().beta.messages.stream({
    model: CLAUDE_TEXT_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Gemini용 스키마를 그대로 쓰므로 프롬프트로 형식을 지시하고, 결과는 호출부의 zod 검증에 맡깁니다.
    system: `${input.system}\n\nRespond with a single JSON value only, with no prose or code fences, matching this JSON Schema:\n${JSON.stringify(input.schema)}`,
    messages: [{ role: "user", content: input.prompt }],
  }).finalMessage();
  if (response.stop_reason === "refusal") throw new Error("Claude가 요청을 거절했습니다.");
  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error("Claude가 응답을 반환하지 않았습니다.");
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
}
