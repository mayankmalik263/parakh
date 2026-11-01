import Link from 'next/link';

/** The MASS mark: the monolith slab, cut by one line of light. */
export function MassMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <polygon points="39,11 45,7 45,53 39,57" fill="#6d3bd7" />
      <polygon points="19,11 25,7 45,7 39,11" fill="#a078ff" />
      <rect x="19" y="11" width="20" height="46" fill="#8b5cf6" />
      <rect x="19" y="28" width="20" height="3" fill="#e9ddff" />
      <polygon points="39,28 45,24 45,27 39,31" fill="#d0bcff" />
    </svg>
  );
}

/** Mark + wordmark, linking home. Used in every page header. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" aria-label="MASS home" className="inline-flex items-center gap-sm text-on-surface no-underline">
      <MassMark size={size} />
      <span className="font-display tracking-[0.02em]" style={{ fontSize: `${size * 0.05}rem` }}>
        MASS
      </span>
    </Link>
  );
}
