import { NextResponse } from "next/server";
import { ask, clampAxes, parseJson } from "@/lib/claude";
import { getModel, logCycle, saveModel, upsertListen } from "@/lib/db";
import { SEED_SYSTEM } from "@/lib/prompts";
import { fullProfile } from "@/lib/spotify";
import { MAX_AXES } from "@/lib/types";

export const maxDuration = 180;

/**
 * Innesto: legge il profilo Spotify per intero e ne ricava un modello iniziale.
 * Gli assi nascono sotto 0.45 — sono inferenze dal volume d'ascolto, non giudizi.
 */
export async function POST() {
  let p;
  try { p = await fullProfile(); }
  catch (e: any) { return NextResponse.json({ error: e.message ?? "spotify non autorizzato" }, { status: 401 }); }

  const body = `ARTISTI PIÙ ASCOLTATI — SEMPRE (${p.topArtistsAllTime.length}): ${p.topArtistsAllTime.join(", ")}
ARTISTI PIÙ ASCOLTATI — ULTIMI 6 MESI: ${p.topArtistsSixMonths.join(", ")}
ARTISTI PIÙ ASCOLTATI — ULTIMO MESE: ${p.topArtistsMonth.join(", ")}
GENERI RICORRENTI — SEMPRE: ${p.genresAllTime.join(", ")}
GENERI RICORRENTI — ULTIMO MESE: ${p.genresMonth.join(", ")}
BRANI PIÙ ASCOLTATI — SEMPRE: ${p.topTracksAllTime.join(" | ")}
BRANI PIÙ ASCOLTATI — ULTIMO MESE: ${p.topTracksMonth.join(" | ")}
LIBRERIA SALVATA: ${p.savedTracks.join(" | ")}
ARTISTI SEGUITI: ${p.following.join(", ")}
ASCOLTATI DI RECENTE: ${p.recent.map((r: any) => `${r.artist} — ${r.track}`).join(" | ")}`;

  const content = await ask(SEED_SYSTEM, [{ role: "user", content: body }], 2000);
  const seed = parseJson<any>(content, null);
  if (!seed?.axes) return NextResponse.json({ error: "innesto illeggibile" }, { status: 502 });

  const model = await getModel();
  const axes = clampAxes(seed.axes, MAX_AXES, 0.45);
  const taste = [...new Set([...model.taste, ...(seed.newArtists ?? []).filter(Boolean)])].slice(0, 40);

  const updated = {
    ...model,
    axes: [...axes, ...model.axes].slice(0, MAX_AXES),
    identity: seed.identity || model.identity,
    summary: seed.summary || model.summary,
    taste,
    changelog: [`Innesto dal profilo Spotify: ${axes.length} assi iniziali, ${taste.length - model.taste.length} artisti aggiunti.`],
  };

  await saveModel(updated);
  await logCycle(model.cycles, "import", updated.changelog, axes);

  // La cronologia recente entra nel registro come esposizione, già consolidata.
  for (const r of p.recent.slice(0, 50)) {
    await upsertListen({ ...r, spotify_url: r.url, verdict: null, dims: [], source: "import", plays: 1, consolidated: true });
  }

  return NextResponse.json({ model: updated, gaps: seed.gaps ?? [] });
}
