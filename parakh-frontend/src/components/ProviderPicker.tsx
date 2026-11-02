'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  PROVIDERS, parseAi, providerInfo, readAiRaw, saveAiSettings, subscribeAi,
  type AiSettings, type ProviderId,
} from '@/lib/aiProvider';

/** Which AI runs the plan. BharatCode first and selected by default; others need the visitor's own key. */
export function ProviderPicker({ defaultOpen = false }: { defaultOpen?: boolean }) {
  // Server render has no localStorage: it shows the default (BharatCode, shared quota), then the browser fills in.
  const raw = useSyncExternalStore(subscribeAi, readAiRaw, () => '');
  const saved = useMemo(() => parseAi(raw), [raw]);
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<AiSettings | null>(null);
  const [keyDraft, setKeyDraft] = useState('');

  const active = providerInfo(saved.provider);
  const activeKey = saved.keys[saved.provider];
  const activeModel = saved.models[saved.provider] || active.defaultModel;
  const missingKey = active.needsKey && !activeKey;

  const editing = draft ?? saved;
  const chosen = providerInfo(editing.provider);
  const chosenKey = editing.keys[chosen.id];
  const modelValue = editing.models[chosen.id] ?? '';
  const canSave = (!chosen.needsKey || !!chosenKey || !!keyDraft.trim()) && (chosen.defaultModel || modelValue.trim());

  const toggle = () => {
    setDraft(open ? null : saved);
    setKeyDraft('');
    setOpen(!open);
  };
  const pick = (id: ProviderId) => {
    setDraft({ ...editing, provider: id });
    setKeyDraft('');
  };
  const save = () => {
    const keys = keyDraft.trim() ? { ...editing.keys, [chosen.id]: keyDraft.trim() } : editing.keys;
    saveAiSettings({ ...editing, keys });
    setDraft(null);
    setKeyDraft('');
    setOpen(false);
  };
  const forgetKey = () => {
    const keys = { ...editing.keys };
    delete keys[chosen.id];
    const next = { ...editing, keys };
    setDraft(next);
    saveAiSettings({ ...saved, keys: { ...saved.keys, [chosen.id]: '' } });
  };

  const status = active.id === 'bharatcode'
    ? activeKey ? `BharatCode, your key ••••${activeKey.slice(-4)}` : 'BharatCode, shared free quota'
    : missingKey ? `${active.label}: add your API key` : `${active.label} · ${activeModel} · key ••••${activeKey!.slice(-4)}`;

  return (
    <div className="card p-4 text-left md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm muted">
          <span className={`size-2 rounded-full ${missingKey ? 'bg-error' : active.id === 'bharatcode' && !activeKey ? 'bg-tertiary' : 'bg-primary'}`} />
          <span><span className="font-semibold text-ink">AI:</span> {status}</span>
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="cursor-pointer text-sm font-medium text-primary-fixed-dim transition-colors hover:text-ink"
        >
          {open ? 'Close' : 'Change AI or use your own key'}
        </button>
      </div>

      {open && (
        <div className="enter mt-4 flex flex-col gap-4">
          <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
            <legend className="mb-2 text-sm font-bold">Run my plans on</legend>
            {PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer rounded-full border-2 border-ink px-3.5 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${editing.provider === p.id ? 'bg-marigold' : 'bg-surface hover:bg-surface-dim'}`}
              >
                <input type="radio" name="ai-provider" value={p.id} checked={editing.provider === p.id} onChange={() => pick(p.id)} className="sr-only" />
                {p.label}
                {p.id === 'bharatcode' && <span className="ml-1.5 text-xs font-bold uppercase tracking-wide">default</span>}
              </label>
            ))}
          </fieldset>

          <p className="m-0 text-sm leading-relaxed muted">
            {chosen.id === 'bharatcode' ? (
              <>
                BharatCode powers Parakh for the BharatCode Build League. {chosen.keyHint} With your own key from{' '}
                <a href="https://bharatcode.ai" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">bharatcode.ai</a>{' '}
                (free for eligible students, within BharatCode&apos;s limits), plans use your quota instead.
              </>
            ) : (
              <>
                {chosen.keyHint} API use is billed by {chosen.company} to your account, separately from any chat
                subscription. One model runs all five agents.
              </>
            )}{' '}
            Keys stay only in this browser and go to our server with each request; it never saves them.
          </p>

          {chosen.id !== 'bharatcode' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ai-model" className="text-sm font-bold">Model</label>
              <input
                id="ai-model"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={modelValue}
                onChange={(e) => setDraft({ ...editing, models: { ...editing.models, [chosen.id]: e.target.value } })}
                placeholder={chosen.defaultModel ? `${chosen.defaultModel} (default)` : 'Required, e.g. provider/model-name'}
                className="field py-3 font-mono text-sm"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ai-key" className="text-sm font-bold">
              {chosen.label} API key{chosen.needsKey ? '' : ' (optional)'}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="ai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder={chosenKey ? `Saved ••••${chosenKey.slice(-4)}. Paste to replace` : `Paste your ${chosen.label} API key`}
                className="field min-w-0 flex-1 py-3 font-mono text-sm"
              />
              {chosenKey && (
                <button type="button" onClick={forgetKey} className="cursor-pointer text-sm muted transition-colors hover:text-error">
                  Forget key
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={save} disabled={!canSave} className="btn btn-primary btn-sm">
              Use {chosen.label}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
