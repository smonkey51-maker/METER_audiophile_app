import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Alle 4:00. Consolidare a ore morte invece che a soglia di reazioni:
 * la memoria si assesta mentre dormi e la mattina il modello è cambiato.
 *
 * Il riaggiornamento dal profilo Spotify e la scelta dei consigli del
 * giorno girano nello stesso ciclo, incatenati: nessuno dei due ha un
 * cron dedicato (il piano Hobby ne ammette uno solo al giorno per
 * progetto, già preso da questo). Jessica propone dopo il consolidamento,
 * così i consigli riflettono il modello appena aggiornato.
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
