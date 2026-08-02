"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check, Headphones, Moon, Music2, Pause, Play,
  Plus, Search, SkipBack, SkipForward, Sun, X,
} from "lucide-react";
import { DIMS, RIGS, VERDICTS, type Listen, type Model, EMPTY_MODEL, type Rec, type Verdict } from "@/lib/types";
import JessicaAvatar from "./JessicaAvatar";
import SpotifyMark from "./SpotifyMark";
import BookIcon from "./BookIcon";
import CatIcon from "./CatIcon";
import Wrapped from "./Wrapped";

type Playback = { isPlaying: boolean; track: string; artist: string; device?: string; art?: string };
type SearchHit = { artist: string; track: string; album?: string; url: string; uri: string };

// Prova passiva che il ciclo notturno gira davvero (se non si muove da
// giorni si vede subito), ma detta come presenza e non come timestamp
// di sistema — è la frase sotto il ritratto, non un log.
function presencePhrase(iso?: string) {
  if (!iso) return null;
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "Jessica è con te in questo momento";
  if (h < 24) return "Jessica ha ascoltato con te oggi";
  if (h < 72) return "Jessica aspetta il prossimo ascolto";
  return "Jessica aspetta di riprendere ad ascoltare con te";
}

export default function Meter() {
  const [dark, setDark] = useState(true);
  const [model, setModel] = useState<Model>(EMPTY_MODEL);
  const [listens, setListens] = useState<Listen[]>([]);
  const [rig, setRig] = useState<string>("aperte");
  const [ready, setReady] = useState(false);

  const [rating, setRating] = useState<{ rec: Partial<Rec> & { id?: number }; verdict: Verdict | null; dims: string[] } | null>(null);
  const [manual, setManual] = useState({ open: false, artist: "", track: "" });
  const [toast, setToast] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [rigMenuOpen, setRigMenuOpen] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rigMenuRef = useRef<HTMLDivElement>(null);
  const rigTriggerRef = useRef<HTMLButtonElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const flash = useCallback((t: string) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  // Chiude il menu della catena d'ascolto al primo click fuori o con Esc —
  // è un popover finto, il browser non lo fa da solo come per una <select>.
  useEffect(() => {
    if (!rigMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (rigMenuRef.current && !rigMenuRef.current.contains(e.target as Node)) setRigMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setRigMenuOpen(false); rigTriggerRef.current?.focus(); }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [rigMenuOpen]);

  // All'apertura, il focus salta subito sull'opzione attiva: da tastiera
  // il menu si esplora con le frecce, come una vera listbox.
  useEffect(() => {
    if (!rigMenuOpen) return;
    const items = Array.from(rigMenuRef.current?.querySelectorAll<HTMLButtonElement>(".dropdown-item") ?? []);
    (items.find((el) => el.getAttribute("aria-selected") === "true") ?? items[0])?.focus();
  }, [rigMenuOpen]);

  function onRigMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(rigMenuRef.current?.querySelectorAll<HTMLButtonElement>(".dropdown-item") ?? []);
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items[next]?.focus();
  }

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

  // ⌘K / Ctrl+K apre il comando rapido da qualunque punto della pagina,
  // come una vera command palette — non solo cliccando sul trigger.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (paletteOpen) paletteInputRef.current?.focus();
    else { setSearchQuery(""); setSearchResults([]); }
  }, [paletteOpen]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      setModel(r.model); setListens(r.listens ?? []);
      setDbError(false);
    } catch {
      // Niente più schermata bianca: la pagina resta usabile (anche se
      // vuota) e lo dice, invece di restare a "carico la memoria" per sempre.
      setDbError(true);
    }
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
  const dailyPicks = useMemo(() => listens
    .filter((l) => !l.verdict && l.source === "rec")
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 8), [listens]);

  // Le copertine non sono in DB (richiederebbe una colonna in più): si
  // recuperano al volo quando un consiglio compare, una tantum per riga.
  const [artByPick, setArtByPick] = useState<Record<number, string | null>>({});
  useEffect(() => {
    const missing = dailyPicks.filter((p) => p.id != null && !(p.id in artByPick));
    missing.forEach(async (p) => {
      const art = await fetch(`/api/spotify/art?artist=${encodeURIComponent(p.artist)}&track=${encodeURIComponent(p.track)}`)
        .then((x) => x.json()).then((r) => r.art ?? null).catch(() => null);
      setArtByPick((m) => ({ ...m, [p.id!]: art }));
    });
  }, [dailyPicks, artByPick]);

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
          backgroundImage: playback?.art ? `url("${playback.art}")` : "none",
          backgroundSize: "cover", backgroundPosition: "center",
          transform: "scale(1.2)",
          filter: "blur(90px) saturate(140%) brightness(.5)",
          opacity: dark && playback?.art ? 0.55 : 0,
          transition: "opacity 1.1s var(--ease)",
        }}
      />
      {/* Il ritratto di Jessica, non la scritta: la firma della pagina.
          Sotto, un indicatore di presenza — non un timestamp di sistema. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <div className="brand-mark" title="Jessica AI">
          <JessicaAvatar size={63} />
        </div>
        {presencePhrase(model.updatedAt) && (
          <p className="label" style={{ textAlign: "center" }}>{presencePhrase(model.updatedAt)}</p>
        )}
      </div>

      {/* Niente più barra: riaggiorno e consolidamento sono automatici (dream
          cron, ogni notte), non serve più un frontalino di controlli. Resta
          solo la pill di utilità — sticky in alto su desktop, in basso al
          centro su mobile (vedi .status-row). */}
      <div className="status-row">
        <div className="pill-status seg" role="group" aria-label="Stato e preferenze">
          <a className="seg-item seg-item--icon" href="/api/spotify/login" aria-label="Collega Spotify" title="Collega Spotify">
            <SpotifyMark size={24} />
          </a>
          <button className="seg-item seg-item--icon" onClick={() => setWrappedOpen(true)} aria-label="Il tuo Wrapped" title="Il tuo Wrapped">
            <BookIcon size={20} />
          </button>
          <button className="seg-item seg-item--icon" onClick={() => flash("Ciao, da Petra! Mraaao")} aria-label="Petra" title="Petra">
            <CatIcon size={20} />
          </button>
          <span className="seg-divider" aria-hidden="true" />
          <div ref={rigMenuRef} style={{ position: "relative" }}>
            <button
              ref={rigTriggerRef}
              type="button" className="seg-item seg-item--icon" onClick={() => setRigMenuOpen((o) => !o)}
              aria-haspopup="listbox" aria-expanded={rigMenuOpen} aria-label="Catena d'ascolto"
              title={RIGS.find((r) => r.key === rig)?.label}
            >
              <Headphones size={21} aria-hidden="true" />
            </button>
            {rigMenuOpen && (
              <div className="dropdown" role="listbox" aria-label="Catena d'ascolto" onKeyDown={onRigMenuKeyDown}>
                {RIGS.map((r) => (
                  <button
                    key={r.key} type="button" role="option" aria-selected={r.key === rig}
                    className={`dropdown-item${r.key === rig ? " is-active" : ""}`}
                    onClick={() => { setRig(r.key); setRigMenuOpen(false); rigTriggerRef.current?.focus(); }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="seg-divider" aria-hidden="true" />
          <button className="seg-item seg-item--icon" onClick={() => setDark((d) => !d)} aria-label={dark ? "Passa al tema chiaro" : "Passa al tema scuro"}>
            {dark ? <Moon size={21} /> : <Sun size={21} />}
          </button>
        </div>
      </div>

      <div className="shell" style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Niente più schermata bianca se il DB è irraggiungibile: lo si
            dice, con un modo per riprovare, e il resto della pagina
            resta comunque usabile. */}
        {dbError && (
          <section className="block pop" style={{ padding: "16px 22px", marginBottom: 28, maxWidth: 760, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span className="t-body" style={{ fontSize: 15 }}>Non riesco a raggiungere la memoria di Jessica in questo momento.</span>
            <button className="btn btn--ghost btn--sm" onClick={refresh}>Riprova</button>
          </section>
        )}

        {/* tesi: Jessica dice cosa sa di te, sempre in tono scherzoso — il
            paragrafo (model.summary) inizia sempre con "Bubi sei...", lo
            garantisce il prompt che lo genera. Una citazione, non un dato:
            l'unico posto (con "Opinioni") dove entra il serif. */}
        <section className="rise" style={{ maxWidth: 760, margin: "0 auto 56px", textAlign: "center" }}>
          <p className="label" style={{ marginBottom: 18, color: "var(--mute)" }}>Cosa sa Jessica?</p>
          <p className="warmup t-quote" style={{ fontSize: "clamp(26px, 4vw, 34px)", lineHeight: 1.4 }}>
            {model.summary || "Bubi sei un mistero anche per me: non so ancora niente del tuo ascolto. Importa il profilo Spotify o registra qualche brano."}
          </p>
        </section>

        {/* Telecomando: nessun audio passa da qui, comanda il dispositivo Spotify già attivo.
            Flush come il resto della pagina — solo il web player, quando c'è
            qualcosa da mostrare, resta una superficie propria. */}
        <section className="rise" style={{ marginBottom: 36 }}>
          <div className="section-label"><p className="label">Ora in ascolto</p></div>

          {playback ? (
            /* Qualcosa è caricato, anche solo in pausa: diventa un web player
               vero, con la copertina, non più la sola riga di testo — e un
               bagliore sfocato della cover dietro, come una luce che rimbalza
               dal vinile invece di un semplice riquadro. */
            <div style={{ position: "relative", marginBottom: 20 }}>
              {playback.art && (
                <div aria-hidden="true" className="webplayer-glow" style={{ backgroundImage: `url("${playback.art}")` }} />
              )}
              <div className="webplayer">
                <div className="webplayer-art" aria-hidden="true" style={playback.art ? { backgroundImage: `url("${playback.art}")` } : undefined}>
                  {!playback.art && <Music2 size={26} style={{ opacity: .4 }} />}
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
                  <button className="btn btn--pri" onClick={() => playerAction(playback.isPlaying ? "pause" : "play")} aria-label={playback.isPlaying ? "Pausa" : "Riproduci"} style={{ display: "inline-flex", alignItems: "center", padding: "11px 15px" }}>
                    {playback.isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => playerAction("next")} aria-label="Successiva" style={{ display: "inline-flex", alignItems: "center" }}>
                    <SkipForward size={15} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="t-body" style={{ fontSize: 17, marginBottom: 20 }}>Nessuna riproduzione attiva. Apri Spotify su un dispositivo.</p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* Non più una barra sempre aperta: un trigger, come un
                comando rapido. ⌘K la apre da ovunque nella pagina. */}
            <button className="field palette-trigger" style={{ flex: 1, minWidth: 160 }} onClick={() => setPaletteOpen(true)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Search size={15} style={{ opacity: .6, flexShrink: 0 }} />
                <span className="truncate">Cerca un brano su Spotify</span>
              </span>
              <span className="kbd">⌘K</span>
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => {
                // C'è già qualcosa in ascolto: non serve chiedere cosa
                // registrare, si passa dritti al giudizio.
                if (playback) openRating({ artist: playback.artist, track: playback.track });
                else setManual({ open: true, artist: "", track: "" });
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} /> Registra un ascolto
            </button>
          </div>
        </section>

        {/* Jessica lavora da sola: ogni notte guarda cosa ascolti e propone
            brani nuovi senza che nessuno glielo chieda. Qui vedi solo il
            risultato, non c'è più una conversazione da tenere in piedi. */}
        <section style={{ marginTop: 8 }}>
          <div className="section-label"><p className="label">Opinioni di Jessica sulla tua musica</p></div>
          <p className="t-body" style={{ fontSize: 15.5, maxWidth: 640, marginBottom: 28 }}>
            Ogni notte passa in rassegna quello che ascolti e sceglie brani nuovi per conto suo — in totale autonomia, non glielo chiedi tu.
          </p>

          {/* Le analisi vere, quelle che Spotify non può fare: gli assi di
              gusto che consolida nei cicli notturni. Un carosello perché
              sono pensieri distinti, non una lista da scorrere in verticale. */}
          {model.axes.length > 0 && (
            <div className="carousel" style={{ marginBottom: 32 }}>
              {model.axes.map((a, i) => (
                <div key={i} className="block carousel-card">
                  <p className="t-quote" style={{ fontSize: 19, lineHeight: 1.45 }}>&ldquo;{a.claim}&rdquo;</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
                    <div className="confidence-track"><div className="confidence-fill" style={{ width: `${Math.round(a.confidence * 100)}%` }} /></div>
                    <span className="label" style={{ flexShrink: 0 }}>{Math.round(a.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="label" style={{ marginBottom: 16 }}>Consigli di oggi{dailyPicks.length ? ` — ${dailyPicks.length}` : ""}</p>

          {dailyPicks.length === 0 ? (
            <p className="t-body" style={{ fontSize: 15.5, maxWidth: 480 }}>
              Niente di nuovo ancora — Jessica propone al ciclo notturno. Nel frattempo registra un ascolto che vuoi farle conoscere.
            </p>
          ) : (
            <div className="recess rows">
              {dailyPicks.map((e, i) => (
                <div key={e.id} className="row-tap tracklist-row" role="button" tabIndex={0}
                  onClick={() => openRating({ ...e, url: e.spotify_url, id: e.id })}
                  onKeyDown={(ev) => ev.key === "Enter" && openRating({ ...e, url: e.spotify_url, id: e.id })}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, cursor: "pointer" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 auto" }}>
                    <span className="tracklist-n">{i + 1}</span>
                    <span className="tracklist-art" aria-hidden="true" style={e.id != null && artByPick[e.id] ? { backgroundImage: `url("${artByPick[e.id]}")` } : undefined}>
                      {!(e.id != null && artByPick[e.id]) && <Music2 size={16} style={{ opacity: .35 }} />}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                      <span className="t-display truncate" style={{ fontSize: 16, maxWidth: 220 }}>{e.track}</span>
                      <span className="t-subdisplay truncate" style={{ fontSize: 13.5, maxWidth: 220 }}>{e.artist}</span>
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {/* Ascoltarlo non deve aprire anche il giudizio: la riga
                        resta cliccabile per quello, il tasto ferma la propagazione. */}
                    {e.spotify_id && (
                      <button
                        className="btn btn--ghost btn--sm" aria-label={`Riproduci ${e.track}`} title="Riproduci"
                        onClick={(ev) => { ev.stopPropagation(); playerAction("play", e.spotify_id); }}
                        style={{ display: "inline-flex", alignItems: "center", padding: 6 }}
                      >
                        <Play size={13} />
                      </button>
                    )}
                    {/* Il bridge dovrebbe essere una parola o due (lo dice il prompt), ma
                        se Jessica esagera non deve mai spingersi sopra al titolo. */}
                    {e.bridge && <span className="label truncate" style={{ maxWidth: 140 }}>{e.bridge}</span>}
                  </span>
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

      {/* comando rapido: cerca un brano, riproducilo o giudicalo — o registra
          quello che non trova, senza chiudere e riaprire un altro foglio. */}
      {paletteOpen && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setPaletteOpen(false)}>
          <div className="block sheet" style={{ maxWidth: 560, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={paletteInputRef} className="field" style={{ flex: 1 }}
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Cerca un brano su Spotify"
              />
              <button className="btn btn--pri btn--sm" onClick={runSearch} disabled={searching || !searchQuery.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Search size={14} />
                {searching ? "Cerco…" : "Cerca"}
              </button>
              <button className="btn btn--ghost" onClick={() => setPaletteOpen(false)} aria-label="Chiudi" style={{ display: "inline-flex", alignItems: "center" }}>
                <X size={16} />
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, maxHeight: "50vh", overflowY: "auto" }}>
                {searchResults.map((r) => (
                  <div key={r.uri} className="recess" style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15.5, minWidth: 0 }}><span className="t-display" style={{ fontSize: 15.5 }}>{r.track}</span> <span className="t-subdisplay">· {r.artist}</span></span>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn btn--sm" onClick={() => { playerAction("play", r.uri); setPaletteOpen(false); }}>Riproduci</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => { openRating({ artist: r.artist, track: r.track, album: r.album, url: r.url }); setPaletteOpen(false); }}>Giudica</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <p className="t-body" style={{ fontSize: 15, marginTop: 16 }}>
                Nessun risultato.{" "}
                <button className="btn btn--ghost btn--sm" onClick={() => { setManual({ open: true, artist: "", track: "" }); setPaletteOpen(false); }}>
                  Registra manualmente
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="block pop" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 26, zIndex: 70, padding: "14px 24px", boxShadow: "var(--lift-2)", maxWidth: "92vw" }}>
          <span className="t-body" style={{ fontSize: 15.5 }}>{toast}</span>
        </div>
      )}

      {wrappedOpen && <Wrapped onClose={() => setWrappedOpen(false)} />}
    </main>
  );
}
