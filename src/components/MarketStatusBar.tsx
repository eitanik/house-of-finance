import { StyleSheet, Text, View } from 'react-native';

import { isMarketOpen } from '../game/marketHours';
import { colors, radii } from '../theme';

type Props = { simMs: number };

function MarketPill({ label, open }: { label: string; open: boolean }) {
  return (
    <View style={[styles.pill, open ? styles.pillOpen : styles.pillClosed]}>
      <View style={[styles.dot, { backgroundColor: open ? colors.buy : colors.textDim }]} />
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillState, { marginRight: 'auto' }]}>{open ? 'פתוח' : 'סגור'}</Text>
    </View>
  );
}

export function MarketStatusBar({ simMs }: Props) {
  return (
    <View style={styles.row}>
      <MarketPill label="ת״א" open={isMarketOpen('TASE', simMs)} />
      <MarketPill label="ארה״ב" open={isMarketOpen('US', simMs)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  pillOpen: { backgroundColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.25)' },
  pillClosed: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: colors.surfaceBorder },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillLabel: { color: colors.text, fontWeight: '800', fontSize: 13 },
  pillState: { color: colors.textMuted, fontSize: 12 },
});
