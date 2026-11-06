import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import {
  dailyScoreBonus,
  questDefById,
  questProgress,
} from '../game/dailyQuest';
import type { DailyQuestState, Holdings } from '../game/types';
import { colors, radii } from '../theme';
import { GlassCard } from './ui/GlassCard';

type Props = {
  daily: DailyQuestState | undefined;
  holdings: Holdings;
};

export function DailyQuestCard({ daily, holdings }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!daily?.completed) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.03, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [daily?.completed, scale]);

  if (!daily) return null;

  const quest = questDefById(daily.questId);
  const { current, target, ratio } = questProgress(quest, daily.activity, holdings);
  const bonus = dailyScoreBonus(daily);
  const progressLabel =
    quest.kind === 'buy_ils'
      ? `₪${Math.round(current).toLocaleString('he-IL')} / ₪${target.toLocaleString('he-IL')}`
      : `${Math.min(current, target)} / ${target}`;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <GlassCard style={styles.card}>
        <View style={styles.head}>
          <View style={styles.streak}>
            <Ionicons name="flame" size={18} color={colors.gold} />
            <Text style={styles.streakText}>{daily.streak} ימים ברצף</Text>
          </View>
          {daily.completed ? (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.buy} />
              <Text style={styles.doneText}>הושלם</Text>
            </View>
          ) : (
            <Text style={styles.bonusHint}>בונוס עד +{bonus.toFixed(1)} לציון</Text>
          )}
        </View>
        <Text style={styles.title}>יעד יומי · {quest.title}</Text>
        <Text style={styles.desc}>{quest.description}</Text>
        {!daily.completed ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
            </View>
            <Text style={styles.progress}>{progressLabel}</Text>
          </>
        ) : (
          <Text style={styles.completeMsg}>
            קיבלתם בונוס +{bonus.toFixed(1)} נקודות לטבלה השבועית. חזרו מחר ליעד חדש.
          </Text>
        )}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, borderColor: 'rgba(251,191,36,0.25)' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakText: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  bonusHint: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneText: { color: colors.buy, fontWeight: '800', fontSize: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  desc: { color: colors.textMuted, marginTop: 6, lineHeight: 20, fontSize: 14 },
  track: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  progress: { color: colors.textMuted, fontSize: 12, marginTop: 8, fontWeight: '700' },
  completeMsg: { color: colors.buy, marginTop: 12, lineHeight: 20, fontWeight: '600' },
});
