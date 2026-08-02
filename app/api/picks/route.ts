import { NextResponse } from "next/server";
import { ask, parseJson } from "@/lib/claude";
import { getModel, recentListens, upsertListen } from "@/lib/db";
import { dailyPicksSystem, listenLine } from "@/lib/prompts";
import { searchTrack } from "@/lib/spotify";
import type { Rec } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Jessica sceglie brani nuovi da sola, ogni notte: nessun input dell'utente.
 * Chiamata dal ciclo dream dopo il consolidamento, cosicché i consigli
 * riflettano il modello appena aggiornato.
 */
export async function POST() {
  const model = await getModel();
  const recent = await recentListens(8);

  const context = `ASCOLTI RECENTI:
${recent.map(listenLine).join("\n") || "- (nessuno)"}

Proponi brani nuovi che non compaiono sopra.`;

  const content = await ask(dailyPicksSystem(model), [{ role: "user", content: context }], 1200);
  const parsed = parseJson<{ recs: Rec[] }>(content, { recs: [] });

  const ids: number[] = [];
  for (const r of (parsed.recs ?? []).slice(0, 4)) {
    try {
      const hit = await searchTrack(r.artist, r.track);
      // "bridge" è pensato come un'etichetta corta accanto al titolo in
      // interfaccia: anche se il prompt lo chiede, un modello può ignorarlo
      // e restituire una frase — non deve mai rompere il layout della riga.
      const id = await upsertListen({
        artist: r.artist, track: r.track, album: r.album, spotify_url: hit?.url,
        meter: r.meter, dynamics: r.dynamics, production: r.production, era: r.era,
        bridge: r.bridge?.slice(0, 40), source: "rec",
      });
      ids.push(id);
    } catch { /* un brano non trovato non blocca gli altri */ }
  }

  return NextResponse.json({ picks: ids.length });
}
