export function TwynMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="Twyn logo">
      <defs>
        <linearGradient id="tw-a" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="tw-b" x1="24" y1="20" x2="58" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f472b6" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* two overlapping "twin" diamonds */}
      <rect x="10" y="10" width="28" height="28" rx="9" transform="rotate(45 24 24)" fill="url(#tw-a)" />
      <rect x="26" y="26" width="28" height="28" rx="9" transform="rotate(45 40 40)" fill="url(#tw-b)" fillOpacity="0.92" />
      <circle cx="32" cy="32" r="4.5" fill="#0e0a18" />
      <circle cx="32" cy="32" r="2.2" fill="#f4f0ff" />
    </svg>
  );
}

export function TwynLogo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <TwynMark size={size} />
      <span
        className="font-display font-semibold tracking-tight grad-text"
        style={{ fontSize: size * 0.78 }}
      >
        twyn
      </span>
    </span>
  );
}
