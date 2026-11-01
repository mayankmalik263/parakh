'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';

export default function Navigation() {
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-ink bg-background/90 backdrop-blur-md [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
      <nav aria-label="Main" className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
        <Logo />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/#how" className="nav-link hidden sm:inline">How it works</Link>
          <Link href="/critique" className="nav-link">Check a deck</Link>
          <Link href="/docs" className="nav-link">Docs</Link>
          {session ? (
            <>
              <Link href="/dashboard" className="nav-link">My plans</Link>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/');
                }}
                className="nav-link"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="nav-link">Log in</Link>
          )}
          <Link href="/simulate" className="btn btn-marigold btn-sm">
            {session ? 'New plan' : 'Start free'}
          </Link>
        </div>
      </nav>
    </header>
  );
}
