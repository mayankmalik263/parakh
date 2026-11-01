import Link from 'next/link';
import type { CSSProperties } from 'react';
import Navigation from './Navigation';
import MonolithScene from './MonolithScene';
import DebateReplay from './DebateReplay';
import Footer from './Footer';
import Reveal from '@/components/motion/Reveal';
import PlanView, { PlanFrame } from '@/components/plan/PlanView';
import { Icon } from '@/components/ui/Icon';
import { SAMPLE_CONTEXT, SAMPLE_PLAN, SAMPLE_REPORT } from '@/lib/sampleRun';

const AGENTS = [
  { name: 'Strategist', icon: 'explore', text: 'Who the customer is, the moment the problem hurts, and two or three competitors that actually exist.' },
  { name: 'Builder', icon: 'construction', text: 'Tools with their plan names and prices, and your first ten steps. Running a service? You get pilots and a contract, not an app.' },
  { name: 'Economics', icon: 'payments', text: 'Your price, what each customer costs to serve, monthly burn, runway, and where you should be on day 30, 60 and 90.' },
  { name: 'Growth', icon: 'campaign', text: "One or two channels, a cold message you can send tonight, and replies to the two objections you'll hear first." },
];

const CHECKS = ['Monthly burn', 'Runway', 'Break-even', 'MRR', 'Cost per customer'];

const i = (n: number) => ({ '--i': n }) as CSSProperties;

function Words({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <>
      {text.split(' ').map((w, k) => (
        <span key={k} className="word" style={i(from + k)}>
          {w}&nbsp;
        </span>
      ))}
    </>
  );
}

export default function LandingPage() {
  return (
    <div className="w-full bg-black text-on-surface">
      <Navigation />
      <main className="overflow-x-hidden">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 px-6 pt-16 text-center md:pt-20">
          <span className="enter inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-sm muted" style={i(0)}>
            <span className="size-1.5 rounded-full bg-tertiary [animation:pulse-ring_1.8s_ease-out_infinite]" />
            Four agents write it. A fifth tears it apart.
          </span>
          <h1 className="display m-0 max-w-[60rem] text-[clamp(3rem,7.5vw,6.5rem)]">
            <Words text="Type one sentence. Get a build plan with" />
            <em className="word" style={i(8)}>real prices.</em>
          </h1>
          <p className="enter m-0 max-w-[38rem] text-lg leading-relaxed muted md:text-xl" style={i(5)}>
            Who to sell to, what to build it with, what to charge, and where your first ten customers come from. Then a
            Critic reads the whole thing and sends back whatever won&apos;t hold up.
          </p>
          <div className="enter mt-1 flex flex-wrap justify-center gap-3" style={i(6)}>
            <Link href="/simulate" className="btn btn-primary">
              Run my idea <span className="arrow">→</span>
            </Link>
            <Link href="#sample" className="btn btn-ghost">See a real plan</Link>
          </div>
          <p className="enter m-0 text-sm muted" style={i(7)}>Free with an account. A plan takes two or three minutes.</p>
        </section>

        <section aria-hidden="true" className="relative -mt-4 h-[clamp(28rem,58vw,48rem)]">
          <MonolithScene />
        </section>

        {/* Agents */}
        <section id="agents" className="mx-auto flex max-w-[68rem] scroll-mt-20 flex-col gap-10 px-6 py-20">
          <Reveal className="flex max-w-[42rem] flex-col gap-3">
            <span className="eyebrow">The agents</span>
            <h2 className="display m-0 text-[clamp(2.5rem,5vw,4rem)]">Who writes what</h2>
            <p className="m-0 text-lg leading-relaxed muted">
              Each agent owns one part of the plan, so the price can&apos;t quietly disagree with the burn.
            </p>
          </Reveal>
          <Reveal className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
            {AGENTS.map((a, n) => (
              <div key={a.name} className="card spotlight lift flex flex-col gap-3 p-6" style={i(n)}>
                <span className="grid size-11 place-items-center rounded-full bg-inverse-primary/25 text-primary-fixed-dim">
                  <Icon name={a.icon} className="text-[1.375rem]" />
                </span>
                <h3 className="font-display m-0 text-[2rem] font-normal leading-none">{a.name}</h3>
                <p className="serif m-0 text-[1.1875rem] muted">{a.text}</p>
              </div>
            ))}
            <div className="card spotlight lift flex flex-col gap-3 p-6 shadow-[inset_0_0_0_1px_rgba(255,184,105,0.5)]" style={i(4)}>
              <span className="grid size-11 place-items-center rounded-full bg-tertiary/15 text-tertiary">
                <Icon name="gavel" className="text-[1.375rem]" />
              </span>
              <h3 className="font-display m-0 text-[2rem] font-normal italic leading-none text-tertiary">Critic</h3>
              <p className="serif m-0 text-[1.1875rem] muted">
                Runs on a different model. Reads the finished plan, sends each problem back to whoever owns it, and names
                the one risk most likely to sink you.
              </p>
            </div>
          </Reveal>

          <Reveal className="mt-10 flex max-w-[42rem] flex-col gap-3">
            <span className="eyebrow">Replay</span>
            <h2 className="display m-0 text-[clamp(2.25rem,4.5vw,3.5rem)]">Watch a real run argue with itself</h2>
            <p className="m-0 text-lg leading-relaxed muted">
              This is what happened when someone asked for a WhatsApp reminder bot for dental clinics. Press any agent to
              see what it wrote, or drag through the timeline.
            </p>
          </Reveal>
          <Reveal self>
            <DebateReplay />
          </Reveal>
        </section>

        {/* Math */}
        <section className="mx-auto grid max-w-[68rem] grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] items-center gap-12 px-6 py-20">
          <Reveal className="flex flex-col gap-4">
            <span className="eyebrow">Math check</span>
            <h2 className="display m-0 text-[clamp(2.5rem,5vw,4rem)]">The math gets redone in code</h2>
            <p className="m-0 text-[1.0625rem] leading-relaxed muted">
              Language models are shaky at arithmetic, so they don&apos;t get the last word on it. After every round, plain
              code recalculates the numbers from the agents&apos; own inputs and corrects what&apos;s off. What it
              can&apos;t fix on its own shows up in your plan as a warning.
            </p>
            <div className="flex flex-wrap gap-2">
              {CHECKS.map((c, n) => (
                <span key={c} className="rounded-full bg-surface px-3 py-1.5 text-sm" style={i(n + 3)}>{c}</span>
              ))}
            </div>
          </Reveal>
          <Reveal self className="card p-6 md:p-8">
            <div className="mb-5 flex items-center justify-between text-sm">
              <span className="font-semibold">Facebook lead ads</span>
              <span className="muted">from the run above</span>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3 tabular-nums">
              <div className="rounded-2xl bg-surface-container-low p-4">
                <dt className="text-sm muted">Spend per month</dt>
                <dd className="m-0 mt-1 text-2xl font-semibold">₹6,000</dd>
              </div>
              <div className="rounded-2xl bg-surface-container-low p-4">
                <dt className="text-sm muted">New clinics</dt>
                <dd className="m-0 mt-1 text-2xl font-semibold">10</dd>
              </div>
            </dl>
            <div className="mt-3 rounded-2xl bg-surface-container-low p-4">
              <div className="text-sm muted">Cost per customer</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="strike relative text-2xl font-semibold text-[#8d8b8b]">₹60</span>
                <span className="pop text-[2.5rem] font-semibold leading-none text-tertiary">₹600</span>
              </div>
              <div className="mt-3 text-sm muted">The Growth agent wrote ₹60. ₹6,000 ÷ 10 is ₹600, so the plan got a warning.</div>
            </div>
          </Reveal>
        </section>

        {/* Sample plan */}
        <section id="sample" className="mx-auto flex max-w-[68rem] scroll-mt-20 flex-col gap-8 px-6 py-20">
          <Reveal className="flex max-w-[44rem] flex-col gap-3">
            <span className="eyebrow">Sample plan</span>
            <h2 className="display m-0 text-[clamp(2.5rem,5vw,4rem)]">
              This is what lands in your <em>dashboard</em>
            </h2>
            <p className="m-0 text-lg leading-relaxed muted">
              The same dental-bot run, unedited. Click through the tabs, tick off steps, open the Critic&apos;s notes. It
              didn&apos;t like this plan much, and it says why.
            </p>
          </Reveal>
          <Reveal self>
            <PlanFrame title={`mass · ${SAMPLE_CONTEXT}`}>
              <PlanView plan={SAMPLE_PLAN} report={SAMPLE_REPORT} />
            </PlanFrame>
          </Reveal>
        </section>

        {/* Private */}
        <section className="mx-auto flex max-w-[68rem] flex-col gap-8 px-6 py-20">
          <Reveal className="flex max-w-[40rem] flex-col gap-3">
            <span className="eyebrow">Yours only</span>
            <h2 className="display m-0 text-[clamp(2.5rem,5vw,4rem)]">Your plans are private</h2>
          </Reveal>
          <Reveal className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
            {[
              ['lock', 'Saved to your account', 'Every plan lands in your dashboard. Nobody else can open it.'],
              ['forum', 'Ask follow-ups', 'Chat with the agents about your plan. "@Economics what if I charge ₹999?" The chat is saved too.'],
              ['key', 'Bring your own key', 'Hit the free daily limit? Paste your own free Groq key. It stays in your browser.'],
            ].map(([icon, title, text], n) => (
              <div key={title} className="card spotlight lift flex flex-col gap-3 p-6" style={i(n)}>
                <Icon name={icon} className="text-[1.5rem] text-primary-fixed-dim" />
                <h3 className="font-display m-0 text-[1.75rem] font-normal leading-none">{title}</h3>
                <p className="serif m-0 text-[1.1875rem] muted">{text}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* CTA */}
        <section className="relative flex flex-col items-center gap-7 overflow-hidden px-6 pb-32 pt-24 text-center">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-0 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(109,59,215,0.28),transparent_65%)]" />
          <Reveal className="relative flex flex-col items-center gap-7">
            <h2 className="display m-0 max-w-[50rem] text-[clamp(2.75rem,6.5vw,5.5rem)]">
              What would the Critic say about <em>your</em> idea?
            </h2>
            <Link href="/simulate" className="btn btn-primary" style={i(1)}>
              Run my idea <span className="arrow">→</span>
            </Link>
            <p className="m-0 text-sm muted" style={i(2)}>Free with an account. Two or three minutes per plan.</p>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
