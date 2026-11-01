'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import Navigation from '@/components/landing/Navigation';
import { startSimulation, getSimulationStatus, streamSimulation } from '@/lib/api';
import type {
  SimulateRequest,
  SimulationJob,
  AgentEvent,
} from '@/types/simulation';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PlanView from '@/components/plan/PlanView';
import { Icon } from '@/components/ui/Icon';
import { BharatCodeKeyField } from '@/components/BharatCodeKeyField';
/* ─── Agent display config ─────────────────────────── */
const AGENTS = [
  { key: 'Strategist', icon: 'explore' },
  { key: 'Builder', icon: 'construction' },
  { key: 'Economics', icon: 'payments' },
  { key: 'Growth', icon: 'campaign' },
  { key: 'Critic', icon: 'gavel' },
  { key: 'Report', icon: 'description' },
];

const EXAMPLES = [
  'Notes and PYQ papers for my college, sold to juniors before exams',
  'Instagram reels editing for cafes near campus in Dehradun',
  'A WhatsApp bot that reminds dental patients about appointments',
  'Handmade candles sold on Instagram, made in my hostel room',
];

/* ─── Phase enum ───────────────────────────────────── */
type Phase = 'form' | 'clarify' | 'running' | 'done' | 'error';

/**
 * Reads the three fixed clarify questions (CLARIFY_FIXED in api.py) into the market and the
 * "Funding:" / "Founder:" markers the backend's build_profile trusts over keyword guessing.
 * Only the chosen answers are read, never the question text, which names every option.
 */
function profileFromAnswers(pairs: [string, string][]): { market: string; markers: string } {
  const answer = (question: string) => pairs.find(([q]) => q === question)?.[1]?.toLowerCase() ?? '';
  const where = answer('Where are your first customers?');
  const who = answer("Who's building this?");
  const money = answer('How will you fund the start?');

  const market = where.startsWith('outside india') ? 'Global' : where ? 'India' : '';
  const markers = [
    money.includes('investors') ? 'Funding: Venture' : money ? 'Funding: Bootstrapped' : '',
    who.includes('student') ? 'Founder: Student' : who.includes('full time') ? 'Founder: Full-time' : who.includes('job') ? 'Founder: Professional' : '',
  ].filter(Boolean).join('. ');
  return { market, markers };
}

export default function SimulatePage() {
  /* Form state */
  const [form, setForm] = useState<SimulateRequest>({
    idea: '',
    target_audience: '',
    market: '',
    revenue_model: '',
    constraints: '',
  });

  /* Job state */
  const [phase, setPhase] = useState<Phase>('form');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationJob | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  /* Live agent state — driven by SSE */
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [activityLog, setActivityLog] = useState<AgentEvent[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  /* Clarify state */
  const [questions, setQuestions] = useState<{question: string, options: string[]}[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isClarifying, setIsClarifying] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const router = useRouter();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulations need an account: every run is saved to the user's history.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login?next=/simulate');
        return;
      }
      setSessionChecked(true);
    });
  }, [router]);

  /* Keep the newest event in view inside the feed (not the page) */
  useEffect(() => {
    const feed = logEndRef.current?.parentElement;
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
  }, [activityLog]);

  /* Elapsed time while the agents work */
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  /* ─── SSE event handler ─────────────────────────── */
  const handleAgentEvent = useCallback((event: AgentEvent) => {
    setActivityLog((prev) => [...prev, event]);

    switch (event.type) {
      case 'agent_start':
        setActiveAgent(event.agent || null);
        if (event.round && event.round > currentRound) {
          setCurrentRound(event.round);
        }
        break;

      case 'agent_done':
        setCompletedAgents((prev) =>
          prev.includes(event.agent || '') ? prev : [...prev, event.agent || '']
        );
        setActiveAgent(null);
        break;

      case 'supervisor_result':
        setCompletedAgents((prev) =>
          prev.includes('Critic') ? prev : [...prev, 'Critic']
        );
        setActiveAgent(null);
        break;

      case 'debate_loop':
        // Revision pass: the agents being re-run (plus the Critic) are no longer complete
        setCompletedAgents((prev) =>
          prev.filter((a) => ![...(event.agents || []), 'Critic'].includes(a))
        );
        if (event.round) setCurrentRound(event.round);
        break;

      case 'job_done':
        // SSE is done — polling will pick up the final result
        break;

      case 'job_error':
        setErrorMsg(event.error || 'Simulation failed');
        setPhase('error');
        break;
    }
  }, [currentRound]);

  /* ─── Polling (fallback + final result fetch) ──── */
  const poll = useCallback(async (id: string) => {
    try {
      const job = await getSimulationStatus(id);

      if (job.status === 'done') {
        setResult(job);
        setPhase('done');
        return true;
      }
      if (job.status === 'error') {
        setErrorMsg(job.error || 'Simulation failed');
        setPhase('error');
        return true;
      }
      return false;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection lost');
      setPhase('error');
      return true;
    }
  }, []);

  /* ─── SSE + Polling lifecycle ───────────────────── */
  useEffect(() => {
    if (phase !== 'running' || !jobId) return;

    // Start SSE stream
    const cleanup = streamSimulation(
      jobId,
      handleAgentEvent,
      () => {
        // SSE error — we still have polling as fallback
        console.warn('SSE connection lost, relying on polling fallback');
      }
    );
    cleanupRef.current = cleanup;

    // Poll every 3s as fallback (in case SSE drops)
    const pollTimer = setInterval(async () => {
      const done = await poll(jobId);
      if (done) {
        clearInterval(pollTimer);
        cleanup();
      }
    }, 3000);

    return () => {
      clearInterval(pollTimer);
      cleanup();
      cleanupRef.current = null;
    };
  }, [phase, jobId, poll, handleAgentEvent]);

  /* ─── Submit ─────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.idea.trim()) return;

    setIsClarifying(true);
    setErrorMsg('');

    try {
      const { clarifyIdea } = await import('@/lib/api');
      const res = await clarifyIdea(form.idea, "pro"); // Use Pro tier for development
      setQuestions(res.questions);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setPhase('clarify');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to clarify idea');
      setPhase('error');
    } finally {
      setIsClarifying(false);
    }
  };

  const handleAnswerSelect = async (option: string) => {
    const newAnswers = { ...answers, [currentQuestionIndex]: option };
    setAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Start Simulation
      const qaString = questions.map((q, i) => `${q.question} ${newAnswers[i]}`).join('. ');
      const { market, markers } = profileFromAnswers(questions.map((q, i) => [q.question, newAnswers[i] ?? '']));

      const finalForm = {
        ...form,
        market: market || form.market,
        constraints: [markers, form.constraints, `Context: ${qaString}`].filter(Boolean).join('. '),
        tier: "pro" as any
      };

      setPhase('running');
      setActiveAgent(null);
      setCompletedAgents([]);
      setActivityLog([]);
      setCurrentRound(1);
      setElapsed(0);
      setErrorMsg('');

      try {
        const job = await startSimulation(finalForm);
        setJobId(job.job_id);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to start simulation');
        setPhase('error');
      }
    }
  };

  const handleReset = () => {
    if (cleanupRef.current) cleanupRef.current();
    setPhase('form');
    setJobId(null);
    setResult(null);
    setErrorMsg('');
    setActiveAgent(null);
    setCompletedAgents([]);
    setActivityLog([]);
    setCurrentRound(1);
    setForm({ idea: '', target_audience: '', market: '', revenue_model: '', constraints: '' });
  };


  /* ─── Helper: get agent status ──────────────────── */
  const getAgentStatus = (agentKey: string) => {
    if (activeAgent === agentKey) return 'active';
    if (completedAgents.includes(agentKey)) return 'completed';
    return 'waiting';
  };

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const doneCount = AGENTS.filter((a) => completedAgents.includes(a.key)).length;

  /* ─── Render ─────────────────────────────────────── */
  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-2 border-surface-container-highest border-t-primary" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto w-full max-w-[56rem] px-6 pb-24 pt-14">
        {/* Page header */}
        <div key={phase} className="mb-10 flex flex-col gap-3 text-center">
          <span className="eyebrow enter mx-auto">
            {phase === 'form' && 'New plan'}
            {phase === 'clarify' && 'Quick questions'}
            {phase === 'running' && `Round ${currentRound} · ${mmss}`}
            {phase === 'done' && 'Done'}
            {phase === 'error' && 'Something broke'}
          </span>
          <h1 className="display enter m-0 text-[clamp(2.75rem,6vw,4.75rem)]" style={{ '--i': 1 } as CSSProperties}>
            {phase === 'form' && <>What are you <em>building?</em></>}
            {phase === 'clarify' && <>A few things <em>first</em></>}
            {phase === 'running' && <>The agents are <em>on it</em></>}
            {phase === 'done' && <>Your plan is <em>ready</em></>}
            {phase === 'error' && <>That didn&apos;t <em>work</em></>}
          </h1>
          <p className="enter mx-auto m-0 max-w-[38rem] text-lg leading-relaxed muted" style={{ '--i': 2 } as CSSProperties}>
            {phase === 'form' && "One or two sentences is enough. Say who it's for, which city or campus, and how much you can put in."}
            {phase === 'clarify' && 'Your answers go to every agent, so the plan fits your budget and market.'}
            {phase === 'running' && 'Four agents write the plan, then the Critic sends problems back. This usually takes a few minutes.'}
            {phase === 'done' && "It's saved to your dashboard. Tick off steps as you go, or ask the agents follow-up questions there."}
            {phase === 'error' && 'Nothing was saved. Read the message below, then try again.'}
          </p>
        </div>

        {/* ═══ FORM ═══ */}
        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="enter flex flex-col gap-4" style={{ '--i': 3 } as CSSProperties}>
            <div className="card p-2 transition-shadow duration-200 focus-within:shadow-[8px_8px_0_#E0177A]">
              <label htmlFor="startup-idea" className="sr-only">Your startup idea</label>
              <textarea
                id="startup-idea"
                value={form.idea}
                onChange={(e) => setForm({ ...form, idea: e.target.value })}
                placeholder="e.g. A tiffin service for hostel students in Bidholi, starting with ₹8,000 of savings"
                required
                rows={4}
                className="field resize-none border-0 bg-transparent text-xl font-medium leading-relaxed shadow-none focus:transform-none focus:shadow-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-2">
                <span className="font-mono text-sm tabular-nums text-on-surface-variant">{form.idea.length} characters</span>
                <button type="submit" disabled={isClarifying || !form.idea.trim()} className="btn btn-primary">
                  {isClarifying ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Reading your idea…
                    </>
                  ) : (
                    <>Continue <span className="arrow">→</span></>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">Try one:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setForm({ ...form, idea: ex })}
                  className="cursor-pointer rounded-full border-2 border-ink bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-[background-color,transform] duration-200 hover:bg-marigold active:scale-95"
                >
                  {ex}
                </button>
              ))}
            </div>

            <BharatCodeKeyField />

            <ol className="m-0 mt-4 grid list-none gap-3 p-0 text-sm sm:grid-cols-3">
              {['Describe the idea', 'Answer a few quick questions', 'Watch the agents work'].map((t, i) => (
                <li key={t} className="flex items-center gap-2.5 font-semibold">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-extrabold ${i === 0 ? 'bg-rani text-white' : 'bg-surface'}`}>{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </form>
        )}

        {/* ═══ CLARIFY ═══ */}
        {phase === 'clarify' && questions.length > 0 && (
          <div className="card mx-auto max-w-[44rem] p-6 md:p-10">
            <div className="mb-8 flex gap-1.5">
              {questions.map((_, i) => (
                <span key={i} className={`h-3 flex-1 rounded-full border-2 border-ink transition-colors duration-500 ${i <= currentQuestionIndex ? 'bg-rani' : 'bg-surface'}`} />
              ))}
            </div>
            <div key={currentQuestionIndex} className="enter">
              <div className="mb-3 font-mono text-sm muted">
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>
              <h2 className="display m-0 mb-8 text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1]">
                {questions[currentQuestionIndex].question}
              </h2>
              <div className="flex flex-col gap-2.5">
                {questions[currentQuestionIndex].options.map((option, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAnswerSelect(option)}
                    className={`enter group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-[3px] border-ink px-5 py-4 text-left font-semibold shadow-[4px_4px_0_#161616] transition-[background-color,transform,box-shadow] duration-150 ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#161616] active:translate-x-1 active:translate-y-1 active:shadow-none ${answers[currentQuestionIndex] === option ? 'bg-marigold' : 'bg-surface hover:bg-surface-container-low'}`}
                    style={{ '--i': i + 1 } as CSSProperties}
                  >
                    <span className="text-[1.0625rem] leading-snug">{option}</span>
                    <span aria-hidden className="text-primary-fixed-dim opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-1 group-hover:opacity-100">→</span>
                  </button>
                ))}
              </div>
              {currentQuestionIndex > 0 && (
                <button type="button" onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)} className="mt-6 cursor-pointer text-sm font-bold muted transition-colors hover:text-ink">
                  ← Previous question
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══ RUNNING ═══ */}
        {phase === 'running' && (
          <div className="flex flex-col gap-4">
            <div className="card p-5 md:p-8">
              <div className="relative grid grid-cols-3 gap-y-6 md:grid-cols-6">
                <div aria-hidden className="absolute left-[8.33%] right-[8.33%] top-[1.65rem] hidden h-[3px] bg-ink/15 md:block" />
                <div
                  aria-hidden
                  className="absolute left-[8.33%] top-[1.65rem] hidden h-[3px] bg-rani transition-[width] duration-700 [transition-timing-function:var(--ease-spring)] md:block"
                  style={{ width: `${(Math.max(0, doneCount - 1) / (AGENTS.length - 1)) * 83.34}%` }}
                />
                {AGENTS.map((agent) => {
                  const status = getAgentStatus(agent.key);
                  const critic = agent.key === 'Critic';
                  return (
                    <div key={agent.key} className="relative flex flex-col items-center gap-2">
                      <span
                        className={`relative grid size-14 place-items-center rounded-full border-[3px] border-ink transition-all duration-500 [transition-timing-function:var(--ease-bounce)] ${
                          status === 'active'
                            ? `${critic ? 'bg-ink text-marigold' : 'bg-rani text-white'} scale-110 [animation:pulse-ring_1.4s_ease-out_infinite]`
                            : status === 'completed'
                              ? 'bg-marigold text-ink'
                              : 'bg-surface text-on-surface-variant'
                        }`}
                      >
                        <Icon name={agent.icon} className="text-[1.5rem]" />
                        {status === 'completed' && (
                          <span className="enter absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full border-2 border-ink bg-rani text-[0.7rem] text-white">✓</span>
                        )}
                      </span>
                      <span className={`text-sm font-bold ${status === 'waiting' ? 'text-on-surface-variant' : 'text-ink'}`}>{agent.key}</span>
                      <span className="h-4 text-xs font-bold text-primary-fixed-dim">{status === 'active' && 'working…'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b-[3px] border-ink bg-marigold px-5 py-3 md:px-6">
                <span className="font-display text-lg uppercase tracking-[0.03em]">What the agents are doing</span>
                <span className="flex items-center gap-2 font-mono text-sm font-medium">
                  <span className="size-2.5 animate-pulse rounded-full border-2 border-ink bg-rani" />
                  Live · {mmss}
                </span>
              </div>
              <div className="flex max-h-[28rem] min-h-[12rem] flex-col gap-1 overflow-y-auto px-5 py-4 md:px-6" aria-live="polite">
                {activityLog.length === 0 && (
                  <div className="m-auto flex flex-col items-center gap-3 py-8 text-sm muted">
                    <span className="size-6 animate-spin rounded-full border-2 border-surface-container-highest border-t-primary" />
                    Starting the Strategist…
                  </div>
                )}
                {activityLog.map((event, i) => (
                  <ActivityLogEntry key={i} event={event} />
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ ERROR ═══ */}
        {phase === 'error' && (
          <div className="card mx-auto flex max-w-[40rem] flex-col items-center gap-5 p-8 text-center shadow-[6px_6px_0_#B3122E]">
            <span className="grid size-14 place-items-center rounded-full border-[3px] border-ink bg-error-container text-error">
              <Icon name="error" className="text-[1.75rem]" />
            </span>
            <p className="m-0 text-[1.0625rem] leading-relaxed">{errorMsg}</p>
            {/quota|bharatcode api key/i.test(errorMsg) ? (
              <div className="w-full">
                <BharatCodeKeyField defaultOpen />
              </div>
            ) : (
              <p className="m-0 text-sm muted">If it keeps happening, wait a minute and try again.</p>
            )}
            <button onClick={handleReset} className="btn btn-primary">Try again</button>
          </div>
        )}

        {/* ═══ DONE ═══ */}
        {phase === 'done' && result?.result && (
          <div className="enter flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-2 text-sm">
                <span className="rounded-full border-2 border-ink bg-surface px-3 py-1.5 font-semibold">
                  {result.result.debate_rounds} review {result.result.debate_rounds === 1 ? 'round' : 'rounds'}
                </span>
                <span className="truncate rounded-full border-2 border-ink bg-surface px-3 py-1.5 muted">&quot;{form.idea.length > 60 ? `${form.idea.slice(0, 60)}…` : form.idea}&quot;</span>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard" className="btn btn-ghost btn-sm">All plans</Link>
                <button onClick={handleReset} className="btn btn-primary btn-sm">New plan</button>
              </div>
            </div>
            <PlanView plan={result.result.business_plan} report={result.result.final_report} />
          </div>
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Activity feed entry: one SSE event
   ═══════════════════════════════════════════════════════ */

function ActivityLogEntry({ event }: { event: AgentEvent }) {
  const agent = AGENTS.find((a) => a.key === event.agent);
  const text = (c: unknown) => {
    const o = c as { title?: string; description?: string };
    return typeof c === 'string' ? c : o.title ? `${o.title}: ${o.description}` : JSON.stringify(c);
  };

  switch (event.type) {
    case 'agent_start':
      return (
        <div className="enter flex items-center gap-3 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-surface text-ink">
            <Icon name={agent?.icon || 'settings'} className="text-[1.05rem]" />
          </span>
          <span className="text-sm">
            <span className="font-semibold">{event.agent}</span>{' '}
            <span className="muted">started{(event.round ?? 0) > 1 ? ` round ${event.round}` : ''}</span>
          </span>
        </div>
      );

    case 'agent_done':
      return (
        <div className="enter flex gap-3 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-marigold text-ink">
            <Icon name={agent?.icon || 'check'} className="text-[1.05rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm"><span className="font-semibold">{event.agent}</span> <span className="text-primary-fixed-dim">done</span></div>
            {event.summary && <p className="m-0 mt-0.5 text-[0.9375rem] leading-relaxed">{event.summary}</p>}
          </div>
        </div>
      );

    case 'supervisor_result':
      return (
        <div className={`enter my-2 rounded-2xl border-[3px] border-ink px-4 py-3.5 shadow-[4px_4px_0_#161616] ${event.forced ? 'bg-tertiary-fixed' : event.agreed ? 'bg-marigold' : 'bg-primary-fixed'}`}>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Icon name="gavel" className="text-[1.05rem]" />
            {event.forced ? 'Critic: out of revisions, open issues stay in the plan' : event.agreed ? 'Critic approved the plan' : 'Critic sent problems back'}
          </div>
          {event.reason && <p className="m-0 text-[0.9375rem] leading-relaxed">{event.reason}</p>}
          {!!event.conflicts?.length && (
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-sm muted">
              {event.conflicts.map((c, i) => (
                <li key={i} className="flex gap-2"><span className="text-error">•</span><span>{text(c)}</span></li>
              ))}
            </ul>
          )}
          {!!event.decisions?.length && (
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-sm muted">
              {event.decisions.map((d, i) => (
                <li key={i} className="flex gap-2"><span className="text-primary">→</span><span>{text(d)}</span></li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'math_fixed': {
      const fmt = (v: number, unit: string) =>
        unit === 'money' ? `${event.symbol ?? '₹'}${Math.round(v).toLocaleString(event.symbol === '$' ? 'en-US' : 'en-IN')}`
          : unit === 'months' ? `${v} mo` : v.toLocaleString('en-IN');
      return (
        <div className="enter my-2 rounded-2xl border-[3px] border-ink bg-surface px-4 py-3.5 shadow-[4px_4px_0_#E0177A]">
          <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-primary-fixed-dim">
            <Icon name="calculate" className="text-[1.05rem]" />
            Code corrected {event.fixes?.length} number{event.fixes?.length === 1 ? '' : 's'} the agents got wrong
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            {event.fixes?.map((f, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                <span className="muted">{f.label}</span>
                <span className="text-on-surface-variant line-through decoration-rani decoration-2">{fmt(f.before, f.unit)}</span>
                <span aria-hidden>→</span>
                <span className="font-extrabold text-primary-fixed-dim">{fmt(f.after, f.unit)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case 'debate_loop':
      return (
        <div className="enter my-2 flex items-center gap-3 text-sm font-bold text-ink">
          <span className="h-[3px] flex-1 bg-ink" />
          <Icon name="sync" className="animate-spin text-[1rem]" />
          Round {event.round}: {event.agents?.length ? event.agents.join(', ') : 'the agents'} revise
          <span className="h-[3px] flex-1 bg-ink" />
        </div>
      );

    case 'job_done':
      return (
        <div className="enter my-2 flex items-center gap-2 rounded-2xl border-2 border-ink bg-marigold px-4 py-3 text-sm font-semibold text-ink">
          <Icon name="task_alt" className="text-[1.05rem]" /> Plan finished. Loading it…
        </div>
      );

    case 'job_error':
      return (
        <div className="enter my-2 flex items-center gap-2 rounded-2xl border-2 border-ink bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container">
          <Icon name="error" className="text-[1.05rem]" /> {event.error || 'Simulation failed'}
        </div>
      );
    default:
      return null;
  }
}
