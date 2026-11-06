import { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../src/components/ui/GlassCard';
import { Screen } from '../../src/components/ui/Screen';
import { useAuth } from '../../src/context/AuthContext';
import { useCloudApi } from '../../src/services/cloudApi';
import { useGame } from '../../src/context/GameContext';
import { colors, radii, spacing } from '../../src/theme';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Text style={styles.medal}>🥇</Text>;
  if (rank === 2) return <Text style={styles.medal}>🥈</Text>;
  if (rank === 3) return <Text style={styles.medal}>🥉</Text>;
  return <Text style={styles.rankNum}>{rank}</Text>;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barVal}>{value.toFixed(0)}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { uid } = useAuth();
  const { leaderboard, mode } = useGame();
  const cloud = useCloudApi();

  return (
    <Screen scroll={false} padBottom={100}>
      <GlassCard style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
        <Text style={styles.formulaTitle}>איך מחשבים ציון?</Text>
        <Text style={styles.formula}>
          85% דירוג תשואה שבועית + 15% דירוג יציבות (שקע מקסימלי) · שלישי–שישי
        </Text>
        <Text style={[styles.formula, { marginTop: 8 }]}>
          בשורה של כל שחקן: האחוזים למעלה הם תשואה ו־MDD בפועל; הפסים הם דירוג יחסי (0–100) מול כל השחקנים.
        </Text>
      </GlassCard>

      {cloud && leaderboard.length === 0 && (
        <Text style={styles.local}>הדירוג מתעדכן בשרת — יופיע תוך דקות (או אחרי קידום שעון).</Text>
      )}

      {mode === 'local' && (
        <Text style={styles.local}>טיפ: הירשמו עם שמות שונים (יציאה → שם חדש) לדמות כמה שחקנים.</Text>
      )}

      <FlatList
        data={leaderboard}
        keyExtractor={(r) => r.uid}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <GlassCard>
            <Text style={styles.empty}>אין שחקנים — תהיו הראשונים!</Text>
          </GlassCard>
        }
        renderItem={({ item, index }) => {
          const rank = index + 1;
          const isMe = item.uid === uid;
          return (
            <GlassCard style={isMe ? [styles.row, styles.rowMe] : styles.row}>
              <View style={styles.rowHead}>
                <RankBadge rank={rank} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.displayName}
                    {isMe ? '  (את/ה)' : ''}
                  </Text>
                  <Text style={styles.returnText}>
                    תשואה שבועית: {(item.weeklyReturn * 100).toFixed(2)}% · שקע (MDD): {(item.mdd * 100).toFixed(1)}%
                    {item.dailyBonus > 0 ? ` · בונוס יומי +${item.dailyBonus.toFixed(1)}` : ''}
                    {item.streak > 0 ? ` · 🔥${item.streak}` : ''}
                  </Text>
                </View>
                <View style={styles.scoreBox}>
                  <Text style={styles.score}>{item.score.toFixed(1)}</Text>
                  <Text style={styles.scoreLabel}>ציון</Text>
                </View>
              </View>
              <ScoreBar label="דירוג תשואה" value={item.returnPercentile} color={colors.buy} />
              <ScoreBar label="דירוג יציבות" value={item.stabilityPercentile} color={colors.accentBlue} />
            </GlassCard>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  formulaTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  formula: { color: colors.textMuted, marginTop: 6, lineHeight: 20, fontSize: 13 },
  local: { color: colors.gold, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  empty: { color: colors.textMuted, textAlign: 'center' },
  row: { marginBottom: 10 },
  rowMe: { borderColor: 'rgba(94,234,212,0.45)' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  medal: { fontSize: 28, width: 36, textAlign: 'center' },
  rankNum: { color: colors.textMuted, fontWeight: '800', fontSize: 18, width: 36, textAlign: 'center' },
  name: { color: colors.text, fontWeight: '800', fontSize: 16 },
  returnText: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  scoreBox: { alignItems: 'center', backgroundColor: 'rgba(52,211,153,0.12)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm },
  score: { color: colors.buy, fontWeight: '900', fontSize: 20 },
  scoreLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  barLabel: { color: colors.textDim, width: 48, fontSize: 11, fontWeight: '700' },
  barTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barVal: { color: colors.textMuted, width: 28, fontSize: 11, fontWeight: '700', textAlign: 'left' },
});
