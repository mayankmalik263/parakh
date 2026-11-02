'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/landing/Navigation';
import Reveal from '@/components/motion/Reveal';
import { getSimulations } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';

type Sim = { id: string; idea: string; created_at: string; market?: string };

export default function DashboardPage() {
  const [simulations, setSimulations] = useState<Sim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login?next=/dashboard');
        return;
      }
      setUserEmail(session.user.email || '');
      // Show the list from the last visit at once, then refresh it from the server.
      const cacheKey = `parakh_plans_${session.user.id}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setSimulations(JSON.parse(cached));
          setLoading(false);
        }
      } catch { /* no cache: wait for the server */ }
      getSimulations()
        .then((list: Sim[]) => {
          setSimulations(list);
          setError('');
          try { sessionStorage.setItem(cacheKey, JSON.stringify(list)); } catch { /* storage full or blocked */ }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, [router]);

  const shown = simulations.filter((s) => s.idea?.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto w-full max-w-[68rem] px-6 pb-24 pt-14">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="eyebrow enter">Dashboard</span>
            <h1 className="display enter m-0 text-[clamp(2.75rem,6vw,4.5rem)]" style={{ '--i': 1 } as CSSProperties}>
              Your <em>plans</em>
            </h1>
            <p className="enter m-0 muted" style={{ '--i': 2 } as CSSProperties}>
              {loading ? 'Loading…' : `${simulations.length} ${simulations.length === 1 ? 'plan' : 'plans'}`}
              {userEmail && ` · ${userEmail}`}
            </p>
          </div>
          <div className="enter flex flex-wrap gap-2" style={{ '--i': 3 } as CSSProperties}>
            {process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true' && (
              <Link href="/dashboard/evals" className="btn btn-ghost btn-sm">Evaluations</Link>
            )}
            <Link href="/simulate" className="btn btn-primary">
              <Icon name="add" className="text-[1.25rem]" /> New plan
            </Link>
          </div>
        </div>

        {simulations.length > 3 && (
          <div className="enter mb-6" style={{ '--i': 4 } as CSSProperties}>
            <label htmlFor="plan-search" className="sr-only">Search plans</label>
            <div className="relative max-w-[26rem]">
              <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.25rem] text-on-surface-variant" />
              <input
                id="plan-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your ideas"
                className="field rounded-full py-3 pl-11"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card flex h-48 flex-col gap-3 p-6">
                <div className="shimmer h-3 w-24 rounded-full" />
                <div className="shimmer h-6 w-4/5 rounded-full" />
                <div className="shimmer h-6 w-3/5 rounded-full" />
                <div className="shimmer mt-auto h-3 w-28 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-8 text-center shadow-[6px_6px_0_#B3122E]">
            <p className="m-0 text-error">{error}</p>
          </div>
        ) : simulations.length === 0 ? (
          <div className="card enter flex flex-col items-center gap-5 px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full border-[3px] border-ink bg-marigold text-ink">
              <Icon name="lightbulb" className="text-[2rem]" />
            </span>
            <h2 className="display m-0 text-[2.25rem]">No plans yet</h2>
            <p className="m-0 max-w-[26rem] muted">Type one sentence about your idea. The agents take it from there, and the plan shows up here.</p>
            <Link href="/simulate" className="btn btn-primary">Run my first idea <span className="arrow">→</span></Link>
          </div>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center muted">No plans match &quot;{query}&quot;.</p>
        ) : (
          <Reveal className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((sim, n) => (
              <Link
                key={sim.id}
                href={`/dashboard/${sim.id}`}
                className="card spotlight lift group flex min-h-48 flex-col gap-4 p-6 no-underline active:scale-[0.99]"
                style={{ '--i': Math.min(n, 8) } as CSSProperties}
              >
                <div className="flex items-center justify-between text-sm muted">
                  <span>
                    {new Date(sim.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {sim.market && <span className="rounded-full border-2 border-ink bg-marigold px-2.5 py-0.5 text-xs font-bold text-ink">{sim.market}</span>}
                </div>
                <h3 className="display m-0 line-clamp-3 text-[1.625rem] leading-[1.15] text-on-surface">{sim.idea}</h3>
                <span className="mt-auto flex items-center gap-1.5 text-sm font-medium text-primary-fixed-dim">
                  Open plan <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ))}
          </Reveal>
        )}
      </main>
    </div>
  );
}
