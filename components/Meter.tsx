"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ChevronLeft, ChevronRight, Headphones, Music2, MessageSquare, Pause, Play,
  Plus, Search, SkipBack, SkipForward, X,
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

// Un codice a otto trattini, come le cifre coperte di una carta: quelli
// "accesi" sono proporzionali alla confidenza, mai a caso.
function confidenceMask(confidence: number) {
  const total = 8;
  const filled = Math.min(total, Math.max(1, Math.round(confidence * total)));
  return Array.from({ length: total }, (_, i) => i < filled);
}

export default function Meter() {
  const [model, setModel] = useState<Model>(EMPTY_MODEL);
  const [listens, setListens] = useState<Listen[]>([]);
  const [rig, setRig] = useState<string>("aperte");
  const [ready, setReady] = useState(false);

  const [rating, setRating] = useState<{ rec: Partial<Rec> & { id?: number }; verdict: Verdict | null; dims: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [manual, setManual] = useState({ open: false, artist: "", track: "" });
  const [toast, setToast] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [ambient, setAmbient] = useState("transparent");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [rigMenuOpen, setRigMenuOpen] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [axisIndex, setAxisIndex] = useState(0);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rigMenuRef = useRef<HTMLDivElement>(null);
  const rigTriggerRef = useRef<HTMLButtonElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);

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

  // Un indicatore "leading" tinto dal colore medio della copertina in
  // riproduzione — non più un velo di vetro, solo un filo colorato sul
  // bordo della card, coerente con superfici piatte.
  useEffect(() => {
    const art = playback?.art;
    if (!art) { setAmbient("transparent"); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 12; canvas.height = 12;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 12, 12);
        const { data } = ctx.getImageData(0, 0, 12, 12);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
        if (n && !cancelled) setAmbient(`rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})`);
      } catch { if (!cancelled) setAmbient("transparent"); } // tela "sporca" (CORS): niente velo, non un errore visibile
    };
    img.onerror = () => { if (!cancelled) setAmbient("transparent"); };
    img.src = art;
    return () => { cancelled = true; };
  }, [playback?.art]);

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

  return (
    <main style={{ minHeight: "100vh" }}>
      {/* Top app bar M3: sostituisce la pillola fluttuante. Stessa
          collocazione su desktop e mobile — niente più salto in basso. */}
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-avatar"><JessicaAvatar size={28} /></div>
          <span className="t-display" style={{ fontSize: 15 }}>Jessica</span>
        </div>
        <div className="topbar-actions" role="group" aria-label="Stato e preferenze">
          <a className="icon-btn" href="/api/spotify/login" aria-label="Collega Spotify" title="Collega il tuo profilo Spotify">
            <SpotifyMark size={22} />
          </a>
          <button className="icon-btn" onClick={() => setWrappedOpen(true)} aria-label="Il tuo Wrapped" title="Vedi il tuo Wrapped">
            <BookIcon size={22} />
          </button>
          <button className="icon-btn" onClick={() => flash("Ciao, da Petra! Mraaao")} aria-label="Petra, la gatta di Jessica" title="Petra">
            <CatIcon size={22} />
          </button>
          <div ref={rigMenuRef} style={{ position: "relative" }}>
            <button
              ref={rigTriggerRef}
              type="button" className={`icon-btn${rigMenuOpen ? " icon-btn--on" : ""}`} onClick={() => setRigMenuOpen((o) => !o)}
              aria-haspopup="listbox" aria-expanded={rigMenuOpen} aria-label="Catena d'ascolto"
              title={`Catena d'ascolto: ${RIGS.find((r) => r.key === rig)?.label}`}
            >
              <Headphones size={22} aria-hidden="true" />
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

      <div className="shell">
        {/* Il ritratto di Jessica, molto più grande: il vero punto focale
            della pagina, non più un dettaglio accanto alla pillola. Sotto,
            un indicatore di presenza — non un timestamp di sistema. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <div className={`brand-mark${presenceTier(model.updatedAt) ? ` brand-mark--${presenceTier(model.updatedAt)}` : ""}`} title="Jessica AI">
            <JessicaAvatar size={120} />
          </div>
          {presencePhrase(model.updatedAt) && (
            <p className="label" style={{ textAlign: "center" }}>{presencePhrase(model.updatedAt)}</p>
          )}
        </div>

        {/* Niente più schermata bianca se il DB è irraggiungibile: lo si
            dice, con un modo per riprovare, e il resto della pagina
            resta comunque usabile. */}
        {dbError && (
          <section className="card pop" style={{ padding: "16px 22px", marginBottom: 28, maxWidth: 760, marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span className="t-body" style={{ fontSize: 14 }}>Non riesco a raggiungere la memoria di Jessica in questo momento.</span>
            <button className="btn btn--text btn--sm" onClick={refresh}>Riprova</button>
          </section>
        )}

        {/* tesi: Jessica dice cosa sa di te, sempre in tono scherzoso — il
            paragrafo (model.summary) inizia sempre con "Bubi sei...", lo
            garantisce il prompt che lo genera. Una citazione, non un dato:
            l'unico posto (con "Opinioni") dove entra il serif. */}
        <section className="rise" style={{ maxWidth: 760, margin: "0 auto 32px", textAlign: "center" }}>
          <p className="label" style={{ marginBottom: 18, color: "var(--on-surface-variant)" }}>Cosa so di te?</p>
          <p className="warmup t-quote" style={{ fontSize: "clamp(24px, 4vw, 32px)" }}>
            {model.summary || "Bubi sei un mistero anche per me: non so ancora niente del tuo ascolto. Importa il profilo Spotify o registra qualche brano."}
          </p>
          {/* Percorso guidato per chi arriva senza dati: due azioni
              esplicite invece di lasciar scoprire da soli dove si comincia. */}
          {!hasData && (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
              <a className="btn btn--filled" href="/api/spotify/login">Collega Spotify</a>
              <button className="btn btn--outlined" onClick={() => setManual({ open: true, artist: "", track: "" })}>
                Registra il primo ascolto
              </button>
            </div>
          )}
        </section>

        {/* Telecomando: nessun audio passa da qui, comanda il dispositivo Spotify già attivo. */}
        <section className="rise" style={{ marginBottom: 36 }}>
          <div className="section-label"><p className="label">Ora in ascolto</p></div>

          {playback ? (
            /* Qualcosa è caricato, anche solo in pausa: diventa un web player
               vero, con la copertina, non più la sola riga di testo. */
            <div style={{ marginBottom: 20 }}>
              <div className="card webplayer" style={{ "--ambient": ambient } as React.CSSProperties}>
                <div key={playback.art ?? playback.track} className="webplayer-art pop" aria-hidden="true" style={playback.art ? { backgroundImage: `url("${playback.art}")` } : undefined}>
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
                  <button className="icon-btn icon-btn--sm" onClick={() => playerAction("previous")} aria-label="Precedente">
                    <SkipBack size={15} />
                  </button>
                  <button className="btn btn--filled" onClick={() => playerAction(playback.isPlaying ? "pause" : "play")} aria-label={playback.isPlaying ? "Pausa" : "Riproduci"} style={{ padding: "11px 15px" }}>
                    {/* Non uno scambio secco di icona: le due si passano il
                        posto, una si ritira ruotando mentre l'altra arriva
                        dallo stesso punto — un morph, non un salto. */}
                    <span className="play-morph">
                      <span className={`play-morph-icon${playback.isPlaying ? "" : " is-out"}`}><Pause size={18} /></span>
                      <span className={`play-morph-icon${playback.isPlaying ? " is-out" : ""}`}><Play size={18} /></span>
                    </span>
                  </button>
                  <button className="icon-btn icon-btn--sm" onClick={() => playerAction("next")} aria-label="Successiva">
                    <SkipForward size={15} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Stessa sagoma del web player attivo: se cambiasse altezza al primo
               play, tutto sotto — la tracklist — si sposterebbe sotto al dito
               proprio mentre si prova a toccare la riga successiva. */
            <div style={{ marginBottom: 20 }}>
              <div className="card webplayer">
                <div className="webplayer-art" aria-hidden="true"><Music2 size={26} style={{ opacity: .4 }} /></div>
                <div className="webplayer-info">
                  <p className="t-body" style={{ fontSize: 15 }}>Nessuna riproduzione attiva. Apri Spotify su un dispositivo.</p>
                </div>
                {/* Stessi tre tasti, disattivati: sotto i 640px vanno a
                    capo su una riga propria — se mancassero qui, la sagoma
                    tornerebbe a cambiare altezza proprio su mobile. */}
                <div className="webplayer-controls" style={{ opacity: .35 }}>
                  <button className="icon-btn icon-btn--sm" disabled aria-hidden="true" tabIndex={-1}>
                    <SkipBack size={15} />
                  </button>
                  <button className="btn btn--filled" disabled aria-hidden="true" tabIndex={-1} style={{ padding: "11px 15px" }}>
                    <Play size={18} />
                  </button>
                  <button className="icon-btn icon-btn--sm" disabled aria-hidden="true" tabIndex={-1}>
                    <SkipForward size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Non più una barra sempre aperta: un trigger, come un comando
              rapido. ⌘K la apre da ovunque nella pagina. "Registra un
              ascolto" è passato al FAB in fondo alla pagina: qui resta
              solo la ricerca, a piena larghezza. */}
          <button className="field palette-trigger" onClick={() => setPaletteOpen(true)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Search size={15} style={{ opacity: .7, flexShrink: 0 }} />
              <span className="truncate">Cerca un brano su Spotify</span>
            </span>
            <span className="kbd">⌘K</span>
          </button>
        </section>

        {/* Jessica lavora da sola: ogni notte guarda cosa ascolti e propone
            brani nuovi senza che nessuno glielo chieda. Qui vedi solo il
            risultato, non c'è più una conversazione da tenere in piedi. */}
        <section style={{ marginTop: 8 }}>
          <div className="section-label"><p className="label">Le mie opinioni sulla tua musica</p></div>
          <p className="t-body" style={{ fontSize: 15, maxWidth: 640, marginBottom: 28 }}>
            Ogni notte passo in rassegna quello che ascolti e scelgo brani nuovi per conto mio — in totale autonomia, non me lo chiedi tu.
          </p>

          {/* Le analisi vere, quelle che Spotify non può fare: gli assi di
              gusto che consolida nei cicli notturni. Uno alla volta, da
              sfogliare — sono pensieri distinti, non righe di una lista. */}
          {model.axes.length > 0 && (() => {
            // Se un ciclo notturno pota gli assi, l'indice sfogliato può
            // restare fuori range: si aggancia all'ultimo rimasto.
            const safeIndex = Math.min(axisIndex, model.axes.length - 1);
            const axis = model.axes[safeIndex];
            return (
            <div style={{ marginBottom: 32, maxWidth: 480 }}>
              <div className="card card--large carousel-card" key={safeIndex}>
                <p className="t-quote" style={{ fontSize: 18 }}>&ldquo;{axis.claim}&rdquo;</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
                  <div className="confidence-track"><div className="confidence-fill" style={{ width: `${Math.round(axis.confidence * 100)}%` }} /></div>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span className="confidence-mask" aria-hidden="true">
                      {confidenceMask(axis.confidence).map((on, i) => (
                        <span key={i} className={on ? "is-on" : ""}>•</span>
                      ))}
                    </span>
                    <span className="label">{Math.round(axis.confidence * 100)}%</span>
                  </span>
                </div>
              </div>
              {model.axes.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 14 }}>
                  <button className="icon-btn icon-btn--sm" aria-label="Pensiero precedente" onClick={() => setAxisIndex((i) => (Math.min(i, model.axes.length - 1) - 1 + model.axes.length) % model.axes.length)}>
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ display: "flex", gap: 6 }}>
                    {model.axes.map((_, i) => (
                      <button key={i} className={`axis-dot${i === safeIndex ? " is-active" : ""}`} aria-label={`Pensiero ${i + 1}`} onClick={() => setAxisIndex(i)} />
                    ))}
                  </div>
                  <button className="icon-btn icon-btn--sm" aria-label="Pensiero successivo" onClick={() => setAxisIndex((i) => (Math.min(i, model.axes.length - 1) + 1) % model.axes.length)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
            );
          })()}

          <p className="label" style={{ marginBottom: 16 }}>Consigli di oggi{dailyPicks.length ? ` — ${dailyPicks.length}` : ""}</p>

          {dailyPicks.length === 0 ? (
            <p className="t-body" style={{ fontSize: 15, maxWidth: 480 }}>
              Niente di nuovo ancora — propongo al ciclo notturno. Nel frattempo registra un ascolto che vuoi farmi conoscere.
            </p>
          ) : (
            <>
              {/* Il primo consiglio, in evidenza con la cover a tutto bordo:
                  resta comunque anche nella lista sotto, questa card è solo
                  enfasi visiva, non un filtro. */}
              {(() => {
                const pick = dailyPicks[0];
                const art = pick.id != null ? artByPick[pick.id] : undefined;
                const canPlay = !!pick.spotify_id;
                const judge = () => openRating({ ...pick, url: pick.spotify_url, id: pick.id });
                return (
                  <div className="hero-pick pop" style={{ marginBottom: 24, ...(art ? { backgroundImage: `url("${art}")` } : null) }}>
                    {!art && <Music2 size={30} className="hero-pick-fallback" aria-hidden="true" />}
                    <div className="hero-pick-info">
                      <p className="label" style={{ marginBottom: 8 }}>Pick di oggi</p>
                      <p className="t-display truncate" style={{ fontSize: 21 }}>{pick.track}</p>
                      <p className="t-subdisplay truncate" style={{ fontSize: 14, marginTop: 2 }}>{pick.artist}</p>
                      {pick.bridge && <p className="t-body" style={{ fontSize: 13, marginTop: 8, maxWidth: 340 }}>{pick.bridge}</p>}
                    </div>
                    <div className="hero-pick-actions">
                      <button
                        className="icon-btn" disabled={!canPlay}
                        aria-label={canPlay ? `Avvia ${pick.track}` : `${pick.track}: non ancora trovato su Spotify`}
                        title={canPlay ? "Avvia l'ascolto" : "Non ancora trovato su Spotify"}
                        onClick={() => canPlay && playerAction("play", pick.spotify_id)}
                      >
                        <Play size={16} fill="currentColor" />
                      </button>
                      <button
                        className="btn btn--tonal btn--sm" aria-label={`Commenta ${pick.track}`} title="Commenta questo consiglio"
                        onClick={judge}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <MessageSquare size={13} /> Commenta
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Come un diario, non righe uniformi: un filo verticale che
                  scorre da un consiglio al successivo. */}
              <div className="timeline">
                {dailyPicks.map((e) => {
                  const judge = () => openRating({ ...e, url: e.spotify_url, id: e.id });
                  const canPlay = !!e.spotify_id;
                  return (
                  <div key={e.id} className="timeline-row">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 auto" }}>
                        {/* Un solo bersaglio per "avvia l'ascolto": la copertina
                            stessa è il pulsante play, non una riga che decide da
                            sola cosa succede al tap. Disattivato (non assente)
                            quando non c'è ancora un brano Spotify da avviare, così
                            la differenza si vede subito, non si scopre a tentoni. */}
                        <button
                          type="button" className="tracklist-art-btn" disabled={!canPlay}
                          aria-label={canPlay ? `Avvia ${e.track}` : `${e.track}: non ancora trovato su Spotify`}
                          title={canPlay ? "Avvia l'ascolto" : "Non ancora trovato su Spotify"}
                          onClick={() => canPlay && playerAction("play", e.spotify_id)}
                        >
                          <span className="tracklist-art" aria-hidden="true" style={e.id != null && artByPick[e.id] ? { backgroundImage: `url("${artByPick[e.id]}")` } : undefined}>
                            {!(e.id != null && artByPick[e.id]) && <Music2 size={16} style={{ opacity: .35 }} />}
                          </span>
                          <span className="tracklist-play-overlay" aria-hidden="true"><Play size={15} fill="currentColor" /></span>
                        </button>
                        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                          <span className="t-display truncate" style={{ fontSize: 16, maxWidth: 220 }}>{e.track}</span>
                          <span className="t-subdisplay truncate" style={{ fontSize: 13, maxWidth: 220 }}>{e.artist}</span>
                        </span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        {/* Il bridge dovrebbe essere una parola o due (lo dice il prompt), ma
                            se Jessica esagera non deve mai spingersi sopra al titolo. */}
                        {e.bridge && <span className="label truncate" style={{ maxWidth: 140 }}>{e.bridge}</span>}
                        {/* Il secondo bersaglio, altrettanto esplicito: non più
                            una sola icona ghost, ma un pulsante con etichetta —
                            si legge "commenta", non si intuisce da un'iconcina. */}
                        <button
                          className="btn btn--tonal btn--sm" aria-label={`Commenta ${e.track}`} title="Commenta questo consiglio"
                          onClick={judge}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <MessageSquare size={13} /> Commenta
                        </button>
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {/* foglio di giudizio */}
      {rating && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && closeRating()}>
          <div className="dialog sheet" style={{ maxWidth: 470, width: "100%", padding: 30 }}>
            <p className="label">Giudizio</p>
            <p className="t-display" style={{ fontSize: 22, marginTop: 6 }}>{rating.rec.track}</p>
            <p className="t-subdisplay" style={{ fontSize: 15, marginTop: 2 }}>{rating.rec.artist}</p>

            <div style={{ display: "flex", gap: 8, margin: "26px 0" }}>
              {VERDICTS.map((v) => {
                const on = rating.verdict === v.key;
                // Un colore per verdetto, non uno per "selezionato": verde
                // tenue per ciò che resta, blu tenue per ciò che resta in
                // dubbio, niente colore per ciò che si scarta.
                const bg = !on ? "var(--surface-container)" : v.key === "keep" ? "var(--success-container)" : v.key === "maybe" ? "var(--tertiary-container)" : "var(--on-surface)";
                const fg = !on ? "var(--on-surface)" : v.key === "keep" ? "var(--on-success-container)" : v.key === "maybe" ? "var(--on-tertiary-container)" : "var(--surface)";
                return (
                  <button key={v.key} className="btn btn--sm" title={v.hint} style={{ flex: 1, background: bg, color: fg }}
                    onClick={() => setRating((r) => r && { ...r, verdict: v.key })}>
                    {v.label}
                  </button>
                );
              })}
            </div>

            <p className="label">Su cosa</p>
            <p className="t-body" style={{ fontSize: 15, margin: "6px 0 14px" }}>
              È la parte che il modello impara davvero. Puoi sceglierne più di una.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
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

      {/* ingresso manuale */}
      {manual.open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setManual({ open: false, artist: "", track: "" })}>
          <div className="dialog sheet" style={{ maxWidth: 430, width: "100%", padding: 30 }}>
            <p className="t-display" style={{ fontSize: 21 }}>Registra un ascolto</p>
            <p className="t-body" style={{ fontSize: 15, margin: "10px 0 20px" }}>
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

      {/* comando rapido: cerca un brano, riproducilo o giudicalo — o registra
          quello che non trova, senza chiudere e riaprire un altro foglio. */}
      {paletteOpen && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setPaletteOpen(false)}>
          <div className="dialog sheet" style={{ maxWidth: 560, width: "100%", padding: 24 }}>
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
                  <div key={r.uri} className="card card--filled" style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, minWidth: 0 }}><span className="t-display" style={{ fontSize: 15 }}>{r.track}</span> <span className="t-subdisplay">· {r.artist}</span></span>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn btn--tonal btn--sm" onClick={() => { playerAction("play", r.uri); setPaletteOpen(false); }}>Riproduci</button>
                      <button className="btn btn--text btn--sm" onClick={() => { openRating({ artist: r.artist, track: r.track, album: r.album, url: r.url }); setPaletteOpen(false); }}>Giudica</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <p className="t-body" style={{ fontSize: 14, marginTop: 16 }}>
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

      {/* Azione flottante, sempre a portata: se c'è già qualcosa in
          ascolto salta dritto al giudizio, altrimenti apre il modulo
          manuale — stessa logica che aveva il bottone inline di prima.
          FAB M3 esteso: icona + etichetta, non solo un'icona. */}
      <button
        type="button" className="fab pop"
        onClick={() => {
          if (playback) openRating({ artist: playback.artist, track: playback.track });
          else setManual({ open: true, artist: "", track: "" });
        }}
        aria-label="Registra un ascolto" title="Registra un ascolto"
      >
        <Plus size={20} /> <span className="fab-label">Registra</span>
      </button>

      {wrappedOpen && <Wrapped onClose={() => setWrappedOpen(false)} />}
    </main>
  );
}
