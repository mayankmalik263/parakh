import Link from 'next/link';

/** The Parakh stamp: a marigold badge with an ink tick, like a checked answer. */
export function ParakhMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <circle cx="32" cy="32" r="28" fill="#FFB20F" stroke="#161616" strokeWidth="5" />
      <path d="M19 33l9 9 18-20" fill="none" stroke="#161616" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + wordmark, linking home. Used in every page header. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" aria-label="Parakh home" className="inline-flex items-center gap-2 text-ink no-underline">
      <ParakhMark size={size} />
      <span className="font-display text-[1.75rem] leading-none tracking-[0.02em]">PARAKH</span>
      <span className="deva text-[1.25rem] leading-none text-primary-fixed-dim" lang="hi">परख</span>
    </Link>
  );
}
