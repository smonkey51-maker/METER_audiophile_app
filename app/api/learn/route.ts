import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual learning cycle. Unlike the passive two-hour Spotify collector, this
 * explicitly asks Jessica to re-read Spotify, consolidate memory and refresh
 * recommendations now instead of waiting for the nightly cycle.
 */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;

  try {
    const imported = await fetch(`${origin}/api/import`, { method: "POST" });
    const importBody = await imported.json().catch(() => ({}));
    if (!imported.ok) return NextResponse.json({ error: importBody.error ?? "Import Spotify fallito" }, { status: imported.status });

    const consolidated = await fetch(`${origin}/api/consolidate`, { method: "POST" });
    const consolidateBody = await consolidated.json().catch(() => ({}));
    if (!consolidated.ok) return NextResponse.json({ error: consolidateBody.error ?? "Consolidamento fallito" }, { status: consolidated.status });

    const picks = await fetch(`${origin}/api/picks`, { method: "POST" });
    const picksBody = await picks.json().catch(() => ({}));
    if (!picks.ok) return NextResponse.json({ error: picksBody.error ?? "Aggiornamento consigli fallito" }, { status: picks.status });

    return NextResponse.json({ ok: true, imported: importBody, consolidated: consolidateBody, picks: picksBody });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Apprendimento non riuscito" }, { status: 500 });
  }
}
