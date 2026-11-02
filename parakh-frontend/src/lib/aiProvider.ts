// Which AI runs a visitor's plans, and their own key for it. Everything here stays in this browser:
// it goes to our server only as request headers (X-Parakh-Provider / -Model / -Key), and the server
// uses the key for that request and never saves or logs it.
//
// BharatCode is the default and comes first: it powers Parakh for the BharatCode Build League and
// works with no key on the shared quota. Every other provider needs the visitor's own API key.

export type ProviderId = 'bharatcode' | 'openai' | 'anthropic' | 'gemini' | 'openrouter';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  defaultModel: string; // must match agents/providers.py
  needsKey: boolean;
  company: string; // who bills the API use
  keyHint: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'bharatcode', company: 'BharatCode', label: 'BharatCode', defaultModel: 'qwen-3.8-27b', needsKey: false,
    keyHint: 'Optional. Without a key, plans run on the shared free quota.' },
  { id: 'openai', company: 'OpenAI', label: 'OpenAI', defaultModel: 'gpt-6-luna', needsKey: true,
    keyHint: 'An OpenAI API key (starts with sk-).' },
  { id: 'anthropic', company: 'Anthropic', label: 'Claude', defaultModel: 'claude-sonnet-5-5', needsKey: true,
    keyHint: 'An Anthropic API key (starts with sk-ant-). Parakh caches the shared part of each prompt, so later agents cost less.' },
  { id: 'gemini', company: 'Google', label: 'Gemini', defaultModel: 'gemini-2.5-flash', needsKey: true,
    keyHint: 'A Gemini API key from Google AI Studio.' },
  { id: 'openrouter', company: 'OpenRouter', label: 'OpenRouter', defaultModel: '', needsKey: true,
    keyHint: 'An OpenRouter key. Type the model too, for example a model id from openrouter.ai/models.' },
];

export function providerInfo(id: string): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export interface AiSettings {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
}

const STORAGE_KEY = 'parakh_ai';
const OLD_BHARATCODE_KEY = 'parakh_bharatcode_key';
const CHANGE_EVENT = 'parakh-ai-change';
const DEFAULTS: AiSettings = { provider: 'bharatcode', keys: {}, models: {} };

/** The raw stored string. useSyncExternalStore needs a snapshot that compares equal between reads. */
export function readAiRaw(): string {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Carry over a BharatCode key saved by the earlier "use your own BharatCode key" field.
      const old = localStorage.getItem(OLD_BHARATCODE_KEY);
      if (old) {
        raw = JSON.stringify({ ...DEFAULTS, keys: { bharatcode: old } });
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(OLD_BHARATCODE_KEY);
      }
    }
    return raw || '';
  } catch {
    return '';
  }
}

export function parseAi(raw: string): AiSettings {
  if (!raw) return DEFAULTS;
  try {
    const v = JSON.parse(raw);
    return {
      provider: PROVIDERS.some((p) => p.id === v.provider) ? v.provider : 'bharatcode',
      keys: v.keys && typeof v.keys === 'object' ? v.keys : {},
      models: v.models && typeof v.models === 'object' ? v.models : {},
    };
  } catch {
    return DEFAULTS;
  }
}

export function getAiSettings(): AiSettings {
  return parseAi(readAiRaw());
}

export function saveAiSettings(next: AiSettings) {
  const clean: AiSettings = {
    provider: next.provider,
    keys: Object.fromEntries(Object.entries(next.keys).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()])),
    models: Object.fromEntries(Object.entries(next.models).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()])),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Private mode or blocked storage: BharatCode's shared quota still works.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: fires on changes in this tab and in other tabs. */
export function subscribeAi(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Request headers for the chosen provider. BharatCode with no key sends nothing extra. */
export function aiHeaders(): Record<string, string> {
  const s = getAiSettings();
  const key = s.keys[s.provider];
  const model = s.models[s.provider];
  if (s.provider === 'bharatcode' && !key && !model) return {};
  return {
    'X-Parakh-Provider': s.provider,
    ...(model ? { 'X-Parakh-Model': model } : {}),
    ...(key ? { 'X-Parakh-Key': key } : {}),
  };
}
