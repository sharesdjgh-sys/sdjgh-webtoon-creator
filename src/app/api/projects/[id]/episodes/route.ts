import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { episodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.select().from(episodes).where(eq(episodes.projectId, id));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { episodes: eps } = await req.json();

  await db.delete(episodes).where(eq(episodes.projectId, id));

  if (eps.length > 0) {
    const toInsert = eps.map((e: Record<string, unknown>) => ({
      projectId: id,
      episodeNumber: e.episodeNumber as number,
      title: e.title as string,
      synopsis: e.synopsis as string,
      script: e.script as string,
      isCompleted: e.isCompleted as boolean,
    }));
    await db.insert(episodes).values(toInsert);
  }

  const result = await db.select().from(episodes).where(eq(episodes.projectId, id));
  return NextResponse.json(result);
}
