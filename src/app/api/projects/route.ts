import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId 필요" }, { status: 400 });

  const result = await db.select().from(projects).where(eq(projects.userId, userId));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { userId, title, genre, targetCompetition, deadline } = await req.json();
  if (!userId || !title) {
    return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
  }

  const [project] = await db
    .insert(projects)
    .values({ userId, title, genre, targetCompetition, deadline: deadline ? new Date(deadline) : null })
    .returning();

  return NextResponse.json(project, { status: 201 });
}
