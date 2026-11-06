import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { MarketStatusBar } from '../../src/components/MarketStatusBar';
import { AppButton } from '../../src/components/ui/AppButton';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Screen } from '../../src/components/ui/Screen';
import { useGame } from '../../src/context/GameContext';
import { isFirebaseConfigured } from '../../src/firebase/config';
import { colors, radii, spacing } from '../../src/theme';

const TIME_STEPS = [
  { min: 30, label: '+30 דקות', icon: 'time-outline' as const, desc: 'קפיצה קצרה' },
  { min: 60, label: '+שעה', icon: 'hourglass-outline' as const, desc: 'התקדמות בינונית' },
  { min: 480, label: '+8 שעות', icon: 'sunny-outline' as const, desc: 'לקראת סוף יום מסחר' },
];

export default function WorldScreen() {
  const { clockLabel, world, advance } = useGame();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const step = async (minutes: number) => {
    setBusy(true);
    setErr(null);
    try {
      const msg = await advance(minutes);
      if (msg) setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll padBottom={120}>
      <Text style={styles.title}>שעון העולם</Text>
      <Text style={styles.sub}>כל השחקנים באותו זמן — קדימה בזמן מבצעת פקודות ממתינות.</Text>

      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <LinearGradient
          colors={['rgba(94,234,212,0.25)', 'rgba(96,165,250,0.15)']}
          style={styles.clockRing}
        >
          <GlassCard style={styles.clockInner}>
            <Ionicons name="globe-outline" size={28} color={colors.accent} />
            <Text style={styles.clock}>{clockLabel}</Text>
            <Text style={styles.tz}>שעון ישראל (מדומה)</Text>
          </GlassCard>
        </LinearGradient>
      </Animated.View>

      {world ? <MarketStatusBar simMs={world.simMs} /> : null}

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Text style={styles.section}>קדימה בזמן</Text>
      {TIME_STEPS.map((s) => (
        <AppButton
          key={s.min}
          label={s.label}
          variant="secondary"
          fullWidth
          disabled={busy}
          onPress={() => step(s.min)}
          icon={<Ionicons name={s.icon} size={18} color={colors.text} />}
        />
      ))}

      <GlassCard style={{ marginTop: spacing.md }}>
        <View style={styles.metaRow}>
          <Ionicons name="cloud-outline" size={18} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {isFirebaseConfigured()
              ? 'Firebase מחובר — ריבוי מכשירים'
              : 'מצב מקומי — אותו דפדפן, שחקנים שונים'}
          </Text>
        </View>
        {world ? (
          <Text style={styles.seed}>
            seed {world.seed} · epoch {world.epochDate}
          </Text>
        ) : null}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm },
  sub: { color: colors.textMuted, lineHeight: 22, marginBottom: spacing.md, marginTop: 6 },
  clockRing: { borderRadius: radii.xl, padding: 3, marginBottom: spacing.md },
  clockInner: { alignItems: 'center', paddingVertical: 28, backgroundColor: 'rgba(6,8,15,0.85)' },
  clock: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 12, letterSpacing: 0.5 },
  tz: { color: colors.textDim, marginTop: 6, fontSize: 12 },
  section: { color: colors.textMuted, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { color: colors.textMuted, flex: 1, lineHeight: 20, fontSize: 13 },
  seed: { color: colors.textDim, fontSize: 11, marginTop: 10 },
  err: { color: colors.sell, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
});
