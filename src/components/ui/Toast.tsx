import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { colors, radii } from '../../theme';

type Props = {
  message: string | null;
  type?: 'info' | 'success' | 'error';
};

export function Toast({ message, type = 'info' }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!message) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 12, duration: 200, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [message, opacity, translateY]);

  if (!message) return null;

  const bg =
    type === 'success' ? 'rgba(52,211,153,0.2)' : type === 'error' ? 'rgba(248,113,113,0.2)' : colors.surface;
  const border =
    type === 'success' ? colors.buy : type === 'error' ? colors.sell : colors.surfaceBorder;

  return (
    <Animated.View
      style={[styles.wrap, { opacity, transform: [{ translateY }] }, { backgroundColor: bg, borderColor: border }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  text: { color: colors.text, textAlign: 'center', fontWeight: '600', lineHeight: 20 },
});
