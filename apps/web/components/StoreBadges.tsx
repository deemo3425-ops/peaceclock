/**
 * App-store badges (M5·WS1·T1.1). Links go live after M6 store listings; until
 * then they render a "coming soon" state. Env-driven so launch flips them on
 * without a code change (PRD §5.3).
 */

const LINKS = {
  apple: process.env.NEXT_PUBLIC_APP_STORE_URL,
  google: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
  mac: process.env.NEXT_PUBLIC_MAC_STORE_URL,
};

const STORES: { key: keyof typeof LINKS; label: string }[] = [
  { key: 'apple', label: 'App Store' },
  { key: 'google', label: 'Google Play' },
  { key: 'mac', label: 'Mac App Store' },
];

export function StoreBadges() {
  const anyLive = STORES.some(({ key }) => Boolean(LINKS[key]));

  return (
    <div className="badges-wrap">
      <p className="badges__heading">Get the app</p>
      <ul className="badges" aria-label="Mobile and desktop apps">
        {STORES.map(({ key, label }) => {
          const href = LINKS[key];
          return (
            <li key={key}>
              {href ? (
                <a
                  className="badge-link"
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Download PeaceClock on ${label}`}
                >
                  {label}
                </a>
              ) : (
                <span
                  className="badge-link badge-link--soon"
                  aria-disabled="true"
                  title="Store listing coming after app launch (M6)"
                >
                  {label}
                  <span className="badge-link__soon">Coming soon</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!anyLive && (
        <p className="badges__note">iOS, Android, and macOS apps are in development — links go live at launch.</p>
      )}
    </div>
  );
}
