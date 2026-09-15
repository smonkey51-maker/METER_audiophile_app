import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Alle 4:00: Jessica consolida ciò che METER ha raccolto durante il giorno
 * e sceglie i consigli successivi. La raccolta Spotify frequente è separata
 * in /api/cron/spotify-sync: questo ciclo resta il momento di riflessione,
 * non un semplice polling.
 *
 * Manteniamo anche il reimport completo del profilo una volta al giorno:
 * aggiorna top artist, libreria e traiettoria di lungo periodo, mentre lo
 * scrobble frequente conserva gli ascolti tra un ciclo e l'altro.
 */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

  let reimport: unknown = { skipped: true };
  try {
    const r = await fetch(`${base}/api/import`, { method: "POST" });
    reimport = await r.json();
  } catch (e: any) {
    reimport = { error: e.message };
  }

  const res = await fetch(`${base}/api/consolidate`, { method: "POST" });
  const consolidate = await res.json();

  let picks: unknown = { skipped: true };
  try {
    const p = await fetch(`${base}/api/picks`, { method: "POST" });
    picks = await p.json();
  } catch (e: any) {
    picks = { error: e.message };
  }

  return NextResponse.json({ reimport, consolidate, picks });
}
