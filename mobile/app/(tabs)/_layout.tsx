import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { useMarketStore } from '../../src/store/marketStore';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={s.iconWrapper}>
      <Text style={[s.icon, focused && s.iconActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { supabaseToken, isHydrating } = useAuthStore();
  const { hydrateFromStorage: hydrateMarket } = useMarketStore();

  useEffect(() => { hydrateMarket(); }, []);

  useEffect(() => {
    if (!isHydrating && !supabaseToken) router.replace('/(auth)/login');
  }, [isHydrating, supabaseToken]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: s.tabBar,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: s.label,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }} />
      <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: ({ focused }) => <TabIcon label="📈" focused={focused} /> }} />
      <Tabs.Screen name="fo" options={{ title: 'F&O', tabBarIcon: ({ focused }) => <TabIcon label="📊" focused={focused} /> }} />
      <Tabs.Screen name="positions" options={{ title: 'Positions', tabBarIcon: ({ focused }) => <TabIcon label="📋" focused={focused} /> }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio', tabBarIcon: ({ focused }) => <TabIcon label="💼" focused={focused} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ focused }) => <TabIcon label="⋯" focused={focused} /> }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: { backgroundColor: '#0a0f1e', borderTopColor: '#1e293b', borderTopWidth: 1, height: 60, paddingBottom: 6 },
  label: { fontSize: 10, fontWeight: '500' },
  iconWrapper: { alignItems: 'center' },
  icon: { fontSize: 20, opacity: 0.5 },
  iconActive: { opacity: 1 },
});