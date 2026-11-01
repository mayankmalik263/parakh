'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/landing/Navigation';
import { getEvaluations, getLessons, triggerEvaluation, getSimulations, getStressConstraints } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

export default function EvaluationsDashboardPage() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [simulationsList, setSimulationsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State for triggering a suite
  const [selectedSimId, setSelectedSimId] = useState('');
  const [stressScenarios, setStressScenarios] = useState<any[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [loadingConstraints, setLoadingConstraints] = useState(false);

  const [triggering, setTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState('');

  // Expandable Audit Log State
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);


  const fetchData = async () => {
    try {
      const [evalsData, lessonsData, simsData] = await Promise.all([
        getEvaluations(),
        getLessons(),
        getSimulations()
      ]);
      setEvaluations(evalsData);
      setLessons(lessonsData);
      setSimulationsList(simsData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const router = useRouter();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
      router.push('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleSimulationChange = async (simId: string) => {
    setSelectedSimId(simId);
    setStressScenarios([]);
    setSelectedScenarios([]);
    
    if (!simId) return;
    
    setLoadingConstraints(true);
    try {
      const data = await getStressConstraints(simId);
      setStressScenarios(data.scenarios || []);
    } catch (err: any) {
      console.error('Failed to load stress constraints:', err);
    } finally {
      setLoadingConstraints(false);
    }
  };

  const handleScenarioToggle = (text: string) => {
    if (selectedScenarios.includes(text)) {
      setSelectedScenarios(selectedScenarios.filter(s => s !== text));
    } else {
      setSelectedScenarios([...selectedScenarios, text]);
    }
  };

  const handleSubmitSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSimId || triggering) return;

    setTriggering(true);
    setTriggerStatus('Initiating stress-test simulations in background...');
    try {
      await triggerEvaluation({
        simulation_id: selectedSimId,
        stress_constraints: selectedScenarios,
        runs: 2,
      });
      setTriggerStatus('Success! Stress-test evaluation job is now running in the background. Check back in a few minutes.');
      setSelectedSimId('');
      setStressScenarios([]);
      setSelectedScenarios([]);
      // Refresh list shortly after
      setTimeout(fetchData, 8000);
    } catch (err: any) {
      setTriggerStatus(`Error: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  // Helper to format scores
  const fmtScore = (score: number | undefined) => {
    if (score === undefined || score === null) return '0%';
    return `${Math.round(score * 100)}%`;
  };

  // Helper for progress bar color
  const getProgressBarColor = (score: number) => {
    if (score >= 0.85) return 'bg-primary';
    if (score >= 0.7) return 'bg-tertiary';
    return 'bg-error';
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navigation />

      <main className="pt-14 pb-2xl px-margin-mobile md:px-margin-desktop max-w-[80rem] mx-auto">
        <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md">
          <div>
            <h1 className="font-display text-[32px] md:text-[40px] font-extrabold tracking-tighter mb-xs leading-none">
              Dev Tools: Evaluation & Alignment
            </h1>
            <p className="font-body-md text-on-surface-variant max-w-[48rem]">
              Monitor Multi-Agent alignment metrics, track automated backend metrics over consecutive runs, and stress-test generated plans against custom AI risk constraints.
            </p>
          </div>
        </div>

        {error && (
          <div className="border border-error bg-error/5 p-md mb-lg font-body-sm text-error">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
          {/* Left / Middle: Evals and trigger */}
          <div className="lg:col-span-2 space-y-xl">
            {/* Trigger Suite Card */}
            <div className="border border-outline-variant bg-surface-container-lowest p-lg">
              <div className="font-display text-[20px] font-extrabold tracking-tighter text-primary mb-sm flex items-center gap-xs">
                <Icon name="science" className="text-[20px]" />
                Run Alignment Stress-Test Suite
              </div>
              <p className="font-body-sm text-on-surface-variant mb-md">
                Select a past simulation to analyze. The AI will audit its plan structure, extract specific vulnerabilities, and generate extreme shock scenarios to stress-test in parallel.
              </p>

              <form onSubmit={handleSubmitSuite} className="space-y-md">
                <div>
                  <label htmlFor="simulation-select" className="block font-label-mono text-xs text-primary mb-xs uppercase">Select Simulation to Stress-Test</label>
                  <select
                    id="simulation-select"
                    required
                    value={selectedSimId}
                    onChange={(e) => handleSimulationChange(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline focus:border-primary outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background text-on-surface font-body-sm px-md py-sm rounded transition-colors"
                  >
                    <option value="">-- Choose one of your simulations --</option>
                    {simulationsList.map((sim) => (
                      <option key={sim.id} value={sim.id}>
                        "{sim.idea}" ({new Date(sim.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                {loadingConstraints && (
                  <div className="font-label-mono text-xs text-primary animate-pulse py-sm flex items-center gap-xs">
                    <Icon name="sync" className="text-sm animate-spin" />
                    AI is auditing plan vulnerabilities and generating extreme constraints...
                  </div>
                )}

                {stressScenarios.length > 0 && (
                  <div className="space-y-sm bg-surface-container/30 border border-outline-variant/30 p-md rounded animate-fade-in">
                    <div id="stress-scenarios-label" className="block font-label-mono text-xs text-primary uppercase mb-sm">
                      Select Extreme Shock Constraints to Inject:
                    </div>
                    <div className="space-y-md" role="group" aria-labelledby="stress-scenarios-label">
                      {stressScenarios.map((sc, i) => (
                        <label htmlFor={`scenario-${i}`} key={i} className="flex items-start gap-md cursor-pointer group">
                          <input
                            id={`scenario-${i}`}
                            type="checkbox"
                            className="mt-[3px] accent-primary"
                            checked={selectedScenarios.includes(sc.constraint_text)}
                            onChange={() => handleScenarioToggle(sc.constraint_text)}
                          />
                          <div>
                            <div className="font-label-mono text-xs text-primary group-hover:underline">
                              {sc.title}
                            </div>
                            <div className="font-body-xs text-on-surface-variant leading-relaxed">
                              {sc.constraint_text}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row items-center justify-between gap-md pt-sm">
                  {triggerStatus && (
                    <div className="font-label-mono text-[11px] text-primary/90 flex-1 leading-relaxed">
                      {triggerStatus}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={triggering || !selectedSimId}
                    className="w-full md:w-auto bg-primary text-on-primary font-label-mono px-xl py-sm rounded hover:brightness-125 transition-all text-sm disabled:opacity-50"
                  >
                    {triggering ? 'Simulating Stress-Test...' : 'Launch Stress-Test Suite'}
                  </button>
                </div>
              </form>
            </div>

            {/* Runs History */}
            <div className="space-y-md">
              <div className="font-display text-[22px] font-extrabold tracking-tighter text-on-surface flex items-center gap-xs">
                <Icon name="history" className="text-[22px]" />
                Evaluation History
              </div>

              {loading ? (
                <div className="text-center py-xl">
                  <Icon name="sync" className="text-primary text-[28px] animate-spin" />
                </div>
              ) : evaluations.length === 0 ? (
                <div className="border border-outline-variant bg-surface-container-lowest p-xl text-center font-body-sm text-on-surface-variant italic">
                  No evaluations run yet. Run evaluations to see results.
                </div>
              ) : (
                <div className="space-y-md">
                  {evaluations.map((run) => (
                    <div key={run.id} className="border border-outline-variant bg-surface-container-lowest p-lg">
                      <div className="flex flex-col md:flex-row justify-between md:items-start gap-sm mb-md pb-sm border-b border-outline-variant/30">
                        <div>
                          <div className="font-label-mono text-[10px] text-primary uppercase mb-xs">idea evaluated</div>
                          <div className="font-headline-md text-base font-bold leading-tight">"{run.idea}"</div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-label-mono text-[10px] text-on-surface-variant">
                            {new Date(run.created_at).toLocaleString()}
                          </span>
                          <div className="font-label-mono text-[9px] bg-surface-container border border-outline-variant/40 px-xs py-[2px] rounded text-on-surface-variant/80 inline-block mt-xs">
                            {run.runs_count} SIMULATIONS
                          </div>
                        </div>
                      </div>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-md">
                        {/* Financial coherence */}
                        <div>
                          <div className="font-label-mono text-[10px] text-on-surface-variant mb-xs">FINANCIAL COHERENCE</div>
                          <div className="flex items-center gap-sm">
                            <span className="font-stats-lg text-primary text-lg">{fmtScore(run.avg_financial_coherence)}</span>
                            <div className="flex-1 bg-surface-container h-1 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressBarColor(run.avg_financial_coherence || 0)}`}
                                style={{ width: fmtScore(run.avg_financial_coherence) }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Constraint adherence */}
                        <div>
                          <div className="font-label-mono text-[10px] text-on-surface-variant mb-xs">CONSTRAINT ADHERENCE</div>
                          <div className="flex items-center gap-sm">
                            <span className="font-stats-lg text-primary text-lg">{fmtScore(run.avg_constraint_adherence)}</span>
                            <div className="flex-1 bg-surface-container h-1 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressBarColor(run.avg_constraint_adherence || 0)}`}
                                style={{ width: fmtScore(run.avg_constraint_adherence) }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Completeness */}
                        <div>
                          <div className="font-label-mono text-[10px] text-on-surface-variant mb-xs">COMPLETENESS</div>
                          <div className="flex items-center gap-sm">
                            <span className="font-stats-lg text-primary text-lg">{fmtScore(run.avg_completeness)}</span>
                            <div className="flex-1 bg-surface-container h-1 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressBarColor(run.avg_completeness || 0)}`}
                                style={{ width: fmtScore(run.avg_completeness) }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Consistency */}
                        <div>
                          <div className="font-label-mono text-[10px] text-on-surface-variant mb-xs">CONSISTENCY SCORE</div>
                          <div className="flex items-center gap-sm">
                            <span className="font-stats-lg text-primary text-lg">{fmtScore(run.consistency_score)}</span>
                            <div className="flex-1 bg-surface-container h-1 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getProgressBarColor(run.consistency_score || 0)}`}
                                style={{ width: fmtScore(run.consistency_score) }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Debate rounds */}
                        <div>
                          <div className="font-label-mono text-[10px] text-on-surface-variant mb-xs">DEBATE ROUNDS (AVG)</div>
                          <div className="font-stats-lg text-primary text-lg">
                            {run.avg_debate_rounds || 0} <span className="text-[10px] text-on-surface-variant">rounds</span>
                          </div>
                        </div>
                      </div>

                      {/* Expandable audit log toggle */}
                      <div className="mt-md pt-sm border-t border-outline-variant/20 flex justify-end">
                        <button
                          onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                          className="font-label-mono text-[10px] text-primary hover:underline flex items-center gap-xs"
                        >
                          <Icon name={expandedRunId === run.id ? 'expand_less' : 'expand_more'} className="text-[14px]" />
                          {expandedRunId === run.id ? 'Hide Audit Log' : 'View Detailed Audit Log'}
                        </button>
                      </div>

                      {/* Expandable Audit Log Details */}
                      {expandedRunId === run.id && (
                        <div className="mt-md p-md bg-surface-container/20 border border-outline-variant/30 rounded space-y-md animate-fade-in text-left">
                          {/* Constraint adherence justification */}
                          <div>
                            <div className="font-label-mono text-[10px] text-primary uppercase mb-xs flex items-center gap-xs">
                              <Icon name="gavel" className="text-[12px]" />
                              LLM Judge Constraint Justification
                            </div>
                            <p className="font-body-xs text-on-surface leading-relaxed italic bg-surface-container/50 p-sm border-l-2 border-primary/50">
                              "{run.detailed_metrics?.adherence_justification || 'No justification logged.'}"
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-md pt-sm">
                            {/* Financial math violations */}
                            <div>
                              <div className="font-label-mono text-[10px] text-primary uppercase mb-xs flex items-center gap-xs">
                                <Icon name="account_balance" className="text-[12px]" />
                                Financial Math Audits
                              </div>
                              {run.detailed_metrics?.financial_violations && run.detailed_metrics.financial_violations.length > 0 ? (
                                <ul className="space-y-1">
                                  {run.detailed_metrics.financial_violations.map((v: string, idx: number) => (
                                    <li key={idx} className="font-body-xs text-error flex items-start gap-xs leading-tight">
                                      <span className="text-error mt-[2px]">•</span> {v}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="font-body-xs text-primary/95 flex items-center gap-xs">
                                  <Icon name="done" className="text-xs text-primary" /> All financial calculations aligned.
                                </div>
                              )}
                            </div>

                            {/* Completeness checking */}
                            <div>
                              <div className="font-label-mono text-[10px] text-primary uppercase mb-xs flex items-center gap-xs">
                                <Icon name="checklist" className="text-[12px]" />
                                Completeness & Placeholder Check
                              </div>
                              {run.detailed_metrics?.completeness_issues && run.detailed_metrics.completeness_issues.length > 0 ? (
                                <ul className="space-y-1">
                                  {run.detailed_metrics.completeness_issues.map((i: string, idx: number) => (
                                    <li key={idx} className="font-body-xs text-error flex items-start gap-xs leading-tight">
                                      <span className="text-error mt-[2px]">•</span> {i}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="font-body-xs text-primary/95 flex items-center gap-xs">
                                  <Icon name="done" className="text-xs text-primary" /> All sections generated successfully.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Learned Memory Base */}
          <div className="space-y-md">
            <div className="font-display text-[22px] font-extrabold tracking-tighter text-on-surface flex items-center gap-xs">
              <Icon name="memory" className="text-[22px] text-primary" />
              Agent Memory Base
            </div>
            <p className="font-body-xs text-on-surface-variant mb-md leading-relaxed">
              Rules dynamically generated and stored by backend auto-evaluations and user rating critiques. These are automatically injected into subsequent simulations.
            </p>

            {loading ? (
              <div className="text-center py-xl">
                <Icon name="sync" className="text-primary text-[28px] animate-spin" />
              </div>
            ) : lessons.length === 0 ? (
              <div className="border border-outline-variant bg-surface-container-lowest p-lg text-center font-body-sm text-on-surface-variant italic">
                No rules learned yet. Rules will automatically populate as evaluations run in the background.
              </div>
            ) : (
              <div className="space-y-md">
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`border p-md relative transition-all ${
                      lesson.rating_impact < 0
                        ? 'border-error/30 bg-error/5'
                        : 'border-primary/30 bg-primary/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-sm">
                      <span className={`font-label-mono text-[9px] px-sm py-[2px] rounded uppercase ${
                        lesson.rating_impact < 0
                          ? 'bg-error/10 text-error border border-error/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}>
                        {lesson.rating_impact < 0 ? 'CRITIQUE RULE' : 'REINFORCEMENT'}
                      </span>
                      <span className="font-label-mono text-[8px] text-on-surface-variant opacity-60">
                        TAG: {lesson.tag.toUpperCase()}
                      </span>
                    </div>

                    <p className="font-body-sm text-on-surface leading-relaxed mb-sm">"{lesson.lesson}"</p>

                    <div className="flex justify-between items-center text-[9px] font-label-mono text-on-surface-variant/70 border-t border-outline-variant/20 pt-sm mt-sm">
                      <span>SOURCE: {lesson.source.replace('_', ' ').toUpperCase()}</span>
                      <span>CAT: {lesson.category.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
