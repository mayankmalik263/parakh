'use client';

import { useState, useSyncExternalStore } from 'react';
import { getBharatCodeKey, setBharatCodeKey, subscribeBharatCodeKey } from '@/lib/bharatcodeKey';

/** Optional "use your own BharatCode key" control. The key stays in this browser. */
export function BharatCodeKeyField({ defaultOpen = false }: { defaultOpen?: boolean }) {
  // Server render has no localStorage: it shows the shared-quota state, then the browser fills in.
  const saved = useSyncExternalStore(subscribeBharatCodeKey, getBharatCodeKey, () => '');
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(defaultOpen);

  const save = () => {
    setBharatCodeKey(draft);
    setDraft('');
    setOpen(false);
  };
  const remove = () => setBharatCodeKey('');

  return (
    <div className="card p-4 text-left md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm muted">
          <span className={`size-2 rounded-full ${saved ? 'bg-primary' : 'bg-tertiary'}`} />
          {saved ? `Using your BharatCode key ••••${saved.slice(-4)}` : 'Using the shared free quota'}
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
            className="cursor-pointer font-medium text-primary-fixed-dim transition-colors hover:text-ink"
          >
            {saved ? 'Change key' : 'Use your own BharatCode key'}
          </button>
        </div>
      </div>

      {open && (
        <div className="enter mt-4 flex flex-col gap-3">
          <p className="m-0 text-sm leading-relaxed muted">
            Get a key at{' '}
            <a href="https://bharatcode.ai" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">
              bharatcode.ai
            </a>{' '}
            (eligible students get free access, subject to BharatCode&apos;s current usage limits). Your plans then run on your own quota. The key is stored only in this browser and
            sent with your requests; our server never saves it.
          </p>
          <div className="flex gap-2">
            <label htmlFor="bharatcode-key" className="sr-only">BharatCode API key</label>
            <input
              id="bharatcode-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Paste your BharatCode API key"
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
