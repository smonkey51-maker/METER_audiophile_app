"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Ring from "./Ring";
import { DIMS, EMPTY_MODEL, RIGS, VERDICTS, type Listen, type Model, type Rec, type Verdict } from "@/lib/types";

type Msg = { role: "user" | "agent"; text: string };
type Op = { type: string; index?: number; claim?: string; confidence?: number; reason?: string };
type Playback = { isPlaying: boolean; track: string; artist: string; device?: string };
type SearchHit = { artist: string; track: string; album?: string; url: string; uri: string };

// Da dove viene ogni voce del registro: la fonte pesa quanto il giudizio,
// va sempre leggibile, mai dedotta dal contesto.
const SOURCE_LABEL: Record<Listen["source"], string> = {
  spotify: "Spotify", manual: "Manuale", rec: "Consiglio", import: "Innesto",
};

export default function Meter() {
  // Lo strumento nasce acceso al buio: il pannello chiaro è la variante da laboratorio.
  const [dark, setDark] = useState(true);
  const [model, setModel] = useState<Model>(EMPTY_MODEL);
  const [listens, setListens] = useState<Listen[]>([]);
  const [pending, setPending] = useState(0);
  const [rig, setRig] = useState<string>("aperte");
  const [ready, setReady] = useState(false);

  const [mode, setMode] = useState<"curatore" | "memoria">("curatore");
  const [chat, setChat] = useState<Msg[]>([{ role: "agent", text: "Da dove partiamo? Un umore, un artista da cui divergere, o un difetto che non sopporti più." }]);
  const [memChat, setMemChat] = useState<Msg[]>([{ role: "agent", text: "Chiedimi cosa ho capito del tuo ascolto, o correggimi se ho generalizzato male." }]);
  const [ops, setOps] = useState<Op[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"modello" | "profilo" | "registro">("modello");

  const [rating, setRating] = useState<{ rec: Partial<Rec> & { id?: number }; verdict: Verdict | null; dims: string[] } | null>(null);
  const [manual, setManual] = useState({ open: false, artist: "", track: "" });
  const [dreaming, setDreaming] = useState(false);
  const [importing, setImporting] = useState(false);
  const [gaps, setGaps] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const memHistory = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [chat, memChat, busy, mode]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const flash = useCallback((t: string) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  // Spotify torna qui con ?spotify=ok|error dopo il consenso: è l'unico momento
  // in cui l'esito del collegamento è noto, va detto subito o si perde.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("spotify");
    if (s === "ok") flash("Spotify collegato con successo.");
    if (s === "error") flash("Collegamento a Spotify fallito. Riprova.");
    if (s) {
      params.delete("spotify");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, [flash]);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/state").then((x) => x.json());
    setModel(r.model); setListens(r.listens ?? []); setPending(r.pending ?? 0);
  }, []);

  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);

  const refreshPlayback = useCallback(async () => {
    const r = await fetch("/api/spotify/player").then((x) => x.json()).catch(() => ({ state: null }));
    setPlayback(r.state ?? null);
  }, []);

  // Il telecomando non ha eventi push: un poll leggero è l'unico modo per
  // accorgersi che hanno cambiato brano da un altro dispositivo.
  useEffect(() => {
    refreshPlayback();
    const t = setInterval(refreshPlayback, 15000);
    return () => clearInterval(t);
  }, [refreshPlayback]);

  async function playerAction(action: "play" | "pause" | "next" | "previous", uri?: string) {
    const r = await fetch("/api/spotify/player", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, uri }),
    }).then((x) => x.json()).catch(() => ({ error: "comando fallito" }));
    if (r.error) { flash(r.error); return; }
    setPlayback(r.state ?? null);
  }

  async function runSearch() {
    const q = searchQuery.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`).then((x) => x.json());
      if (r.error) { flash("Ricerca non autorizzata: collega Spotify."); return; }
      setSearchResults(r.results ?? []);
    } catch { flash("Ricerca fallita."); }
    finally { setSearching(false); }
  }

  const kept = useMemo(() => listens.filter((l) => l.verdict === "keep"), [listens]);
  const unjudged = useMemo(() => listens.filter((l) => !l.verdict).slice(0, 8), [listens]);
  const messages = mode === "curatore" ? chat : memChat;

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    (mode === "curatore" ? setChat : setMemChat)((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      if (mode === "curatore") {
        const r = await fetch("/api/curate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, rig, history: history.current }),
        }).then((x) => x.json());
        history.current = [...history.current, { role: "user" as const, content: text }, { role: "assistant" as const, content: JSON.stringify(r) }].slice(-8);
        setChat((m) => [...m, { role: "agent", text: r.reply ?? "—" }]);
        setRecs(r.recs ?? []);
      } else {
        const r = await fetch("/api/memory", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, history: memHistory.current }),
        }).then((x) => x.json());
        memHistory.current = [...memHistory.current, { role: "user" as const, content: text }, { role: "assistant" as const, content: JSON.stringify(r) }].slice(-10);
        setMemChat((m) => [...m, { role: "agent", text: r.reply ?? "—" }]);
        setOps(r.ops ?? []);
      }
    } catch { flash("Chiamata fallita."); }
    finally { setBusy(false); }
  }

  async function applyOp(op: Op, i: number) {
    const r = await fetch("/api/memory", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(op),
    }).then((x) => x.json());
    setModel(r.model);
    setOps((o) => o.filter((_, k) => k !== i));
    flash("Modello aggiornato.");
  }

  async function commitRating() {
    if (!rating?.verdict) return;
    const { rec, verdict, dims } = rating;
    await fetch("/api/log", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artist: rec.artist, track: rec.track, album: rec.album, spotify_url: rec.url,
        verdict, dims, rig, meter: rec.meter, dynamics: rec.dynamics,
        production: rec.production, era: rec.era, bridge: rec.bridge,
        source: rec.id ? "spotify" : "rec",
      }),
    });
    setRecs((x) => x.filter((y) => !(y.artist === rec.artist && y.track === rec.track)));
    setRating(null);
    await refresh();
    flash(`${rec.track}: ${VERDICTS.find((v) => v.key === verdict)!.label}`);
  }

  async function consolidate() {
    if (dreaming || !pending) return;
    setDreaming(true);
    try {
      const r = await fetch("/api/consolidate", { method: "POST" }).then((x) => x.json());
      if (r.model) { setModel(r.model); history.current = []; memHistory.current = []; setTab("modello"); }
      await refresh();
      flash(r.model ? `Consolidato: ${r.model.axes.length} assi attivi.` : "Niente da consolidare.");
    } catch { flash("Consolidamento fallito."); }
    finally { setDreaming(false); }
  }

  async function runImport() {
    if (importing) return;
    setImporting(true);
    try {
      const r = await fetch("/api/import", { method: "POST" }).then((x) => x.json());
      if (r.error) { flash("Spotify non autorizzato: collega l'account."); return; }
      setModel(r.model); setGaps(r.gaps ?? []); setImportSummary(r.model.changelog?.[0] ?? "Profilo Spotify importato."); setTab("modello");
      await refresh();
      flash("Profilo Spotify importato.");
    } catch { flash("Importazione fallita."); }
    finally { setImporting(false); }
  }

  if (!ready) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="led pulse" />
          <span className="label warmup">Carico la memoria</span>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh" }}>
      {/* barra */}
      <div className="bar">
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "18px 28px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {/* Marchio serigrafato + LED di alimentazione: acceso quando l'agente lavora. */}
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              className={busy || dreaming || importing ? "led pulse" : "led"}
              title={busy || dreaming || importing ? "Al lavoro" : "In attesa"}
            />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>
              METER
            </span>
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn--ghost btn--sm" href="/api/spotify/login" style={{ textDecoration: "none" }}>
              Collega a Spotify
            </a>
            <button className="btn btn--ghost btn--sm" onClick={runImport} disabled={importing}>
              {importing ? "Leggo il profilo…" : model.cycles || model.axes.length ? "Riaggiorna dal profilo" : "Importa da Spotify"}
            </button>
            <select className="btn btn--sm" value={rig} onChange={(e) => setRig(e.target.value)} style={{ appearance: "none" }}>
              {RIGS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <button className={`btn btn--sm ${pending ? "btn--pri" : ""}`} onClick={consolidate} disabled={!pending || dreaming}>
              {dreaming ? "Consolido…" : <>Consolida <span className="tnum">{pending}</span></>}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setDark((d) => !d)}>{dark ? "Chiaro" : "Scuro"}</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 28px 96px" }}>
        {/* tesi */}
        <section className="rise" style={{ maxWidth: 820, marginBottom: 40, display: "flex", gap: 32, alignItems: "flex-start" }}>
          {/* L'indicatore: unico strumento a quadrante della pagina, sempre acceso. */}
          <div style={{ position: "relative", flexShrink: 0, paddingTop: 4, isolation: "isolate" }}>
            <Ring value={Math.min(1, model.cycles / 8)} size={112} live={dreaming} accent="var(--accent)" core={false} />
            <span
              className="label tnum"
              style={{
                position: "absolute", inset: 0, display: "grid", placeItems: "center",
                fontSize: 19, letterSpacing: 0, color: "var(--ink)", paddingTop: 4,
              }}
            >
              {model.cycles}
            </span>
          </div>
          <div>
            <p className="label" style={{ marginBottom: 12 }}>
              {model.cycles ? `Modello dopo ${model.cycles} ${model.cycles === 1 ? "ciclo" : "cicli"}` : "Nessun consolidamento"}
            </p>
            {model.identity ? (
              <>
                {/* L'identità non è uno slogan: è un paragrafo analitico, va letto
                    a corpo normale. La classe "display" resta solo per il testo
                    breve dello stato vuoto — ingrandire un paragrafo lo rompe. */}
                <p className="warmup" style={{ fontSize: 20, lineHeight: 1.55, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink)" }}>
                  {model.identity}
                </p>
                {model.summary && (
                  <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--mute)", marginTop: 14 }}>{model.summary}</p>
                )}
              </>
            ) : (
              <p className="display warmup">
                {model.summary || "Non so ancora niente del tuo ascolto. Importa il profilo Spotify, oppure chiedi un consiglio e giudicalo."}
              </p>
            )}
          </div>
        </section>

        {/* Telecomando: nessun audio passa da qui, comanda il dispositivo Spotify già attivo. */}
        <section className="block rise" style={{ padding: 24, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <p className="label" style={{ marginBottom: 6 }}>
                {playback ? `In ascolto${playback.device ? " su " + playback.device : ""}` : "Ora in ascolto"}
              </p>
              <p style={{ fontSize: 16.5 }}>
                {playback
                  ? <>{playback.track} <span style={{ color: "var(--mute)" }}>· {playback.artist}</span></>
                  : <span style={{ color: "var(--mute)" }}>Nessuna riproduzione attiva. Apri Spotify su un dispositivo.</span>}
              </p>
            </div>
            {playback && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => playerAction("previous")} aria-label="Precedente">⏮</button>
                <button className="btn btn--pri btn--sm" onClick={() => playerAction(playback.isPlaying ? "pause" : "play")} aria-label={playback.isPlaying ? "Pausa" : "Riproduci"}>
                  {playback.isPlaying ? "⏸" : "▶"}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => playerAction("next")} aria-label="Successiva">⏭</button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <input className="field" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Cerca un brano su Spotify" />
            <button className="btn btn--sm" onClick={runSearch} disabled={searching || !searchQuery.trim()}>
              {searching ? "Cerco…" : "Cerca"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {searchResults.map((r) => (
                <div key={r.uri} className="recess" style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15.5, minWidth: 0 }}>{r.track} <span style={{ color: "var(--mute)" }}>· {r.artist}</span></span>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn btn--sm" onClick={() => playerAction("play", r.uri)}>Riproduci</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setRating({ rec: { artist: r.artist, track: r.track, album: r.album, url: r.url }, verdict: null, dims: [] })}>Giudica</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {(importSummary || gaps.length > 0) && (
          <section className="block pop" style={{ padding: 24, marginBottom: 32, maxWidth: 760, display: "flex", gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              {importSummary && (
                <p style={{ fontSize: 16.5, lineHeight: 1.5, marginBottom: gaps.length > 0 ? 16 : 0 }}>{importSummary}</p>
              )}
              {gaps.length > 0 && (
                <>
                  <p className="label" style={{ marginBottom: 10 }}>A cui il profilo non risponde</p>
                  {gaps.map((g, i) => <p key={i} style={{ fontSize: 16.5, lineHeight: 1.5, marginBottom: 8 }}>{g}</p>)}
                </>
              )}
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => { setImportSummary(null); setGaps([]); }}>Chiudi</button>
          </section>
        )}

        {/* modalità */}
        <div className="recess" style={{ display: "inline-flex", gap: 4, padding: 4, marginBottom: 20 }}>
          {([["curatore", "Consiglia"], ["memoria", "Interroga"]] as const).map(([k, l]) => (
            <button key={k} className="btn btn--sm" onClick={() => setMode(k)}
              style={{ background: mode === k ? "var(--form)" : "transparent", color: mode === k ? "var(--ink)" : "var(--mute)", boxShadow: mode === k ? "var(--lift-1)" : "none" }}>
              {l}
            </button>
          ))}
        </div>

        <div className="cols">
          <section style={{ minWidth: 0 }}>
            <div ref={scroller} className="block scroll" style={{ height: 290, overflowY: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
              {messages.map((m, i) => (
                <div key={i} className="rise" style={{ maxWidth: "92%", alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "agent" && <p className="label" style={{ marginBottom: 6 }}>METER</p>}
                  <p style={{ fontSize: 17.5, lineHeight: 1.5, color: m.role === "user" ? "var(--mute)" : "var(--ink)", textAlign: m.role === "user" ? "right" : "left" }}>{m.text}</p>
                </div>
              ))}
              {busy && <p className="label pulse">…</p>}
            </div>

            {mode === "memoria" && ops.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p className="label" style={{ marginBottom: 10 }}>Proposte di modifica</p>
                {ops.map((op, i) => (
                  <div key={i} className="block pop" style={{ padding: 20, marginBottom: 8, display: "flex", gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="label" style={{ marginBottom: 5 }}>{op.type.replace("_", " ")}</p>
                      <p style={{ fontSize: 16.5, lineHeight: 1.45 }}>{op.claim || `indice ${op.index}`}</p>
                      {op.reason && <p style={{ fontSize: 15.5, color: "var(--mute)", marginTop: 5, lineHeight: 1.45 }}>{op.reason}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button className="btn btn--pri btn--sm" onClick={() => applyOp(op, i)}>Applica</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setOps((o) => o.filter((_, k) => k !== i))}>Scarta</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input className="field" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={mode === "curatore" ? "Dinamica ampia, niente remaster compressi…" : "Da dove viene l'asse sul timbro?"} />
              <button className="btn btn--pri" onClick={() => send()} disabled={busy || !input.trim()}>Invia</button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {(mode === "curatore"
                ? ["Divergi dal mio ascolto recente", "Testa un asse incerto", "Registrazioni analogiche", "Sorprendimi"]
                : ["Cosa hai capito?", "L'asse più debole", "Contraddizioni?", "Come sono cambiato?"]
              ).map((q) => <button key={q} className="btn btn--sm" onClick={() => send(q)} disabled={busy}>{q}</button>)}
            </div>

            {mode === "curatore" && (
              <div style={{ marginTop: 44 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p className="label">In valutazione</p>
                  <button className="btn btn--ghost btn--sm" onClick={() => setManual({ open: true, artist: "", track: "" })}>+ Registra un ascolto</button>
                </div>

                {recs.length === 0 && !busy && (
                  <p style={{ color: "var(--mute)", fontSize: 17, lineHeight: 1.55, maxWidth: 560 }}>
                    Niente in coda. Il modello impara dalle dimensioni, non dai verdetti: quando giudichi, dichiara <em>cosa</em> ha funzionato o rotto.
                  </p>
                )}

                {recs.map((r, i) => (
                  <article key={`${r.artist}-${r.track}`} className="block rise" style={{ padding: 28, marginBottom: 12, animationDelay: `${i * 70}ms` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.028em", margin: 0 }}>{r.track}</h3>
                      <span style={{ fontSize: 15.5, color: "var(--mute)" }}>{r.artist}</span>
                    </div>
                    {r.learned && <p className="label" style={{ color: "var(--accent)", marginTop: 10 }}>Dal modello · {r.learned}</p>}

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px", margin: "20px 0" }}>
                      {([["Metrica", r.meter], ["Dinamica", r.dynamics], ["Produzione", r.production], ["Epoca", r.era]] as const).map(([k, v]) => (
                        <div key={k} style={{ minWidth: 104 }}>
                          <p className="label">{k}</p>
                          <p style={{ fontSize: 15.5, marginTop: 3 }}>{v || "—"}</p>
                        </div>
                      ))}
                    </div>

                    <p style={{ fontSize: 17, lineHeight: 1.55 }}>{r.why}</p>
                    <p className="label" style={{ marginTop: 12 }}>Ponte · {r.bridge || "—"}</p>

                    <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap" }}>
                      {r.url && <a className="btn btn--sm" href={r.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "var(--good)" }}>Ascolta</a>}
                      <button className="btn btn--pri btn--sm" onClick={() => setRating({ rec: r, verdict: null, dims: [] })}>Giudica</button>
                    </div>
                  </article>
                ))}

                {unjudged.length > 0 && (
                  <div style={{ marginTop: 44 }}>
                    <p className="label" style={{ marginBottom: 4 }}>Rilevati da Spotify — {unjudged.length}</p>
                    <p style={{ fontSize: 15.5, color: "var(--mute)", marginBottom: 14, lineHeight: 1.5, maxWidth: 520 }}>
                      Contano già come esposizione. Un giudizio li rende segnale forte.
                    </p>
                    {unjudged.map((e) => (
                      <div key={e.id} className="block" style={{ padding: "16px 22px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                        <span style={{ fontSize: 16, minWidth: 0 }}>
                          {e.track} <span style={{ color: "var(--mute)" }}>· {e.artist}</span>
                          {e.plays > 1 && <span className="tnum" style={{ color: "var(--accent)", marginLeft: 10, fontSize: 13.5 }}>{e.plays}×</span>}
                        </span>
                        <button className="btn btn--sm" onClick={() => setRating({ rec: { ...e, url: e.spotify_url, id: e.id }, verdict: null, dims: [] })}>Giudica</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* laterale */}
          <aside style={{ minWidth: 0 }}>
            <div className="recess" style={{ display: "flex", gap: 4, padding: 4, marginBottom: 18 }}>
              {([["modello", model.axes.length], ["profilo", model.taste.length], ["registro", listens.length]] as const).map(([t, n]) => (
                <button key={t} className="btn btn--sm" onClick={() => setTab(t as any)} style={{ flex: 1, background: tab === t ? "var(--form)" : "transparent", color: tab === t ? "var(--ink)" : "var(--mute)", boxShadow: tab === t ? "var(--lift-1)" : "none" }}>
                  {t} <span className="tnum" style={{ color: "var(--faint)" }}>{n}</span>
                </button>
              ))}
            </div>

            {tab === "modello" && (
              <div className="rise">
                {model.axes.length === 0 && <p style={{ color: "var(--mute)", fontSize: 16.5, lineHeight: 1.55 }}>Nessun asse. Importa il profilo, oppure giudica qualche brano.</p>}
                {model.axes.map((a, i) => (
                  <div key={i} className="block rise" style={{ padding: 22, marginBottom: 10, display: "flex", gap: 18, alignItems: "flex-start", animationDelay: `${i * 45}ms` }}>
                    <Ring value={a.confidence} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 16.5, lineHeight: 1.45 }}>{a.claim}</p>
                      {a.trace?.length > 0 && <p style={{ fontSize: 14.5, color: "var(--faint)", marginTop: 8, lineHeight: 1.5 }}>{a.trace.join(" · ")}</p>}
                      <p className="label tnum" style={{ marginTop: 8 }}>{a.confidence.toFixed(2)} · {a.evidence} evidenze</p>
                    </div>
                  </div>
                ))}

                {model.rules.length > 0 && (
                  <>
                    <p className="label" style={{ margin: "24px 0 10px" }}>Regole assolute</p>
                    {model.rules.map((r, i) => (
                      <div key={i} className="block" style={{ padding: "16px 22px", marginBottom: 8, fontSize: 16.5 }}>{r}</div>
                    ))}
                  </>
                )}

                {model.eras.length > 0 && (
                  <div className="recess" style={{ padding: 22, marginTop: 24 }}>
                    <p className="label" style={{ marginBottom: 12 }}>Ere precedenti</p>
                    {model.eras.slice().reverse().map((e, i) => (
                      <p key={i} style={{ fontSize: 15.5, color: "var(--mute)", lineHeight: 1.5, marginBottom: 8 }}>
                        <span className="tnum" style={{ color: "var(--faint)" }}>#{e.n}</span> · {e.summary}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "profilo" && (
              <div className="rise" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {model.taste.map((a) => <span key={a} className="btn btn--sm" style={{ cursor: "default" }}>{a}</span>)}
                {model.taste.length === 0 && <p style={{ color: "var(--mute)", fontSize: 16.5 }}>Profilo vuoto. Importa da Spotify.</p>}
              </div>
            )}

            {tab === "registro" && (
              <div className="rise">
                <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                  {VERDICTS.map((v) => (
                    <div key={v.key} className="block" style={{ flex: 1, padding: 20 }}>
                      <div className="tnum" style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1 }}>
                        {listens.filter((l) => l.verdict === v.key).length}
                      </div>
                      <div className="label" style={{ marginTop: 6 }}>{v.label}</div>
                    </div>
                  ))}
                </div>
                {listens.map((e) => (
                  <div key={e.id} className="block" style={{ padding: "16px 22px", marginBottom: 8, opacity: e.consolidated ? 0.66 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                      <span style={{ fontSize: 16, minWidth: 0 }}>{e.track} <span style={{ color: "var(--mute)" }}>· {e.artist}</span></span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <span className="label">{SOURCE_LABEL[e.source]}</span>
                        <span style={{ fontSize: 13.5, color: e.verdict ? "var(--accent)" : "var(--faint)", whiteSpace: "nowrap" }}>
                          {e.verdict ? VERDICTS.find((v) => v.key === e.verdict)!.label : `${e.plays}× ascoltato`}
                        </span>
                      </span>
                    </div>
                    {e.dims?.length > 0 && <p className="label" style={{ marginTop: 6 }}>{e.dims.join(" · ")}</p>}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* foglio di giudizio */}
      {rating && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setRating(null)}>
          <div className="block sheet" style={{ maxWidth: 470, width: "100%", padding: 30 }}>
            <p className="label">Giudizio</p>
            <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.028em", marginTop: 6 }}>{rating.rec.track}</p>
            <p style={{ fontSize: 15.5, color: "var(--mute)", marginTop: 2 }}>{rating.rec.artist}</p>

            <div style={{ display: "flex", gap: 8, margin: "26px 0" }}>
              {VERDICTS.map((v) => (
                <button key={v.key} className="btn btn--sm" title={v.hint} style={{ flex: 1, background: rating.verdict === v.key ? "var(--accent)" : "var(--recess)", color: rating.verdict === v.key ? "var(--on-accent)" : "var(--ink)" }}
                  onClick={() => setRating((r) => r && { ...r, verdict: v.key })}>
                  {v.label}
                </button>
              ))}
            </div>

            <p className="label">Su cosa</p>
            <p style={{ fontSize: 15.5, color: "var(--mute)", margin: "6px 0 14px", lineHeight: 1.45 }}>
              È la parte che il modello impara davvero. Puoi sceglierne più di una.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
              {DIMS.map((d) => {
                const on = rating.dims.includes(d);
                return (
                  <button key={d} className="btn btn--sm" style={{ background: on ? "var(--ink)" : "var(--recess)", color: on ? "var(--shell)" : "var(--ink)" }}
                    onClick={() => setRating((r) => r && { ...r, dims: on ? r.dims.filter((x) => x !== d) : [...r.dims, d] })}>
                    {d}
                  </button>
                );
              })}
            </div>

            <p className="label" style={{ marginBottom: 16 }}>Catena · {RIGS.find((r) => r.key === rig)?.label}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--pri" style={{ flex: 1 }} onClick={commitRating} disabled={!rating.verdict}>Registra</button>
              <button className="btn btn--ghost" onClick={() => setRating(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* ingresso manuale */}
      {manual.open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setManual({ open: false, artist: "", track: "" })}>
          <div className="block sheet" style={{ maxWidth: 430, width: "100%", padding: 30 }}>
            <p style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.028em" }}>Registra un ascolto</p>
            <p style={{ fontSize: 15.5, color: "var(--mute)", margin: "10px 0 20px", lineHeight: 1.5 }}>
              Quello che ascolti fuori da qui vale più dei miei suggerimenti.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input className="field" placeholder="Artista" value={manual.artist} onChange={(e) => setManual((m) => ({ ...m, artist: e.target.value }))} />
              <input className="field" placeholder="Brano" value={manual.track} onChange={(e) => setManual((m) => ({ ...m, track: e.target.value }))} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn btn--pri" style={{ flex: 1 }} disabled={!manual.artist.trim() || !manual.track.trim()}
                  onClick={() => { setRating({ rec: { artist: manual.artist.trim(), track: manual.track.trim() }, verdict: null, dims: [] }); setManual({ open: false, artist: "", track: "" }); }}>
                  Continua
                </button>
                <button className="btn btn--ghost" onClick={() => setManual({ open: false, artist: "", track: "" })}>Annulla</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="block pop" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 26, zIndex: 70, padding: "14px 24px", boxShadow: "var(--lift-2)", maxWidth: "92vw" }}>
          <span style={{ fontSize: 15.5 }}>{toast}</span>
        </div>
      )}
    </main>
  );
}
