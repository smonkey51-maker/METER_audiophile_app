"use client";

/**
 * L'anello: unico elemento focale, concentrico come un driver coassiale.
 * Sostituisce ogni barra di avanzamento — la confidenza è un'ampiezza radiale.
 */
export default function Ring({
  value, size = 44, live = false, accent,
}: { value: number; size?: number; live?: boolean; accent?: string }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const col = accent ?? (value > 0.65 ? "var(--accent)" : "var(--mute)");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--recess)" strokeWidth="3" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .7s var(--ease), stroke .3s" }}
      />
      <circle
        cx={size / 2} cy={size / 2} r={Math.max(2.5, r * 0.22)}
        fill={col} className={live ? "pulse" : undefined}
      />
    </svg>
  );
}
