'use client';

import { useState, useSyncExternalStore } from 'react';
import { getGroqKey, setGroqKey, subscribeGroqKey } from '@/lib/groqKey';

/** Optional "use your own free Groq key" control. The key stays in this browser. */
export function GroqKeyField({ defaultOpen = false }: { defaultOpen?: boolean }) {
  // Server render has no localStorage: it shows the shared-quota state, then the browser fills in.
  const saved = useSyncExternalStore(subscribeGroqKey, getGroqKey, () => '');
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(defaultOpen);

  const save = () => {
    setGroqKey(draft);
    setDraft('');
    setOpen(false);
  };
  const remove = () => setGroqKey('');

  return (
    <div className="card p-4 text-left md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm muted">
          <span className={`size-2 rounded-full ${saved ? 'bg-primary' : 'bg-tertiary'}`} />
          {saved ? `Using your Groq key ••••${saved.slice(-4)}` : 'Using the shared free quota'}
        </span>
        <div className="flex gap-4 text-sm">
          {saved && (
            <button type="button" onClick={remove} className="cursor-pointer muted transition-colors hover:text-error">
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="cursor-pointer font-medium text-primary-fixed-dim transition-colors hover:text-white"
          >
            {saved ? 'Change key' : 'Use your own free Groq key'}
          </button>
        </div>
      </div>

      {open && (
        <div className="enter mt-4 flex flex-col gap-3">
          <p className="m-0 text-sm leading-relaxed muted">
            Get a free key at{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">
              console.groq.com/keys
            </a>{' '}
            (no card needed). Your plans then run on your own daily quota. The key is stored only in this browser and
            sent with your requests; our server never saves it.
          </p>
          <div className="flex gap-2">
            <label htmlFor="groq-key" className="sr-only">Groq API key</label>
            <input
              id="groq-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="gsk_..."
              className="field min-w-0 flex-1 py-3 font-mono text-sm"
            />
            <button type="button" onClick={save} disabled={!draft.trim()} className="btn btn-primary btn-sm">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
