"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, Download, ExternalLink, Headphones, Moon, Music2, Pause, Play,
  Plus, Search, SkipBack, SkipForward, Sparkles, Sun, X,
} from "lucide-react";
import { DIMS, RIGS, VERDICTS, type Listen, type Model, EMPTY_MODEL, type Rec, type Verdict } from "@/lib/types";
import JessicaAvatar from "./JessicaAvatar";
import SpotifyMark from "./SpotifyMark";

type Playback = { isPlaying: boolean; track: string; artist: string; device?: string; art?: string };
type SearchHit = { artist: string; track: string; album?: string; url: string; uri: string };

export default function Meter() {
  const [dark, setDark] = useState(true);
  const [model, setModel] = useState<Model>(EMPTY_MODEL);
  const [listens, setListens] = useState<Listen[]>([]);
  const [pending, setPending] = useState(0);
  const [rig, setRig] = useState<string>("aperte");
  const [ready, setReady] = useState(false);

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
  const [rigMenuOpen, setRigMenuOpen] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rigMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const flash = useCallback((t: string) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  // Chiude il menu della catena d'ascolto al primo click fuori — è un
  // popover finto, il browser non lo fa da solo come per una <select>.
  useEffect(() => {
    if (!rigMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (rigMenuRef.current && !rigMenuRef.current.contains(e.target as Node)) setRigMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [rigMenuOpen]);

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

  // Jessica propone da sola ogni notte: qui compaiono solo i suoi consigli,
  // non più gli ascolti passivi rilevati da Spotify — quelli li assorbe già
  // in silenzio il ciclo di consolidamento.
  const dailyPicks = listens
    .filter((l) => !l.verdict && l.source === "rec")
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 8);

  function openRating(e: Partial<Rec> & { id?: number }) {
    setRating({ rec: e, verdict: null, dims: [] });
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
        source: rec.id ? "rec" : "manual",
      }),
    });
    setRating(null);
    await refresh();
    flash(`${rec.track}: ${VERDICTS.find((v) => v.key === verdict)!.label}`);
  }

  async function consolidate() {
    if (dreaming || !pending) return;
    setDreaming(true);
    try {
      const r = await fetch("/api/consolidate", { method: "POST" }).then((x) => x.json());
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
      setModel(r.model); setGaps(r.gaps ?? []); setImportSummary(r.model.changelog?.[0] ?? "Profilo Spotify importato.");
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
      {/* Sfondo ambientale dalla copertina in ascolto: molto scuro e sfocato,
         mai un'immagine leggibile. Solo in scuro — in chiaro romperebbe
         il bianco latte editoriale. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none",
          backgroundImage: playback?.art ? `url(${playback.art})` : "none",
          backgroundSize: "cover", backgroundPosition: "center",
          transform: "scale(1.2)",
          filter: "blur(90px) saturate(140%) brightness(.5)",
          opacity: dark && playback?.art ? 0.55 : 0,
          transition: "opacity 1.1s var(--ease)",
        }}
      />
      {/* Il ritratto di Jessica, non la scritta: la firma della pagina. */}
      <div className="brand-mark" title="Jessica AI">
        <JessicaAvatar size={126} />
      </div>

      {/* Niente più barra: riaggiorno e consolidamento sono automatici (dream
          cron, ogni notte), non serve più un frontalino di controlli. Resta
          solo la pill di utilità — sticky in alto su desktop, in basso al
          centro su mobile (vedi .status-row). */}
      <div className="status-row">
        <div className="pill-status seg" role="group" aria-label="Stato e preferenze">
          <a className="seg-item seg-item--icon" href="/api/spotify/login" aria-label="Collega Spotify" title="Collega Spotify">
            <SpotifyMark size={48} />
          </a>
          <span className="seg-divider" aria-hidden="true" />
          <div ref={rigMenuRef} style={{ position: "relative" }}>
            <button
              type="button" className="seg-item seg-item--icon" onClick={() => setRigMenuOpen((o) => !o)}
              aria-haspopup="listbox" aria-expanded={rigMenuOpen} aria-label="Catena d'ascolto"
              title={RIGS.find((r) => r.key === rig)?.label}
            >
              <Headphones size={42} aria-hidden="true" />
            </button>
            {rigMenuOpen && (
              <div className="dropdown" role="listbox" aria-label="Catena d'ascolto">
                {RIGS.map((r) => (
                  <button
                    key={r.key} type="button" role="option" aria-selected={r.key === rig}
                    className={`dropdown-item${r.key === rig ? " is-active" : ""}`}
                    onClick={() => { setRig(r.key); setRigMenuOpen(false); }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="seg-divider" aria-hidden="true" />
          <button className="seg-item seg-item--icon" onClick={() => setDark((d) => !d)} aria-label={dark ? "Passa al tema chiaro" : "Passa al tema scuro"}>
            {dark ? <Moon size={42} /> : <Sun size={42} />}
          </button>
        </div>
      </div>

      <div className="shell" style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* tesi: Jessica dice cosa sa di te, sempre in tono scherzoso — il
            paragrafo (model.summary) inizia sempre con "Bubi sei...", lo
            garantisce il prompt che lo genera. */}
        <section className="rise" style={{ maxWidth: 820, marginBottom: 40 }}>
          <p className="label" style={{ marginBottom: 12, color: "var(--mute)" }}>Cosa sa Jessica?</p>
          <p className="warmup t-display" style={{ fontSize: 22, lineHeight: 1.45 }}>
            {model.summary || "Bubi sei un mistero anche per me: non so ancora niente del tuo ascolto. Importa il profilo Spotify o registra qualche brano."}
          </p>
        </section>

        {/* Telecomando: nessun audio passa da qui, comanda il dispositivo Spotify già attivo.
            Flush come il resto della pagina — solo il web player, quando c'è
            qualcosa da mostrare, resta una superficie propria. */}
        <section className="rise" style={{ marginBottom: 32 }}>
          <div className="section-label"><p className="label">Ora in ascolto</p></div>

          {playback ? (
            /* Qualcosa è caricato, anche solo in pausa: diventa un web player
               vero, con la copertina, non più la sola riga di testo. */
            <div className="webplayer" style={{ marginBottom: 20 }}>
              <div className="webplayer-art" aria-hidden="true" style={playback.art ? { backgroundImage: `url(${playback.art})` } : undefined}>
                {!playback.art && <Music2 size={20} style={{ opacity: .4 }} />}
              </div>
              <div className="webplayer-info">
                <p className="label" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  {playback.isPlaying && (
                    <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
                  )}
                  <span className="truncate">{`In ascolto${playback.device ? " su " + playback.device : ""}`}</span>
                </p>
                <p className="truncate" style={{ fontSize: 17 }}>
                  <span className="t-display">{playback.track}</span> <span className="t-subdisplay">· {playback.artist}</span>
                </p>
              </div>
              <div className="webplayer-controls">
                <button className="btn btn--ghost btn--sm" onClick={() => playerAction("previous")} aria-label="Precedente" style={{ display: "inline-flex", alignItems: "center" }}>
                  <SkipBack size={15} />
                </button>
                <button className="btn btn--pri btn--sm" onClick={() => playerAction(playback.isPlaying ? "pause" : "play")} aria-label={playback.isPlaying ? "Pausa" : "Riproduci"} style={{ display: "inline-flex", alignItems: "center" }}>
                  {playback.isPlaying ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => playerAction("next")} aria-label="Successiva" style={{ display: "inline-flex", alignItems: "center" }}>
                  <SkipForward size={15} />
                </button>
              </div>
            </div>
          ) : (
            <p className="t-body" style={{ fontSize: 17, marginBottom: 20 }}>Nessuna riproduzione attiva. Apri Spotify su un dispositivo.</p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <input className="field" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Cerca un brano su Spotify" />
            <button className="btn btn--sm" onClick={runSearch} disabled={searching || !searchQuery.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Search size={14} />
              {searching ? "Cerco…" : "Cerca"}
            </button>
          </div>

          {/* Appena si ascolta qualcosa, anche in pausa, la lista dei
              risultati non serve più sotto i piedi del player. */}
          {!playback && searchResults.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {searchResults.map((r) => (
                <div key={r.uri} className="recess" style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15.5, minWidth: 0 }}><span className="t-display" style={{ fontSize: 15.5 }}>{r.track}</span> <span className="t-subdisplay">· {r.artist}</span></span>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn btn--sm" onClick={() => playerAction("play", r.uri)}>Riproduci</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => openRating({ artist: r.artist, track: r.track, album: r.album, url: r.url })}>Giudica</button>
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
                <p className="t-body" style={{ fontSize: 16.5, marginBottom: gaps.length > 0 ? 16 : 0 }}>{importSummary}</p>
              )}
              {gaps.length > 0 && (
                <>
                  <p className="label" style={{ marginBottom: 10 }}>A cui il profilo non risponde</p>
                  {gaps.map((g, i) => <p key={i} className="t-body" style={{ fontSize: 16.5, marginBottom: 8 }}>{g}</p>)}
                </>
              )}
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => { setImportSummary(null); setGaps([]); }} aria-label="Chiudi" style={{ display: "inline-flex", alignItems: "center" }}>
              <X size={15} />
            </button>
          </section>
        )}

        {/* Jessica lavora da sola: ogni notte guarda cosa ascolti e propone
            brani nuovi senza che nessuno glielo chieda. Qui vedi solo il
            risultato, non c'è più una conversazione da tenere in piedi. */}
        <section style={{ marginTop: 8 }}>
          <div className="section-label"><p className="label">Opinioni di Jessica sulla tua musica</p></div>
          <p className="t-body" style={{ fontSize: 15.5, maxWidth: 640, marginBottom: 28 }}>
            Ogni notte passa in rassegna quello che ascolti e sceglie brani nuovi per conto suo — in totale autonomia, non glielo chiedi tu.
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
            <p className="label">Consigli di oggi{dailyPicks.length ? ` — ${dailyPicks.length}` : ""}</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setManual({ open: true, artist: "", track: "" })} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Registra un ascolto
              </button>
              {pending > 0 && (
                <button className="btn btn--ghost btn--sm" onClick={consolidate} disabled={dreaming} aria-label="Consolida ora" title="Consolida ora" style={{ display: "inline-flex", alignItems: "center" }}>
                  <Sparkles size={14} />
                </button>
              )}
              <button className="btn btn--ghost btn--sm" onClick={runImport} disabled={importing} aria-label="Riaggiorna dal profilo Spotify" title="Riaggiorna dal profilo Spotify" style={{ display: "inline-flex", alignItems: "center" }}>
                <Download size={14} />
              </button>
            </div>
          </div>

          {dailyPicks.length === 0 ? (
            <p className="t-body" style={{ fontSize: 15.5, maxWidth: 480 }}>
              Niente di nuovo ancora — Jessica propone al ciclo notturno. Nel frattempo registra un ascolto che vuoi farle conoscere.
            </p>
          ) : (
            <div className="block rows">
              {dailyPicks.map((e) => (
                <div key={e.id} className="row-tap" role="button" tabIndex={0}
                  onClick={() => openRating({ ...e, url: e.spotify_url, id: e.id })}
                  onKeyDown={(ev) => ev.key === "Enter" && openRating({ ...e, url: e.spotify_url, id: e.id })}
                  style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                    <span className="t-display" style={{ fontSize: 16 }}>{e.track}</span>
                    <span className="t-subdisplay">{e.artist}</span>
                  </span>
                  {e.bridge && <span className="label" style={{ flexShrink: 0 }}>{e.bridge}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* foglio di giudizio */}
      {rating && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setRating(null)}>
          <div className="block sheet" style={{ maxWidth: 470, width: "100%", padding: 30 }}>
            <p className="label">Giudizio</p>
            <p className="t-display" style={{ fontSize: 22, marginTop: 6 }}>{rating.rec.track}</p>
            <p className="t-subdisplay" style={{ fontSize: 15.5, marginTop: 2 }}>{rating.rec.artist}</p>

            <div style={{ display: "flex", gap: 8, margin: "26px 0" }}>
              {VERDICTS.map((v) => (
                <button key={v.key} className="btn btn--sm" title={v.hint} style={{ flex: 1, background: rating.verdict === v.key ? "var(--accent)" : "var(--recess)", color: rating.verdict === v.key ? "var(--on-accent)" : "var(--ink)" }}
                  onClick={() => setRating((r) => r && { ...r, verdict: v.key })}>
                  {v.label}
                </button>
              ))}
            </div>

            <p className="label">Su cosa</p>
            <p className="t-body" style={{ fontSize: 15.5, margin: "6px 0 14px" }}>
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
              <button className="btn btn--pri" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={commitRating} disabled={!rating.verdict}>
                <Check size={15} /> Registra
              </button>
              <button className="btn btn--ghost" onClick={() => setRating(null)} aria-label="Annulla" style={{ display: "inline-flex", alignItems: "center" }}>
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ingresso manuale */}
      {manual.open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setManual({ open: false, artist: "", track: "" })}>
          <div className="block sheet" style={{ maxWidth: 430, width: "100%", padding: 30 }}>
            <p className="t-display" style={{ fontSize: 21 }}>Registra un ascolto</p>
            <p className="t-body" style={{ fontSize: 15.5, margin: "10px 0 20px" }}>
              Quello che ascolti fuori da qui vale più dei suoi suggerimenti.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input className="field" placeholder="Artista" value={manual.artist} onChange={(e) => setManual((m) => ({ ...m, artist: e.target.value }))} />
              <input className="field" placeholder="Brano" value={manual.track} onChange={(e) => setManual((m) => ({ ...m, track: e.target.value }))} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn btn--pri" style={{ flex: 1 }} disabled={!manual.artist.trim() || !manual.track.trim()}
                  onClick={() => { openRating({ artist: manual.artist.trim(), track: manual.track.trim() }); setManual({ open: false, artist: "", track: "" }); }}>
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
          <span className="t-body" style={{ fontSize: 15.5 }}>{toast}</span>
        </div>
      )}
    </main>
  );
}
