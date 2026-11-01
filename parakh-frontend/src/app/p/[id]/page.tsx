'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navigation from '@/components/landing/Navigation';
import PlanView from '@/components/plan/PlanView';
import { getSharedPlan, type SharedPlan } from '@/lib/api';

/** A plan its owner chose to share. Read-only: no checklist, no chat, no owner details. */
export default function SharedPlanPage() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getSharedPlan(id).then(setPlan).catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto w-full max-w-[64rem] px-6 pb-24 pt-10">
        {error ? (
          <div className="card flex flex-col items-center gap-5 p-10 text-center">
            <p className="m-0 text-error">{error}</p>
            <Link href="/simulate" className="btn btn-primary">Plan your own idea</Link>
          </div>
        ) : !plan ? (
          <div className="flex flex-col gap-4">
            <div className="shimmer h-4 w-40 rounded-full" />
            <div className="shimmer h-14 w-4/5 rounded-2xl" />
            <div className="shimmer h-72 w-full rounded-[1.25rem]" />
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            <header className="flex flex-col gap-4">
              <span className="eyebrow enter">Shared plan · made with Parakh</span>
              <h1 className="display enter m-0 text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02]" style={{ '--i': 1 } as CSSProperties}>
                {plan.idea}
              </h1>
              {plan.market && (
                <div className="enter flex flex-wrap gap-2 text-sm" style={{ '--i': 2 } as CSSProperties}>
                  <span className="rounded-full border-2 border-ink bg-surface px-3 py-1 font-semibold">{plan.market}</span>
                </div>
              )}
            </header>
            {plan.business_plan && <PlanView plan={plan.business_plan} report={plan.final_report} />}
            <section className="card flex flex-col items-center gap-4 p-8 text-center">
              <h2 className="display m-0 text-[2rem]">What would the Critic say about <em>your</em> idea?</h2>
              <p className="m-0 max-w-[36rem] muted">
                Four agents write the plan, code checks every number, and a Critic sends back what won&apos;t hold up.
                Free, and built for student founders in India.
              </p>
              <Link href="/simulate" className="btn btn-primary">Run my idea <span className="arrow">→</span></Link>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
