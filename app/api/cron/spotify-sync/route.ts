import { NextResponse } from "next/server";
import { upsertListen } from "@/lib/db";
import { recentlyPlayed } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Raccolta silenziosa: importa gli ascolti Spotify recenti senza far
 * consolidare Jessica. Il pensiero resta nel ciclo notturno; qui si limita
 * a prendere appunti mentre METER è chiuso.
 *
 * `after` è volutamente più largo di due ore: se un'esecuzione salta,
 * recuperiamo comunque gli ascolti. `upsertListen` deduplica per brano e
 * incrementa il numero di riproduzioni.
 */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }

  const lookbackMs = 6 * 60 * 60 * 1000;
  let recent;
  try {
    recent = await recentlyPlayed(Date.now() - lookbackMs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "spotify non autorizzato" }, { status: 502 });
  }

  for (const r of recent) {
    await upsertListen({
      ...r,
      spotify_url: r.url,
      verdict: null,
      dims: [],
      source: "spotify",
      plays: 1,
      consolidated: false,
    });
  }

  return NextResponse.json({ ok: true, imported: recent.length, at: new Date().toISOString() });
}
