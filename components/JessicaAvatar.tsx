export default function JessicaAvatar({ size = 42 }: { size?: number }) {
  return (
    <img
      src="/avatars/jessica.png"
      alt=""
      aria-hidden="true"
      className="line-photo"
      style={{ height: size, width: "auto", display: "block" }}
    />
  );
}
