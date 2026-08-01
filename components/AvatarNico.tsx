export default function AvatarNico({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M32 45c0-11 7-19 16-19s16 8 16 19c0 3-.4 5.8-1.1 8.4"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"
      />
      <path d="M32 45c-.3 3-.1 5.7.6 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path
        d="M32.5 52c-2 0-3.3 1.8-2.4 3.6 1 2 3.2 2.9 5.4 2.2M63 52c2 0 3.3 1.8 2.4 3.6-1 2-3.2 2.9-5.4 2.2"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"
      />
      <path
        d="M30 52c1 12 8 22 18 22s17-10 18-22"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"
      />
      <circle cx="39.5" cy="47.5" r="7.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="56.5" cy="47.5" r="7.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M46.7 47h2.6M32.3 46l-3.8-1.4M63.7 46l3.8-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M22 92c1.5-11 8-17 26-17s24.5 6 26 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
