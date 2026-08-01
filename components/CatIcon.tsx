export default function CatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M5.5 4.3l1.8 3.4c1.5-.6 3.1-.6 4.6 0l1.8-3.4.2 3.8c1.6.9 2.6 2.5 2.6 4.4 0 3-2.6 5.4-6 5.4s-6-2.4-6-5.4c0-1.9 1-3.5 2.6-4.4z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"
      />
      <circle cx="9.6" cy="11.4" r="0.9" fill="currentColor" />
      <circle cx="13.4" cy="11.4" r="0.9" fill="currentColor" />
      <path d="M9 17.6v1.8M11.5 18.1v2M14 17.6v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M17 15.5c1.3.2 2.3 1 2.7 2.2-1.2.5-2.5.2-3.2-.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
