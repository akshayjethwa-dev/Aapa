import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const { setSupabaseSession } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    // TODO: Replace with real Supabase auth
    // const { data } = await supabase.auth.signInWithPassword({ email, password })
    await setSupabaseSession('demo-token', 'demo-user-id');
    setLoading(false);
    router.replace('/(tabs)/dashboard');
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        <Text style={s.brand}>Aapa Capital</Text>
        <Text style={s.tagline}>Your trading companion</Text>
        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign in with Supabase</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  brand: { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: '#94a3b8', marginBottom: 32 },
  btn: { backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});