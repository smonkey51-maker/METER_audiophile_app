import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * Due modelli, non uno. Conversazione e memoria girano sul modello economico:
 * sono turni brevi, frequenti, e un errore si corregge nel turno dopo.
 * Consolidamento e innesto girano sul modello capace: riscrivono il modello
 * appreso una volta al giorno, e un asse sbagliato lì resta per settimane.
 * Entrambi sovrascrivibili da env se vuoi spostare l'ago su costo o qualità.
 */
export const MODEL_FAST = process.env.CLAUDE_MODEL_FAST || "claude-haiku-4-5";
export const MODEL_DEEP = process.env.CLAUDE_MODEL_DEEP || "claude-sonnet-4-6";

/**
 * Il system prompt è marcato per il caching: identità, assi e regole non cambiano
 * tra una richiesta e l'altra, quindi in lettura costano il 10%. Attenzione alla
 * soglia minima: sotto i 4096 token di prefisso Haiku non mette niente in cache
 * (Sonnet si ferma a 1024), quindi all'inizio, con pochi assi, lo sconto non c'è.
 */
export async function ask(
  system: string,
  messages: Anthropic.MessageParam[],
  maxTokens = 1200,
  model: string = MODEL_FAST,
) {
  const res = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  });
  return res.content;
}

/** Estrae l'ultimo JSON valido tra i blocchi di testo. */
export function parseJson<T>(content: unknown[], fallback: T): T {
  const texts = (content as any[])
    .filter((b) => b?.type === "text")
    .map((b) => String(b.text ?? ""));
  for (let i = texts.length - 1; i >= 0; i--) {
    const c = texts[i].replace(/```json|```/g, "").trim();
    const s = c.indexOf("{"), e = c.lastIndexOf("}");
    if (s === -1 || e === -1) continue;
    try { return JSON.parse(c.slice(s, e + 1)) as T; } catch { /* blocco precedente */ }
  }
  return fallback;
}

export function clampAxes(raw: any[], max: number, ceiling = 0.95) {
  return (raw ?? [])
    .map((a) => ({
      title: String(a?.title ?? "").trim(),
      claim: String(a?.claim ?? "").trim(),
      confidence: Math.max(0, Math.min(ceiling, Number(a?.confidence) || 0.4)),
      evidence: Math.max(1, Number(a?.evidence) || 1),
      trace: Array.isArray(a?.trace) ? a.trace.filter(Boolean).slice(0, 3) : [],
    }))
    .filter((a) => a.claim && a.confidence >= 0.25)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, max);
}
