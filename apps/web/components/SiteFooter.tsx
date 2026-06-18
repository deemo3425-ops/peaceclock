import { StoreBadges } from './StoreBadges';

/** Shared marketing footer (M5·WS0·T0.1): nav + store badges + neutrality note. */
export function SiteFooter() {
  return (
    <footer className="sitefooter">
      <nav className="sitefooter__nav" aria-label="Site">
        <a href="/">Home</a>
        <a href="/">Map</a>
        <a href="/methodology">Methodology</a>
        <a href="/about">About &amp; funding</a>
        <a href="/privacy">Privacy</a>
      </nav>
      <StoreBadges />
      <p className="sitefooter__note">
        PeaceClock counts only confirmed casualties — a lower bound, not a claim of the full toll.
        Independent and non-partisan. Built by New Florence Interactive, an LLC.
      </p>
    </footer>
  );
}
