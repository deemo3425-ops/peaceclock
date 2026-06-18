import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MatrixRow } from '@peaceclock/count-engine';
import { WINDOWS } from '@peaceclock/count-engine';
import { Audience, Category, Tier } from '@peaceclock/api-types';
import { colors, radii } from '../theme/tokens';
import { AUDIENCE_LABEL, CATEGORY_LABEL, SIDE_LABEL, WINDOW_LABEL } from '../lib/labels';
import { SourceCell } from './SourceCell';

interface Props {
  rows: MatrixRow[];
  category: Category;
  threshold: Tier;
  asOf: string;
}

export function CountMatrix({ rows, category, asOf }: Props) {
  const civilian = rows.filter((r) => r.audience === Audience.CIVILIAN);
  const military = rows.filter((r) => r.audience === Audience.MILITARY);

  return (
    <View style={styles.root} accessibilityLabel={`${CATEGORY_LABEL[category]} counts`}>
      <Group
        title="Civilian"
        subtitle="primary"
        rows={civilian}
        asOf={asOf}
        category={category}
      />
      <Group
        title="Military"
        subtitle="secondary · lower coverage"
        rows={military}
        asOf={asOf}
        category={category}
      />
    </View>
  );
}

function Group({
  title,
  subtitle,
  rows,
  asOf,
  category,
}: {
  title: string;
  subtitle: string;
  rows: MatrixRow[];
  asOf: string;
  category: Category;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>
        {title} <Text style={styles.groupSub}>{subtitle}</Text>
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.sideCol]}>Side</Text>
            {WINDOWS.map((w) => (
              <Text key={w} style={styles.headerCell}>
                {WINDOW_LABEL[w]}
              </Text>
            ))}
          </View>
          {rows.map((r) => (
            <View key={`${r.side}-${r.audience}`} style={styles.dataRow}>
              <Text style={[styles.sideCell, styles.sideCol]}>{SIDE_LABEL[r.side]}</Text>
              {WINDOWS.map((w) => (
                <View
                  key={w}
                  style={[styles.dataCell, w === 'total' && styles.totalCell]}
                >
                  <SourceCell value={r.counts[w]} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.caption}>
        {AUDIENCE_LABEL[rows[0]?.audience ?? Audience.CIVILIAN]} {CATEGORY_LABEL[category]} as of {asOf}
      </Text>
    </View>
  );
}

const CELL_W = 72;
const SIDE_W = 120;

const styles = StyleSheet.create({
  root: {
    gap: 16,
  },
  group: {
    backgroundColor: colors.panel,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  groupTitle: {
    color: colors.fg,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  groupSub: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '400',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 6,
    marginBottom: 4,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerCell: {
    width: CELL_W,
    color: colors.muted,
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '600',
  },
  sideCol: {
    width: SIDE_W,
    textAlign: 'left',
  },
  sideCell: {
    color: colors.fg,
    fontSize: 13,
  },
  dataCell: {
    width: CELL_W,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  totalCell: {
    backgroundColor: '#1a222b',
    borderRadius: radii.control,
    paddingVertical: 2,
  },
  caption: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
  },
});