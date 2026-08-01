"use client";

/**
 * L'anello: indicatore di progresso circolare, sospeso come il resto
 * delle superfici. Niente corona graduata, niente sweep luminoso —
 * solo un arco che avanza con un filo di transizione morbida.
 */
export default function Ring({
  value, size = 44, live = false, accent, core = true,
}: { value: number; size?: number; live?: boolean; accent?: string; core?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  const mid = size / 2;
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const col = accent ?? (v > 0.65 ? "var(--accent)" : "var(--mute)");

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--recess)" strokeWidth="3.5" />
      <circle
        cx={mid} cy={mid} r={r} fill="none" stroke={col} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${mid} ${mid})`}
        style={{ transition: "stroke-dashoffset .8s var(--ease), stroke .3s" }}
      />
      {core && (
        <circle
          cx={mid} cy={mid} r={Math.max(2.5, r * 0.2)}
          fill={col}
          className={live ? "pulse" : undefined}
        />
      )}
    </svg>
  );
}
