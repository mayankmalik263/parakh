'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';

const linkClass = 'nav-link';

export default function Navigation() {
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-black/55 backdrop-blur-[24px] backdrop-saturate-[180%] motion-safe:transition-colors [@media(prefers-reduced-transparency:reduce)]:bg-surface-container-lowest [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
      <nav aria-label="Main" className="mx-auto flex max-w-[64rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2.5 text-[0.9375rem]">
        <Logo />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <Link href="/#agents" className={`${linkClass} hidden sm:inline`}>Agents</Link>
          <Link href="/#sample" className={`${linkClass} hidden sm:inline`}>Sample plan</Link>
          <Link href="/critique" className={linkClass}>Check a deck</Link>
          <Link href="/docs" className={linkClass}>Docs</Link>
          {session ? (
            <>
              <Link href="/dashboard" className={linkClass}>Dashboard</Link>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/');
                }}
                className={linkClass}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className={linkClass}>Log in</Link>
          )}
          <Link href="/simulate" className="btn btn-primary btn-sm">
            {session ? 'New plan' : 'Start free'}
          </Link>
        </div>
      </nav>
    </header>
  );
}
