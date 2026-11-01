'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { BusinessPlan } from '@/types/simulation';
import Reveal from '@/components/motion/Reveal';
import CountUp from './CountUp';

type Props = {
  plan: BusinessPlan;
  report?: string;
  /** Saved checklist ticks ("go_to_market_0": true). Without it, ticks live in local state. */
  checklist?: Record<string, boolean>;
  onToggle?: (category: string, index: number, completed: boolean) => void;
};

const num = (s?: string) => {
  const m = s?.match(/\d[\d,]*(\.\d+)?/);
  return m ? parseFloat(m[0].replace(/,/g, '')) : 0;
};
const ROLES = ['Strategist', 'Builder', 'Economics', 'Growth', 'Critic'];

export default function PlanView({ plan, report, checklist, onToggle }: Props) {
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const ticks = checklist ?? local;
  const toggle = (category: string, i: number) => {
    const next = !ticks[`${category}_${i}`];
    if (onToggle) onToggle(category, i, next);
    else setLocal((s) => ({ ...s, [`${category}_${i}`]: next }));
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'money', label: 'Money' },
    plan.product_mvp?.length ? { id: 'build', label: 'Build' } : null,
    plan.go_to_market?.length ? { id: 'launch', label: 'Customers' } : null,
    plan.competition?.length ? { id: 'rivals', label: 'Competition' } : null,
    { id: 'critic', label: 'Critic' },
    report ? { id: 'report', label: 'Full report' } : null,
  ].filter(Boolean) as { id: string; label: string }[];

  const [active, setActive] = useState('overview');
  const bar = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    const place = () => {
      const btn = bar.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (btn) setPill({ transform: `translateX(${btn.offsetLeft}px)`, width: btn.offsetWidth, opacity: 1 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.id === active);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id;
    setActive(next);
    bar.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
        <div ref={bar} role="tablist" aria-label="Plan sections" onKeyDown={onKey} className="relative inline-flex gap-1 rounded-full border-[3px] border-ink bg-surface p-1">
          <div aria-hidden className="absolute bottom-1 left-0 top-1 rounded-full bg-marigold transition-[transform,width,opacity] duration-500 [transition-timing-function:var(--ease-spring)]" style={pill} />
          {tabs.map((t) => (
            <button
              key={t.id}
              data-tab={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={active === t.id ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={`relative z-10 min-h-10 cursor-pointer whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors active:scale-[0.96] ${active === t.id ? 'text-ink' : 'text-on-surface-variant hover:text-ink'} ${t.id === 'critic' && active !== t.id ? 'text-primary-fixed-dim' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div key={active} role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="enter">
        {active === 'overview' && <Overview plan={plan} />}
        {active === 'money' && <Money plan={plan} />}
        {active === 'build' && (
          <Checklist title="What to build, in order" items={plan.product_mvp} category="product_mvp" ticks={ticks} toggle={toggle} />
        )}
        {active === 'launch' && (
          <Checklist title="How the first customers come in" items={plan.go_to_market} category="go_to_market" ticks={ticks} toggle={toggle} />
        )}
        {active === 'rivals' && <Rivals plan={plan} />}
        {active === 'critic' && <Critic plan={plan} />}
        {active === 'report' && report && (
          <article className="card prose max-w-none p-6 md:p-8 prose-headings:font-display prose-headings:font-normal prose-headings:uppercase prose-h1:text-4xl prose-h2:text-3xl prose-h2:text-primary-fixed-dim prose-p:text-on-surface prose-li:text-on-surface prose-strong:text-ink prose-blockquote:border-l-rani prose-blockquote:text-ink prose-table:text-sm">
            <ReactMarkdown>{report}</ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, i, tone }: { label: string; value?: string; i: number; tone?: string }) {
  if (!value) return null;
  return (
    <div className="card spotlight p-5" style={{ '--i': i } as CSSProperties}>
      <div className="text-sm muted">{label}</div>
      <CountUp value={value} className={`mt-1.5 block font-display text-[2.25rem] leading-none tabular-nums ${tone ?? ''}`} />
    </div>
  );
}

function Overview({ plan }: { plan: BusinessPlan }) {
  const fs = plan.financial_snapshot || ({} as BusinessPlan['financial_snapshot']);
  const paid = [...(plan.business_model || [])].sort((a, b) => num(b.price) - num(a.price))[0];
  return (
    <div className="flex flex-col gap-3">
      {plan.mission && (
        <div className="card p-6 md:p-8">
          <div className="eyebrow mb-3">Mission</div>
          <p className="m-0 text-[clamp(1.375rem,2.4vw,1.875rem)] font-bold leading-snug">{plan.mission}</p>
        </div>
      )}
      <Reveal className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat i={0} label={`Price${paid ? ` (${paid.name})` : ''}`} value={paid?.price} />
        <Stat i={1} label="Monthly burn" value={fs.monthly_burn} />
        <Stat i={2} label="Break-even" value={fs.break_even_target} />
        <Stat i={3} label="Runway" value={fs.runway} />
      </Reveal>
      <div className="grid gap-3 md:grid-cols-2">
        {plan.problem && (
          <div className="card spotlight p-6">
            <div className="eyebrow mb-2">The problem</div>
            <p className="m-0 leading-relaxed muted">{plan.problem}</p>
          </div>
        )}
        {plan.target_customer && (
          <div className="card spotlight p-6">
            <div className="eyebrow mb-2">Who pays</div>
            <p className="m-0 leading-relaxed muted">{plan.target_customer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Money({ plan }: { plan: BusinessPlan }) {
  const fs = plan.financial_snapshot || ({} as BusinessPlan['financial_snapshot']);
  const burn = num(fs.monthly_burn);
  const parts = (fs.burn_breakdown || '')
    .split(';')
    .map((p) => {
      const at = p.lastIndexOf(':');
      return at > 0 ? { label: p.slice(0, at).trim(), amount: num(p.slice(at + 1)) } : null;
    })
    .filter((p): p is { label: string; amount: number } => !!p && p.amount > 0);
  const partsTotal = parts.reduce((a, p) => a + p.amount, 0);
  const targets = plan.revenue_targets || [];
  const top = Math.max(burn, ...targets.map((t) => num(t.mrr)), 1) * 1.12;
  const colors = ['#E0177A', '#FFB20F', '#161616', '#8A4F00', '#F4DFB6', '#FCD3E6'];

  return (
    <div className="flex flex-col gap-3">
      {!!plan.business_model?.length && (
        <Reveal className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
          {plan.business_model.map((tier, i) => (
            <div key={tier.name} className="card spotlight lift p-6" style={{ '--i': i } as CSSProperties}>
              <div className="text-sm font-extrabold uppercase text-primary-fixed-dim">{tier.name}</div>
              <div className="display mt-1 text-[2.5rem]">{tier.price}</div>
              <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[0.9375rem] muted">
                {tier.features?.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-primary">✓</span>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>
      )}

      {targets.length > 0 && (
        <Reveal self className="card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="eyebrow">Revenue targets</div>
            {burn > 0 && <div className="text-sm muted"><span className="mr-1.5 inline-block w-4 border-t-2 border-dashed border-tertiary align-middle" />Monthly burn {fs.monthly_burn}</div>}
          </div>
          <div className="relative mt-6 flex h-56 items-end gap-4 md:gap-8">
            {burn > 0 && (
              <div className="absolute inset-x-0 border-t-2 border-dashed border-tertiary/70" style={{ bottom: `${(burn / top) * 100}%` }} />
            )}
            {targets.map((t, i) => (
              <div key={t.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="mb-2 text-center text-sm font-semibold tabular-nums">{t.mrr.replace(/\s*MRR/i, '')}</div>
                <div
                  className="bar rounded-t-xl border-[3px] border-b-0 border-ink bg-rani transition-[filter] group-hover:brightness-110"
                  style={{ height: `${(num(t.mrr) / top) * 100}%`, '--i': i } as CSSProperties}
                />
                {t.notes && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-8 w-56 -translate-x-1/2 rounded-xl border-2 border-ink bg-ink p-3 text-xs leading-snug text-cream opacity-0 transition-opacity group-hover:opacity-100">
                    {t.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 md:gap-8">
            {targets.map((t) => (
              <div key={t.day} className="flex-1 text-center text-sm muted">Day {t.day}</div>
            ))}
          </div>
        </Reveal>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {parts.length > 0 && (
          <Reveal self className="card p-6">
            <div className="eyebrow mb-4">Where the burn goes</div>
            <div className="flex h-4 overflow-hidden rounded-full border-2 border-ink bg-surface-container-high">
              {parts.map((p, i) => (
                <div key={p.label} className="seg h-full" style={{ width: `${(p.amount / partsTotal) * 100}%`, background: colors[i % colors.length], '--i': i } as CSSProperties} />
              ))}
            </div>
            <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0 text-sm">
              {parts.map((p, i) => (
                <li key={p.label} className="flex items-start gap-2.5">
                  <span className="mt-1 size-3 shrink-0 rounded-full border-2 border-ink" style={{ background: colors[i % colors.length] }} />
                  <span className="flex-1 muted">{p.label}</span>
                  <span className="font-semibold tabular-nums">₹{p.amount.toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Stat i={0} label="Starting money" value={fs.funding_needed} />
          <Stat i={1} label="Runway" value={fs.runway} />
          <Stat i={2} label="Break-even" value={fs.break_even_target} />
          <Stat i={3} label="Burn" value={fs.monthly_burn} tone="text-tertiary" />
        </div>
      </div>
    </div>
  );
}

function Checklist({ title, items, category, ticks, toggle }: {
  title: string; items: string[]; category: string; ticks: Record<string, boolean>; toggle: (c: string, i: number) => void;
}) {
  const done = items.filter((_, i) => ticks[`${category}_${i}`]).length;
  const pct = items.length ? done / items.length : 0;
  return (
    <div className="card p-6 md:p-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">Checklist</div>
          <h3 className="display m-0 text-[1.75rem]">{title}</h3>
        </div>
        <div className="relative size-14 shrink-0">
          <svg viewBox="0 0 36 36" className="size-14 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F4DFB6" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E0177A" strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray="97.4" strokeDashoffset={97.4 * (1 - pct)}
              className="transition-[stroke-dashoffset] duration-700 [transition-timing-function:var(--ease-spring)]" />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">{done}/{items.length}</span>
        </div>
      </div>
      <Reveal as="ol" className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((item, i) => {
          const on = !!ticks[`${category}_${i}`];
          return (
            <li key={i} style={{ '--i': Math.min(i, 8) } as CSSProperties}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(category, i)}
                className="group flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface-container-low active:scale-[0.99]"
              >
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 border-ink transition-all duration-300 ${on ? 'scale-100 bg-primary' : 'bg-surface group-hover:bg-surface-container'}`}>
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5l3 3 6-7" strokeDasharray="16" strokeDashoffset={on ? 0 : 16} className="transition-[stroke-dashoffset] duration-300" />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="mr-2 font-mono text-sm tabular-nums text-on-surface-variant">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`leading-relaxed transition-colors ${on ? 'text-on-surface-variant line-through decoration-rani decoration-2' : 'text-on-surface'}`}>{item}</span>
                </span>
              </button>
            </li>
          );
        })}
      </Reveal>
    </div>
  );
}

function Rivals({ plan }: { plan: BusinessPlan }) {
  return (
    <Reveal className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
      {plan.competition?.map((c, i) => (
        <div key={c.name} className="card spotlight lift flex flex-col gap-3 p-6" style={{ '--i': i } as CSSProperties}>
          <div className="grid size-11 place-items-center rounded-full border-[3px] border-ink bg-marigold font-display text-xl">{c.name[0]}</div>
          <h3 className="m-0 text-lg font-semibold">{c.name}</h3>
          <p className="m-0 leading-relaxed muted">{c.differentiator}</p>
        </div>
      ))}
    </Reveal>
  );
}

function Critic({ plan }: { plan: BusinessPlan }) {
  const issues = (plan.key_conflicts || []).map((c) => {
    const owner = ROLES.find((r) => c.title?.startsWith(`${r}:`)) ?? 'Critic';
    const [problem, fix] = (c.description || c.title).split(/\s*Fix:\s*/);
    return { owner, problem, fix };
  });
  return (
    <div className="flex flex-col gap-3">
      {plan.final_verdict && (
        <div className="card bg-ink p-6 text-cream shadow-[6px_6px_0_#E0177A] md:p-8">
          <div className="mb-3 font-display text-lg uppercase tracking-[0.04em] text-marigold">The Critic&apos;s verdict</div>
          <p className="m-0 text-[clamp(1.25rem,2.2vw,1.75rem)] font-bold leading-snug">{plan.final_verdict}</p>
        </div>
      )}
      {issues.length > 0 && (
        <Reveal className="flex flex-col gap-2">
          {issues.map((it, i) => (
            <details key={i} className="group card overflow-hidden" style={{ '--i': Math.min(i, 6) } as CSSProperties}>
              <summary className="flex cursor-pointer list-none items-start gap-3 p-5 [&::-webkit-details-marker]:hidden">
                <span className="shrink-0 rounded-full border-2 border-ink bg-marigold px-2.5 py-0.5 text-xs font-extrabold text-ink">{it.owner}</span>
                <span className="flex-1 leading-relaxed line-clamp-2 group-open:line-clamp-none">{it.problem}</span>
                <span aria-hidden className="mt-0.5 shrink-0 text-xl font-bold transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              {it.fix && (
                <div className="mx-5 mb-5 rounded-xl border-2 border-ink bg-surface-container-low p-4 text-[0.9375rem] leading-relaxed">
                  <span className="font-semibold text-tertiary">Fix: </span>
                  <span className="muted">{it.fix}</span>
                </div>
              )}
            </details>
          ))}
        </Reveal>
      )}
    </div>
  );
}

export function PlanFrame({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border-[3px] border-ink bg-cream shadow-[10px_10px_0_#161616]">
      <div className="flex items-center gap-2 border-b-[3px] border-ink bg-surface px-5 py-3">
        <span className="size-3.5 rounded-full border-2 border-ink bg-rani" />
        <span className="size-3.5 rounded-full border-2 border-ink bg-marigold" />
        <span className="size-3.5 rounded-full border-2 border-ink bg-surface" />
        <span className="ml-3 truncate font-mono text-sm muted">{title}</span>
      </div>
      <div className="p-4 md:p-6">{children}</div>
    </div>
  );
}

