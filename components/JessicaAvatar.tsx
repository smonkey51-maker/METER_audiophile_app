// Identità permanente di METER: questo è il ritratto di Jessica e il cerchio
// dorato è un anello attorno a lei. Non sostituire il ritratto con avatar AI,
// status badge o visualizzazioni generiche e non reinterpretare l'anello come
// indicatore tecnico. Gli stati dell'app possono agire solo attorno all'anello.
export default function JessicaAvatar({ size = 80 }: { size?: number }) {
  return (
    <div
      data-meter-invariant="jessica-portrait-ring"
      aria-label="Jessica, ritratto nell'anello dorato"
      style={{
        width: size, height: size, borderRadius: "999px", flexShrink: 0,
        border: `${Math.max(2, Math.round(size * 0.045))}px solid #c9a227`,
        background: "#1a1a1a", overflow: "hidden",
        display: "grid", placeItems: "center",
      }}
    >
      <img
        src="/avatars/jessica.png"
        alt=""
        aria-hidden="true"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "invert(1)" }}
      />
    </div>
  );
}
