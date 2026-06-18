import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'PeaceClock',
  slug: 'peaceclock',
  version: '0.0.1',
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
    supportsTablet: true,
  },
  android: {
    package: 'org.peaceclock.app',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      projectId: 'pending',
    },
  },
});