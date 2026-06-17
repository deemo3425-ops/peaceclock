import type { Metadata } from 'next';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'About & Funding — PeaceClock',
  description: 'Who runs PeaceClock, why, and how it is funded.',
};

/** About / Funding (M5·T0.4). Funding/governance facts are placeholders pending
 *  the project owner's disclosure (carry-over). */
export default function AboutPage() {
  return (
    <main className="prose">
      <h1>About PeaceClock</h1>
      <p>
        PeaceClock is an independent, non-partisan effort to document confirmed casualties of the war in
        Ukraine with transparent, auditable methodology. It exists to resist both undercounting and
        propaganda inflation by publishing only what evidence supports.
      </p>

      <h2>Neutrality</h2>
      <p>
        We apply the same authentication bar to every side. We exclude self-reported claims about a
        belligerent&apos;s own losses. Both sides are presented with even-handed framing and styling.
      </p>

      <h2>Who runs it</h2>
      <p>Built and maintained by New Florence Interactive, an LLC.</p>

      <h2>Funding</h2>
      <p>
        {/* TODO(owner): replace with actual funding & governance disclosure */}
        Funding and governance disclosure will be published here. PeaceClock takes no money from any
        government or party to the conflict.
      </p>

      <h2>Contact</h2>
      <p>For corrections or source submissions, contact the maintainers (details to be published).</p>
      <SiteFooter />
    </main>
  );
}
