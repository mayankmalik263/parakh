'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navigation from '@/components/landing/Navigation';
import PlanView from '@/components/plan/PlanView';
import { getSimulationById, getChecklist, initializeChecklist, toggleChecklistItem, setSharing } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

const SUGGESTIONS = [
  '@Economics what happens if I double the price?',
  '@Growth which channel should I start with this week?',
  "@Builder what's the cheapest way to build this?",
  "What's the biggest risk, in one line?",
];

export default function HistoryDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Checklist State
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [hinglish, setHinglish] = useState(false);
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);

  const toggleSharing = async () => {
    setShareError('');
    try {
      const { is_public } = await setSharing(simulation.id, !simulation.is_public);
      setSimulation({ ...simulation, is_public });
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not change sharing.');
    }
  };
  const shareUrl = typeof window !== 'undefined' && simulation ? `${window.location.origin}/p/${simulation.id}` : '';
  const chatEnd = useRef<HTMLDivElement>(null);
  const [showContext, setShowContext] = useState(false);


  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const newMessages = [...chatMessages, { role: 'user', content: chatInput }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatting(true);

    try {
      const { chatWithCouncil } = await import('@/lib/api');
      const res = await chatWithCouncil(simulation.job_id, newMessages, hinglish ? 'hinglish' : 'en');
      setChatMessages([...newMessages, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setChatMessages([...newMessages, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : err}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  // Handle checklist toggle
  const handleToggleChecklist = async (category: string, index: number, completed: boolean) => {
    // Optimistic update
    setChecklistState(prev => ({ ...prev, [`${category}_${index}`]: completed }));
    
    try {
      await toggleChecklistItem(id, category, index, completed);
    } catch (err) {
      // Revert on error
      setChecklistState(prev => ({ ...prev, [`${category}_${index}`]: !completed }));
      console.error('Failed to toggle checklist item:', err);
    }
  };

  useEffect(() => {
    const box = chatEnd.current?.parentElement;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, isChatting]);

  useEffect(() => {
    if (!id) return;
    getSimulationById(id)
      .then(setSimulation)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Load the saved council chat for this simulation
  useEffect(() => {
    if (!simulation?.id) return;
    import('@/lib/api')
      .then(({ getChatHistory }) => getChatHistory(simulation.id))
      .then((history) => setChatMessages(history.map(({ role, content }) => ({ role, content }))))
      .catch((err) => console.error('Failed to load chat history:', err));
  }, [simulation?.id]);

  // Initialize and load checklist when simulation loads
  useEffect(() => {
    if (!simulation?.id) return;
    
    const loadChecklist = async () => {
      try {
        // Initialize checklist if it doesn't exist yet
        await initializeChecklist(simulation.id);
        
        // Fetch checklist items
        const items = await getChecklist(simulation.id);
        const state: Record<string, boolean> = {};
        for (const item of items) {
          state[`${item.category}_${item.item_index}`] = item.completed;
        }
        setChecklistState(state);
      } catch (err) {
        console.error('Failed to load checklist:', err);
      }
    };
    
    loadChecklist();
  }, [simulation?.id]);

  const score = typeof simulation?.alignment_score === 'number' ? Math.round(simulation.alignment_score * 100) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto w-full max-w-[64rem] px-6 pb-24 pt-10">
        <Link href="/dashboard" className="enter mb-8 inline-flex items-center gap-1.5 text-sm muted no-underline transition-colors hover:text-on-surface">
          ← All plans
        </Link>

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="shimmer h-4 w-40 rounded-full" />
            <div className="shimmer h-14 w-4/5 rounded-2xl" />
            <div className="shimmer mt-6 h-12 w-full max-w-[36rem] rounded-full" />
            <div className="shimmer h-72 w-full rounded-[1.25rem]" />
          </div>
        ) : error ? (
          <div className="card flex flex-col items-center gap-5 p-10 text-center">
            <p className="m-0 text-error">{error}</p>
            <Link href="/dashboard" className="btn btn-ghost">Back to your plans</Link>
          </div>
        ) : simulation ? (
          <div className="flex flex-col gap-10">
            <header className="flex flex-col gap-4">
              <span className="eyebrow enter">
                {new Date(simulation.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <h1 className="display enter m-0 text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02]" style={{ '--i': 1 } as CSSProperties}>
                {simulation.idea}
              </h1>
              <div className="enter flex flex-wrap items-center gap-2 text-sm" style={{ '--i': 2 } as CSSProperties}>
                {simulation.market && <span className="rounded-full border-2 border-ink bg-surface px-3 py-1 font-semibold">{simulation.market}</span>}
                {score !== null && (
                  <span className={`rounded-full px-3 py-1 font-semibold ${score >= 70 ? 'border-2 border-ink bg-primary-fixed text-on-primary-fixed' : 'border-2 border-ink bg-marigold text-ink'}`}>
                    Critic score {score}%
                  </span>
                )}
                {simulation.constraints && (
                  <button type="button" onClick={() => setShowContext(!showContext)} aria-expanded={showContext} className="cursor-pointer rounded-full px-3 py-1 font-bold underline decoration-2 underline-offset-2 transition-colors hover:text-primary-fixed-dim">
                    {showContext ? 'Hide' : 'Show'} your answers
                  </button>
                )}
              </div>
              <div className="enter flex flex-wrap items-center gap-3 text-sm" style={{ '--i': 3 } as CSSProperties}>
                <button type="button" onClick={toggleSharing} aria-pressed={!!simulation.is_public} className="btn btn-ghost btn-sm">
                  {simulation.is_public ? 'Stop sharing' : 'Share a public link'}
                </button>
                {simulation.is_public && (
                  <>
                    <code className="max-w-full truncate rounded-full border-2 border-ink bg-surface px-3 py-1.5 font-mono">{shareUrl}</code>
                    <button
                      type="button"
                      className="cursor-pointer font-bold text-primary-fixed-dim underline decoration-2 underline-offset-2"
                      onClick={() => navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true)).catch(() => {})}
                    >
                      {copied ? 'Copied' : 'Copy link'}
                    </button>
                  </>
                )}
                {!simulation.is_public && <span className="muted">Anyone with the link sees the plan, not your answers or chat.</span>}
                {shareError && <span role="alert" className="text-error">{shareError}</span>}
              </div>
              {showContext && (
                <p className="enter m-0 max-w-[48rem] whitespace-pre-wrap rounded-2xl border-[3px] border-ink bg-surface p-5 text-[0.9375rem] leading-relaxed muted">
                  {simulation.constraints.replace('. Context:', '\n')}
                </p>
              )}
            </header>

            {simulation.business_plan && (
              <PlanView
                plan={simulation.business_plan}
                report={simulation.final_report}
                checklist={checklistState}
                onToggle={handleToggleChecklist}
              />
            )}

            {/* Follow-up chat */}
            <section className="card overflow-hidden" aria-labelledby="chat-title">
              <div className="flex flex-col gap-1 border-b-[3px] border-ink bg-marigold px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="chat-title" className="display m-0 text-[2rem]">Ask the agents</h2>
                  <div role="group" aria-label="Reply language" className="flex rounded-full border-2 border-ink bg-surface p-1 text-sm">
                    {([['English', false], ['Hinglish', true]] as const).map(([label, value]) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={hinglish === value}
                        onClick={() => setHinglish(value)}
                        className={`cursor-pointer rounded-full px-3 py-1 transition-colors ${hinglish === value ? 'bg-ink font-bold text-marigold' : 'muted hover:text-on-surface'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="m-0 text-sm font-medium">Start with a role, like @Economics, to get that agent&apos;s answer. Switch to Hinglish if that&apos;s how you think. The chat is saved with this plan.</p>
              </div>
              <div className="flex max-h-[30rem] min-h-[10rem] flex-col gap-3 overflow-y-auto px-6 py-5">
                {chatMessages.length === 0 && !isChatting && (
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((q) => (
                      <button key={q} type="button" onClick={() => setChatInput(q)} className="cursor-pointer rounded-full border-2 border-ink bg-surface px-3.5 py-2 font-semibold text-left text-sm text-on-surface transition-[background-color,transform] duration-200 hover:bg-marigold active:scale-95">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`enter flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed ${msg.role === 'user' ? 'rounded-br-md border-2 border-ink bg-rani text-white' : 'rounded-bl-md border-2 border-ink bg-surface text-on-surface'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="enter flex justify-start">
                    <div className="flex gap-1.5 rounded-2xl rounded-bl-md border-2 border-ink bg-surface px-4 py-4" role="status" aria-label="The agents are typing">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="size-2 animate-bounce rounded-full bg-ink" style={{ animationDelay: `${d * 140}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              <form onSubmit={handleChatSubmit} className="flex gap-2 border-t-[3px] border-ink p-3">
                <label htmlFor="chat-input" className="sr-only">Ask the agents</label>
                <input
                  id="chat-input"
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="@Growth what if I skip ads entirely?"
                  className="field min-w-0 flex-1 rounded-full py-3"
                />
                <button type="submit" disabled={isChatting || !chatInput.trim()} className="btn btn-primary" aria-label="Send">
                  <Icon name="arrow_upward" className="text-[1.25rem]" />
                </button>
              </form>
            </section>
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-5 p-10 text-center">
            <Icon name="search_off" className="text-[2.5rem] text-on-surface-variant" />
            <p className="m-0 muted">That plan doesn&apos;t exist, or it isn&apos;t yours.</p>
            <Link href="/dashboard" className="btn btn-primary">Back to your plans</Link>
          </div>
        )}
      </main>
    </div>
  );
}
