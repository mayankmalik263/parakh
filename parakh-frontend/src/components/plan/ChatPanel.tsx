'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import ChatMarkdown, { splitRole } from './ChatMarkdown';
import { Icon } from '@/components/ui/Icon';

type Message = { role: string; content: string; failed?: boolean };
type Language = 'en' | 'hinglish';

const AGENTS = [
  { name: 'Strategist', mark: 'S' },
  { name: 'Builder', mark: 'B' },
  { name: 'Economics', mark: 'E' },
  { name: 'Growth', mark: 'G' },
  { name: 'Critic', mark: '★' },
];

const SUGGESTIONS = [
  '@Economics what happens if I double the price?',
  '@Growth which channel should I start with this week?',
  "@Builder what's the cheapest way to build this?",
  "What's the biggest risk, in one line?",
];

const LANG_KEY = 'parakh_chat_language';

function Avatar({ role }: { role: string }) {
  const agent = AGENTS.find((a) => a.name === role) ?? AGENTS[4];
  const critic = agent.name === 'Critic';
  return (
    <span
      aria-hidden
      className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink font-display text-sm ${critic ? 'bg-rani text-white' : 'bg-marigold text-ink'}`}
    >
      {agent.mark}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {})}
      className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold muted transition-colors hover:bg-surface-container-low hover:text-ink"
    >
      <Icon name={done ? 'check' : 'content_copy'} className="text-[1rem]" />
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * `initial` is read once; remount with a new key to load a different history.
 * Follow-up chat with the agents, laid out like a chat app: the founder's messages in soft bubbles on
 * the right, the agents' answers as plain text with a role avatar, and one composer box at the bottom.
 */
export default function ChatPanel({ jobId, initial }: { jobId: string; initial: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState('Critic'); // who the pending question went to
  // Rendered only in the browser (after the plan loads), so reading storage here is safe.
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === 'hinglish' ? 'hinglish' : 'en';
    } catch {
      return 'en';
    }
  });
  const box = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const pickLanguage = (next: Language) => {
    setLanguage(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* fine */ }
  };

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // The composer grows with what's typed, up to about eight lines.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = messages.filter((m) => !m.failed);
    const next = [...history, { role: 'user', content: question }];
    setMessages([...messages, { role: 'user', content: question }]);
    setInput('');
    setAsking(AGENTS.find((a) => new RegExp(`@${a.name}\\b`, 'i').test(question))?.name ?? 'Critic');
    setBusy(true);
    try {
      const { chatWithCouncil } = await import('@/lib/api');
      const res = await chatWithCouncil(jobId, next, language);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', failed: true, content: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const mention = (name: string) => {
    setInput((v) => (v.trim().startsWith('@') ? v.replace(/^\s*@\w+\s*/, `@${name} `) : `@${name} ${v}`));
    textarea.current?.focus();
  };

  return (
    <section className="card overflow-hidden" aria-labelledby="chat-title">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink/15 px-6 pb-4 pt-5">
        <div className="flex flex-col gap-1">
          <h2 id="chat-title" className="display m-0 text-[2rem]">Ask the agents</h2>
          <p className="m-0 text-sm muted">Answers use this plan&apos;s numbers. The chat is saved with the plan.</p>
        </div>
      </header>

      <div ref={box} className="flex max-h-[38rem] min-h-[14rem] flex-col overflow-y-auto px-4 py-6 md:px-6" aria-live="polite">
        <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-7">
          {messages.length === 0 && !busy && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="m-0 text-lg font-bold">What do you want to ask about this plan?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="cursor-pointer rounded-full border-2 border-ink bg-surface px-3.5 py-2 text-left text-sm font-semibold text-on-surface transition-[background-color,transform] duration-200 hover:bg-marigold active:scale-95"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} className="enter flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-surface-dim px-4 py-2.5 text-[0.9375rem] leading-relaxed text-ink">
                    {m.content}
                  </div>
                </div>
              );
            }
            if (m.failed) {
              return (
                <div key={i} role="alert" className="enter flex items-start gap-3 rounded-xl border-2 border-error/40 bg-error-container/40 px-4 py-3 text-sm text-error">
                  <Icon name="error" className="mt-0.5 text-[1.125rem]" />
                  <span>{m.content}</span>
                </div>
              );
            }
            const { role, body } = splitRole(m.content);
            const who = role ?? 'Critic';
            return (
              <article key={i} className="enter flex gap-3">
                <Avatar role={who} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="pt-1 text-sm font-extrabold">{who}</span>
                  <div className="text-[0.9375rem] leading-relaxed text-on-surface">
                    <ChatMarkdown content={body} />
                  </div>
                  <div className="-ml-2">
                    <CopyButton text={body} />
                  </div>
                </div>
              </article>
            );
          })}

          {busy && (
            <div className="enter flex items-center gap-3" role="status">
              <Avatar role={asking} />
              <span className="flex items-center gap-1.5 text-sm font-semibold muted">
                Thinking
                {[0, 1, 2].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-ink/60" style={{ animationDelay: `${d * 140}ms` }} />
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-t-2 border-ink/15 bg-surface-container-low px-4 pb-4 pt-4 md:px-6">
        <div className="mx-auto max-w-[46rem]">
          <div className="rounded-[1.25rem] border-2 border-ink bg-surface-container-lowest shadow-[4px_4px_0_#161616] transition-shadow focus-within:shadow-[4px_4px_0_#E0177A]">
            <label htmlFor="chat-input" className="sr-only">Ask the agents</label>
            <textarea
              id="chat-input"
              ref={textarea}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about pricing, tools, first customers…"
              className="block max-h-[200px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[0.9375rem] leading-relaxed text-ink outline-none placeholder:text-on-surface-variant"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 pb-2.5">
              <div className="flex flex-wrap items-center gap-1">
                {AGENTS.map((a) => (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => mention(a.name)}
                    className="cursor-pointer rounded-full px-2.5 py-1 text-xs font-bold muted transition-colors hover:bg-surface-dim hover:text-ink"
                  >
                    @{a.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div role="group" aria-label="Reply language" className="flex rounded-full bg-surface-dim p-0.5 text-xs font-bold">
                  {([['English', 'en'], ['Hinglish', 'hinglish']] as const).map(([label, value]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={language === value}
                      onClick={() => pickLanguage(value)}
                      className={`cursor-pointer rounded-full px-2.5 py-1 transition-colors ${language === value ? 'bg-ink text-marigold' : 'muted hover:text-ink'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="grid size-9 cursor-pointer place-items-center rounded-full bg-ink text-marigold transition-[transform,opacity] hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
                >
                  <Icon name="arrow_upward" className="text-[1.25rem]" />
                </button>
              </div>
            </div>
          </div>
          <p className="m-0 mt-2 text-center text-xs muted">Enter to send, Shift + Enter for a new line. The agents can be wrong; check numbers before you spend.</p>
        </div>
      </form>
    </section>
  );
}
