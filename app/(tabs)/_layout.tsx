import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const outline = String(name).endsWith('-outline') ? name : (`${String(name)}-outline` as IconName);
  return <Ionicons name={focused ? name : outline} size={22} color={focused ? colors.accent : colors.textDim} />;
}

export default function TabsLayout() {
  const { uid, loading, mode, signOut } = useAuth();
  if (loading) return null;
  if (!uid) return <Redirect href="/" />;

  const logout = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <Tabs
      screenOptions={{
        headerStyle: styles.header,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => void logout()}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="התנתקות"
          >
            <Ionicons name="log-out-outline" size={22} color={colors.sell} />
          </Pressable>
        ),
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="trade"
        options={{
          title: 'מסחר',
          tabBarLabel: 'מסחר',
          tabBarIcon: ({ focused }) => <TabIcon name="trending-up" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'התיק שלי',
          tabBarLabel: 'תיק',
          tabBarIcon: ({ focused }) => <TabIcon name="briefcase" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'טבלה שבועית',
          tabBarLabel: 'דירוג',
          tabBarIcon: ({ focused }) => <TabIcon name="trophy" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="world"
        options={{
          title: 'שעון העולם',
          tabBarLabel: 'עולם',
          tabBarIcon: ({ focused }) => <TabIcon name="globe" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  logoutBtn: {
    marginRight: 16,
    padding: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtnPressed: { opacity: 0.7 },
  tabBar: {
    backgroundColor: 'rgba(6,8,15,0.96)',
    borderTopColor: colors.surfaceBorder,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: 6,
  },
});
