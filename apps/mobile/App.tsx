import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Tier } from '@peaceclock/api-types';
import { WINDOWS } from '@peaceclock/count-engine';
import { colors, typography } from './src/theme/tokens';

/**
 * Minimal boot shell — counter + map screens land in PR13/PR14.
 * Imports shared workspace packages to verify monorepo wiring at startup.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PeaceClock</Text>
      <Text style={styles.subtitle}>Confirmed casualty tracker</Text>
      <Text style={styles.meta}>
        Shared engine: {WINDOWS.length} windows · default tier {Tier.CONFIRMED}
      </Text>
      <StatusBar style="light" />
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
  },
  title: {
    color: colors.fg,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.fontSizeBase,
    marginTop: 8,
    textAlign: 'center',
  },
  meta: {
    color: colors.accent,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});