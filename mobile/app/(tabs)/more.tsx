// more.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function MoreScreen() {
  const { logout, isUpstoxConnected } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        <Text style={s.heading}>More</Text>
        <View style={s.card}>
          <Text style={s.row}>🔗 Upstox: {isUpstoxConnected ? 'Connected ✅' : 'Not connected ❌'}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  inner: { flex: 1, padding: 24, gap: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  row: { color: '#cbd5e1', fontSize: 14 },
  logoutBtn: { backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});