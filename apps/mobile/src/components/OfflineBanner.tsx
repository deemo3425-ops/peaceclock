import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';

function fmt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

interface Props {
  cachedAt: string | null;
}

/**
 * Offline / last-known-good banner (M7·WS2·T2.2).
 * Shown when the app is serving cached counts or map data.
 */
export function OfflineBanner({ cachedAt }: Props) {
  if (!cachedAt) return null;

  return (
    <View style={styles.banner} accessibilityRole="text" accessibilityLiveRegion="polite">
      <Text style={styles.text}>
        <Text style={styles.strong}>Offline — showing last known data. </Text>
        Cached at {fmt(cachedAt)}. Figures may be stale until the connection recovers.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warn,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    color: '#1a0f08',
    fontSize: 13,
    lineHeight: 18,
  },
  strong: {
    fontWeight: '700',
  },
});