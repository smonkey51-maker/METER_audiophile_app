export default function CatIcon({ size = 16 }: { size?: number }) {
  return (
    <img
      src="/avatars/petra.png"
      alt=""
      aria-hidden="true"
      className="line-photo"
      style={{ height: size, width: "auto", display: "block" }}
    />
  );
}
