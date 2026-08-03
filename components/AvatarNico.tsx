export default function AvatarNico({ size = 96 }: { size?: number }) {
  return (
    <img
      src="/avatars/nico.png"
      alt=""
      aria-hidden="true"
      className="line-photo"
      style={{ height: size, width: "auto", display: "block" }}
    />
  );
}
