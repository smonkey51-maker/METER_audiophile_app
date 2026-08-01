export default function AvatarPartner({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="translate(16,14)">
        <path
          d="M32 6c-11 0-19 8.5-19 20 0 5 1.6 9.2 4.3 12.6C16.4 42.2 15.8 47 17.4 52.2c1 3.2 2.8 5.6 4.9 7.2 0-3.4.4-6.6 1.3-9.2 2.4 1.8 5.3 2.8 8.4 2.8s6-1 8.4-2.8c.9 2.6 1.3 5.8 1.3 9.2 2.1-1.6 3.9-4 4.9-7.2 1.6-5.2 1-10-.3-13.6C49.4 35.2 51 31 51 26 51 14.5 43 6 32 6z"
          fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
        />
        <circle cx="32" cy="27" r="12" fill="var(--shell)" stroke="currentColor" strokeWidth="1.4" />
        <rect x="19.5" y="24" width="9" height="7" rx="2.6" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <rect x="35.5" y="24" width="9" height="7" rx="2.6" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path d="M28.5 27.2h7M17 25.5l-3-1M47 25.5l3-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <path d="M22 92c1.5-11 8-17 26-17s24.5 6 26 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
