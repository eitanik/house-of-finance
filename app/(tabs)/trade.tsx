import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DailyQuestCard } from '../../src/components/DailyQuestCard';
import { PortfolioHero } from '../../src/components/PortfolioHero';
import { MarketStatusBar } from '../../src/components/MarketStatusBar';
import { formatIls } from '../../src/components/Money';
import { AppButton } from '../../src/components/ui/AppButton';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Screen } from '../../src/components/ui/Screen';
import { Sparkline } from '../../src/components/ui/Sparkline';
import { Toast } from '../../src/components/ui/Toast';
import { useAuth } from '../../src/context/AuthContext';
import { useGame } from '../../src/context/GameContext';
import { INSTRUMENTS } from '../../src/game/instruments';
import { isMarketOpen } from '../../src/game/marketHours';
import { usePriceHistory, useQuote } from '../../src/hooks/useQuote';
import { colors, radii, spacing } from '../../src/theme';
import { STARTING_CASH_ILS } from '../../src/game/types';

const QUICK_AMOUNTS = [10_000, 50_000, 100_000, 250_000];

export default function TradeScreen() {
  const { displayName } = useAuth();
  const { world, player, portfolioTotal, clockLabel, submitOrder, dailyQuest, firebaseError } = useGame();
  const [symbol, setSymbol] = useState(INSTRUMENTS[0].symbol);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('50000');
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'info' | 'success' | 'error'>('info');
  const [submitting, setSubmitting] = useState(false);

  const selected = INSTRUMENTS.find((i) => i.symbol === symbol)!;
  const simMs = world?.simMs ?? 0;
  const quote = useQuote(world, symbol, simMs);
  const history = usePriceHistory(world, symbol, simMs, 16);
  const marketOpen = world && selected ? isMarketOpen(selected.market, world.simMs) : false;

  const maxBuy = useMemo(() => {
    if (!player) return 0;
    return Math.min(player.cashIls, portfolioTotal * 0.2);
  }, [player, portfolioTotal]);

  const onSubmit = async () => {
    const n = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      setMsgType('error');
      setMsg('סכום לא תקין');
      return;
    }
    setSubmitting(true);
    const err = await submitOrder(symbol, side, n);
    setSubmitting(false);
    if (err) {
      setMsgType('error');
      setMsg(err);
    } else {
      setMsgType('success');
      setMsg('הפקודה נשלחה — תבוצע לפי חוקי המסחר (לא ניתן לבטל)');
    }
  };

  const setQuick = (n: number) => setAmount(String(Math.round(n)));

  return (
    <Screen scroll padBottom={120}>
      {firebaseError ? (
        <GlassCard style={{ marginBottom: spacing.sm, borderColor: 'rgba(248,113,113,0.4)' }}>
          <Text style={styles.syncErr}>{firebaseError}</Text>
        </GlassCard>
      ) : null}
      <PortfolioHero
        displayName={displayName}
        portfolioTotal={portfolioTotal}
        cashIls={player?.cashIls ?? STARTING_CASH_ILS}
        clockLabel={clockLabel}
      />

      <DailyQuestCard daily={dailyQuest} holdings={player?.holdings ?? {}} />

      {world ? <MarketStatusBar simMs={world.simMs} /> : null}

      <Text style={styles.sectionTitle}>בחר נייר</Text>
      <FlatList
        data={INSTRUMENTS}
        keyExtractor={(i) => i.symbol}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={{ flexDirection: 'row-reverse', paddingVertical: 4 }}
        renderItem={({ item }) => {
          const active = item.symbol === symbol;
          const isUs = item.market === 'US';
          return (
            <Pressable
              style={[styles.chip, active && styles.chipActive, isUs && styles.chipUs]}
              onPress={() => setSymbol(item.symbol)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.symbol.replace('TA-', '').replace('US-', '')}
              </Text>
              <Text style={styles.chipSub}>{isUs ? '🇺🇸' : '🇮🇱'}</Text>
            </Pressable>
          );
        }}
      />

      <GlassCard style={styles.quoteCard}>
        <View style={styles.quoteHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.symbolName}>{selected.name}</Text>
            <Text style={styles.symbolCode}>{selected.symbol}</Text>
          </View>
          {quote ? (
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={styles.priceIls}>{formatIls(quote.ils)}</Text>
              <Text
                style={[
                  styles.change,
                  { color: quote.dayChange >= 0 ? colors.buy : colors.sell },
                ]}
              >
                {quote.dayChange >= 0 ? '▲' : '▼'} {Math.abs(quote.dayChange).toFixed(2)}% היום
              </Text>
            </View>
          ) : null}
        </View>

        {history.length > 1 ? (
          <View style={styles.chartWrap}>
            <Sparkline data={history} width={300} height={72} positive={history.at(-1)! >= history[0]} />
            <Text style={styles.chartCaption}>16 ימי מסחר אחרונים (₪)</Text>
          </View>
        ) : null}

        <View style={[styles.statusRow, marketOpen ? styles.statusOpen : styles.statusClosed]}>
          <Ionicons name={marketOpen ? 'pulse' : 'moon'} size={16} color={marketOpen ? colors.buy : colors.warn} />
          <Text style={styles.statusText}>
            {marketOpen
              ? 'שוק פתוח — הפקודה תבוצע בסגירה'
              : 'שוק סגור — הפקודה תבוצע בפתיחה הבאה'}
          </Text>
        </View>
      </GlassCard>

      <View style={styles.sideRow}>
        <Pressable
          style={[styles.sideBtn, side === 'buy' && styles.sideBuy]}
          onPress={() => setSide('buy')}
        >
          <Ionicons name="trending-up" size={18} color={side === 'buy' ? '#042f1a' : colors.textMuted} />
          <Text style={[styles.sideLabel, side === 'buy' && styles.sideLabelActiveBuy]}>קנייה</Text>
        </Pressable>
        <Pressable
          style={[styles.sideBtn, side === 'sell' && styles.sideSell]}
          onPress={() => setSide('sell')}
        >
          <Ionicons name="trending-down" size={18} color={side === 'sell' ? '#450a0a' : colors.textMuted} />
          <Text style={[styles.sideLabel, side === 'sell' && styles.sideLabelActiveSell]}>מכירה</Text>
        </Pressable>
      </View>

      <GlassCard style={{ marginBottom: spacing.sm }}>
        <Text style={styles.inputLabel}>סכום בשקלים</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={colors.textDim}
        />
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((q) => (
            <Pressable key={q} style={styles.quickChip} onPress={() => setQuick(q)}>
              <Text style={styles.quickText}>{q >= 1000 ? `${q / 1000}K` : q}</Text>
            </Pressable>
          ))}
          {side === 'buy' ? (
            <Pressable style={[styles.quickChip, styles.quickMax]} onPress={() => setQuick(maxBuy)}>
              <Text style={[styles.quickText, { color: colors.accent }]}>מקס 20%</Text>
            </Pressable>
          ) : null}
        </View>
      </GlassCard>

      <AppButton
        label={side === 'buy' ? 'שליחת פקודת קנייה' : 'שליחת פקודת מכירה'}
        variant={side === 'buy' ? 'buy' : 'sell'}
        fullWidth
        loading={submitting}
        onPress={onSubmit}
        icon={<Ionicons name="send" size={18} color={side === 'buy' ? '#042f1a' : '#450a0a'} />}
      />

      <Toast message={msg} type={msgType} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.textMuted, fontWeight: '700', marginBottom: 8, fontSize: 13 },
  list: { maxHeight: 56, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radii.sm,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    minWidth: 72,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: 'rgba(94,234,212,0.12)' },
  chipUs: {},
  chipText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  chipTextActive: { color: colors.text },
  chipSub: { fontSize: 12, marginTop: 2 },
  quoteCard: { marginBottom: spacing.md },
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  symbolName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  symbolCode: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  priceIls: { color: colors.text, fontSize: 22, fontWeight: '900' },
  change: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  chartWrap: { marginTop: 16, alignItems: 'center' },
  chartCaption: { color: colors.textDim, fontSize: 11, marginTop: 6 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 10,
    borderRadius: radii.sm,
  },
  statusOpen: { backgroundColor: colors.buyDim },
  statusClosed: { backgroundColor: 'rgba(251,191,36,0.12)' },
  statusText: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  sideRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.sm },
  sideBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  sideBuy: { backgroundColor: colors.buyDim, borderColor: 'rgba(52,211,153,0.4)' },
  sideSell: { backgroundColor: colors.sellDim, borderColor: 'rgba(248,113,113,0.4)' },
  sideLabel: { color: colors.textMuted, fontWeight: '800', fontSize: 15 },
  sideLabelActiveBuy: { color: colors.buy },
  sideLabelActiveSell: { color: colors.sell },
  inputLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  quickMax: { borderColor: 'rgba(94,234,212,0.35)' },
  quickText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  syncErr: { color: colors.sell, fontSize: 13, lineHeight: 20, textAlign: 'center', writingDirection: 'rtl' },
});
