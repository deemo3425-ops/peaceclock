import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme/tokens';
import { CounterScreen } from '../screens/CounterScreen';
import { MapScreen } from '../screens/MapScreen';
import { linking } from './linking';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.panel },
          headerTintColor: colors.fg,
          tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
        }}
      >
        <Tab.Screen
          name="Counter"
          component={CounterScreen}
          options={{ title: 'Counter', headerTitle: 'PeaceClock' }}
        />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{ title: 'Map' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}