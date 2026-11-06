import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../../theme';

type Props = ViewProps & {
  scroll?: boolean;
  padBottom?: number;
  children: React.ReactNode;
};

export function Screen({ scroll, padBottom = 100, children, style, ...rest }: Props) {
  const insets = useSafeAreaInsets();
  const content = (
    <View
      style={[
        styles.inner,
        { paddingTop: spacing.sm, paddingBottom: padBottom + insets.bottom },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      locations={[0, 0.55, 1]}
      style={styles.root}
    >
      <View style={[styles.glow, { top: insets.top }]} pointerEvents="none" />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: 'absolute',
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(94,234,212,0.08)',
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
