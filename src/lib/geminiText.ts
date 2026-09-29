import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL
  ?? process.env.GEMINI_LAYOUT_MODEL
  ?? "gemini-3.8-flash";
const CLAUDE_TEXT_MODEL = process.env.CLAUDE_TEXT_MODEL ?? "claude-opus-5";

// GEMINI_API_KEY가 없고 ANTHROPIC_API_KEY만 있으면 텍스트 기능을 Claude로 처리합니다.
function useClaude(): boolean {
  return !process.env.GEMINI_API_KEY && Boolean(process.env.ANTHROPIC_API_KEY);
}

function geminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 또는 ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  return new GoogleGenAI({ apiKey });
}

async function generateClaudeText(system: string, prompt: string): Promise<string> {
  const response = await new Anthropic().beta.messages.create({
    model: CLAUDE_TEXT_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude가 요청을 거절했습니다.");
  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error("Claude가 응답을 반환하지 않았습니다.");
  return text;
}

export async function generateGeminiText(input: {
  system: string;
  prompt: string;
}): Promise<string> {
  if (useClaude()) return generateClaudeText(input.system, input.prompt);
  const response = await geminiClient().models.generateContent({
    model: TEXT_MODEL,
    contents: `${input.system}\n\nUSER REQUEST\n${input.prompt}`,
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini가 응답을 반환하지 않았습니다.");
  return text;
}

export async function generateGeminiJson(input: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<unknown> {
  if (useClaude()) {
    // Gemini용 스키마를 그대로 쓰므로 프롬프트로 형식을 지시하고, 결과는 호출부의 zod 검증에 맡깁니다.
    const text = await generateClaudeText(
      `${input.system}\n\nRespond with a single JSON value only, with no prose or code fences, matching this JSON Schema:\n${JSON.stringify(input.schema)}`,
      input.prompt,
    );
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  }
  const interaction = await geminiClient().interactions.create({
    model: TEXT_MODEL,
    input: `${input.system}\n\nUSER REQUEST\n${input.prompt}`,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: input.schema,
    },
  });
  if (!interaction.output_text) throw new Error("Gemini가 구조화된 응답을 반환하지 않았습니다.");
  return JSON.parse(interaction.output_text);
}

export type GeminiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function chatWithGemini(
  messages: GeminiChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const transcript = messages
    .slice(-24)
    .map((message) => `${message.role === "user" ? "USER" : "ASSISTANT"}: ${message.content}`)
    .join("\n\n");
  return generateGeminiText({
    system: `${systemPrompt}\nRespond in Korean unless the creator explicitly requests another language. Give practical, production-ready advice for a serialized vertical-scroll webtoon.`,
    prompt: `${transcript}\n\nContinue as ASSISTANT. Do not repeat the transcript.`,
  });
}
