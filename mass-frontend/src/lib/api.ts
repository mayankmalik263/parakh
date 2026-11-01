import type { SimulateRequest, SimulationJob, AgentEvent } from '@/types/simulation';

// Strip trailing slashes: "https://x.onrender.com/" + "/clarify" would 404 on "//clarify".
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
import { supabase } from './supabase';
import { getGroqKey } from './groqKey';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const groqKey = getGroqKey();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(groqKey ? { 'X-Groq-Key': groqKey } : {})
  };
}

/**
 * POST /simulate — kicks off a background simulation job.
 * Returns { job_id, status: "pending" }.
 */
export async function startSimulation(data: SimulateRequest): Promise<SimulationJob> {
  const res = await fetch(`${API_URL}/simulate`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Simulation failed to start: ${err}`);
  }

  return res.json();
}

/**
 * POST /clarify — generates clarifying questions for an idea.
 */
export async function clarifyIdea(idea: string, tier: string = "free"): Promise<{ questions: { question: string, options: string[] }[] }> {
  const res = await fetch(`${API_URL}/clarify`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ idea, tier }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Clarification failed: ${err}`);
  }

  return res.json();
}

/**
 * GET /simulate/{job_id} — polls job status.
 * Returns { job_id, status, result?, error? }.
 */
export async function getSimulationStatus(jobId: string): Promise<SimulationJob> {
  const res = await fetch(`${API_URL}/simulate/${jobId}`, { headers: await getAuthHeaders() });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Simulation job not found');
    }
    const err = await res.text();
    throw new Error(`Failed to fetch status: ${err}`);
  }

  return res.json();
}

/**
 * GET /simulate/{job_id}/stream — opens an SSE connection for real-time events.
 * Returns a cleanup function to close the connection.
 */
export function streamSimulation(
  jobId: string,
  onEvent: (event: AgentEvent) => void,
  onError?: (error: Event) => void
): () => void {
  const url = `${API_URL}/simulate/${jobId}/stream`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const event: AgentEvent = JSON.parse(e.data);
      onEvent(event);
    } catch {
      console.warn('Failed to parse SSE event:', e.data);
    }
  };

  eventSource.onerror = (e) => {
    if (onError) onError(e);
    eventSource.close();
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

/** A message a person can act on, instead of the raw response body. */
function readableError(status: number, fallback: string) {
  if (status === 401) return 'Your login has expired. Log out and back in, then try again.';
  return `${fallback} Try again in a minute.`;
}

/**
 * GET /simulations — fetch past simulation history.
 */
export async function getSimulations(): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/simulations`, { 
    cache: 'no-store',
    headers 
  });
  if (!res.ok) throw new Error(readableError(res.status, 'Could not load your plans.'));
  return res.json();
}

/**
 * GET /simulations/{id} — fetch a specific past simulation.
 */
export async function getSimulationById(id: string): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/simulations/${id}`, { 
    cache: 'no-store',
    headers
  });
  if (!res.ok) {
    throw new Error(res.status === 404 ? "That plan doesn't exist, or it isn't yours." : readableError(res.status, 'Could not load this plan.'));
  }
  return res.json();
}

/**
 * POST /simulate/{job_id}/chat — sends a follow-up question to the council.
 */
export async function chatWithCouncil(jobId: string, messages: {role: string, content: string}[], tier: string = "pro"): Promise<{reply: string}> {
  const res = await fetch(`${API_URL}/simulate/${jobId}/chat`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ messages, tier }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Chat failed (${res.status})`);
  }

  return res.json();
}

/**
 * GET /simulations/{id}/chat — the saved council chat for one of the user's simulations, oldest first.
 */
export async function getChatHistory(simulationId: string): Promise<{role: string, content: string}[]> {
  const res = await fetch(`${API_URL}/simulations/${simulationId}/chat`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to load chat (${res.status})`);
  return res.json();
}

/**
 * POST /simulations/{id}/feedback — submits user thumbs up/down + comments.
 */
export async function submitSimulationFeedback(
  id: string,
  section: string,
  ratingImpact: number,
  comment: string
): Promise<{ status: string; lesson_extracted?: any }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/simulations/${id}/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      section,
      rating_impact: ratingImpact,
      comment
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to submit feedback: ${err}`);
  }

  return res.json();
}

/**
 * GET /evaluations — fetch historical evaluation runs.
 */
export async function getEvaluations(): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/evaluations`, {
    cache: 'no-store',
    headers
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch evaluations: ${err}`);
  }

  return res.json();
}

/**
 * POST /evaluate — trigger background evaluation job.
 */
export async function triggerEvaluation(data: {
  idea?: string;
  target_audience?: string;
  market?: string;
  revenue_model?: string;
  constraints?: string;
  runs?: number;
  simulation_id?: string;
  stress_constraints?: string[];
}): Promise<{ status: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/evaluate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to start evaluation: ${err}`);
  }

  return res.json();
}

/**
 * GET /lessons — fetch historical agent lessons.
 */
export async function getLessons(): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/lessons`, {
    cache: 'no-store',
    headers
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch lessons: ${err}`);
  }

  return res.json();
}

/**
 * POST /simulations/{id}/stress-constraints — fetch AI-generated stress test scenarios.
 */
export async function getStressConstraints(id: string): Promise<{ scenarios: { title: string; constraint_text: string }[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/simulations/${id}/stress-constraints`, {
    method: 'POST',
    headers
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to generate stress constraints: ${err}`);
  }

  return res.json();
}


// ── Checklist / Accountability API ─────────────────

export async function getChecklist(simulationId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/simulations/${simulationId}/checklist`, { headers });
  if (!res.ok) throw new Error('Failed to fetch checklist');
  return res.json();
}

export async function initializeChecklist(simulationId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/simulations/${simulationId}/checklist/initialize`, {
    method: 'POST',
    headers
  });
  if (!res.ok) throw new Error('Failed to initialize checklist');
  return res.json();
}

export async function toggleChecklistItem(
  simulationId: string,
  category: string,
  itemIndex: number,
  completed: boolean
) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/simulations/${simulationId}/checklist`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, item_index: itemIndex, completed })
  });
  if (!res.ok) throw new Error('Failed to toggle checklist item');
  return res.json();
}

export async function getChecklistProgress(simulationId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/simulations/${simulationId}/checklist/progress`, { headers });
  if (!res.ok) throw new Error('Failed to fetch checklist progress');
  return res.json();
}
