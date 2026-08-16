"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check, Headphones, Home, ListMusic, Moon, Music2, MessageSquare, Pause, Play,
  Plus, Search, SkipBack, SkipForward, Sun, X,
} from "lucide-react";
import { DIMS, RIGS, VERDICTS, type Listen, type Model, EMPTY_MODEL, type Rec, type Verdict } from "@/lib/types";
import JessicaAvatar from "./JessicaAvatar";
import SpotifyMark from "./SpotifyMark";
import BookIcon from "./BookIcon";
import CatIcon from "./CatIcon";
import Wrapped from "./Wrapped";

type Playback = { isPlaying: boolean; track: string; artist: string; device?: string; art?: string; progressMs?: number; durationMs?: number };
type SearchHit = { artist: string; track: string; album?: string; url: string; uri: string };

function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Prova passiva che il ciclo notturno gira davvero (se non si muove da
// giorni si vede subito), ma detta come presenza e non come timestamp
// di sistema — è la frase sotto il ritratto, non un log.
function presencePhrase(iso?: string) {
  if (!iso) return "Aspetto di riprendere ad ascoltare con te";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "Sono con te in questo momento";
  if (h < 24) return "Ho ascoltato con te oggi";
  if (h < 72) return "Aspetto il prossimo ascolto";
  return "Aspetto di riprendere ad ascoltare con te";
}

// Stesse fasce di presencePhrase, tradotte nel respiro dell'anello invece
// che in un punto acceso/spento: più vivo quanto più recente l'ascolto.
function presenceTier(iso?: string) {
  if (!iso) return "faint";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "warm";
  if (h < 24) return "";
  if (h < 72) return "cool";
  return "faint";
}

// Il ciclo notturno gira alle 4:00 UTC (vercel.json): da model.updatedAt
// e da quell'orario fisso si ricava sia "quanto fa" che "tra quanto" —
// dato vero, non un placeholder, letto dallo stesso cron che lo muove.
function cyclePhrase(updatedAt?: string) {
  if (!updatedAt) return null;
  const now = Date.now();
  const last = new Date(updatedAt).getTime();
  const hoursSince = Math.max(0, Math.round((now - last) / 3600000));
  const next = new Date();
  next.setUTCHours(4, 0, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  const hoursUntil = Math.max(1, Math.round((next.getTime() - now) / 3600000));
  const sinceLabel = hoursSince < 1 ? "meno di un'ora fa" : `${hoursSince}h fa`;
  return `Ultimo ciclo notturno: ${sinceLabel} · prossimo in ~${hoursUntil}h`;
}

export default function Meter() {
  const [dark, setDark] = useState(true);
  const [model, setModel] = useState<Model>(EMPTY_MODEL);
  const [listens, setListens] = useState<Listen[]>([]);
  const [rig, setRig] = useState<string>("aperte");
  const [ready, setReady] = useState(false);

  const [rating, setRating] = useState<{ rec: Partial<Rec> & { id?: number }; verdict: Verdict | null; dims: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [manual, setManual] = useState({ open: false, artist: "", track: "" });
  const [toast, setToast] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const playbackFetchedAt = useRef(Date.now());
  const seekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
    const items = Array.from(rigMenuRef.current?.querySelectorAll<HTMLButtonElement>(".menu-item") ?? []);
    (items.find((el) => el.getAttribute("aria-selected") === "true") ?? items[0])?.focus();
  }, [rigMenuOpen]);

  function onRigMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(rigMenuRef.current?.querySelectorAll<HTMLButtonElement>(".menu-item") ?? []);
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

  const applyPlayback = useCallback((state: Playback | null) => {
    playbackFetchedAt.current = Date.now();
    setPlayback(state);
  }, []);

  const refreshPlayback = useCallback(async () => {
    const r = await fetch("/api/spotify/player").then((x) => x.json()).catch(() => ({ state: null }));
    applyPlayback(r.state ?? null);
  }, [applyPlayback]);

  // Il telecomando non ha eventi push: un poll leggero è l'unico modo per
  // accorgersi che hanno cambiato brano da un altro dispositivo.
  useEffect(() => {
    refreshPlayback();
    const t = setInterval(refreshPlayback, 15000);
    return () => clearInterval(t);
  }, [refreshPlayback]);

  // Tra un poll e l'altro la barra avanza localmente (ogni 500ms), senza
  // aspettare i 15s del prossimo /api/spotify/player. Si ferma mentre si
  // trascina lo scrubber, per non litigare col dito dell'utente.
  useEffect(() => {
    if (!playback?.isPlaying || scrubMs !== null) return;
    const t = setInterval(() => forceTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [playback?.isPlaying, scrubMs]);

  useEffect(() => () => clearTimeout(seekTimer.current), []);

  async function playerAction(action: "play" | "pause" | "next" | "previous" | "seek", uri?: string, positionMs?: number) {
    const r = await fetch("/api/spotify/player", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, uri, positionMs }),
    }).then((x) => x.json()).catch(() => ({ error: "comando fallito" }));
    if (r.error) { flash(r.error); return; }
    applyPlayback(r.state ?? null);
  }

  // Aggiorna subito la posizione visiva mentre si trascina, e manda il
  // comando di seek con un piccolo debounce per non spammare l'API a ogni
  // pixel — funziona sia col mouse (drag continuo) che da tastiera.
  function onScrub(ms: number) {
    setScrubMs(ms);
    clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(() => {
      playerAction("seek", undefined, ms).finally(() => setScrubMs(null));
    }, 300);
  }

  const durationMs = playback?.durationMs ?? 0;
  const liveProgressMs = scrubMs ?? (playback
    ? Math.min(durationMs || Infinity, (playback.progressMs ?? 0) + (playback.isPlaying ? Date.now() - playbackFetchedAt.current : 0))
    : 0);
  const progressPct = durationMs ? Math.min(100, (liveProgressMs / durationMs) * 100) : 0;

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
    .slice(0, 6), [listens]);

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

  // Il foglio di giudizio non deve più comparire e sparire di scatto: dove
  // il browser lo permette (View Transitions API) il cambio di DOM viene
  // incorniciato in una dissolvenza morbida invece di un salto istantaneo
  // — e rispetta chi ha chiesto meno movimento, saltando la transizione
  // invece di ignorare la preferenza.
  function withMorph(fn: () => void) {
    const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof d.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      d.startViewTransition(fn);
    } else {
      fn();
    }
  }

  function openRating(e: Partial<Rec> & { id?: number }) {
    withMorph(() => setRating({ rec: e, verdict: null, dims: [] }));
  }

  function closeRating() {
    withMorph(() => setRating(null));
  }

  // Stessa scorciatoia dietro due ingressi (il FAB in fondo, il bottone
  // "Giudica in ascolto" in testata): se qualcosa sta suonando salta
  // dritto al giudizio, altrimenti apre il modulo manuale.
  function quickJudge() {
    if (playback) openRating({ artist: playback.artist, track: playback.track });
    else setManual({ open: true, artist: "", track: "" });
  }

  async function commitRating() {
    if (!rating?.verdict || submitting) return;
    const { rec, verdict, dims } = rating;
    setSubmitting(true);
    try {
      await fetch("/api/log", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist: rec.artist, track: rec.track, album: rec.album, spotify_url: rec.url,
          verdict, dims, rig, meter: rec.meter, dynamics: rec.dynamics,
          production: rec.production, era: rec.era, bridge: rec.bridge,
          source: rec.id ? "rec" : "manual",
        }),
      });
      closeRating();
      await refresh();
      flash(`${rec.track}: ${VERDICTS.find((v) => v.key === verdict)!.label}`);
    } finally {
      setSubmitting(false);
    }
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

  const hasData = !!model.summary;
  const isCurrent = (l: Listen) => !!playback && playback.track === l.track && playback.artist === l.artist;

  return (
    <main style={{ minHeight: "100vh" }}>
      <div className="app-shell">
        {/* ── Sidebar: logo + navigazione alle sezioni, stile Spotify ── */}
        <aside className="sidebar">
          <a className="sidebar-logo" href="#home" aria-label="METER">
            <span className="sidebar-logo-mark" aria-hidden="true">
              <svg viewBox="0 0 20 20" width={13} height={13} fill="none">
                <path d="M3 15 L3 5 L10 12 L17 5 L17 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
          <nav className="sidebar-nav" aria-label="Sezioni">
            <a className="sidebar-link" href="#home"><Home size={18} aria-hidden="true" /> Home</a>
            <a className="sidebar-link" href="#listening"><Music2 size={18} aria-hidden="true" /> Ora in ascolto</a>
            <a className="sidebar-link" href="#picks"><ListMusic size={18} aria-hidden="true" /> Consigli di oggi</a>
            <a className="sidebar-link" href="#opinions"><MessageSquare size={18} aria-hidden="true" /> Le mie opinioni</a>
          </nav>
        </aside>

        <div className="app-main">
      {/* ── Header: sole 5 icone di stato e preferenze ── */}
      <div className="topbar-wrap">
        <div className="topbar">
          <div className="topbar-group">
            <div className="topbar-actions" role="group" aria-label="Stato e preferenze">
              <a className="icon-btn" href="/api/spotify/login" aria-label="Collega Spotify" title="Collega il tuo profilo Spotify">
                <SpotifyMark size={18} />
              </a>
              <button className="icon-btn" onClick={() => flash("Ciao, da Petra! Mraaao")} aria-label="Petra, la gatta di Jessica" title="Petra">
                <CatIcon size={18} />
              </button>
              <button className="icon-btn topbar-theme" onClick={() => setDark((d) => !d)} aria-label={dark ? "Passa al tema chiaro" : "Passa al tema scuro"} title={dark ? "Tema chiaro" : "Tema scuro"}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className="icon-btn" onClick={() => setWrappedOpen(true)} aria-label="Il tuo Wrapped" title="Vedi il tuo Wrapped">
                <BookIcon size={18} />
              </button>
              <div ref={rigMenuRef} style={{ position: "relative" }}>
                <button
                  ref={rigTriggerRef}
                  type="button" className={`icon-btn${rigMenuOpen ? " icon-btn--on" : ""}`} onClick={() => setRigMenuOpen((o) => !o)}
                  aria-haspopup="listbox" aria-expanded={rigMenuOpen} aria-label="Catena d'ascolto"
                  title={`Catena d'ascolto: ${RIGS.find((r) => r.key === rig)?.label}`}
                >
                  <Headphones size={18} aria-hidden="true" />
                </button>
                {rigMenuOpen && (
                  <div className="menu" role="listbox" aria-label="Catena d'ascolto" onKeyDown={onRigMenuKeyDown}>
                    {RIGS.map((r) => (
                      <button
                        key={r.key} type="button" role="option" aria-selected={r.key === rig}
                        className={`menu-item${r.key === rig ? " is-active" : ""}`}
                        onClick={() => { setRig(r.key); setRigMenuOpen(false); rigTriggerRef.current?.focus(); }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shell">
        {dbError && (
          <section className="card pop" style={{ padding: "16px 22px", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span className="t-body" style={{ fontSize: 14 }}>Non riesco a raggiungere la memoria di Jessica in questo momento.</span>
            <button className="btn btn--text btn--sm" onClick={refresh}>Riprova</button>
          </section>
        )}

        {/* ── Jessica + "Cosa so di te" ── */}
        <section id="home" className="hero-header rise">
          <div className="hero-profile">
            <div className={`brand-mark${presenceTier(model.updatedAt) ? ` brand-mark--${presenceTier(model.updatedAt)}` : ""}`} title="Jessica AI">
              <JessicaAvatar size={80} />
            </div>
            <span className="hero-profile-label">Jessica</span>
          </div>
          <div className="hero-content">
            <p className="label" style={{ marginBottom: 16 }}>Cosa so di te</p>
            <p className="t-quote warmup" style={{ fontSize: "clamp(19px, 2.6vw, 24px)" }}>
              {model.summary || "Bubi sei un mistero anche per me: non so ancora niente del tuo ascolto. Importa il profilo Spotify o registra qualche brano."}
            </p>
            <p className="hero-presence">
              <button className="hero-presence-btn" onClick={refresh}>{presencePhrase(model.updatedAt)}</button>
            </p>
            {cyclePhrase(model.updatedAt) && (
              <span className="cycle-pill"><Moon size={12} aria-hidden="true" /> {cyclePhrase(model.updatedAt)}</span>
            )}
            {!hasData && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
                <a className="btn btn--filled" href="/api/spotify/login">Collega Spotify</a>
                <button className="btn btn--outlined" onClick={() => setManual({ open: true, artist: "", track: "" })}>
                  Registra il primo ascolto
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Ora in ascolto ── */}
        <section id="listening" className="rise" style={{ marginBottom: 40 }}>
          <p className="label" style={{ marginBottom: 16 }}>Ora in ascolto</p>
          <div className="card webplayer">
            <div className="webplayer-art" aria-hidden="true" style={playback?.art ? { backgroundImage: `url("${playback.art}")` } : undefined}>
              {!playback?.art && <Music2 size={20} style={{ opacity: .4 }} />}
            </div>
            <div className="webplayer-info">
              {playback ? (
                <>
                  <p className="truncate" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="t-display truncate" style={{ fontSize: 15 }}>{playback.track}</span>
                    {playback.isPlaying && <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>}
                  </p>
                  <p className="t-subdisplay truncate" style={{ fontSize: 13, marginTop: 2 }}>{playback.artist}</p>
                </>
              ) : (
                <p className="t-body truncate" style={{ fontSize: 14 }}>Nessuna riproduzione attiva. Apri Spotify su un dispositivo.</p>
              )}
            </div>
            <div className="webplayer-controls">
              <button className="bp-transport-btn" disabled={!playback} onClick={() => playerAction("previous")} aria-label="Precedente">
                <SkipBack size={16} />
              </button>
              <button
                className="bp-play" disabled={!playback}
                onClick={() => playback && playerAction(playback.isPlaying ? "pause" : "play")}
                aria-label={playback?.isPlaying ? "Pausa" : "Riproduci"}
              >
                <span className="play-morph">
                  <span className={`play-morph-icon${playback?.isPlaying ? "" : " is-out"}`}><Pause size={15} /></span>
                  <span className={`play-morph-icon${playback?.isPlaying ? " is-out" : ""}`}><Play size={15} style={{ marginLeft: 1 }} /></span>
                </span>
              </button>
              <button className="bp-transport-btn" disabled={!playback} onClick={() => playerAction("next")} aria-label="Successiva">
                <SkipForward size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* ── Ricerca ── */}
        <section className="rise" style={{ marginBottom: 48 }}>
          <button className="field palette-trigger" onClick={() => setPaletteOpen(true)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Search size={16} style={{ opacity: .7, flexShrink: 0 }} />
              <span className="truncate">Cerca un brano su Spotify</span>
            </span>
            <span className="kbd">⌘K</span>
          </button>
        </section>

        {/* ── Consigli di oggi ── */}
        <section id="picks" className="rise" style={{ marginBottom: 48 }}>
          <p className="label" style={{ marginBottom: 20 }}>Consigli di oggi{dailyPicks.length ? ` — ${dailyPicks.length}` : ""}</p>

          {dailyPicks.length === 0 ? (
            <p className="t-body" style={{ fontSize: 14 }}>
              Niente di nuovo ancora — propongo al ciclo notturno. Nel frattempo registra un ascolto che vuoi farmi conoscere.
            </p>
          ) : (
            <div className="picks-grid">
              {dailyPicks.map((pick) => {
                const art = pick.id != null ? artByPick[pick.id] : undefined;
                const canPlay = !!pick.spotify_id;
                const active = isCurrent(pick);
                const judge = () => openRating({ ...pick, url: pick.spotify_url, id: pick.id });
                return (
                  <button
                    key={pick.id ?? `${pick.artist}-${pick.track}`}
                    type="button" className="pick-card"
                    onClick={() => canPlay && playerAction(active && playback?.isPlaying ? "pause" : "play", pick.spotify_id)}
                    aria-label={canPlay ? `Avvia ${pick.track}` : `${pick.track}: non ancora trovato su Spotify`}
                  >
                    <div className="pick-card-art">
                      {art
                        ? <img src={art} alt="" />
                        : <Music2 size={22} style={{ opacity: .35 }} />}
                      <div className={`pick-card-overlay${active ? " is-on" : ""}`}>
                        <span className="pick-card-play">
                          {active && playback?.isPlaying
                            ? <Pause size={15} fill="currentColor" />
                            : <Play size={15} fill="currentColor" style={{ marginLeft: 1 }} />}
                        </span>
                      </div>
                      {active && <span className="pick-card-active-dot" aria-hidden="true" />}
                      <span
                        role="button" tabIndex={0}
                        className="icon-btn icon-btn--sm"
                        style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,.45)", color: "#fff" }}
                        aria-label={`Commenta ${pick.track}`} title="Commenta questo consiglio"
                        onClick={(e) => { e.stopPropagation(); judge(); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); judge(); } }}
                      >
                        <MessageSquare size={13} />
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p className={`pick-card-title truncate${active ? " is-active" : ""}`}>{pick.track}</p>
                      <p className="pick-card-artist truncate">{pick.artist}</p>
                      {pick.bridge && <p className="pick-card-bridge truncate">{pick.bridge}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Le mie opinioni sulla tua musica ── */}
        <section id="opinions" className="rise">
          <p className="label" style={{ marginBottom: 16 }}>Le mie opinioni sulla tua musica</p>

          {model.axes.length > 0 ? (
            <div className="opinions-grid">
              {model.axes.map((axis, i) => (
                <div key={i}>
                  <div className="opinion-row-head">
                    <span className="t-quote">{axis.title || axis.claim}</span>
                    <span className="opinion-pct tnum">{Math.round(axis.confidence * 100)}%</span>
                  </div>
                  <div className="confidence-track"><div className="confidence-fill" style={{ width: `${Math.round(axis.confidence * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="t-body" style={{ fontSize: 14 }}>
              Non ho ancora abbastanza ascolti giudicati per dirti qualcosa di preciso.
            </p>
          )}
        </section>
      </div>
        </div>
      </div>

      {/* ── barra di riproduzione in fondo ── */}
      <div className="bottom-player">
        <div className="bp-track">
          {playback ? (
            <>
              <img
                src={playback.art || "/avatars/jessica.png"}
                alt="" className="bp-cover"
              />
              <div style={{ minWidth: 0 }}>
                <p className="t-display truncate" style={{ fontSize: 13.5 }}>{playback.track}</p>
                <p className="t-subdisplay truncate" style={{ fontSize: 12 }}>{playback.artist}</p>
              </div>
            </>
          ) : (
            <p className="t-body truncate" style={{ fontSize: 12.5 }}>Nessun brano selezionato</p>
          )}
        </div>

        <div className="bp-center">
          <div className="bp-transport">
            <button className="bp-transport-btn" disabled={!playback} onClick={() => playerAction("previous")} aria-label="Precedente">
              <SkipBack size={17} />
            </button>
            <button
              className="bp-play" disabled={!playback}
              onClick={() => playback && playerAction(playback.isPlaying ? "pause" : "play")}
              aria-label={playback?.isPlaying ? "Pausa" : "Riproduci"}
            >
              <span className="play-morph">
                <span className={`play-morph-icon${playback?.isPlaying ? "" : " is-out"}`}><Pause size={15} /></span>
                <span className={`play-morph-icon${playback?.isPlaying ? " is-out" : ""}`}><Play size={15} style={{ marginLeft: 1 }} /></span>
              </span>
            </button>
            <button className="bp-transport-btn" disabled={!playback} onClick={() => playerAction("next")} aria-label="Successiva">
              <SkipForward size={17} />
            </button>
          </div>
          <div className="bp-progress">
            <span className="bp-time tnum">{fmtTime(liveProgressMs)}</span>
            <div className="bp-progress-track">
              <div className="bp-progress-fill" style={{ width: `${progressPct}%` }} />
              <input
                type="range" className="bp-progress-input"
                min={0} max={durationMs || 0} step={1000}
                value={Math.min(liveProgressMs, durationMs || 0)}
                disabled={!playback || !durationMs}
                onChange={(e) => onScrub(Number(e.target.value))}
                aria-label="Posizione nel brano"
              />
            </div>
            <span className="bp-time tnum">-{fmtTime(Math.max(0, durationMs - liveProgressMs))}</span>
          </div>
        </div>

        <div style={{ width: 240, flexShrink: 0 }} />
      </div>

      {/* ── foglio di giudizio ── */}
      {rating && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && closeRating()}>
          <div className="dialog sheet" style={{ maxWidth: 400, width: "100%", padding: 26 }}>
            <p className="label">Giudizio</p>
            <p className="t-display" style={{ fontSize: 20, marginTop: 6 }}>{rating.rec.track}</p>
            <p className="t-subdisplay" style={{ fontSize: 14, marginTop: 2 }}>{rating.rec.artist}</p>

            <div style={{ display: "flex", gap: 8, margin: "24px 0" }}>
              {VERDICTS.map((v) => {
                const on = rating.verdict === v.key;
                return (
                  <button
                    key={v.key} title={v.hint}
                    className={`btn btn--sm${on ? " btn--filled" : " btn--tonal"}`}
                    style={{ flex: 1 }}
                    onClick={() => setRating((r) => r && { ...r, verdict: v.key })}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>

            <p className="label">Su cosa</p>
            <p className="t-body" style={{ fontSize: 13, margin: "6px 0 14px", lineHeight: 1.5 }}>
              È la parte che il modello impara davvero. Puoi sceglierne più di una.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {DIMS.map((d) => {
                const on = rating.dims.includes(d);
                return (
                  <button key={d} className={`chip${on ? " chip--on" : ""}`}
                    onClick={() => setRating((r) => r && { ...r, dims: on ? r.dims.filter((x) => x !== d) : [...r.dims, d] })}>
                    {d}
                  </button>
                );
              })}
            </div>

            <p className="label" style={{ marginBottom: 16 }}>Catena · {RIGS.find((r) => r.key === rig)?.label}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--filled" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={commitRating} disabled={!rating.verdict || submitting}>
                <Check size={15} /> {submitting ? "Registro…" : "Registra"}
              </button>
              <button className="icon-btn" onClick={closeRating} aria-label="Annulla">
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ingresso manuale ── */}
      {manual.open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setManual({ open: false, artist: "", track: "" })}>
          <div className="dialog sheet" style={{ maxWidth: 400, width: "100%", padding: 26 }}>
            <p className="t-display" style={{ fontSize: 19 }}>Registra un ascolto</p>
            <p className="t-body" style={{ fontSize: 14, margin: "10px 0 18px" }}>
              Quello che ascolti fuori da qui vale più dei suoi suggerimenti.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input className="field" placeholder="Artista" value={manual.artist} onChange={(e) => setManual((m) => ({ ...m, artist: e.target.value }))} />
              <input className="field" placeholder="Brano" value={manual.track} onChange={(e) => setManual((m) => ({ ...m, track: e.target.value }))} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn btn--filled" style={{ flex: 1 }} disabled={!manual.artist.trim() || !manual.track.trim()}
                  onClick={() => { openRating({ artist: manual.artist.trim(), track: manual.track.trim() }); setManual({ open: false, artist: "", track: "" }); }}>
                  Continua
                </button>
                <button className="btn btn--text" onClick={() => setManual({ open: false, artist: "", track: "" })}>Annulla</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── comando rapido ── */}
      {paletteOpen && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setPaletteOpen(false)}>
          <div className="dialog sheet" style={{ maxWidth: 540, width: "100%", padding: 22 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={paletteInputRef} className="field" style={{ flex: 1 }}
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Cerca un brano su Spotify"
              />
              <button className="btn btn--filled btn--sm" onClick={runSearch} disabled={searching || !searchQuery.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Search size={14} />
                {searching ? "Cerco…" : "Cerca"}
              </button>
              <button className="icon-btn" onClick={() => setPaletteOpen(false)} aria-label="Chiudi">
                <X size={16} />
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, maxHeight: "50vh", overflowY: "auto" }}>
                {searchResults.map((r) => (
                  <div key={r.uri} className="card card--filled" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, minWidth: 0 }}><span className="t-display" style={{ fontSize: 14 }}>{r.track}</span> <span className="t-subdisplay">· {r.artist}</span></span>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn btn--tonal btn--sm" onClick={() => { playerAction("play", r.uri); setPaletteOpen(false); }}>Riproduci</button>
                      <button className="btn btn--text btn--sm" onClick={() => { openRating({ artist: r.artist, track: r.track, album: r.album, url: r.url }); setPaletteOpen(false); }}>Giudica</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <p className="t-body" style={{ fontSize: 13.5, marginTop: 16 }}>
                Nessun risultato.{" "}
                <button className="btn btn--text btn--sm" onClick={() => { setManual({ open: true, artist: "", track: "" }); setPaletteOpen(false); }}>
                  Registra manualmente
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="snackbar pop" role="status">
          <span>{toast}</span>
        </div>
      )}

      {/* ── azione flottante "Registra" ── */}
      <button
        type="button" className="fab pop"
        onClick={quickJudge}
        aria-label="Registra un ascolto" title="Registra un ascolto"
      >
        <Plus size={16} /> Registra
      </button>

      {wrappedOpen && <Wrapped onClose={() => setWrappedOpen(false)} />}
    </main>
  );
}
