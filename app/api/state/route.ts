import { NextResponse } from "next/server";
import { getModel, recentListens, pendingListens } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [model, listens, pending] = await Promise.all([
    getModel(), recentListens(60), pendingListens(),
  ]);
  return NextResponse.json({ model, listens, pending: pending.length });
}
