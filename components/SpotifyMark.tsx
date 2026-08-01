export default function SpotifyMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1DB954" />
      <path d="M17.3 16.3c-.2.3-.6.4-.9.2-2.5-1.5-5.7-1.9-9.4-1a.68.68 0 11-.3-1.33c4.1-.9 7.6-.5 10.4 1.2.3.2.4.6.2.93z" fill="#08120C" />
      <path d="M18.6 13.3c-.3.4-.8.5-1.1.3-2.9-1.8-7.3-2.3-10.7-1.2a.85.85 0 11-.5-1.6c3.9-1.2 8.7-.7 12 1.3.4.2.5.8.3 1.2z" fill="#08120C" />
      <path d="M18.7 10.2C15.3 8.2 9.7 8 6.5 9a1 1 0 11-.6-1.9c3.7-1.1 9.9-.9 13.8 1.4a1 1 0 11-1 1.7z" fill="#08120C" />
    </svg>
  );
}
