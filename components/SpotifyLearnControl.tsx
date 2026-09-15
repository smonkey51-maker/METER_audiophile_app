"use client";

import { useState } from "react";
import SpotifyMark from "./SpotifyMark";

export default function SpotifyLearnControl() {
  const [open, setOpen] = useState(false);
  const [learning, setLearning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function learnNow() {
    if (learning) return;
    setLearning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/learn", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Apprendimento non riuscito");
      setMessage("Jessica ha riletto Spotify e aggiornato la memoria.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      setMessage(e?.message ?? "Apprendimento non riuscito");
    } finally {
      setLearning(false);
    }
  }

  return (
    <div className="spotify-learn" style={{ position: "relative" }}>
      <button
        type="button"
        className={`icon-btn${open ? " icon-btn--on" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Spotify"
        title="Spotify"
      >
        <SpotifyMark size={18} />
      </button>
      {open && (
        <div className="menu spotify-learn-menu" role="menu">
          <a className="menu-item spotify-menu-link" href="/api/spotify/login" role="menuitem">Collega / ricollega Spotify</a>
          <button className="menu-item" type="button" role="menuitem" onClick={learnNow} disabled={learning}>
            {learning ? "Jessica sta imparando…" : "Aggiorna Jessica da Spotify"}
          </button>
          {message && <p className="spotify-learn-status">{message}</p>}
        </div>
      )}
    </div>
  );
}
