import { NextResponse } from "next/server";
import { ask, parseJson } from "@/lib/claude";
import { getModel, recentListens } from "@/lib/db";
import { curatorSystem, listenLine } from "@/lib/prompts";
import { searchTrack } from "@/lib/spotify";
import type { Rec } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { text, rig, history = [] } = await req.json();
  const model = await getModel();
  const recent = await recentListens(8);

  const context = `ASCOLTI RECENTI NON CONSOLIDATI:
${recent.map(listenLine).join("\n") || "- (nessuno)"}

RICHIESTA: ${text}`;

  const content = await ask(
    curatorSystem(model, rig),
    [...history.slice(-8), { role: "user", content: context }],
    1200
  );
  const parsed = parseJson<{ reply: string; recs: Rec[] }>(content, { reply: "—", recs: [] });

  // I link si risolvono in parallelo, dopo la generazione: è ciò che rende la risposta immediata.
  const recs = await Promise.all(
    (parsed.recs ?? []).slice(0, 3).map(async (r) => {
      try { return { ...r, ...(await searchTrack(r.artist, r.track)) }; }
      catch { return { ...r, url: "", uri: "" }; }
    })
  );

  return NextResponse.json({ reply: parsed.reply, recs });
}
