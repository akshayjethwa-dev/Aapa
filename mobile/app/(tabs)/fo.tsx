import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FOScreen() {
  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        <Text style={s.heading}>Futures & Options</Text>
        <Text style={s.sub}>Options chain, strategy builder — coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});