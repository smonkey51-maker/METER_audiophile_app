import { NextResponse } from "next/server";
import { ask, parseJson } from "@/lib/claude";
import { getModel, saveModel } from "@/lib/db";
import { memorySystem } from "@/lib/prompts";
import { MAX_AXES, MAX_RULES } from "@/lib/types";

export const maxDuration = 60;

/** Conversazione sul modello. Le modifiche le propone, non le applica. */
export async function POST(req: Request) {
  const { text, history = [] } = await req.json();
  const model = await getModel();
  const content = await ask(memorySystem(model), [...history.slice(-10), { role: "user", content: text }], 1000);
  const parsed = parseJson<{ reply: string; ops: any[] }>(content, { reply: "—", ops: [] });
  return NextResponse.json(parsed);
}

/** Applica una singola proposta, dopo approvazione esplicita dell'utente. */
export async function PATCH(req: Request) {
  const op = await req.json();
  const m = await getModel();
  const axes = [...m.axes], rules = [...m.rules];

  if (op.type === "add_axis") axes.push({ claim: op.claim, confidence: Math.min(0.95, op.confidence ?? 0.5), evidence: 1, trace: [] });
  if (op.type === "edit_axis" && axes[op.index]) axes[op.index] = { ...axes[op.index], claim: op.claim || axes[op.index].claim, confidence: Math.min(0.95, op.confidence ?? axes[op.index].confidence) };
  if (op.type === "drop_axis") axes.splice(op.index, 1);
  if (op.type === "add_rule") rules.push(op.claim);
  if (op.type === "drop_rule") rules.splice(op.index, 1);

  const next = { ...m, axes: axes.slice(0, MAX_AXES), rules: rules.slice(0, MAX_RULES) };
  await saveModel(next);
  return NextResponse.json({ model: next });
}
