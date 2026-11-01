'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SAMPLE_IDEA, SAMPLE_STEPS, type Step } from '@/lib/sampleRun';

const NODES: { key: Step['agent']; icon: string }[] = [
  { key: 'Strategist', icon: 'explore' },
  { key: 'Builder', icon: 'construction' },
  { key: 'Economics', icon: 'payments' },
  { key: 'Growth', icon: 'campaign' },
  { key: 'Code', icon: 'calculate' },
  { key: 'Critic', icon: 'gavel' },
];
const STEP_MS = 3400;

/** Replays a real MASS run step by step. Autoplays once on screen; click a node or a segment to jump. */
export default function DebateReplay() {
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const last = SAMPLE_STEPS.length - 1;

  // Start when scrolled into view.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setStep(last);
      else {
        setStep(0);
        setPlaying(true);
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [last]);

  useEffect(() => {
    if (!playing || step >= last) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step, last]);

  // Keep the newest message in view without scrolling the page.
  useEffect(() => {
    const f = feed.current;
    if (f) f.scrollTo({ top: f.scrollHeight, behavior: 'smooth' });
  }, [step]);

  const current = SAMPLE_STEPS[step];
  const round = current?.round ?? 1;
  const doneInRound = new Set(SAMPLE_STEPS.slice(0, step).filter((s) => s.round === round).map((s) => s.agent));

  const jumpTo = (agent: Step['agent']) => {
    const inRound = SAMPLE_STEPS.findIndex((s) => s.agent === agent && s.round === round);
    const any = inRound >= 0 ? inRound : SAMPLE_STEPS.findIndex((s) => s.agent === agent);
    if (any >= 0) {
      setStep(any);
      setPlaying(false);
    }
  };

  return (
    <div ref={root} className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container-high px-5 py-4 md:px-7">
        <div className="min-w-0">
          <div className="text-sm muted">Idea</div>
          <div className="serif truncate text-[1.25rem] italic">&ldquo;{SAMPLE_IDEA}&rdquo;</div>
        </div>
        <div className="flex items-center gap-2">
          <span key={round} className="enter rounded-full bg-surface-container-high px-3 py-1.5 text-sm font-medium tabular-nums">
            Round {round} of 2
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (step >= last) {
                setStep(0);
                setPlaying(true);
              } else setPlaying((p) => !p);
            }}
          >
            <Icon name={step >= last ? 'replay' : playing ? 'pause' : 'play_arrow'} className="text-[1.125rem]" />
            {step >= last ? 'Replay' : playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>

      {/* Pipeline */}
      <div className="relative px-4 pb-2 pt-6 md:px-7">
        <div className="relative grid grid-cols-6 gap-1">
          <div aria-hidden className="absolute left-[8.33%] right-[8.33%] top-[1.625rem] h-px sm:top-8 bg-surface-container-highest" />
          {NODES.map((n, i) => {
            const active = current?.agent === n.key;
            const done = doneInRound.has(n.key);
            const critic = n.key === 'Critic';
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => jumpTo(n.key)}
                className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl py-1"
                style={{ '--i': i } as CSSProperties}
                aria-label={`Show what ${n.key === 'Code' ? 'the code check' : `the ${n.key}`} wrote`}
              >
                <span
                  className={`relative grid size-11 place-items-center rounded-full transition-all duration-500 [transition-timing-function:var(--ease-bounce)] group-hover:scale-110 sm:size-14 group-active:scale-95 ${
                    active
                      ? `${critic ? 'bg-tertiary text-on-tertiary' : 'bg-inverse-primary text-white'} scale-110 [animation:pulse-ring_1.4s_ease-out_infinite]`
                      : done
                        ? 'bg-surface-container-highest text-primary-fixed-dim'
                        : 'bg-surface-container-high text-[#8d8b8b]'
                  }`}
                >
                  <Icon name={n.icon} className="text-[1.5rem]" />
                  {done && !active && (
                    <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-primary text-[0.7rem] text-white">✓</span>
                  )}
                </span>
                <span className={`serif text-center text-[0.875rem] transition-colors sm:text-[1.0625rem] ${active ? 'italic text-on-surface' : 'text-[#9d9b9b]'}`}>
                  {n.key === 'Code' ? 'Math check' : n.key}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      <div ref={feed} className="flex h-[24rem] flex-col gap-3 overflow-y-auto px-4 pb-6 pt-3 [scrollbar-width:thin] md:px-7" aria-live="polite">
        {step < 0 && <div className="m-auto text-sm muted">Scroll here to start the replay.</div>}
        {SAMPLE_STEPS.slice(0, step + 1).map((s, i) => {
          const isNew = i === step;
          const newRound = i > 0 && SAMPLE_STEPS[i - 1].round !== s.round;
          return (
            <div key={i} className="flex flex-col gap-2">
              {newRound && (
                <div className="enter my-1 flex items-center gap-3 text-sm text-tertiary">
                  <span className="h-px flex-1 bg-tertiary/30" />
                  Round 2: the agents with problems revise
                  <span className="h-px flex-1 bg-tertiary/30" />
                </div>
              )}
              <div className={`${isNew ? 'enter' : ''} flex gap-3 ${s.skipped ? 'opacity-50' : ''}`}>
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${s.agent === 'Critic' ? 'bg-tertiary/15 text-tertiary' : s.agent === 'Code' ? 'bg-surface-container-highest text-on-surface' : 'bg-inverse-primary/25 text-primary-fixed-dim'}`}>
                  <Icon name={NODES.find((n) => n.key === s.agent)!.icon} className="text-[1.05rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`serif text-[1.0625rem] italic ${s.agent === 'Critic' ? 'text-tertiary' : s.agent === 'Code' ? 'text-on-surface' : 'text-primary-fixed-dim'}`}>
                    {s.agent === 'Code' ? 'Math check' : s.agent}
                    {s.agent === 'Code' && <span className="ml-2 font-sans text-[0.6875rem] not-italic uppercase tracking-[0.12em] text-[#8d8b8b]">code, not AI</span>}
                  </div>
                  <p className="serif m-0 mt-0.5 text-[1.25rem] text-[#e2e0e0]">
                    {isNew
                      ? s.text.split(' ').map((w, j) => (
                          <span key={j} className="word" style={{ '--i': j } as CSSProperties}>{w}&nbsp;</span>
                        ))
                      : s.text}
                  </p>
                  {s.sendsBack && (
                    <div className="mt-2 flex flex-col gap-2">
                      {s.sendsBack.map((b, j) => (
                        <div
                          key={j}
                          className={`${isNew ? 'enter' : ''} rounded-xl border-l-2 ${s.agent === 'Code' ? 'border-primary bg-primary/10' : 'border-tertiary bg-tertiary/10'} serif px-3.5 py-2.5 text-[1.125rem]`}
                          style={{ '--i': j + 4 } as CSSProperties}
                        >
                          <span className="mr-1.5 italic text-on-surface">→ {b.to}</span>
                          <span className="text-[#d4d2d2]">{b.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrubber */}
      <div className="flex gap-1 px-4 pb-5 md:px-7">
        {SAMPLE_STEPS.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Step ${i + 1}: ${s.agent}`}
            onClick={() => {
              setStep(i);
              setPlaying(false);
            }}
            className="group flex h-6 flex-1 cursor-pointer items-center"
          >
            <span className={`h-1.5 w-full rounded-full transition-all duration-300 group-hover:h-2.5 ${i <= step ? (s.agent === 'Critic' ? 'bg-tertiary' : 'bg-primary') : 'bg-surface-container-highest'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
