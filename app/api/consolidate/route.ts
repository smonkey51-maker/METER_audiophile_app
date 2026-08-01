import { NextResponse } from "next/server";
import { ask, clampAxes, parseJson, MODEL_DEEP } from "@/lib/claude";
import { getModel, logCycle, markConsolidated, pendingListens, saveModel } from "@/lib/db";
import { CONSOLIDATE_SYSTEM, META_SYSTEM, listenLine } from "@/lib/prompts";
import { MAX_AXES, MAX_RULES, META_EVERY } from "@/lib/types";

export const maxDuration = 120;

/**
 * Dream cycle: Orient → Gather → Consolidate → Prune.
 * Processo separato dalla conversazione, senza accesso al contesto di chat.
 */
export async function POST() {
  const model = await getModel();
  const fresh = await pendingListens();
  if (!fresh.length) return NextResponse.json({ skipped: true, reason: "niente in coda" });

  const payload = `MODELLO ATTUALE:
${JSON.stringify({ axes: model.axes, rules: model.rules, summary: model.summary }, null, 1)}

NUOVE VOCI (${fresh.length}):
${fresh.map(listenLine).join("\n")}`;

  const content = await ask(CONSOLIDATE_SYSTEM, [{ role: "user", content: payload }], 1800, MODEL_DEEP);
  const next = parseJson<any>(content, null);
  if (!next?.axes) return NextResponse.json({ error: "consolidamento illeggibile" }, { status: 502 });

  const axes = clampAxes(next.axes, MAX_AXES);
  const cycles = model.cycles + 1;
  const changelog: string[] = (next.changelog ?? []).filter(Boolean).slice(0, 5);

  let updated = {
    ...model,
    axes,
    rules: (next.rules ?? []).filter(Boolean).slice(0, MAX_RULES),
    summary: next.summary || model.summary,
    changelog,
    cycles,
  };

  // Meta-consolidamento: l'identità di lungo periodo non viene mai potata.
  if (cycles % META_EVERY === 0) {
    try {
      const metaContent = await ask(META_SYSTEM, [{
        role: "user",
        content: `IDENTITÀ ATTUALE:\n${model.identity || "(nessuna)"}

ERE PRECEDENTI:
${model.eras.map((e) => `- ciclo ${e.n}: ${e.summary}`).join("\n") || "(nessuna)"}

MODELLO CORRENTE:
${JSON.stringify({ axes, rules: updated.rules, summary: updated.summary }, null, 1)}`,
      }], 800, MODEL_DEEP);
      const meta = parseJson<any>(metaContent, null);
      if (meta?.identity) {
        updated = {
          ...updated,
          identity: meta.identity,
          eras: [...model.eras, { n: cycles, summary: meta.era || updated.summary }].slice(-24),
        };
        changelog.push("Identità di lungo periodo aggiornata.");
        await logCycle(cycles, "meta", [meta.era ?? ""], axes);
      }
    } catch { /* l'identità resta quella precedente */ }
  }

  await saveModel(updated);
  await markConsolidated(fresh.map((f) => f.id!).filter(Boolean));
  await logCycle(cycles, "consolidate", changelog, axes);

  return NextResponse.json({ model: updated, consumed: fresh.length });
}
