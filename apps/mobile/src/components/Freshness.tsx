import { StyleSheet, Text, View } from 'react-native';
import type { CountsResponse } from '@peaceclock/api-types';
import { Side } from '@peaceclock/api-types';
import { colors } from '../theme/tokens';
import { SIDE_LABEL } from '../lib/labels';

interface Props {
  asOf: string;
  lastUpdated: string;
  lastUpdatedBySide: CountsResponse['lastUpdatedBySide'];
}

function fmt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t) || t === 0) return 'no data yet';
  return `${new Date(t).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

export function Freshness({ asOf, lastUpdated, lastUpdatedBySide }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>
        Showing counts <Text style={styles.strong}>as of {asOf}</Text>. Figures are a lower bound — they rise only as evidence is confirmed.
      </Text>
      <Text style={styles.updated}>
        Last updated: {fmt(lastUpdated)}
        {([Side.UA_COALITION, Side.RUSSIA] as const).map((s) =>
          lastUpdatedBySide[s] ? (
            <Text key={s}> · {SIDE_LABEL[s]}: {fmt(lastUpdatedBySide[s]!)}</Text>
          ) : null,
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
    paddingTop: 8,
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  strong: {
    color: colors.fg,
    fontWeight: '600',
  },
  updated: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});