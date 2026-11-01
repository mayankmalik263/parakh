import Navigation from '@/components/landing/Navigation';
import Footer from '@/components/landing/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | MASS',
  description: 'Privacy Policy for MASS — Multi-Agent Startup Simulator. Learn how we handle your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="mx-auto w-full max-w-[48rem] px-6 pb-24 pt-14">
        <div className="mb-2xl">
          <div className="eyebrow enter mb-3">Legal</div>
          <h1 className="display enter m-0 mb-4 text-[clamp(3rem,7vw,4.5rem)]">
            Privacy Policy
          </h1>
          <p className="m-0 text-sm muted">
            Last updated: July 20, 2026
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Section title="1. Introduction">
            <p>
              MASS (&ldquo;Multi-Agent Startup Simulator&rdquo;) is an open-source project created and maintained by{' '}
              <strong className="text-on-surface">Mayank Malik</strong>. This Privacy Policy explains how we collect, use,
              and protect information when you use the MASS platform at{' '}
              <a href="https://mass-multi-agent-startup-simulator.vercel.app" className="text-primary-fixed-dim underline">
                mass-multi-agent-startup-simulator.vercel.app
              </a>.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <h3 className="m-0 mt-2 text-base font-semibold text-on-surface">2.1 Simulation Input Data</h3>
            <p>
              When you submit a simulation, we receive the startup idea and optional context fields (target audience,
              market, revenue model, constraints) you provide. This data is processed in real-time by our AI agents
              and is <strong className="text-on-surface">permanently stored</strong> on our servers in our database. This allows you to view your simulation history on the dashboard.
            </p>

            <h3 className="m-0 mt-2 text-base font-semibold text-on-surface">2.2 Analytics</h3>
            <p>
              We use <strong className="text-on-surface">Vercel Analytics</strong> to collect anonymous, aggregated usage
              data such as page views, browser type, and geographic region. This data does not include your startup
              ideas or any personally identifiable information. Vercel Analytics is privacy-friendly and does not use
              cookies for tracking.
            </p>

            <h3 className="m-0 mt-2 text-base font-semibold text-on-surface">2.3 Account Data</h3>
            <p>
              MASS requires user accounts for saving your simulation history. We collect and securely store your email address for authentication purposes when you log in.
            </p>
          </Section>

          <Section title="3. Third-Party Services">
            <p>
              Your simulation inputs are sent to AI language models via{' '}
              <a href="https://groq.com" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">
                Groq
              </a>{' '}
              for processing. We recommend reviewing Groq&apos;s Privacy Policy for details on how it handles data.
            </p>
            <p>
              If you add your own Groq API key, it is stored only in your browser&apos;s local storage and sent with
              your requests so they run on your own Groq quota. Our server uses it for that request only and never
              stores or logs it. You can remove it at any time from the simulation page.
            </p>
            <p>
              We do not sell, share, or transfer your simulation data to any other third parties beyond what is
              necessary for AI processing.
            </p>
          </Section>

          <Section title="4. Data Retention">
            <p>
              We maintain databases of user-submitted ideas and simulation results. This data is securely stored so that you can access your simulation history and generated reports from your dashboard at any time.
            </p>
          </Section>

          <Section title="5. Open Source">
            <p>
              MASS is open-source software licensed under the{' '}
              <strong className="text-on-surface">MIT License</strong>. The source code is publicly available at{' '}
              <a href="https://github.com/mayankmalik263/Mass-Multi-Agent-STARTUP-Simulator-" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">
                github.com/mayankmalik263/Mass-Multi-Agent-STARTUP-Simulator-
              </a>
              . You can inspect exactly how your data is processed by reviewing the source code.
            </p>
          </Section>

          <Section title="6. Children's Privacy">
            <p>
              MASS is not directed at children under 13. We do not knowingly collect information from children.
            </p>
          </Section>

          <Section title="7. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Changes will be reflected on this page with an
              updated &ldquo;Last updated&rdquo; date. Continued use of the platform after changes constitutes
              acceptance of the revised policy.
            </p>
          </Section>

          <Section title="8. Contact">
            <p>
              For privacy-related questions, reach out to Mayank Malik on{' '}
              <a href="https://x.com/systemslearner" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">
                𝕏 @systemslearner
              </a>{' '}
              or open an issue on the{' '}
              <a href="https://github.com/mayankmalik263/Mass-Multi-Agent-STARTUP-Simulator-/issues" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">
                GitHub repository
              </a>.
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 md:p-7">
      <h2 className="m-0 mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 leading-relaxed text-[#d4d2d2]">
        {children}
      </div>
    </div>
  );
}
