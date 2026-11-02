'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navigation from '@/components/landing/Navigation';
import PlanView from '@/components/plan/PlanView';
import ChatPanel from '@/components/plan/ChatPanel';
import { getSimulationById, getChecklist, getChatHistory, initializeChecklist, toggleChecklistItem, setSharing } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

export default function HistoryDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Checklist State
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

  // Saved chat; null until loaded, so the panel mounts once with the full history.
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[] | null>(null);
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
  const [showContext, setShowContext] = useState(false);

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

  // The plan, its chat and its checklist all load at once: they only need the id from the URL.
  useEffect(() => {
    if (!id) return;
    getSimulationById(id)
      .then(setSimulation)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    getChatHistory(id)
      .then((history) => setChatHistory(history.map(({ role, content }) => ({ role, content }))))
      .catch((err) => {
        console.error('Failed to load chat history:', err);
        setChatHistory([]);
      });

    const toState = (items: { category: string; item_index: number; completed: boolean }[]) =>
      Object.fromEntries(items.map((item) => [`${item.category}_${item.item_index}`, item.completed]));
    (async () => {
      try {
        let items = await getChecklist(id);
        if (!items.length) {
          // First visit to this plan: create its checklist, then read it back.
          await initializeChecklist(id);
          items = await getChecklist(id);
        }
        setChecklistState(toState(items));
      } catch (err) {
        console.error('Failed to load checklist:', err);
      }
    })();
  }, [id]);

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
            {chatHistory ? (
              <ChatPanel jobId={simulation.job_id} initial={chatHistory} />
            ) : (
              <div className="card flex h-56 flex-col gap-3 p-6">
                <div className="shimmer h-6 w-48 rounded-full" />
                <div className="shimmer h-4 w-72 rounded-full" />
                <div className="shimmer mt-auto h-14 w-full rounded-2xl" />
              </div>
            )}
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
