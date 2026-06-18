import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Tier } from '@peaceclock/api-types';
import { colors, radii } from '../theme/tokens';
import { TIER_LABEL, TIER_ORDER } from '../lib/labels';

interface Props {
  threshold: Tier;
  onChange: (t: Tier) => void;
}

/**
 * Authentication-threshold slider (M6·T1.1). Official → Confirmed → OSINT →
 * AI-corroborated. Live client-side recount (no network).
 */
export function ThresholdSlider({ threshold, onChange }: Props) {
  const idx = TIER_ORDER.indexOf(threshold);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Authentication level</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={TIER_ORDER.length - 1}
        step={1}
        value={idx}
        onValueChange={(v) => onChange(TIER_ORDER[Math.round(v)])}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.accent}
        accessibilityLabel="Authentication threshold"
        accessibilityValue={{ text: TIER_LABEL[threshold] }}
      />
      <Text style={styles.value}>
        {TIER_LABEL[threshold]}
        {threshold === Tier.AI_CORROBORATED && (
          <Text style={styles.provisional}> · provisional — human audit required</Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.panel,
    borderRadius: radii.panel,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  value: {
    color: colors.fg,
    fontSize: 15,
    marginTop: 6,
  },
  provisional: {
    color: colors.warn,
    fontSize: 13,
  },
});