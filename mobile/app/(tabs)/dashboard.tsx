import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useMarketStore } from '../../src/store/marketStore';

export default function DashboardScreen() {
  const { userId } = useAuthStore();
  const { connectionStatus } = useMarketStore();

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.heading}>Dashboard</Text>
        <Text style={s.sub}>User: {userId ?? '—'}</Text>
        <Text style={s.sub}>Market WS: {connectionStatus}</Text>
        {/* TODO: P&L summary, indices strip, watchlist preview */}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  content: { padding: 20, gap: 8 },
  heading: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  sub: { fontSize: 14, color: '#94a3b8' },
});