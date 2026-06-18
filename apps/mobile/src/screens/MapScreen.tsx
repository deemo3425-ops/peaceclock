import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme/tokens';

/** Map placeholder — MapLibre Native view lands in PR14 (M6·WS2). */
export function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map</Text>
      <Text style={styles.subtitle}>
        Clustered casualty map — coming in the next release.
      </Text>
      <Text style={styles.meta}>PR14 · MapLibre Native + /api/map</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    color: colors.fg,
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.fontSizeBase,
    textAlign: 'center',
    lineHeight: 22,
  },
  meta: {
    color: colors.accent,
    fontSize: 13,
    marginTop: 8,
  },
});