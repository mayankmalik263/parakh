'use client';

import ReactMarkdown, { type Components } from 'react-markdown';

const ROLES = ['Strategist', 'Builder', 'Economics', 'Growth', 'Critic'];
// "**@Economics**", "@Economics:", "### Economics" on the first line: shown as a role tag, not as text.
const ROLE_LINE = new RegExp(`^\\s*(?:#{1,6}\\s*)?\\**\\s*@?(${ROLES.join('|')})\\s*\\**\\s*:?\\s*\\**\\s*(?:\\n|$)`, 'i');

const components: Components = {
  p: ({ children }) => <p className="m-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h3 className="m-0 mt-1 text-lg font-extrabold text-ink">{children}</h3>,
  h2: ({ children }) => <h3 className="m-0 mt-1 text-lg font-extrabold text-ink">{children}</h3>,
  h3: ({ children }) => <h3 className="m-0 mt-1 text-base font-extrabold text-ink">{children}</h3>,
  h4: ({ children }) => <h4 className="m-0 mt-1 text-[0.9375rem] font-extrabold text-ink">{children}</h4>,
  ul: ({ children }) => <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 marker:text-rani">{children}</ul>,
  ol: ({ children }) => <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 marker:font-bold marker:text-rani">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-fixed-dim underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-surface-container-low px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>,
  pre: ({ children }) => <pre className="m-0 overflow-x-auto rounded-xl border-2 border-ink bg-surface-container-low p-3 text-sm">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="m-0 border-l-4 border-rani pl-3 italic">{children}</blockquote>,
  hr: () => <hr className="my-1 border-0 border-t-2 border-dashed border-ink/30" />,
};

/** Splits a reply into the answering role (from a first line like "**@Economics**") and the rest. */
export function splitRole(content: string): { role: string | null; body: string } {
  const match = content.match(ROLE_LINE);
  const role = match ? ROLES.find((r) => r.toLowerCase() === match[1].toLowerCase()) ?? null : null;
  return { role, body: (match ? content.slice(match[0].length) : content).trim() };
}

/** An agent's chat reply: Markdown rendered as real headings, bold and lists. */
export default function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-3 break-words">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
