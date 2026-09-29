import { NextResponse } from "next/server";
import { extractPlanningDocText, PlanningDocError, PLANNING_DOC_MAX_BYTES, PLANNING_DOC_MAX_CHARS } from "@/lib/planningDoc";

export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "기획서 파일을 선택해 주세요." }, { status: 400 });
    if (file.size > PLANNING_DOC_MAX_BYTES) return NextResponse.json({ error: "4MB 이하 파일만 올릴 수 있어요." }, { status: 413 });
    const text = await extractPlanningDocText(file);
    return NextResponse.json({
      name: file.name.slice(0, 200),
      text: text.slice(0, PLANNING_DOC_MAX_CHARS),
      truncated: text.length > PLANNING_DOC_MAX_CHARS,
    });
  } catch (error) {
    if (error instanceof PlanningDocError) return NextResponse.json({ error: error.message }, { status: 415 });
    console.error("[planning-doc]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "기획서를 읽지 못했습니다. 내용을 직접 붙여넣어 주세요." }, { status: 500 });
  }
}
