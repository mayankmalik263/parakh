import Link from 'next/link';
import Navigation from '@/components/landing/Navigation';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <span className="sticker rounded-full border-[3px] border-ink bg-rani px-4 py-1.5 font-extrabold text-white" style={{ '--r': '-3deg' } as React.CSSProperties}>
          404
        </span>
        <h1 className="display m-0 text-[clamp(3rem,8vw,5.5rem)]">
          This page <em>doesn&apos;t exist</em>
        </h1>
        <p className="m-0 text-lg font-medium">The link may be old, or the plan was made private again.</p>
        <Link href="/" className="btn btn-primary">Back to Parakh</Link>
      </main>
    </div>
  );
}
