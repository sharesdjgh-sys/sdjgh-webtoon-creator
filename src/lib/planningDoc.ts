import "server-only";

import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export const PLANNING_DOC_MAX_BYTES = 4 * 1024 * 1024;
export const PLANNING_DOC_MAX_CHARS = 30_000;

export class PlanningDocError extends Error {}

function decodeText(buffer: Buffer): string {
  // 한국어 Windows 메모장은 EUC-KR(CP949)로 저장하는 경우가 많습니다.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr").decode(buffer);
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

async function hwpxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sections = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!sections.length) throw new PlanningDocError("HWPX 문서에서 본문을 찾지 못했습니다.");
  const paragraphs: string[] = [];
  for (const name of sections) {
    const xml = await zip.file(name)!.async("string");
    for (const paragraph of xml.split(/<\/(?:\w+:)?p>/)) {
      const runs = [...paragraph.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)]
        .map((match) => decodeXmlEntities(match[1].replace(/<[^>]+>/g, "")));
      if (runs.length) paragraphs.push(runs.join(""));
    }
  }
  return paragraphs.join("\n");
}

async function pdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function extractPlanningDocText(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  if (extension === "txt" || extension === "md") text = decodeText(buffer);
  else if (extension === "docx") text = (await mammoth.extractRawText({ buffer })).value;
  else if (extension === "pdf") text = await pdfText(buffer);
  else if (extension === "hwpx") text = await hwpxText(buffer);
  else if (extension === "hwp") throw new PlanningDocError("한글(.hwp) 파일은 한글에서 '다른 이름으로 저장'으로 HWPX 또는 PDF로 저장한 뒤 올려 주세요.");
  else throw new PlanningDocError("TXT, MD, DOCX, PDF, HWPX 파일만 올릴 수 있어요.");

  const normalized = text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) throw new PlanningDocError("문서에서 글자를 찾지 못했습니다. 스캔한 이미지 PDF라면 내용을 직접 붙여넣어 주세요.");
  return normalized;
}
