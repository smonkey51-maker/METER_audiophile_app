export default function BookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 5.2C10.4 3.9 8.3 3.3 6 3.3v13.4c2.3 0 4.4.6 6 1.9 1.6-1.3 3.7-1.9 6-1.9V3.3c-2.3 0-4.4.6-6 1.9z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"
      />
      <path d="M12 5.2v13.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
