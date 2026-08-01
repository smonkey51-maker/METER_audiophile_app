"use client";

import { useId } from "react";

/**
 * L'anello: indicatore di progresso circolare, sospeso come il resto
 * delle superfici. Niente corona graduata, niente sweep luminoso —
 * solo un arco che avanza con un filo di transizione morbida. Il
 * gradiente lungo l'arco è l'unica concessione "materica": nessun bagliore,
 * solo una variazione di intensità che dà profondità al tratto.
 */
export default function Ring({
  value, size = 44, live = false, accent, core = true,
}: { value: number; size?: number; live?: boolean; accent?: string; core?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  const mid = size / 2;
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const col = accent ?? (v > 0.65 ? "var(--accent)" : "var(--mute)");
  // Niente ":" nell'id: alcuni browser non risolvono url(#id) quando l'id
  // generato da useId() contiene i due punti.
  const gradId = `ring-${useId().replace(/:/g, "")}`;

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={col} stopOpacity="0.55" />
          <stop offset="100%" stopColor={col} stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--recess)" strokeWidth="3.5" />
      <circle
        cx={mid} cy={mid} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${mid} ${mid})`}
        style={{ transition: "stroke-dashoffset .8s var(--ease)" }}
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
