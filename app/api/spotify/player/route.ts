import { NextResponse } from "next/server";
import { nextTrack, pausePlayback, play, playbackState, previousTrack } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ state: await playbackState() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}

/** Comanda il dispositivo Spotify già attivo: nessun audio passa da qui. */
export async function POST(req: Request) {
  const { action, uri } = await req.json();
  try {
    if (action === "play") await play(uri);
    else if (action === "pause") await pausePlayback();
    else if (action === "next") await nextTrack();
    else if (action === "previous") await previousTrack();
    else return NextResponse.json({ error: "azione sconosciuta" }, { status: 400 });
    return NextResponse.json({ state: await playbackState() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
