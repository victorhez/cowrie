import { NextResponse } from "next/server";
import { ask } from "@/lib/secretary-model";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST {circle, question}: read-only secretary. Model mode when NEAR_AI_API_KEY is set, rules-based otherwise or on failure. */
export async function POST(req: Request) {
  let b: { circle?: number; question?: string } = {};
  try { b = await req.json(); } catch { /* handled below */ }
  const circle = Number(b.circle), question = String(b.question ?? "").slice(0, 300);
  if (!Number.isInteger(circle) || circle < 0 || !question.trim()) return NextResponse.json({ error: "send {circle, question}" }, { status: 400 });
  try { return NextResponse.json(await ask(circle, question)); }
  catch { return NextResponse.json({ error: "could not read the chain; try again" }, { status: 502 }); }
}
