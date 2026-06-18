import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Category } from '@peaceclock/api-types';
import { colors, radii } from '../theme/tokens';
import { CATEGORY_LABEL } from '../lib/labels';

interface Props {
  category: Category;
  onChange: (c: Category) => void;
}

const ORDER: Category[] = [Category.KILLED, Category.WOUNDED, Category.MISSING_POW];

/** Category toggle: killed (default) / wounded / missing-POW. */
export function CategoryToggle({ category, onChange }: Props) {
  return (
    <View style={styles.root} accessibilityRole="radiogroup" accessibilityLabel="Casualty category">
      {ORDER.map((c) => {
        const active = c === category;
        return (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(c)}
            style={[styles.toggle, active && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, active && styles.toggleTextOn]}>
              {CATEGORY_LABEL[c]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  toggleOn: {
    borderColor: colors.accent,
    backgroundColor: '#1a2838',
  },
  toggleText: {
    color: colors.muted,
    fontSize: 14,
  },
  toggleTextOn: {
    color: colors.accent,
    fontWeight: '600',
  },
});