import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radii, shadow, spacing } from '../../theme';

export function GlassCard({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    ...shadow.card,
  },
});
