import Link from 'next/link';
import { ParakhMark } from '@/components/Logo';

export default function Footer() {
  return (
    <footer className="border-t-[3px] border-ink bg-ink text-cream">
      <div className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-4 px-6 py-6 text-[0.9375rem] font-semibold">
        <span className="inline-flex items-center gap-2">
          <ParakhMark size={22} />
          Parakh · open source · model calls run on BharatCode
        </span>
        <div className="flex flex-wrap gap-6">
          <Link href="/docs" className="text-cream no-underline hover:text-marigold">Docs</Link>
          <Link href="/privacy" className="text-cream no-underline hover:text-marigold">Privacy</Link>
          <Link href="/terms" className="text-cream no-underline hover:text-marigold">Terms</Link>
          <a href="https://github.com/mayankmalik263/parakh" className="text-cream no-underline hover:text-marigold">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
