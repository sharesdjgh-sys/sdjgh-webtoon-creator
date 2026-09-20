import "server-only";

import { GoogleGenAI } from "@google/genai";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL
  ?? process.env.GEMINI_LAYOUT_MODEL
  ?? "gemini-3.8-flash";

function geminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  return new GoogleGenAI({ apiKey });
}

export async function generateGeminiText(input: {
  system: string;
  prompt: string;
}): Promise<string> {
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
