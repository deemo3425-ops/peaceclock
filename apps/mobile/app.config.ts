import type { ExpoConfig, ConfigContext } from 'expo/config';

/** Semantic version shown in stores; bump for each public release. */
const APP_VERSION = '1.0.0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'PeaceClock',
  slug: 'peaceclock',
  version: APP_VERSION,
  scheme: 'peaceclock',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0b0d10',
  },
  ios: {
    bundleIdentifier: 'org.peaceclock.app',
    buildNumber: '1',
    supportsTablet: true,
    /** Universal Links — replace host when the production domain is final. */
    associatedDomains: ['applinks:peaceclock.org'],
    /**
     * Apple Privacy Manifest placeholders (App Store privacy nutrition labels).
     * Review and finalize before production submit; must match apps/mobile/store/privacy-nutrition-notes.md
     * and https://peaceclock.org/privacy.
     */
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
      ],
    },
    infoPlist: {
      /** iPad-on-Mac ("Designed for iPad") — Mac App Store binary from the same build. */
      LSRequiresIPhoneOS: true,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'org.peaceclock.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    /** App Links — replace host when the production domain is final. */
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'peaceclock.org', pathPrefix: '/c' },
          { scheme: 'https', host: 'peaceclock.org', pathPrefix: '/m' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    permissions: ['INTERNET'],
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: ['@maplibre/maplibre-react-native'],
  extra: {
    eas: {
      /** Set via `eas init` or EAS_PROJECT_ID env; replace before first cloud build. */
      projectId: process.env.EAS_PROJECT_ID ?? 'pending-eas-project-id',
    },
    /**
     * Deep link paths — resolved by src/navigation/linking.ts at runtime.
     * peaceclock://c/ukraine/:date opens Counter; peaceclock://m/ukraine/:date opens Map.
     */
    linking: {
      prefixes: ['peaceclock://', 'https://peaceclock.org'],
      paths: {
        counter: 'c/:theater/:date',
        map: 'm/:theater/:date',
      },
    },
  },
  owner: 'peaceclock',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/pending-eas-project-id',
  },
});