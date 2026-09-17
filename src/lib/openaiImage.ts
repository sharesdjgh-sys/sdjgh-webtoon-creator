import "server-only";

import OpenAI from "openai";
import {
  buildCharacterSheetPrompt,
  type CharacterVisualInput,
  type ProjectVisualContext,
} from "@/lib/gemini";

const CHARACTER_SHEET_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst";
const CHARACTER_SHEET_SIZE = "1920x1280";

function client(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  return new OpenAI({ apiKey });
}

export async function generateCharacterSheet(
  context: ProjectVisualContext,
  character: CharacterVisualInput,
): Promise<{ data: string; mimeType: string; prompt: string }> {
  const prompt = buildCharacterSheetPrompt(context, character);
  const response = await client().images.generate({
    model: CHARACTER_SHEET_MODEL,
    prompt,
    size: CHARACTER_SHEET_SIZE,
    quality: "high",
    output_format: "jpeg",
    output_compression: 92,
    background: "opaque",
    n: 1,
  });
  const data = response.data?.[0]?.b64_json;
  if (!data) throw new Error("OpenAI가 캐릭터 시트 이미지를 반환하지 않았습니다.");
  return { data, mimeType: "image/jpeg", prompt };
}
