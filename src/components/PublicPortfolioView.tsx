import { StyleSheet, Text, View } from 'react-native';

import { INSTRUMENT_BY_SYMBOL } from '../game/instruments';
import { countDistinctHoldings, countHoldingsByMarket, holdingValueIls, portfolioTotalIls } from '../game/portfolio';
import type { Player } from '../game/types';
import type { WorldSeries } from '../game/worldGen';
import { formatIls } from './Money';
import { GlassCard } from './ui/GlassCard';
import { colors, spacing } from '../theme';

export function PublicPortfolioView({
  player,
  series,
  simMs,
  title,
}: {
  player: Player;
  series: WorldSeries;
  simMs: number;
  title?: string;
}) {
  const total = portfolioTotalIls(player.cashIls, player.holdings, series, simMs, 'close');
  const cashPct = total > 0 ? (player.cashIls / total) * 100 : 100;
  const distinct = countDistinctHoldings(player.holdings);
  const mk = countHoldingsByMarket(player.holdings);

  const rows = Object.entries(player.holdings)
    .filter(([, qty]) => qty > 1e-9)
    .map(([symbol, qty]) => {
      const val = holdingValueIls({ [symbol]: qty }, series, simMs, 'close');
      const pct = total > 0 ? (val / total) * 100 : 0;
      const inst = INSTRUMENT_BY_SYMBOL[symbol];
      return { symbol, name: inst?.name ?? symbol, pct, market: inst?.market };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <GlassCard>
      <Text style={styles.title}>{title ?? player.displayName}</Text>
      <Text style={styles.total}>{formatIls(total)}</Text>
      <Text style={styles.meta}>
        מזומן {cashPct.toFixed(1)}% · {distinct} ניירות ({mk.tase} ת״א · {mk.us} US)
      </Text>

      {rows.length === 0 ? (
        <Text style={styles.empty}>אין אחזקות — הכל במזומן</Text>
      ) : (
        rows.map((r) => (
          <View key={r.symbol} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sym}>{r.name}</Text>
              <Text style={styles.code}>{r.symbol}</Text>
            </View>
            <Text style={styles.pct}>{r.pct.toFixed(1)}%</Text>
          </View>
        ))
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontWeight: '800', fontSize: 18 },
  total: { color: colors.buy, fontWeight: '900', fontSize: 24, marginTop: 8 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 6, marginBottom: 14 },
  empty: { color: colors.textMuted, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  sym: { color: colors.text, fontWeight: '700', fontSize: 14 },
  code: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  pct: { color: colors.accent, fontWeight: '800', fontSize: 15 },
});
