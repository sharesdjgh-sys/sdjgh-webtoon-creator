import "server-only";

import OpenAI, { toFile } from "openai";
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
  references: Array<{ bytes: Buffer; mimeType: "image/png" | "image/jpeg" | "image/webp" }> = [],
): Promise<{ data: string; mimeType: string; prompt: string }> {
  const prompt = buildCharacterSheetPrompt(context, character) + (references.length
    ? "\n\nThe attached images are supplemental visual references for this character. The written character description is the primary specification. Borrow only compatible appearance details from the references; when they conflict, follow the written description. Create a new character sheet, not a copy of a reference image."
    : "");
  if (references.length && !/^(gpt-image-|chatgpt-image-latest$)/.test(CHARACTER_SHEET_MODEL)) {
    throw new Error("IMAGE_MODEL_EDIT_UNSUPPORTED");
  }
  const options = {
    model: CHARACTER_SHEET_MODEL,
    prompt,
    size: CHARACTER_SHEET_SIZE,
    quality: "high" as const,
    output_format: "jpeg" as const,
    output_compression: 92,
    background: "opaque" as const,
    n: 1,
  };
  const imageClient = client().images;
  const response = references.length
    ? await imageClient.edit({
        ...options,
        image: await Promise.all(references.map((reference, index) => toFile(
          reference.bytes,
          `character-reference-${index + 1}.${reference.mimeType === "image/jpeg" ? "jpg" : reference.mimeType.split("/")[1]}`,
          { type: reference.mimeType },
        ))),
      })
    : await imageClient.generate(options);
  const data = response.data?.[0]?.b64_json;
  if (!data) throw new Error("OpenAI가 캐릭터 시트 이미지를 반환하지 않았습니다.");
  return { data, mimeType: "image/jpeg", prompt };
}
