import type { Metadata } from 'next';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Privacy — PeaceClock',
  description: 'PeaceClock privacy policy and analytics disclosure.',
};

/** Privacy policy + analytics disclosure (M5·T1.3). Must match the actual,
 *  no-PII analytics (M2·T5.3) and the app store privacy labels (M6). */
export default function PrivacyPage() {
  return (
    <main className="prose">
      <h1>Privacy</h1>
      <p>PeaceClock is built to respect your privacy. We collect no personal information.</p>

      <h2>Analytics</h2>
      <p>
        We record only aggregate, non-identifying interaction events — page views and which controls were
        used (date scrub, threshold change, category toggle, source open). We do <strong>not</strong> collect
        names, accounts, precise location, IP-based identity, or any cross-site identifiers, and we do not
        sell or share data.
      </p>

      <h2>Cookies</h2>
      <p>No tracking or advertising cookies are used. View state is kept in the URL, not in persistent storage.</p>

      <h2>External links</h2>
      <p>
        Source links open external sites (news outlets, social posts). Those sites have their own privacy
        practices. Graphic or identifying media is linked, never embedded.
      </p>

      <h2>Apps</h2>
      <p>The iOS, Android, and macOS apps follow this same policy; their store privacy labels reflect it.</p>
      <SiteFooter />
    </main>
  );
}
