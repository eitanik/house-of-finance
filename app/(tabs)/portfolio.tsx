import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatIls, Money } from '../../src/components/Money';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Screen } from '../../src/components/ui/Screen';
import { Sparkline } from '../../src/components/ui/Sparkline';
import { useGame } from '../../src/context/GameContext';
import { INSTRUMENT_BY_SYMBOL } from '../../src/game/instruments';
import { calendarDateIsrael } from '../../src/game/marketHours';
import type { WorldState } from '../../src/game/types';
import { usePriceHistory } from '../../src/hooks/useQuote';
import { getWorldSeries } from '../../src/game/worldGen';
import { colors, spacing } from '../../src/theme';

function HoldingRow({
  symbol,
  qty,
  val,
  world,
  simMs,
}: {
  symbol: string;
  qty: number;
  val: number;
  world: WorldState;
  simMs: number;
}) {
  const inst = INSTRUMENT_BY_SYMBOL[symbol];
  const hist = usePriceHistory(world, symbol, simMs, 10);

  return (
    <GlassCard style={styles.holdingCard}>
      <View style={styles.holdingTop}>
        <View>
          <Text style={styles.sym}>{symbol.replace('TA-', '').replace('US-', '')}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {inst.name}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-start' }}>
          <Text style={styles.val}>{formatIls(val)}</Text>
          <Text style={styles.qty}>{qty.toFixed(3)} יח׳</Text>
        </View>
      </View>
      {hist.length > 1 ? <Sparkline data={hist} width={260} height={40} /> : null}
    </GlassCard>
  );
}

export default function PortfolioScreen() {
  const { world, player, orders, portfolioTotal, refresh } = useGame();
  const [refreshing, setRefreshing] = useState(false);

  if (!player || !world) {
    return (
      <Screen>
        <Text style={styles.muted}>טוען...</Text>
      </Screen>
    );
  }

  const series = getWorldSeries(world.seed, world.epochDate);
  const date = calendarDateIsrael(world.simMs);
  const rows = Object.entries(player.holdings)
    .filter(([, q]) => q > 1e-8)
    .map(([symbol, qty]) => {
      const inst = INSTRUMENT_BY_SYMBOL[symbol];
      const idx = series.dateIndex[date];
      const bar = idx !== undefined ? series.bySymbol[symbol]?.[idx] : undefined;
      const fx = idx !== undefined ? series.fx[idx]?.close : 3.65;
      const px = bar?.close ?? inst.basePrice;
      const val = inst.market === 'US' ? qty * px * fx : qty * px;
      return { symbol, qty, val };
    })
    .sort((a, b) => b.val - a.val);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Screen scroll={false} padBottom={100}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: spacing.md }}
      >
        <GlassCard style={{ marginBottom: spacing.md, marginTop: spacing.sm }}>
          <Text style={styles.label}>שווי תיק נוכחי</Text>
          <Money value={portfolioTotal} style={styles.total} />
          <View style={styles.split}>
            <View style={styles.splitItem}>
              <Ionicons name="wallet-outline" size={20} color={colors.accentBlue} />
              <Text style={styles.splitLabel}>מזומן</Text>
              <Text style={styles.splitVal}>{formatIls(player.cashIls)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.splitItem}>
              <Ionicons name="pie-chart-outline" size={20} color={colors.purple} />
              <Text style={styles.splitLabel}>ניירות</Text>
              <Text style={styles.splitVal}>{rows.length}</Text>
            </View>
          </View>
        </GlassCard>

        <Text style={styles.section}>אחזקות</Text>
        {rows.length === 0 ? (
          <GlassCard>
            <Text style={styles.emptyTitle}>התיק ריק</Text>
            <Text style={styles.muted}>עברו לטאב מסחר כדי לקנות ניירות ראשונים</Text>
          </GlassCard>
        ) : (
          rows.map((r) => (
            <HoldingRow
              key={r.symbol}
              symbol={r.symbol}
              qty={r.qty}
              val={r.val}
              world={world}
              simMs={world.simMs}
            />
          ))
        )}

        <Text style={[styles.section, { marginTop: spacing.lg }]}>פקודות</Text>
        {orders.slice(0, 12).map((o) => {
          const isBuy = o.side === 'buy';
          const statusColor =
            o.status === 'filled' ? colors.buy : o.status === 'pending' ? colors.warn : colors.sell;
          return (
            <View key={o.id} style={styles.orderRow}>
              <View style={[styles.orderIcon, { backgroundColor: isBuy ? colors.buyDim : colors.sellDim }]}>
                <Ionicons
                  name={isBuy ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={22}
                  color={isBuy ? colors.buy : colors.sell}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderTitle}>
                  {isBuy ? 'קנייה' : 'מכירה'} · {o.symbol.replace('TA-', '').replace('US-', '')}
                </Text>
                <Text style={styles.orderSub}>{formatIls(o.amountIls)}</Text>
              </View>
              <Text style={[styles.orderStatus, { color: statusColor }]}>
                {o.status === 'pending' ? 'ממתין' : o.status === 'filled' ? 'בוצע' : 'נדחה'}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 13 },
  total: { color: colors.text, fontSize: 32, fontWeight: '900', marginTop: 4 },
  split: { flexDirection: 'row', marginTop: 20, alignItems: 'center' },
  splitItem: { flex: 1, alignItems: 'center', gap: 4 },
  splitLabel: { color: colors.textDim, fontSize: 12 },
  splitVal: { color: colors.text, fontWeight: '800', fontSize: 15 },
  divider: { width: 1, height: 40, backgroundColor: colors.surfaceBorder },
  section: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 10 },
  holdingCard: { marginBottom: 10, paddingVertical: 14 },
  holdingTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sym: { color: colors.text, fontWeight: '800', fontSize: 17 },
  sub: { color: colors.textMuted, fontSize: 12, maxWidth: 180 },
  val: { color: colors.text, fontWeight: '800', fontSize: 16 },
  qty: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  emptyTitle: { color: colors.text, fontWeight: '800', fontSize: 17, marginBottom: 6 },
  muted: { color: colors.textMuted, lineHeight: 20 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  orderIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  orderTitle: { color: colors.text, fontWeight: '700' },
  orderSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  orderStatus: { fontWeight: '800', fontSize: 13 },
});
