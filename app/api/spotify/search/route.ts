import { NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await searchTracks(q) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
