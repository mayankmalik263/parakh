import Link from 'next/link';
import type { CSSProperties } from 'react';
import Navigation from './Navigation';
import Footer from './Footer';
import Reveal from '@/components/motion/Reveal';
import PlanView, { PlanFrame } from '@/components/plan/PlanView';
import { EXAMPLE_CONTEXT, EXAMPLE_PLAN, EXAMPLE_REPORT } from '@/lib/examplePlan';

const TICKER = [
  'Notes for juniors',
  'Hostel tiffin',
  'Reels for cafes',
  'Thrift store on Insta',
  'Campus laundry pickup',
  'Candles from room 214',
  'Fest merch',
  'Cycle repair at the gate',
];

const AGENTS = [
  { letter: 'S', name: 'Strategist', text: 'Who pays, and the week it hurts. Competitors that exist, not made-up ones.' },
  { letter: 'B', name: 'Builder', text: 'Free tools first, with plan names and prices. Ten steps you can start tonight.' },
  { letter: 'E', name: 'Economics', text: 'Price, monthly costs, runway, and how many paying customers you need to break even.' },
  { letter: 'G', name: 'Growth', text: 'Your first 10 customers: class groups, fests, the shop outside the gate.' },
];

const STUDENT = [
  { big: '₹15,000', text: 'at most to build v1', r: -1.5 },
  { big: '₹10,000', text: 'a month before anyone pays', r: 1 },
  { big: '15 hrs', text: 'a week, around classes', r: -1 },
  { big: 'Campus', text: 'first customers before any ads', r: 1.5 },
];

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

export default function LandingPage() {
  return (
    <div className="w-full bg-background text-on-surface">
      <div aria-hidden className="overflow-hidden whitespace-nowrap border-b-[3px] border-ink bg-ink text-marigold">
        <div className="ticker inline-flex gap-10 py-2 font-display text-base tracking-[0.04em] uppercase">
          {[...TICKER, ...TICKER].map((t, k) => (
            <span key={k}>{t} ★</span>
          ))}
        </div>
      </div>
      <Navigation />

      <main className="overflow-x-hidden">
        {/* Hero */}
        <section className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-12 px-6 pb-20 pt-10">
          <div className="flex min-w-0 flex-[1_1_32rem] flex-col gap-6">
            <span
              className="slap sticker w-fit rounded-full border-[3px] border-ink bg-rani px-4 py-1.5 text-[0.9375rem] font-extrabold text-white"
              style={v({ '--r': '-3deg' })}
              lang="hi-Latn"
            >
              Idea hai? Test karo.
            </span>
            <h1 className="display m-0 text-[clamp(3.5rem,8.5vw,7.75rem)]">
              Test your idea <em>before campus</em> does.
            </h1>
            <p className="m-0 max-w-[34rem] text-xl font-medium leading-relaxed">
              Write it in one line. Four AI agents plan it in rupees, plain code rechecks every number, and a Critic
              tells you straight what won&apos;t hold up. Made for student founders in India.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/simulate" className="btn btn-primary min-h-14 px-7 text-lg">
                Test my idea <span className="arrow">→</span>
              </Link>
              <Link href="/critique" className="btn btn-ghost min-h-14 px-7 text-lg">
                Check my deck
              </Link>
            </div>
            <p className="m-0 text-sm font-semibold muted">
              Free account, runs on BharatCode. Hit the shared limit? Use your own key.
            </p>
          </div>

          <div aria-hidden className="relative min-h-[30rem] min-w-0 flex-[1_1_24rem]">
            <div className="spin-slow absolute right-2 top-0 size-36">
              <svg viewBox="0 0 160 160" width="100%" height="100%">
                <defs>
                  {/* Letters stand on this circle and grow outwards, so it sits well inside the rim:
                      15px capitals reach r = 66, leaving a clear gap to the rim at r = 74. */}
                  <path id="stamp-ring" d="M80,80 m-53,0 a53,53 0 1,1 106,0 a53,53 0 1,1 -106,0" />
                </defs>
                <circle cx="80" cy="80" r="76" fill="#FFB20F" stroke="#161616" strokeWidth="4" />
                <circle cx="80" cy="80" r="48" fill="none" stroke="#161616" strokeWidth="2" />
                <text style={{ fontFamily: 'var(--font-anton)' }} fontSize="15" fill="#161616">
                  <textPath href="#stamp-ring" textLength="326" lengthAdjust="spacing">CODE CHECKED ★ NO FAKE MATH ★</textPath>
                </text>
                <text x="80" y="93" textAnchor="middle" style={{ fontFamily: 'var(--font-tiro-deva)' }} fontSize="34" fill="#161616">
                  परख
                </text>
              </svg>
            </div>

            <div className="slap sticker absolute left-0 top-10 w-[17rem] rounded-2xl border-[3px] border-ink bg-surface p-5 shadow-[7px_7px_0_#161616]" style={v({ '--r': '-6deg', '--i': 1 })}>
              <div className="text-sm font-extrabold">RUNWAY</div>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-4xl line-through decoration-rani decoration-4">12 MO</span>
                <span className="font-display text-5xl text-primary-fixed-dim">3.2</span>
              </div>
              <div className="font-mono text-[0.8125rem]">₹8,000 ÷ ₹2,500 a month</div>
            </div>

            <div className="slap sticker absolute right-4 top-48 w-56 rounded-2xl border-[3px] border-ink bg-marigold p-5 shadow-[7px_7px_0_#161616]" style={v({ '--r': '5deg', '--i': 2 })}>
              <div className="text-sm font-extrabold">PRICE</div>
              <div className="font-display text-5xl leading-none">₹149 ✓</div>
              <div className="text-sm font-semibold">per subject, exam week</div>
            </div>

            <div className="slap sticker absolute bottom-0 left-12 w-80 max-w-[calc(100%-3rem)] rounded-2xl border-[3px] border-ink bg-ink p-5 text-cream shadow-[7px_7px_0_#E0177A]" style={v({ '--r': '-2deg', '--i': 3 })}>
              <div className="font-display text-lg tracking-[0.03em] text-marigold">THE CRITIC SAYS</div>
              <p className="m-0 mt-1.5 font-semibold leading-snug">
                One buyer posts the bundle in a class group and nobody else needs to pay.
              </p>
            </div>
          </div>
        </section>

        {/* Agents */}
        <section id="how" className="scroll-mt-20 border-y-[3px] border-ink bg-ink px-6 py-20 text-cream">
          <div className="mx-auto flex max-w-[78rem] flex-col gap-10">
            <h2 className="display m-0 max-w-[48rem] text-[clamp(2.75rem,6vw,5rem)] leading-[0.95]">
              Four agents. <span className="text-marigold">One Critic.</span> No sugarcoating.
            </h2>
            <Reveal className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-5">
              {AGENTS.map((a, n) => (
                <article key={a.name} className="lift flex flex-col gap-2.5 rounded-[1.25rem] border-[3px] border-cream bg-cream p-6 text-ink shadow-[6px_6px_0_#FFB20F] hover:shadow-[9px_9px_0_#FFB20F]" style={v({ '--i': n })}>
                  <span className="grid size-12 place-items-center rounded-full border-[3px] border-ink bg-marigold font-display text-[1.375rem]">{a.letter}</span>
                  <h3 className="m-0 font-display text-[1.75rem] font-normal uppercase">{a.name}</h3>
                  <p className="m-0 font-medium leading-normal">{a.text}</p>
                </article>
              ))}
              <article className="lift flex flex-col gap-2.5 rounded-[1.25rem] border-[3px] border-cream bg-rani p-6 text-white shadow-[6px_6px_0_#FFB20F] hover:shadow-[9px_9px_0_#FFB20F]" style={v({ '--i': 4 })}>
                <span aria-hidden className="grid size-12 place-items-center rounded-full border-[3px] border-cream bg-ink text-[1.375rem] text-marigold">★</span>
                <h3 className="m-0 font-display text-[1.75rem] font-normal uppercase">The Critic</h3>
                <p className="m-0 font-medium leading-normal">
                  Wrote none of the plan. Reads all of it, sends each problem back to whoever owns it, and names your
                  biggest risk.
                </p>
              </article>
            </Reveal>
          </div>
        </section>

        {/* Math check */}
        <section className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-12 px-6 py-20">
          <Reveal className="flex min-w-0 flex-[1_1_26rem] flex-col gap-4">
            <h2 className="display m-0 text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.95]">AI can&apos;t divide. Code can.</h2>
            <p className="m-0 text-lg font-medium leading-relaxed">
              After every round, plain Python redoes burn, runway, break-even, MRR and cost per customer from the
              agents&apos; own numbers. If one is off, it gets replaced while you watch the run.
            </p>
          </Reveal>
          <Reveal self className="card flex min-w-0 flex-[1_1_22rem] flex-col gap-3 p-7 shadow-[8px_8px_0_#161616]">
            <div className="font-extrabold">Growth agent · Instagram ads</div>
            <div className="font-mono text-lg">₹6,000 spend ÷ 10 customers</div>
            <div className="flex flex-wrap items-baseline gap-4">
              <span className="strike relative font-display text-[2.5rem]">₹60</span>
              <span className="pop font-display text-[4rem] leading-none text-primary-fixed-dim">₹600</span>
            </div>
            <span className="w-fit rounded-full border-2 border-ink bg-marigold px-3 py-1 text-sm font-extrabold">Fixed by code</span>
            <p className="m-0 text-sm font-medium muted">An illustration of the kind of slip the check catches.</p>
          </Reveal>
        </section>

        {/* Student mode */}
        <section className="border-y-[3px] border-ink bg-marigold px-6 py-20">
          <div className="mx-auto flex max-w-[78rem] flex-col gap-8">
            <div className="flex max-w-[46rem] flex-col gap-3">
              <h2 className="display m-0 text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.95]">Pocket-money budget. Planned like one.</h2>
              <p className="m-0 text-lg font-semibold leading-relaxed">
                Unless you say otherwise, Parakh plans for a student in India spending their own savings. Not a student,
                or selling abroad? Say so in the first questions and these limits change.
              </p>
            </div>
            <Reveal className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-5">
              {STUDENT.map((s, n) => (
                <div key={s.big} className="sticker rounded-2xl border-[3px] border-ink bg-cream p-5 shadow-[6px_6px_0_#161616]" style={v({ '--r': `${s.r}deg`, '--i': n })}>
                  <div className="font-display text-[2.75rem] uppercase leading-none">{s.big}</div>
                  <p className="m-0 mt-1 font-semibold">{s.text}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Deck check */}
        <section className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-12 px-6 py-20">
          <div
            aria-hidden
            className="sticker grid aspect-video min-w-0 flex-[1_1_26rem] grid-cols-3 gap-3 rounded-[1.25rem] border-[3px] border-ink bg-surface p-6 shadow-[8px_8px_0_#E0177A]"
            style={v({ '--r': '-1.5deg' })}
          >
            <div className="col-span-3 font-display text-[1.375rem]">SLIDE 7 · TRACTION</div>
            <div className="rounded-xl border-[3px] border-rani p-2.5"><div className="text-xs font-bold">MRR</div><div className="font-mono">₹60,000</div></div>
            <div className="rounded-xl border-2 border-ink p-2.5"><div className="text-xs font-bold">BURN</div><div className="font-mono">₹40,000</div></div>
            <div className="rounded-xl border-[3px] border-rani p-2.5"><div className="text-xs font-bold">RUNWAY</div><div className="font-mono">12 mo</div></div>
            <div className="col-span-3 self-end font-extrabold text-primary-fixed-dim">150 × ₹299 = ₹44,850. Not ₹60,000.</div>
          </div>
          <Reveal className="flex min-w-0 flex-[1_1_22rem] flex-col gap-4">
            <h2 className="display m-0 text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.95]">Pitching on Friday? Check the deck tonight.</h2>
            <p className="m-0 text-lg font-medium leading-relaxed">
              Upload up to three slides with numbers on them, or paste the numbers. Parakh redoes the math from your own
              deck and shows the formula for every figure that&apos;s off. Then the Critic goes after the claims math
              can&apos;t check, like &quot;we only need 1% of the market&quot;. Parakh doesn&apos;t store your deck.
            </p>
            <Link href="/critique" className="btn btn-ink w-fit min-h-14 px-7">
              Check my deck <span className="arrow">→</span>
            </Link>
          </Reveal>
        </section>

        {/* Example plan */}
        <section id="example" className="scroll-mt-20 border-t-[3px] border-ink bg-surface-container px-6 py-20">
          <div className="mx-auto flex max-w-[78rem] flex-col gap-8">
            <div className="flex max-w-[46rem] flex-col gap-3">
              <span className="eyebrow">Example plan</span>
              <h2 className="display m-0 text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.95]">What lands in your dashboard</h2>
              <p className="m-0 text-lg font-medium leading-relaxed">
                We wrote this one by hand so you can click around without signing up: tabs, steps you can tick off, the
                Critic&apos;s notes. Its numbers pass the same math check a real run goes through. Your own plan comes
                from the agents.
              </p>
            </div>
            <PlanFrame title={`parakh · ${EXAMPLE_CONTEXT}`}>
              <PlanView plan={EXAMPLE_PLAN} report={EXAMPLE_REPORT} />
            </PlanFrame>
          </div>
        </section>

        {/* After the plan */}
        <section className="mx-auto flex max-w-[78rem] flex-col gap-8 px-6 py-20">
          <h2 className="display m-0 max-w-[40rem] text-[clamp(2.5rem,5vw,4rem)] leading-[0.95]">After the plan</h2>
          <Reveal className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-5">
            {[
              ['Ask the agents', 'Ask follow-ups like "@Economics what if I charge ₹99?" Reply in English or Hinglish.'],
              ['Private by default', 'Plans save to your account. Share a read-only link only if you turn it on.'],
              ['Your own key', 'Shared limit used up? Paste your own BharatCode key, or switch to OpenAI, Claude, Gemini or OpenRouter. The key stays in your browser.'],
            ].map(([title, text], n) => (
              <div key={title} className="card lift flex flex-col gap-2 p-6" style={v({ '--i': n })}>
                <h3 className="m-0 font-display text-[1.75rem] font-normal uppercase">{title}</h3>
                <p className="serif m-0 text-[1.0625rem]">{text}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-6 border-t-[3px] border-ink px-6 py-20 text-center">
          <h2 className="display m-0 text-[clamp(3.25rem,8vw,7rem)] leading-[0.9]" lang="hi-Latn">Bas ek line likho.</h2>
          <p className="m-0 text-xl font-semibold">One line about your idea. A plan usually takes a few minutes.</p>
          <Link href="/simulate" className="btn btn-primary min-h-14 px-8 text-xl">
            Test my idea <span className="arrow">→</span>
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
