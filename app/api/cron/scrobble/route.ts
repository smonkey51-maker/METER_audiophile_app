import { NextResponse } from "next/server";
import { upsertListen } from "@/lib/db";
import { recentlyPlayed } from "@/lib/spotify";

export const dynamic = "force-dynamic";

/**
 * Ogni 30 minuti. È questo che cattura ciò che ascolti in auto alle otto di mattina:
 * l'endpoint recently-played non richiede che l'app sia aperta.
 */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }
  try {
    const since = Date.now() - 1000 * 60 * 45;
    const items = await recentlyPlayed(since);
    for (const i of items) {
      await upsertListen({
        artist: i.artist, track: i.track, album: i.album, spotify_url: i.url,
        verdict: null, dims: [], source: "spotify", plays: 1, played_at: i.played_at,
      });
    }
    return NextResponse.json({ captured: items.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
