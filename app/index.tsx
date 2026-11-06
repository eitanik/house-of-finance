import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../src/components/ui/AppButton';
import { GlassCard } from '../src/components/ui/GlassCard';
import { useAuth } from '../src/context/AuthContext';
import { isFirebaseConfigured } from '../src/firebase/config';
import { colors, radii, spacing } from '../src/theme';
import { STARTING_CASH_ILS } from '../src/game/types';
import { formatIls } from '../src/components/Money';
import { authErrorCode, messageForAuthError } from '../src/utils/authErrors';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { uid, loading, mode, signInLocal, signInEmail } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.flex}>
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: insets.top + 80 }} />
      </LinearGradient>
    );
  }

  if (uid) {
    return <Redirect href="/(tabs)/trade" />;
  }

  const wrap = async (fn: () => Promise<void>, authKind: 'login' | 'register') => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.replace('/(tabs)/trade');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      /* Local validation from AuthContext — already Hebrew */
      if (
        raw.startsWith('יש להזין') ||
        raw.includes('פורמט') ||
        raw.includes('לפחות 6 תווים')
      ) {
        setError(raw);
        return;
      }
      const code = authErrorCode(e);
      if (__DEV__ && !code) console.warn('[Auth] unmapped error:', e);
      setError(messageForAuthError(e, authKind));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={['#0a0e17', '#111827', '#1e1b4b']} style={styles.flex}>
      <KeyboardAvoidingView
        style={[styles.flex, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <Ionicons name="stats-chart" size={36} color={colors.accent} />
            </View>
            <Text style={styles.title}>House of Finance</Text>
            <Text style={styles.subtitle}>תחרות מסחר שבועית · {formatIls(STARTING_CASH_ILS)} וירטואליים</Text>
          </View>

          <GlassCard style={styles.card}>
            <View style={styles.featureRow}>
              <Feature icon="flash-outline" text="פקודות לפי חוקי ת״א וארה״ב" />
              <Feature icon="trophy" text="דירוג תשואה + יציבות" />
              <Feature icon="people" text="שחקנים על אותו שעון עולם" />
            </View>

            {!isFirebaseConfigured() && (
              <Text style={styles.hint}>מצב הדגמה מקומי — לריבוי מכשירים הגדירו Firebase (.env)</Text>
            )}

            {error ? (
              <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color={colors.sell} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

          {mode === 'local' ? (
            <>
              <Text style={styles.label}>שם שחקן</Text>
              <TextInput
                style={styles.input}
                placeholder="למשל: יoni_trader"
                placeholderTextColor={colors.textDim}
                value={name}
                onChangeText={setName}
              />
              <AppButton
                label="התחל לשחק"
                variant="buy"
                fullWidth
                loading={busy}
                onPress={() => wrap(() => signInLocal(name), 'login')}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>אימייל</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={styles.label}>סיסמה</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textDim}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <AppButton
                label="התחבר"
                fullWidth
                loading={busy}
                onPress={() => wrap(() => signInEmail(email.trim(), password, false), 'login')}
              />
              <Pressable onPress={() => wrap(() => signInEmail(email.trim(), password, true), 'register')} disabled={busy}>
                <Text style={styles.link}>אין חשבון? הרשמה</Text>
              </Pressable>
            </>
          )}
        </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Feature({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.feature}>
      <Ionicons name={icon} size={16} color={colors.accentBlue} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingHorizontal: spacing.lg },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.lg },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(94,234,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 8, textAlign: 'center', writingDirection: 'rtl' },
  card: { gap: 4 },
  featureRow: { gap: 10, marginBottom: 16 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: colors.textMuted, fontSize: 13, flex: 1, writingDirection: 'rtl', textAlign: 'right' },
  hint: { fontSize: 12, color: colors.gold, lineHeight: 18, marginBottom: 12, writingDirection: 'rtl', textAlign: 'center' },
  label: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 8,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radii.md,
    padding: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 4,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  link: { color: colors.accentBlue, textAlign: 'center', marginTop: 14, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  errorBannerText: {
    flex: 1,
    color: colors.sell,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});
