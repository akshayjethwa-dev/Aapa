import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMarketStore } from '../../src/store/marketStore';

const TABS = ['Indices', 'Stocks', 'Favorites'] as const;
type Tab = (typeof TABS)[number];

export default function MarketScreen() {
  const { tickers, favorites, lastTab, setLastTab } = useMarketStore();
  const activeTab = (lastTab as Tab) ?? 'Indices';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.subTabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setLastTab(t)}
            style={[s.subTab, activeTab === t && s.subTabActive]}
          >
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Favorites' && favorites.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyText}>No favorites yet. Tap ☆ on any stock.</Text>
        </View>
      )}

      {activeTab === 'Favorites' && favorites.length > 0 && (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => router.push(`/stock-detail/${item}`)}
            >
              <Text style={s.symbol}>{item}</Text>
              <Text style={s.price}>
                {tickers[item]?.last_price != null     // ✅ FIX: was ltp
                  ? `₹${tickers[item].last_price}`
                  : '—'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {activeTab !== 'Favorites' && (
        <View style={s.empty}>
          <Text style={s.emptyText}>Live {activeTab} data — coming soon</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  subTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  subTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  tabText: { color: '#64748b', fontWeight: '500', fontSize: 13 },
  tabTextActive: { color: '#3b82f6' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  symbol: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  price: { color: '#94a3b8', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#475569', fontSize: 14 },
});