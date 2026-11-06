import { StyleSheet, Text, View } from 'react-native';

import { formatIls, Money } from './Money';
import { GlassCard } from './ui/GlassCard';
import { colors, spacing } from '../theme';

type Props = {
  displayName?: string | null;
  portfolioTotal: number;
  cashIls: number;
  clockLabel: string;
};

export function PortfolioHero({ displayName, portfolioTotal, cashIls, clockLabel }: Props) {
  const invested = Math.max(0, portfolioTotal - cashIls);
  const cashPct = portfolioTotal > 0 ? (cashIls / portfolioTotal) * 100 : 100;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greet}>שלום, {displayName ?? 'שחקן'}</Text>
          <Text style={styles.clock}>🕐 {clockLabel}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>תחרות שבועית</Text>
        </View>
      </View>
      <Text style={styles.label}>שווי תיק</Text>
      <Money value={portfolioTotal} style={styles.total} />
      <View style={styles.barTrack}>
        <View style={[styles.barInvest, { width: `${100 - cashPct}%` }]} />
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.stat}>מזומן {formatIls(cashIls)}</Text>
        <Text style={styles.stat}>מושקע {formatIls(invested)}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  greet: { color: colors.text, fontSize: 17, fontWeight: '700' },
  clock: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  pill: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  pillText: { color: colors.purple, fontSize: 11, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 13 },
  total: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },
  barTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    marginTop: 14,
    overflow: 'hidden',
  },
  barInvest: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  stat: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});
