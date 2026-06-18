# Store privacy labels — working notes (M6·T5.3)

**Canonical policy:** https://peaceclock.org/privacy  
**Must stay consistent across:** Apple App Privacy (nutrition labels), Google Play Data Safety, and the website.

PeaceClock collects **no accounts, no PII, no precise location, and no cross-app tracking**.

---

## Apple App Privacy (App Store Connect)

| Question | Answer |
|----------|--------|
| Do you or your third-party partners collect data from this app? | **Yes** — limited analytics only |
| Is data used to track users? | **No** |
| Is data linked to the user's identity? | **No** |

### Data types to declare

| Category | Collected | Linked to user | Used for tracking | Purpose |
|----------|-----------|----------------|-------------------|---------|
| Product interaction (e.g. feature usage) | Yes | No | No | Analytics |
| Identifiers | No | — | — | — |
| Location | No | — | — | — |
| Contact info | No | — | — | — |
| User content | No | — | — | — |
| Browsing history | No | — | — | — |
| Diagnostics (crash data) | Optional — declare if crash reporting is enabled in a later build | No | No | App functionality |

### Privacy Manifest (`app.config.ts`)

Placeholders are wired in `ios.privacyManifests`. Before submit:

1. Reconcile `NSPrivacyCollectedDataTypes` with the table above.
2. Audit third-party SDKs (MapLibre, Expo) for required `NSPrivacyAccessedAPITypes` entries.
3. Set `NSPrivacyTracking` to `false` unless a tracking SDK is added.

---

## Google Play Data Safety

| Data type | Collected | Shared | Ephemeral | Required / optional | Purpose |
|-----------|-----------|--------|-----------|---------------------|---------|
| App interactions | Yes | No | No | Optional | Analytics |
| Personal info | No | — | — | — | — |
| Location | No | — | — | — | — |
| Financial info | No | — | — | — | — |
| Photos / videos | No | — | — | — | — |
| Files and docs | No | — | — | — | — |
| Device or other IDs | No | — | — | — | — |

Additional answers:

- **Data encrypted in transit:** Yes (HTTPS to API)
- **Users can request data deletion:** N/A — no personal data stored server-side per user
- **Committed to Play Families policy:** No (news/informational, not child-directed)
- **Independent security review:** No

---

## Reviewer notes (both stores)

- Armed-conflict **news/informational** app; no graphic media embedded.
- Evidence opens **external source URLs** in the system browser / in-app browser.
- **No UGC** — users cannot post or upload content.
- **No login, IAP, or ads.**