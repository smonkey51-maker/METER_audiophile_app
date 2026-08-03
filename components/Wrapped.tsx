"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { RIGS } from "@/lib/types";
import JessicaAvatar from "./JessicaAvatar";
import AvatarNico from "./AvatarNico";

type WrappedData = {
  spotify: {
    topArtist: string | null; topArtists: string[]; topGenres: string[];
    topTrack: string | null; savedCount: number; followingCount: number;
  } | null;
  model: { cycles: number; axes: { claim: string; confidence: number }[]; identity: string };
  stats: { judged: number; keep: number; maybe: number; drop: number; picks: number; topRig?: string };
};

type Card = { eyebrow: string; body: React.ReactNode };

const rigLabel = (k?: string) => RIGS.find((r) => r.key === k)?.label ?? "";

export default function Wrapped({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<WrappedData | null>(null);
  const [error, setError] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    fetch("/api/wrapped").then((r) => r.json()).then(setData).catch(() => setError(true));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => n + 1);
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cards = useMemo<Card[]>(() => {
    if (!data) return [];
    const list: Card[] = [
      {
        eyebrow: "Il tuo Wrapped",
        body: (
          <>
            <JessicaAvatar size={56} />
            <p className="t-display" style={{ fontSize: 26, marginTop: 20 }}>Quello che so di te, in una carrellata.</p>
            <p className="t-body" style={{ fontSize: 15.5, marginTop: 10 }}>Un misto di Spotify e di quello che hai insegnato a Jessica.</p>
          </>
        ),
      },
    ];

    if (data.spotify?.topArtist) {
      list.push({
        eyebrow: "Artista più ascoltato",
        body: (
          <>
            <p className="t-display" style={{ fontSize: 34, lineHeight: 1.15 }}>{data.spotify.topArtist}</p>
            {data.spotify.topArtists.length > 1 && (
              <p className="t-body" style={{ fontSize: 15, marginTop: 16 }}>
                Subito dietro: {data.spotify.topArtists.slice(1).join(", ")}
              </p>
            )}
          </>
        ),
      });
    }

    if (data.spotify?.topGenres.length) {
      list.push({
        eyebrow: "Generi ricorrenti",
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
            {data.spotify.topGenres.map((g, idx) => (
              <p key={g} className="t-display" style={{ fontSize: 22, opacity: 1 - idx * 0.12 }}>{g}</p>
            ))}
          </div>
        ),
      });
    }

    if (data.spotify?.topTrack) {
      list.push({
        eyebrow: "Brano del momento",
        body: <p className="t-display" style={{ fontSize: 28, lineHeight: 1.2 }}>{data.spotify.topTrack}</p>,
      });
    }

    if (data.model.axes.length > 0) {
      const top = [...data.model.axes].sort((a, b) => b.confidence - a.confidence)[0];
      list.push({
        eyebrow: "Cosa ha imparato Jessica",
        body: (
          <>
            <p className="t-display" style={{ fontSize: 40 }}>{data.model.axes.length}</p>
            <p className="t-body" style={{ fontSize: 15.5, marginTop: 4 }}>tratti di gusto individuati in {data.model.cycles} cicli</p>
            {top && <p className="t-subdisplay" style={{ fontSize: 16, marginTop: 22, lineHeight: 1.5 }}>&ldquo;{top.claim}&rdquo;</p>}
          </>
        ),
      });
    }

    list.push({
      eyebrow: "In totale autonomia",
      body: (
        <>
          <p className="t-display" style={{ fontSize: 40 }}>{data.stats.picks}</p>
          <p className="t-body" style={{ fontSize: 15.5, marginTop: 4 }}>brani proposti da Jessica senza che glielo chiedessi</p>
          {data.stats.topRig && (
            <p className="t-body" style={{ fontSize: 15.5, marginTop: 18 }}>Catena preferita: <span className="t-subdisplay">{rigLabel(data.stats.topRig)}</span></p>
          )}
        </>
      ),
    });

    // Le ultime due carte non dipendono dai dati: chiudono sempre così.
    list.push({
      eyebrow: "Grazie per l'ascolto",
      body: <AvatarNico size={120} />,
    });
    list.push({
      eyebrow: "— Jessica",
      body: <JessicaAvatar size={120} />,
    });

    return list;
  }, [data]);

  const atEnd = i >= cards.length - 1;

  return (
    <div className="wrapped-scrim" role="dialog" aria-modal="true" aria-label="Il tuo Wrapped">
      <button className="wrapped-close" onClick={onClose} aria-label="Chiudi">
        <X size={18} />
      </button>

      {cards.length > 0 && (
        <div className="wrapped-progress">
          {cards.map((_, idx) => (
            <span key={idx} className={`wrapped-progress-seg${idx < i ? " is-done" : idx === i ? " is-active" : ""}`} />
          ))}
        </div>
      )}

      {error && <p className="t-body" style={{ fontSize: 15.5 }}>Non riesco a costruire il tuo Wrapped in questo momento.</p>}

      {!error && !data && <span className="led pulse" />}

      {!error && data && cards.length > 0 && (
        <>
          <div className="wrapped-card pop" key={i}>
            <p className="label" style={{ marginBottom: 18 }}>{cards[i].eyebrow}</p>
            {cards[i].body}
          </div>

          <div className="wrapped-nav" aria-hidden="true">
            <button
              className="wrapped-tap"
              onClick={() => (i === 0 ? onClose() : setI((n) => n - 1))}
              aria-label="Indietro"
            />
            <button
              className="wrapped-tap"
              onClick={() => (atEnd ? onClose() : setI((n) => n + 1))}
              aria-label={atEnd ? "Chiudi" : "Avanti"}
            />
          </div>
        </>
      )}
    </div>
  );
}
