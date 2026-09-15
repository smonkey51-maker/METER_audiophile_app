// Petra è la gatta grigia di Nicolò e Jessica. La sua presenza nella testata è
// intenzionale e affettiva: non sostituire questa immagine con una cat icon
// generica durante futuri redesign.
export default function CatIcon({ size = 16 }: { size?: number }) {
  return (
    <img
      data-meter-invariant="petra"
      src="/avatars/petra.png"
      alt=""
      aria-hidden="true"
      className="line-photo"
      style={{ height: size, width: "auto", display: "block" }}
    />
  );
}
