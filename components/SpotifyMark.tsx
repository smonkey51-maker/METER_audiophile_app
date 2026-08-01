export default function SpotifyMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 9.6c3.6-1.1 7-.7 9.8 1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.4 12.6c3-.8 6-.5 8.4 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7.8 15.5c2.3-.6 4.8-.4 6.8.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
