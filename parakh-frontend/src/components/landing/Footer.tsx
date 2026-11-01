import Link from 'next/link';
import { MassMark } from '@/components/Logo';

export default function Footer() {
  return (
    <footer className="border-t border-surface-container-low bg-black">
      <div className="mx-auto flex max-w-[64rem] flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-[#c6c6c7]">
        <span className="inline-flex items-center gap-2">
          <MassMark size={20} />
          Parakh, your own AI co-founder
        </span>
        <div className="flex gap-6">
          <Link href="/docs" className="no-underline hover:text-on-surface">Docs</Link>
          <Link href="/privacy" className="no-underline hover:text-on-surface">Privacy</Link>
          <Link href="/terms" className="no-underline hover:text-on-surface">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
