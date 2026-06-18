import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { INVASION_START } from '@peaceclock/count-engine';
import { colors, radii, typography } from '../theme/tokens';
import { dateFromIndex, indexFromDate, todayUtc } from '../lib/dates';

const SLIDER_STEPS = 365;

interface Props {
  asOf: string;
  onChange: (d: string) => void;
}

/**
 * Date scrubber (M6·T1.1). Slider maps [INVASION_START, today] — recomputes
 * all cells client-side from the loaded series, no extra fetch within range.
 */
export function DateScrubber({ asOf, onChange }: Props) {
  const maxDate = todayUtc();
  const index = useMemo(
    () => indexFromDate(INVASION_START, maxDate, asOf, SLIDER_STEPS),
    [asOf, maxDate],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.label}>As of</Text>
      <Text style={styles.value} accessibilityRole="text">
        {asOf}
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={SLIDER_STEPS}
        step={1}
        value={index}
        onValueChange={(v) => onChange(dateFromIndex(INVASION_START, maxDate, v, SLIDER_STEPS))}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.accent}
        accessibilityLabel="Date scrubber"
        accessibilityValue={{ text: asOf }}
      />
      <View style={styles.range}>
        <Text style={styles.rangeText}>{INVASION_START}</Text>
        <Text style={styles.rangeText}>{maxDate}</Text>
      </View>
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
    marginBottom: 4,
  },
  value: {
    color: colors.fg,
    fontSize: typography.fontSizeBase,
    fontWeight: '600',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  range: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rangeText: {
    color: colors.muted,
    fontSize: 12,
  },
});