import { NextResponse } from "next/server";
import { getScore } from "@/lib/score";

export const dynamic = "force-dynamic";
const ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;

/** GET /api/score/<testnet account>: the Cowrie Score and the inputs that produced it, read from the chain. */
export async function GET(_req: Request, { params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  if (!ID.test(account)) return NextResponse.json({ error: "invalid NEAR account id" }, { status: 400 });
  try { return NextResponse.json(await getScore(account)); }
  catch { return NextResponse.json({ error: "could not read the credential contract; try again" }, { status: 502 }); }
}
