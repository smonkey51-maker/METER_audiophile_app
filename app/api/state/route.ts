import { NextResponse } from "next/server";
import { getModel, recentListens, pendingListens } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [model, listens, pending] = await Promise.all([
      getModel(), recentListens(60), pendingListens(),
    ]);
    return NextResponse.json({ model, listens, pending: pending.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "memoria non raggiungibile" }, { status: 503 });
  }
}
