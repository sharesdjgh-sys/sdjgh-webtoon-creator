import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.select().from(characters).where(eq(characters.projectId, id));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { characters: chars } = await req.json();

  // 기존 캐릭터 삭제 후 재삽입
  await db.delete(characters).where(eq(characters.projectId, id));

  if (chars.length > 0) {
    const toInsert = chars.map((c: Record<string, string>) => ({
      projectId: id,
      name: c.name || "이름 없음",
      role: c.role,
      age: c.age,
      appearance: c.appearance,
      personality: c.personality,
      backstory: c.backstory,
    }));
    await db.insert(characters).values(toInsert);
  }

  const result = await db.select().from(characters).where(eq(characters.projectId, id));
  return NextResponse.json(result);
}
