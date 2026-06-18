import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootTabParamList } from './types';

const prefix = Linking.createURL('/');

/**
 * Deep links: peaceclock://c/ukraine/:date (counter) and peaceclock://m/ukraine/:date (map).
 * Mirrors web /c/:theater/:date and /m/:theater/:date routes.
 */
export const linking: LinkingOptions<RootTabParamList> = {
  prefixes: [prefix, 'peaceclock://'],
  config: {
    screens: {
      Counter: 'c/:theater/:date',
      Map: 'm/:theater/:date',
    },
  },
};