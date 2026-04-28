import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useMarketStore } from '../../src/store/marketStore';

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { tickers, favorites, toggleFavorite } = useMarketStore();
  const ticker = tickers[symbol ?? ''];
  const isFav = favorites.includes(symbol ?? '');

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        <View style={s.header}>
          <Text style={s.symbol}>{symbol}</Text>
          <TouchableOpacity onPress={() => symbol && toggleFavorite(symbol)}>
            <Text style={s.fav}>{isFav ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.price}>
          LTP: ₹{ticker?.last_price != null ? ticker.last_price : '—'}  {/* ✅ FIX: was ltp */}
        </Text>

        {ticker && (
          <View style={s.statsRow}>
            <StatBox label="Open"  value={ticker.ohlc?.open} />
            <StatBox label="High"  value={ticker.ohlc?.high} />
            <StatBox label="Low"   value={ticker.ohlc?.low} />
            <StatBox label="Close" value={ticker.ohlc?.close} />
          </View>
        )}

        {ticker?.change_percent != null && (
          <Text
            style={[
              s.change,
              ticker.change_percent >= 0 ? s.changePositive : s.changeNegative,
            ]}
          >
            {ticker.change_percent >= 0 ? '▲' : '▼'}{' '}
            {Math.abs(ticker.change_percent).toFixed(2)}%
          </Text>
        )}

        <TouchableOpacity
          style={s.orderBtn}
          onPress={() => router.push(`/order-window/${symbol}`)}
        >
          <Text style={s.orderBtnText}>Place Order</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Small helper component for OHLC stats
function StatBox({ label, value }: { label: string; value?: number }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value != null ? `₹${value}` : '—'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  inner: { padding: 24, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbol: { fontSize: 26, fontWeight: '700', color: '#f8fafc' },
  fav: { fontSize: 28, color: '#f59e0b' },
  price: { fontSize: 22, fontWeight: '600', color: '#f8fafc' },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: '#64748b', marginBottom: 2 },
  statValue: { fontSize: 13, color: '#cbd5e1', fontWeight: '600' },
  change: { fontSize: 16, fontWeight: '600' },
  changePositive: { color: '#22c55e' },
  changeNegative: { color: '#ef4444' },
  orderBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  orderBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});