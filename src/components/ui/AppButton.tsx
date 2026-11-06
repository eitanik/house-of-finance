import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../../theme';

type Variant = 'primary' | 'secondary' | 'buy' | 'sell' | 'ghost';

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
};

const variantStyle: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: '#2563eb', text: '#fff' },
  secondary: { bg: 'rgba(255,255,255,0.08)', text: colors.text },
  buy: { bg: colors.buy, text: '#042f1a' },
  sell: { bg: colors.sell, text: '#450a0a' },
  ghost: { bg: 'transparent', text: colors.textMuted, border: colors.surfaceBorder },
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  fullWidth,
}: Props) {
  const v = variantStyle[variant];
  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, opacity: pressed ? 0.88 : disabled ? 0.5 : 1 },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        fullWidth && styles.full,
      ]}
      onPress={async () => {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
          /* web */
        }
        await onPress();
      }}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { color: v.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '800' },
});
