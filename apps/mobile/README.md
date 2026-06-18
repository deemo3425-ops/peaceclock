# PeaceClock Mobile (`@peaceclock/mobile`)

Expo / React Native client for iOS, Android, and macOS (via iPad-on-Mac). Shares `@peaceclock/api-types` and `@peaceclock/count-engine` with the web app.

## Prerequisites

- Node 20+ and pnpm (from monorepo root)
- [EAS CLI](https://docs.expo.dev/build/setup/): `npm install -g eas-cli`
- Expo account with access to the `peaceclock` org
- Apple Developer Program + App Store Connect app record
- Google Play Console app + service account JSON (for automated submit)

## Local development

```bash
# From monorepo root
pnpm install
pnpm --filter @peaceclock/mobile start

# Platform simulators
pnpm --filter @peaceclock/mobile ios
pnpm --filter @peaceclock/mobile android
```

Set the API origin for device builds:

```bash
export EXPO_PUBLIC_API_URL=https://peaceclock.org   # or your preview deployment
```

## EAS project setup (one-time)

```bash
cd apps/mobile
eas login
eas init          # creates/links project — copy projectId into app.config.ts extra.eas.projectId
```

Replace placeholders in `eas.json` → `submit.production.ios` (`appleId`, `ascAppId`, `appleTeamId`) and add `store/google-play-service-account.json` (gitignored; never commit).

## Build profiles (`eas.json`)

| Profile | Use | iOS output | Android output |
|---------|-----|------------|------------------|
| `development` | Dev client + simulator | `.app` (simulator) | debug APK |
| `preview` | Internal QA / TestFlight external-less testers | device IPA (ad hoc/internal) | release APK |
| `production` | Store submission | App Store IPA | AAB (Play Store) |

```bash
cd apps/mobile

# Typecheck before any cloud build (CI gate)
pnpm typecheck

# Development (simulator / dev client)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview (internal distribution)
eas build --profile preview --platform all

# Production (store binaries; auto-increments build numbers)
eas build --profile production --platform all
```

`EXPO_PUBLIC_API_URL` is set per profile in `eas.json`. Override at build time with `eas build --profile production -e EXPO_PUBLIC_API_URL=https://staging.peaceclock.org` if needed.

## TestFlight internal testing (iOS / iPadOS / Mac)

1. **Create the App Store Connect record** with bundle ID `org.peaceclock.app` (must match `app.config.ts`).
2. **Production or preview build:**
   ```bash
   eas build --profile production --platform ios
   ```
3. **Upload to App Store Connect:**
   ```bash
   eas submit --profile production --platform ios --latest
   ```
   Or upload the `.ipa` manually via Transporter.
4. **App Store Connect → TestFlight → Internal Testing:**
   - Add internal testers (App Store Connect users on your team; no Beta App Review).
   - Select the uploaded build → enable the internal group.
   - Testers install via the TestFlight app (macOS testers use the same build through "Designed for iPad" on Apple Silicon).
5. **Verify on device:** deep links (`https://peaceclock.org/c/ukraine/2024-01-01`), counter scrub, map clusters, offline banner, source links opening externally.
6. **External TestFlight (optional):** requires Beta App Review; use after internal sign-off.

### Mac App Store note

The iOS/iPadOS binary with `supportsTablet: true` runs on Apple Silicon Macs. Enable Mac distribution in App Store Connect when creating the app version; no separate EAS platform flag is required.

## Google Play internal testing (Android)

1. **Create the Play Console app** with package `org.peaceclock.app` (must match `app.config.ts`).
2. **Production build (AAB):**
   ```bash
   eas build --profile production --platform android
   ```
3. **Upload to Play Console:**
   ```bash
   eas submit --profile production --platform android --latest
   ```
   Ensure `store/google-play-service-account.json` exists locally and the service account has **Release manager** (or admin) on the app.
4. **Play Console → Testing → Internal testing:**
   - Create an internal testing track (up to 100 testers).
   - Create a release → add the uploaded AAB → roll out to internal testing.
   - Copy the opt-in URL and share with testers.
5. **Verify on device:** App Links (`https://peaceclock.org/m/...`), same functional checklist as iOS.
6. **Promote:** internal → closed → open → production after rating and Data Safety forms are complete.

## Store metadata

Templates live in `store/`:

- `description.txt` — listing copy and keyword stubs
- `privacy-nutrition-notes.md` — Apple / Google privacy form answers (align with https://peaceclock.org/privacy)
- `content-rating-questionnaire.md` — age rating answer stubs

Screenshots, icons, and feature graphics are staged manually in each console.

## CI recommendation

Before `eas build` in CI:

```bash
pnpm typecheck
pnpm --filter @peaceclock/count-engine test
```

Use `eas build --non-interactive` with `EXPO_TOKEN` in the CI environment.

## Config reference

| File | Purpose |
|------|---------|
| `app.config.ts` | Version, bundle IDs, privacy manifest placeholders, universal links |
| `eas.json` | Build/submit profiles for development, preview, production |
| `store/*` | Store listing and compliance templates |