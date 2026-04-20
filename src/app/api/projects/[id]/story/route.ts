import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [story] = await db.select().from(stories).where(eq(stories.projectId, id)).limit(1);
  return NextResponse.json(story ?? null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db.select().from(stories).where(eq(stories.projectId, id)).limit(1);
  if (existing) {
    const [updated] = await db
      .update(stories)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(stories.projectId, id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db.insert(stories).values({ projectId: id, ...body }).returning();
  return NextResponse.json(created, { status: 201 });
}
