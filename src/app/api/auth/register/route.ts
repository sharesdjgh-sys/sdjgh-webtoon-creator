import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password, name, school, grade } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "필수 정보를 입력해주세요." }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ email, name, passwordHash, school, grade }).returning();

  return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
}
