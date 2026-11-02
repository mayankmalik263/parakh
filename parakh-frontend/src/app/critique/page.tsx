'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/landing/Navigation';
import { Icon } from '@/components/ui/Icon';
import Reveal from '@/components/motion/Reveal';
import { ProviderPicker } from '@/components/ProviderPicker';
import { supabase } from '@/lib/supabase';
import { getCritique, startCritique, type CritiqueFinding, type CritiqueResult } from '@/lib/api';

type Phase = 'form' | 'running' | 'done' | 'error';

const MAX_SLIDES = 3;
const MAX_SIDE = 1600; // px: plenty to read numbers, small enough to upload fast

// A numbers slide with four mistakes in it, so anyone can try the check without a deck.
const SAMPLE = `NoteNest: shared notes and PYQs for UPES students
Price: ₹299/month per student
Paying students today: 150
MRR: ₹60,000
Monthly burn: ₹40,000 (rent ₹15,000, salaries ₹20,000, tools ₹3,000)
Cash in bank: ₹2,00,000
Runway: 12 months
Instagram ads: ₹10,000/month brings 50 new students, CAC ₹100
Market: 4 crore college students in India, we only need 1%`;

const i = (n: number) => ({ '--i': n }) as CSSProperties;

/** Reads an image file, scales it down to MAX_SIDE, and returns a JPEG data URL. */
async function toDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`${file.name} isn't an image we can read.`));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser blocked image processing.');
    ctx.fillStyle = '#fff'; // transparent PNGs become white, not black, as JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function money(value: number, currency: string) {
  const locale = currency === 'USD' ? 'en-US' : 'en-IN';
  const symbol = currency === 'USD' ? '$' : '₹';
  return `${symbol}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)}`;
}

function formatValue(value: number | null, field: string, currency: string) {
  if (value === null || value === undefined) return 'not given';
  if (field === 'runway_months') return `${value} mo`;
  if (field === 'break_even_customers') return `${value.toLocaleString('en-IN')} customers`;
  return money(value, currency);
}

const FIELD_LABELS: Record<string, string> = {
  monthly_burn: 'Monthly burn',
  runway_months: 'Runway',
  break_even_customers: 'Break-even',
  current_mrr: 'MRR',
  revenue_targets: 'Revenue target',
  channels: 'Cost per customer',
  delivery_cost_per_customer: 'Margin per customer',
};

function FindingCard({ f, currency, n }: { f: CritiqueFinding; currency: string; n: number }) {
  const showNumbers = f.severity === 'error' && f.claimed !== null && f.computed !== null;
  return (
    <Reveal self className={`card flex flex-col gap-3 p-5 md:p-6 ${f.severity === 'error' ? 'shadow-[6px_6px_0_#E0177A]' : ''}`} style={i(n)}>
      <div className="flex items-center gap-2 text-sm">
        <Icon name={f.severity === 'error' ? 'error' : 'warning'} className={f.severity === 'error' ? 'text-primary-fixed-dim' : 'text-tertiary'} />
        <span className={f.severity === 'error' ? 'font-display text-lg uppercase tracking-[0.03em] text-primary-fixed-dim' : 'font-display text-lg uppercase tracking-[0.03em] text-tertiary'}>
          {FIELD_LABELS[f.field] ?? 'Check this'}
        </span>
      </div>
      {showNumbers && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 tabular-nums">
          <span className="strike relative font-display text-[2rem] text-on-surface-variant">{formatValue(f.claimed, f.field, currency)}</span>
          <span className="pop font-display text-[2.75rem] leading-none text-primary-fixed-dim">{formatValue(f.computed, f.field, currency)}</span>
        </div>
      )}
      <p className="m-0 leading-relaxed">{f.problem}</p>
      <p className="m-0 text-sm leading-relaxed muted">
        <span className="font-extrabold text-ink">Fix: </span>
        {f.fix}
      </p>
    </Reveal>
  );
}

export default function CritiquePage() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [slides, setSlides] = useState<{ name: string; url: string }[]>([]);
  const [text, setText] = useState('');
  const [idea, setIdea] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CritiqueResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login?next=/critique');
      else setSessionChecked(true);
    });
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [router]);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError('');
    const room = MAX_SLIDES - slides.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (files.length > room) setError(`Up to ${MAX_SLIDES} slides at a time. Pick the ones with your numbers.`);
    try {
      const added = await Promise.all(picked.map(async (f) => ({ name: f.name, url: await toDataUrl(f) })));
      setSlides((s) => [...s, ...added].slice(0, MAX_SLIDES));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slides.length && text.trim().length < 20) {
      setError('Add a slide screenshot or paste the numbers from your deck.');
      return;
    }
    setError('');
    setPhase('running');
    setElapsed(0);
    try {
      const { job_id } = await startCritique({ images: slides.map((s) => s.url), text, idea });
      const started = Date.now();
      poll.current = setInterval(async () => {
        const seconds = Math.round((Date.now() - started) / 1000);
        setElapsed(seconds);
        try {
          const job = await getCritique(job_id);
          if (job.status === 'done' && job.result) {
            clearInterval(poll.current!);
            setResult(job.result);
            setPhase('done');
          } else if (job.status === 'error') {
            clearInterval(poll.current!);
            setError(job.error || 'The check failed.');
            setPhase('error');
          } else if (seconds > 300) {
            clearInterval(poll.current!);
            setError('This is taking too long. Try again in a minute.');
            setPhase('error');
          }
        } catch {
          // A missed poll is fine; the next one tries again.
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the check.');
      setPhase('error');
    }
  };

  const reset = () => {
    setPhase('form');
    setResult(null);
    setError('');
  };

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-2 border-surface-container-highest border-t-primary" aria-label="Loading" />
      </div>
    );
  }

  const currency = (result?.claims.currency as string) || 'INR';
  const errors = result?.findings.filter((f) => f.severity === 'error') ?? [];
  const warnings = result?.findings.filter((f) => f.severity === 'warning') ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto w-full max-w-[56rem] px-6 pb-24 pt-14">
        <div key={phase} className="mb-10 flex flex-col gap-3 text-center">
          <span className="eyebrow enter mx-auto" style={i(0)}>
            {phase === 'form' && 'Deck check'}
            {phase === 'running' && `Reading · ${elapsed}s`}
            {phase === 'done' && 'Checked'}
            {phase === 'error' && 'Something broke'}
          </span>
          <h1 className="display enter m-0 text-[clamp(2.5rem,6vw,4.5rem)]" style={i(1)}>
            {phase === 'form' && <>Does your deck <em>add up?</em></>}
            {phase === 'running' && <>Checking your <em>numbers</em></>}
            {phase === 'done' && (errors.length ? <>{errors.length} number{errors.length > 1 ? 's' : ''} don&apos;t <em>add up</em></> : <>The math <em>holds</em></>)}
            {phase === 'error' && <>That didn&apos;t <em>work</em></>}
          </h1>
          <p className="enter mx-auto m-0 max-w-[38rem] text-lg leading-relaxed muted" style={i(2)}>
            {phase === 'form' && 'Drop in the slides with your numbers, or paste them. Code recomputes runway, break-even, MRR and CAC from what the deck says, then the Critic reads the rest.'}
            {phase === 'running' && 'Reading the slides, redoing the math, then the Critic weighs in. Usually under a minute.'}
            {phase === 'done' && "Every pink number below was recomputed by code from your own deck. Parakh doesn't store your deck."}
            {phase === 'error' && error}
          </p>
        </div>

        {phase === 'form' && (
          <form onSubmit={submit} className="enter flex flex-col gap-4" style={i(3)}>
            <div
              className="card flex flex-col items-center gap-3 border-dashed p-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
            >
              <Icon name="add_photo_alternate" className="text-[2rem] text-primary-fixed-dim" />
              <p className="m-0 font-semibold">Drop up to {MAX_SLIDES} slide screenshots here</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()} disabled={slides.length >= MAX_SLIDES}>
                Choose images
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                aria-label="Slide screenshots"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              {slides.length > 0 && (
                <ul className="m-0 mt-2 flex list-none flex-wrap justify-center gap-3 p-0">
                  {slides.map((s, n) => (
                    <li key={s.name + n} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                      <img src={s.url} alt={s.name} className="h-24 w-36 rounded-xl border-[3px] border-ink object-cover" />
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => setSlides((all) => all.filter((_, k) => k !== n))}
                        className="absolute -right-2 -top-2 grid size-7 cursor-pointer place-items-center rounded-full border-2 border-ink bg-marigold text-sm font-bold"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-2 transition-shadow duration-200 focus-within:shadow-[8px_8px_0_#E0177A]">
              <label htmlFor="deck-text" className="sr-only">Or paste the numbers from your deck</label>
              <textarea
                id="deck-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                maxLength={8000}
                placeholder={'Or paste the numbers, e.g.\nPrice ₹299/month, 150 paying users, MRR ₹60,000\nBurn ₹40,000/month, cash ₹2,00,000, runway 12 months'}
                className="field resize-y border-0 bg-transparent font-mono text-sm leading-relaxed shadow-none focus:transform-none focus:shadow-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2">
                <button type="button" className="cursor-pointer text-sm font-bold text-primary-fixed-dim underline decoration-2 underline-offset-2" onClick={() => setText(SAMPLE)}>
                  Try a sample with 4 mistakes in it
                </button>
                <span className="font-mono text-sm tabular-nums text-on-surface-variant">{text.length} / 8000</span>
              </div>
            </div>

            <label className="flex flex-col gap-2 text-sm font-semibold">
              What does the startup do? (optional, helps the Critic)
              <input value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={500} placeholder="Shared notes and past papers for UPES students" className="field" />
            </label>

            {error && <p role="alert" className="m-0 text-sm text-error">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold muted">Parakh doesn&apos;t store what you upload.</p>
              <button type="submit" className="btn btn-primary">
                Check my deck <span className="arrow">→</span>
              </button>
            </div>
            <ProviderPicker />
          </form>
        )}

        {phase === 'running' && (
          <div className="flex justify-center py-10">
            <span className="size-12 animate-spin rounded-full border-[5px] border-surface-container-high border-t-rani" aria-label="Checking" />
          </div>
        )}

        {phase === 'error' && (
          <div className="flex justify-center">
            <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="flex flex-col gap-12">
            {(result.claims.startup_name || result.claims.one_liner) && (
              <p className="m-0 text-center text-lg muted">
                {result.claims.startup_name && <span className="font-semibold text-on-surface">{result.claims.startup_name}</span>}
                {result.claims.startup_name && result.claims.one_liner && ': '}
                {result.claims.one_liner}
              </p>
            )}

            {errors.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="errors-title">
                <h2 id="errors-title" className="display m-0 text-[2rem]">Doesn&apos;t add up</h2>
                {errors.map((f, n) => <FindingCard key={n} f={f} currency={currency} n={n} />)}
              </section>
            )}

            {result.recomputed.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="recomputed-title">
                <h2 id="recomputed-title" className="display m-0 text-[2rem]">What the numbers actually say</h2>
                <dl className="m-0 grid gap-3 sm:grid-cols-2">
                  {result.recomputed.map((r) => (
                    <div key={r.label} className="rounded-2xl border-[3px] border-ink bg-surface p-4">
                      <dt className="text-sm muted">{r.label}</dt>
                      <dd className="m-0 mt-1 font-display text-[2rem] leading-none tabular-nums">
                        {r.unit === 'money' ? money(r.value, currency) : r.unit === 'months' ? `${r.value} months` : r.value.toLocaleString('en-IN')}
                      </dd>
                      <dd className="m-0 mt-2 font-mono text-sm muted">{r.formula}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {warnings.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="warnings-title">
                <h2 id="warnings-title" className="display m-0 text-[2rem]">Worth a second look</h2>
                {warnings.map((f, n) => <FindingCard key={n} f={f} currency={currency} n={n} />)}
              </section>
            )}

            {result.verdict ? (
              <section className="card flex flex-col gap-5 bg-ink p-6 text-cream shadow-[6px_6px_0_#E0177A] md:p-8" aria-labelledby="critic-title">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full border-[3px] border-cream bg-marigold text-ink"><Icon name="gavel" /></span>
                  <h2 id="critic-title" className="m-0 font-display text-[2rem] font-normal uppercase text-marigold">The Critic</h2>
                </div>
                <p className="m-0 text-[1.1875rem] font-semibold leading-relaxed">{result.verdict.verdict}</p>
                <p className="m-0"><span className="font-extrabold text-marigold">Biggest risk: </span>{result.verdict.biggest_risk}</p>
                {result.verdict.red_flags.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="m-0 font-display text-lg font-normal uppercase tracking-[0.03em] text-marigold">Claims a judge won&apos;t buy</h3>
                    {result.verdict.red_flags.map((r, n) => (
                      <div key={n} className="rounded-2xl border-[3px] border-cream bg-cream p-4 text-ink">
                        <p className="m-0 font-bold">&quot;{r.claim}&quot;</p>
                        <p className="m-0 mt-1 leading-relaxed muted">{r.problem}</p>
                        <p className="m-0 mt-1 text-sm"><span className="font-semibold">Fix: </span>{r.fix}</p>
                      </div>
                    ))}
                  </div>
                )}
                {result.verdict.missing.length > 0 && (
                  <div>
                    <h3 className="m-0 mb-2 font-display text-lg font-normal uppercase tracking-[0.03em] text-marigold">Numbers you&apos;ll be asked for</h3>
                    <ul className="m-0 flex flex-col gap-1 pl-5 text-cream/85">{result.verdict.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                )}
                {result.verdict.questions_to_expect.length > 0 && (
                  <div>
                    <h3 className="m-0 mb-2 font-display text-lg font-normal uppercase tracking-[0.03em] text-marigold">Questions to expect</h3>
                    <ul className="m-0 flex flex-col gap-1 pl-5 text-cream/85">{result.verdict.questions_to_expect.map((q) => <li key={q}>{q}</li>)}</ul>
                  </div>
                )}
              </section>
            ) : (
              <p className="m-0 text-center muted">The Critic couldn&apos;t finish its review this time. The math check above still stands.</p>
            )}

            {Array.isArray(result.claims.unreadable) && result.claims.unreadable.length > 0 && (
              <p className="m-0 text-sm muted">
                Couldn&apos;t read clearly: {result.claims.unreadable.join('; ')}. A sharper screenshot or pasted text will fix it.
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" className="btn btn-primary" onClick={reset}>Check another deck</button>
              <Link href="/simulate" className="btn btn-ghost">Build a full plan instead</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
