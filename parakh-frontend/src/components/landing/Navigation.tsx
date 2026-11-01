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
      <nav aria-label="Main" className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Logo />
        {/* Phones: logo and the main button on one row, the links on a second row. */}
        <div className="order-3 flex w-full items-center gap-x-5 overflow-x-auto pb-1 [scrollbar-width:none] sm:order-2 sm:ml-auto sm:w-auto sm:gap-x-6 sm:overflow-visible sm:pb-0">
          <Link href="/#how" className="nav-link hidden shrink-0 sm:inline">How it works</Link>
          <Link href="/critique" className="nav-link shrink-0">Check a deck</Link>
          <Link href="/docs" className="nav-link shrink-0">Docs</Link>
          {session ? (
            <>
              <Link href="/dashboard" className="nav-link shrink-0">My plans</Link>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/');
                }}
                className="nav-link shrink-0"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="nav-link shrink-0">Log in</Link>
          )}
        </div>
        <Link href="/simulate" className="btn btn-marigold btn-sm order-2 ml-auto sm:order-3 sm:ml-0">
          {session ? 'New plan' : 'Start free'}
        </Link>
      </nav>
    </header>
  );
}
