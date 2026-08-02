import { NextResponse } from "next/server";
import { trackArt } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const artist = searchParams.get("artist");
  const track = searchParams.get("track");
  if (!artist || !track) return NextResponse.json({ art: null });
  try {
    return NextResponse.json({ art: await trackArt(artist, track) });
  } catch {
    return NextResponse.json({ art: null });
  }
}
