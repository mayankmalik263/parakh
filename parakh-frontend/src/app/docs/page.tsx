import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Navigation from '@/components/landing/Navigation';
import Footer from '@/components/landing/Footer';
import Reveal from '@/components/motion/Reveal';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'Docs | Parakh',
  description: 'How Parakh works: the five agents, the math check, the revision loop, the API, and how to run it yourself.',
};

const TOC = [
  ['overview', 'What Parakh does'],
  ['run', 'How a run works'],
  ['agents', 'The agents'],
  ['math', 'The math check'],
  ['plan', "What's in your plan"],
  ['student', 'Student mode'],
  ['deck', 'Deck check'],
  ['limits', 'Limits and your own key'],
  ['api', 'API'],
  ['events', 'Live events'],
  ['self-host', 'Run it yourself'],
  ['license', 'License'],
];

const STEPS = [
  ['help', 'Clarify', "You type the idea and answer seven multiple-choice questions: five fixed ones (where your customers are, who's building it, how you'll fund it, how much you can put in, which AI you already pay for) and two a model writes about your idea."],
  ['explore', 'Strategist', 'Customer, problem, real competitors, and what to leave out.'],
  ['construction', 'Builder', 'Stack or delivery setup, MVP features, first ten steps. It picks tools; code puts in their checked prices.'],
  ['payments', 'Economics', 'Pricing, cost to serve one customer, burn, runway, break-even, Day 30/60/90 targets.'],
  ['campaign', 'Growth', 'Channels with spend and expected customers, a cold message, objection replies.'],
  ['calculate', 'Math check', 'Plain code recomputes the numbers and fixes what it can.'],
  ['gavel', 'Critic', 'Reads the whole plan and sends each problem to the agent that owns it.'],
  ['sync', 'Revise', "Only blocking problems send a section back, up to two rounds; minor ones stay in the plan as notes. Agents whose inputs didn't change are skipped."],
  ['description', 'Report', "The plan is saved to your dashboard with the Critic's verdict and any open warnings."],
];

const AGENTS = [
  { name: 'Strategist', model: 'Qwen 3.8 27B', text: 'Keeps the business you named. A social media agency stays a social media agency. Competitors must exist; for a service business they can be agencies, freelancers or an in-house hire.' },
  { name: 'Builder', model: 'Qwen 3.8 27B', text: 'Writes for the type of business: software gets a stack and tools, a service gets pilots and a contract, a physical product gets a store and fulfilment setup.' },
  { name: 'Economics', model: 'Qwen 3.8 27B', text: 'Sets the price and what delivering to one customer costs, then burn, runway and break-even from the margin.' },
  { name: 'Growth', model: 'Qwen 3.8 27B', text: 'Picks one or two channels sized to the Day 30 target, never more than 1.5× it. No invented track record in the cold message.' },
  { name: 'Critic', model: 'Qwen 3.8 27B', text: "Judges only what code can't check, because the math is already recomputed. Scores how well the plan matches what you asked and names the biggest risk. Self-hosters can give it a separate model with PARAKH_CRITIC_MODEL." },
];

const ENDPOINTS: { method: string; path: string; text: string; body?: string }[] = [
  { method: 'POST', path: '/clarify', text: 'Questions to ask before a run.', body: '{ "idea": "Handmade soy candles sold on Instagram" }' },
  { method: 'POST', path: '/simulate', text: 'Start a run. Returns a job id right away.', body: '{\n  "idea": "Handmade soy candles sold on Instagram",\n  "market": "India",\n  "constraints": "Bootstrapped. Context: ..."\n}' },
  { method: 'GET', path: '/simulate/{job_id}', text: 'Job status. When done, includes the plan, the full report and the number of review rounds.' },
  { method: 'GET', path: '/simulate/{job_id}/stream', text: 'Server-sent events while the agents work (below).' },
  { method: 'GET', path: '/simulations', text: 'Your saved plans, newest first.' },
  { method: 'GET', path: '/simulations/{id}', text: 'One saved plan.' },
  { method: 'POST', path: '/simulate/{job_id}/chat', text: 'Ask a follow-up. Start with @Economics (or another role) to get that agent.', body: '{ "messages": [{ "role": "user", "content": "@Economics what if I charge ₹999?" }] }' },
  { method: 'GET', path: '/simulations/{id}/chat', text: 'The saved follow-up chat for a plan. Send "language": "hinglish" with a chat message to get answers in Hinglish.' },
  { method: 'POST', path: '/critique', text: 'Check a pitch deck. Up to 3 slide images as data URLs and/or the numbers as text. Returns a job id. Nothing is stored.', body: '{\n  "images": ["data:image/png;base64,..."],\n  "text": "Burn ₹40,000/month, cash ₹2,00,000, runway 12 months",\n  "idea": "Shared notes for UPES students"\n}' },
  { method: 'GET', path: '/critique/{job_id}', text: 'Status of a deck check. When done: what the deck claims, the findings, the recomputed numbers and the Critic\'s review.' },
  { method: 'PATCH', path: '/simulations/{id}/share', text: 'Turn a public link for one of your plans on or off.', body: '{ "public": true }' },
  { method: 'GET', path: '/shared/{id}', text: 'A plan its owner shared. No login needed. Returns the plan and report only.' },
  { method: 'PATCH', path: '/simulations/{id}/checklist', text: 'Tick or untick a step.', body: '{ "category": "product_mvp", "item_index": 2, "completed": true }' },
];

const EVENTS = [
  ['agent_start', 'An agent starts', 'agent, round'],
  ['agent_done', 'An agent finishes', 'agent, round, summary'],
  ['supervisor_result', 'The Critic is done', 'agreed, reason, conflicts, forced'],
  ['math_fixed', 'Code corrected numbers the agents got wrong', 'round, symbol, fixes [{label, unit, before, after}]'],
  ['debate_loop', 'A revision round starts', 'round, agents, reason'],
  ['job_done', 'The plan is saved', '-'],
  ['job_error', 'The run failed', 'error'],
];

const i = (n: number) => ({ '--i': n }) as CSSProperties;

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="mx-auto grid w-full max-w-[72rem] gap-12 px-6 pb-24 pt-14 lg:grid-cols-[13rem_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24 flex flex-col gap-1 text-sm">
            <span className="eyebrow mb-3">On this page</span>
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="rounded-lg px-3 py-1.5 muted no-underline transition-colors hover:bg-surface hover:text-on-surface">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col gap-20">
          <header className="flex flex-col gap-4">
            <span className="eyebrow enter">Docs</span>
            <h1 className="display enter m-0 text-[clamp(3rem,7vw,5.5rem)]" style={i(1)}>
              How Parakh <em>works</em>
            </h1>
            <p className="enter m-0 max-w-[40rem] text-lg leading-relaxed muted" style={i(2)}>
              Five agents, one math check, and up to two rounds of revisions. Here is what each part does, what the API
              looks like, and how to run your own copy.
            </p>
          </header>

          <Section id="overview" eyebrow="Overview" title="What Parakh does">
            <P>
              You describe a business idea in a sentence. Parakh turns it into a build plan: who the customer is, what to
              build it with and what that costs, what to charge, how long the money lasts, and where the first customers
              come from.
            </P>
            <P>
              Four agents write it, each owning one part, so the price can&apos;t quietly disagree with the burn. A
              fifth agent, the Critic, reads the result and sends problems back. Plain code checks the arithmetic in
              between, because language models get sums wrong.
            </P>
          </Section>

          <Section id="run" eyebrow="Step by step" title="How a run works">
            <Reveal as="ol" className="relative m-0 flex list-none flex-col gap-2 p-0">
              <span aria-hidden className="absolute bottom-6 left-[1.6875rem] top-6 w-px bg-surface-container-highest" />
              {STEPS.map(([icon, name, text], n) => (
                <li key={name} className="relative flex gap-4 rounded-2xl p-3 transition-colors hover:bg-surface" style={i(n)}>
                  <span className={`relative grid size-8 shrink-0 place-items-center rounded-full ${name === 'Critic' ? 'border-2 border-ink bg-ink text-marigold' : 'border-2 border-ink bg-marigold text-ink'}`}>
                    <Icon name={icon} className="text-[1.05rem]" />
                  </span>
                  <div>
                    <div className="font-semibold">{name}</div>
                    <p className="m-0 mt-0.5 leading-relaxed muted">{text}</p>
                  </div>
                </li>
              ))}
            </Reveal>
            <P>
              The second revision round only runs if the first finished within 100 seconds, so a plan doesn&apos;t sit in
              a queue for five minutes. If the Critic fails, the run keeps its last verdict instead of failing.
            </P>
          </Section>

          <Section id="agents" eyebrow="The agents" title="Who writes what">
            <Reveal className="grid gap-3 md:grid-cols-2">
              {AGENTS.map((a, n) => (
                <div key={a.name} className={`card spotlight lift flex flex-col gap-2 p-6 ${a.name === 'Critic' ? 'bg-marigold' : ''}`} style={i(n)}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className={`m-0 text-lg font-semibold ${a.name === 'Critic' ? 'text-tertiary' : ''}`}>{a.name}</h3>
                    <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs muted">{a.model}</span>
                  </div>
                  <p className="m-0 leading-relaxed muted">{a.text}</p>
                </div>
              ))}
            </Reveal>
            <P>Every agent runs on BharatCode&apos;s API, including the clarifying questions.</P>
          </Section>

          <Section id="math" eyebrow="Math check" title="Numbers get recomputed in code">
            <P>
              After every round, code recalculates monthly burn, runway, break-even (from the margin: price minus the
              cost to serve one customer), MRR at each target, and cost per customer for each channel. Where the
              agent&apos;s number is off, the code replaces it.
            </P>
            <P>
              Some problems are judgement calls code can&apos;t fix on its own, like a channel promising far more
              customers than the target needs, or a price below the cost to serve. Those go to the Critic, and if they
              survive the last round they stay in your plan as warnings.
            </P>
            <P>
              Tool prices work the same way. Parakh keeps a list of tools with each plan&apos;s price, the page it was
              read from and the date it was checked. When the Builder names a tool on that list, code writes in the
              checked price and converts it to rupees or dollars. Every tool the plan recommends gets a cost line, free
              ones included. Tools that aren&apos;t on the list are marked &quot;not verified&quot; in your plan, and a tool
              you can&apos;t use where you are (CapCut is banned in India) goes back to the Builder.
            </P>
          </Section>

          <Section id="plan" eyebrow="Your plan" title="What's in your plan">
            <Reveal className="grid gap-2 sm:grid-cols-2">
              {['Mission, problem and who pays', 'Pricing tiers', 'Burn, runway, break-even', 'Day 30, 60 and 90 targets', 'MVP build checklist', 'First-customers checklist', 'Competitors and how you differ', 'Tools with checked prices', "The Critic's verdict and open issues", 'The full written report', 'A saved follow-up chat'].map((t, n) => (
                <div key={t} className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-surface px-4 py-3 font-semibold" style={i(n)}>
                  <span className="text-primary">✓</span>
                  {t}
                </div>
              ))}
            </Reveal>
            <P>
              Want to see one? The <Link href="/#example" className="text-primary-fixed-dim underline">example plan</Link> on
              the home page shows the layout. It was written by hand, and its numbers pass the same math check.
            </P>
          </Section>

          <Section id="student" eyebrow="Defaults" title="Student mode">
            <P>
              Parakh assumes you&apos;re a student in India unless you say otherwise. A blank market means India and
              rupees. A student founder gets these limits, and the math check enforces the money ones: the first version
              costs at most ₹15,000 to build, running costs stay under ₹10,000 a month before revenue, and the plan fits
              about 15 hours a week around classes. Channels start on campus: batchmates, class WhatsApp groups, fests,
              Instagram and nearby shops.
            </P>
            <P>
              Answer &quot;full time&quot; or &quot;alongside a job&quot; to the second question and the caps widen
              to ₹40,000 and ₹30,000. Pick &quot;Outside India&quot; and the plan switches to dollars. Raising from
              investors turns the caps off.
            </P>
          </Section>

          <Section id="deck" eyebrow="Deck check" title="Check a deck you already have">
            <P>
              Upload up to three slide screenshots, or paste the numbers. The model copies out only what the deck
              states; it is told not to compute or fill gaps. Then plain code recomputes burn from the line items,
              runway (cash ÷ burn), break-even (burn ÷ margin per customer), MRR (customers × price) and cost per customer
              (spend ÷ new customers), and shows each mismatch with its formula. The Critic then reviews what code
              can&apos;t check, such as a &quot;we only need 1% of the market&quot; slide.
            </P>
            <P>
              If the model on your key doesn&apos;t accept images, you&apos;ll be asked to paste the numbers instead. The
              repo has a sample slide with four planted mistakes in <Code>examples/sample-deck-slide.png</Code>.
            </P>
          </Section>

          <Section id="limits" eyebrow="Limits" title="Limits and your own key">
            <P>
              By default Parakh runs on BharatCode&apos;s API with one shared key, which has a daily token budget shared by
              everyone using the site. On busy days the shared quota can run out, and you&apos;ll see a message saying so.
            </P>
            <P>
              You can skip the wait with your own key from{' '}
              <a href="https://bharatcode.ai" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">bharatcode.ai</a>{' '}
              (eligible students get free access, subject to BharatCode&apos;s current usage limits), or switch the AI to
              OpenAI, Claude, Gemini or OpenRouter with your own API key for that provider. Pick it under
              &ldquo;Change AI or use your own key&rdquo; on the New plan page. One model runs all five agents.
            </P>
            <P>
              Your key is stored only in your browser and sent with your own requests in the <Code>X-Parakh-Provider</Code>,{' '}
              <Code>X-Parakh-Model</Code> and <Code>X-Parakh-Key</Code> headers. The server uses it for that request and never
              saves or logs it. API usage is billed by the provider, separately from a ChatGPT, Claude or Gemini chat
              subscription. Each plan shows the tokens it used and, on a paid key, a rough cost.
            </P>
          </Section>

          <Section id="api" eyebrow="API" title="Endpoints">
            <P>
              Every endpoint except the stream needs <Code>Authorization: Bearer &lt;Supabase access token&gt;</Code>. You
              only ever see your own plans; anyone else&apos;s returns 404.
            </P>
            <Reveal className="flex flex-col gap-2">
              {ENDPOINTS.map((e, n) => (
                <details key={e.method + e.path} className="group card overflow-hidden" style={i(Math.min(n, 6))}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className={`w-14 rounded-full py-1 text-center text-xs font-semibold ${e.method === 'GET' ? 'border-2 border-ink bg-primary-fixed text-on-primary-fixed' : e.method === 'POST' ? 'border-2 border-ink bg-marigold text-ink' : 'bg-surface-container-highest'}`}>{e.method}</span>
                    <code className="font-mono text-sm">{e.path}</code>
                    <span className="flex-1 text-sm muted">{e.text}</span>
                    {e.body && <span aria-hidden className="text-on-surface-variant transition-transform duration-300 group-open:rotate-45">+</span>}
                  </summary>
                  {e.body && (
                    <pre className="m-0 mx-5 mb-5 overflow-x-auto rounded-xl border-[3px] border-ink bg-ink p-4 font-mono text-[0.8125rem] leading-relaxed text-cream">{e.body}</pre>
                  )}
                </details>
              ))}
            </Reveal>
          </Section>

          <Section id="events" eyebrow="Streaming" title="Live events">
            <P>
              <Code>GET /simulate/&#123;job_id&#125;/stream</Code> sends one JSON object per event as server-sent events.
              The stream closes after <Code>job_done</Code> or <Code>job_error</Code>.
            </P>
            <div className="card overflow-x-auto p-2">
              <table className="w-full min-w-[32rem] border-collapse text-left text-[0.9375rem]">
                <thead>
                  <tr className="text-sm muted">
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map(([ev, when, fields]) => (
                    <tr key={ev} className="border-t border-surface-container-high transition-colors hover:bg-surface-container-low">
                      <td className="px-4 py-3"><Code>{ev}</Code></td>
                      <td className="px-4 py-3">{when}</td>
                      <td className="px-4 py-3 muted">{fields}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="self-host" eyebrow="Self-hosting" title="Run it yourself">
            <P>You need Python 3.10+, Node 18+, a BharatCode API key and a Supabase project.</P>
            <Pre>{`git clone https://github.com/mayankmalik263/parakh.git
cd parakh

python -m venv venv
venv\\Scripts\\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env            # BHARATCODE_API_KEY, SUPABASE_URL, SUPABASE_KEY
uvicorn api:app --reload`}</Pre>
            <Pre>{`cd parakh-frontend
npm install
# .env.local: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev`}</Pre>
            <P>
              Then open <Code>http://localhost:3000</Code>. The SQL files in the repo root create the tables; run{' '}
              <Code>supabase_auth_migration.sql</Code> and then <Code>supabase_share_migration.sql</Code> last.
            </P>
          </Section>

          <Section id="license" eyebrow="License" title="License and ownership">
            <P>
              Parakh is the original work of Mayank Malik, who designed the architecture, agent boundaries, revision
              loop, prompts, state and UI. It grew out of his earlier project, MASS. AI tools helped during development. Copyright © 2026 Mayank Malik.
            </P>
            <P>
              The code is MIT licensed: use, change and share it, as long as the copyright notice and license text stay
              in every copy and Mayank Malik is credited as the original author. Full text in the{' '}
              <Link href="/terms" className="text-primary-fixed-dim underline">Terms</Link> or the{' '}
              <a href="https://github.com/mayankmalik263/parakh/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">LICENSE file</a>.
            </P>
          </Section>
        </main>
      </div>
      <Footer />
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-5">
      <Reveal className="flex flex-col gap-2">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="display m-0 text-[clamp(2.25rem,4.5vw,3.25rem)]" style={i(1)}>{title}</h2>
      </Reveal>
      {children}
    </section>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="m-0 max-w-[44rem] text-[1.0625rem] leading-relaxed text-on-surface">{children}</p>;
const Code = ({ children }: { children: ReactNode }) => <code className="rounded-md bg-surface-container-high px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
const Pre = ({ children }: { children: ReactNode }) => (
  <pre className="m-0 overflow-x-auto rounded-2xl border-[3px] border-ink bg-ink p-5 font-mono text-[0.8125rem] leading-relaxed text-cream">{children}</pre>
);
