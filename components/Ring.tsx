"use client";

/**
 * L'anello: unico elemento focale, concentrico come un driver coassiale.
 * Sostituisce ogni barra di avanzamento — la confidenza è un'ampiezza radiale.
 *
 * Tre tracce, come su un indicatore vero: la corona di tacche fa da scala,
 * l'incavo è la traccia morta, l'arco acceso è il valore. Il nucleo è il LED.
 */
export default function Ring({
  value, size = 44, live = false, accent, core = true,
}: { value: number; size?: number; live?: boolean; accent?: string; core?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  const mid = size / 2;
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const col = accent ?? (v > 0.65 ? "var(--accent)" : "var(--mute)");
  const lit = accent !== undefined || v > 0.65;

  // La scala: tacche su 3/4 di giro, densità costante a ogni dimensione.
  const rTick = r - 4.5;
  const ticks = Math.max(12, Math.round(size / 2.4));

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
      aria-hidden="true"
    >
      {/* corona graduata */}
      {size >= 40 && (
        <g opacity="0.35">
          {Array.from({ length: ticks }, (_, i) => {
            const a = (i / ticks) * 2 * Math.PI - Math.PI / 2;
            const long = i % 5 === 0;
            const r0 = rTick - (long ? 3 : 1.6);
            return (
              <line
                key={i}
                x1={mid + Math.cos(a) * r0} y1={mid + Math.sin(a) * r0}
                x2={mid + Math.cos(a) * rTick} y2={mid + Math.sin(a) * rTick}
                stroke={i / ticks <= v ? col : "var(--faint)"}
                strokeWidth={long ? 1.1 : 0.7}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      )}

      {/* traccia morta, fresata nel pannello */}
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--recess)" strokeWidth="3.5" />

      {/* Sweep: un arco corto che gira senza fermarsi. È ciò che distingue
          uno strumento acceso da un grafico — c'è anche quando il valore è zero. */}
      {size >= 80 && (
        <circle
          className="scan"
          cx={mid} cy={mid} r={r} fill="none"
          stroke={accent ?? "var(--accent)"} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${c * 0.06} ${c}`}
          opacity="0.5"
          style={{ transformOrigin: "center", filter: `drop-shadow(0 0 6px ${accent ?? "var(--accent)"})` }}
        />
      )}

      {/* arco acceso */}
      <circle
        cx={mid} cy={mid} r={r} fill="none" stroke={col} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${mid} ${mid})`}
        style={{
          transition: "stroke-dashoffset .8s var(--ease), stroke .3s",
          filter: lit ? `drop-shadow(0 0 5px ${col})` : undefined,
        }}
      />

      {/* nucleo: il LED. Si spegne quando al centro va un numero. */}
      {core && (
        <circle
          cx={mid} cy={mid} r={Math.max(2.5, r * 0.2)}
          fill={col} className={live ? "pulse" : undefined}
          style={{ filter: lit && !live ? `drop-shadow(0 0 4px ${col})` : undefined }}
        />
      )}
    </svg>
  );
}
