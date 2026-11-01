import Navigation from '@/components/landing/Navigation';
import Footer from '@/components/landing/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Parakh',
  description: 'Terms of Service for Parakh, your own AI co-founder.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="mx-auto w-full max-w-[48rem] px-6 pb-24 pt-14">
        <div className="mb-2xl">
          <div className="eyebrow enter mb-3">Legal</div>
          <h1 className="display enter m-0 mb-4 text-[clamp(3rem,7vw,4.5rem)]">
            Terms of Service
          </h1>
          <p className="m-0 text-sm muted">
            Last updated: June 19, 2026
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using Parakh, you agree to be bound by these
              Terms of Service. If you do not agree, do not use the platform. Parakh is operated by{' '}
              <strong className="text-on-surface">Mayank Malik</strong>.
            </p>
          </Section>

          <Section title="2. Service Description">
            <p>
              Parakh is an AI-powered startup simulation tool that uses multiple specialized AI agents to analyze,
              debate, and produce structured business plans based on user-submitted startup ideas. The service is
              provided <strong className="text-on-surface">&ldquo;as is&rdquo;</strong> for educational and
              exploratory purposes.
            </p>
          </Section>

          <Section title="3. No Professional Advice">
            <div className="border-l-2 border-tertiary pl-md mb-md bg-tertiary/5 py-sm">
              <p className="text-on-surface">
                <strong>Important:</strong> Parakh generates AI-produced content. The output is{' '}
                <strong>not</strong> professional financial, legal, or business advice. Do not make real business
                decisions solely based on Parakh output. Always consult qualified professionals before acting on any
                startup plan.
              </p>
            </div>
            <p>
              The AI agents are language models that simulate executive reasoning. Their output may contain
              inaccuracies, outdated information, or unrealistic projections. Use the results as a starting
              point for further research, not as a definitive plan.
            </p>
          </Section>

          <Section title="4. Intellectual Property">
            <h3 className="m-0 mt-2 text-base font-semibold text-on-surface">4.1 Platform Ownership</h3>
            <p>
              The Parakh platform — including its architecture, agent design, debate flow, state management system,
              prompt engineering, UI design, and all associated code — is the original work of{' '}
              <strong className="text-on-surface">Mayank Malik</strong>.
              Copyright © 2026 Mayank Malik. All rights reserved.
            </p>

            <h3 className="m-0 mt-2 text-base font-semibold text-on-surface">4.2 Open Source License</h3>
            <p>
              The source code is released under the <strong className="text-on-surface">MIT License</strong>.
              This means you may use, copy, modify, and distribute the code provided that:
            </p>
            <ul className="space-y-xs ml-md mb-md">
              <li className="flex items-start gap-xs">
                <span className="text-primary mt-[2px]">→</span>
                The original copyright notice and MIT license text are included in all copies or substantial
                portions of the software.
              </li>
              <li className="flex items-start gap-xs">
                <span className="text-primary mt-[2px]">→</span>
                Proper attribution to Mayank Malik as the original author is maintained.
              </li>
            </ul>
            <p>
              Failure to include the required copyright notice and license constitutes a violation of the
              MIT License terms and may be subject to legal action.
            </p>

            <h3 className="m-0 mt-2 text-base font-semibold text-on-surface">4.3 User Content</h3>
            <p>
              You retain full ownership of the startup ideas and context you submit to Parakh. We do not claim
              any rights over your input or the generated output. The simulation results belong to you.
            </p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="space-y-xs ml-md">
              <li className="flex items-start gap-xs">
                <span className="text-error mt-[2px]">•</span>
                Use Parakh to generate content that is illegal, harmful, or violates the rights of others.
              </li>
              <li className="flex items-start gap-xs">
                <span className="text-error mt-[2px]">•</span>
                Attempt to overload, disrupt, or reverse-engineer the platform&apos;s infrastructure.
              </li>
              <li className="flex items-start gap-xs">
                <span className="text-error mt-[2px]">•</span>
                Scrape, crawl, or programmatically access the platform in a way that degrades service for others.
              </li>
              <li className="flex items-start gap-xs">
                <span className="text-error mt-[2px]">•</span>
                Misrepresent Parakh output as professional advice to third parties.
              </li>
            </ul>
          </Section>

          <Section title="6. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Mayank Malik and the Parakh project shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not limited to loss
              of profits, data, or business opportunities, arising from your use of the platform or reliance on its
              output. The platform is provided without warranties of any kind, express or implied.
            </p>
          </Section>

          <Section title="7. Disclaimer of Warranties">
            <p>
              Parakh is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. We make no warranties,
              expressed or implied, regarding the accuracy, reliability, or completeness of the AI-generated content.
              We do not guarantee uninterrupted access to the service.
            </p>
          </Section>

          <Section title="8. Modifications">
            <p>
              We reserve the right to modify these Terms at any time. Changes take effect immediately upon being
              posted on this page. Your continued use of Parakh after changes constitutes acceptance of the new terms.
            </p>
          </Section>

          <Section title="9. Termination">
            <p>
              We reserve the right to restrict or terminate access to Parakh for any user who violates these terms
              or engages in behavior that could harm the platform or its users.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India. Any disputes
              arising from these Terms shall be subject to the exclusive jurisdiction of the courts in India.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For questions about these terms, contact Mayank Malik on{' '}
              <a href="https://x.com/systemslearner" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">
                𝕏 @systemslearner
              </a>{' '}
              or open an issue on{' '}
              <a href="https://github.com/mayankmalik263/parakh/issues" target="_blank" rel="noopener noreferrer" className="text-primary-fixed-dim underline">
                GitHub
              </a>.
            </p>
          </Section>

          {/* MIT License block */}
          <div className="border border-primary/30 bg-primary/5 p-lg">
            <h3 className="font-label-mono text-primary mb-md uppercase text-sm">MIT License</h3>
            <pre className="font-mono text-[11px] text-on-surface-variant leading-relaxed whitespace-pre-wrap">
{`Copyright (c) 2026 Mayank Malik

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
            </pre>
          </div>
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
