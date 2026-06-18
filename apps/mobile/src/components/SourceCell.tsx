import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme/tokens';

interface Props {
  value: number;
}

/**
 * Count cell (SourceCell pattern stub — full source drill-down lands in M6·T1.2).
 * Zero cells are plain text; non-zero cells are styled as tappable figures.
 */
export function SourceCell({ value }: Props) {
  if (value === 0) {
    return <Text style={styles.zero}>0</Text>;
  }

  return (
    <Text style={styles.value} accessibilityRole="button" accessibilityHint="Source detail coming soon">
      {value.toLocaleString()}
    </Text>
  );
}

const styles = StyleSheet.create({
  zero: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'right',
  },
  value: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
});