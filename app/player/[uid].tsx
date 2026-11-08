import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PublicPortfolioView } from '../../src/components/PublicPortfolioView';
import { Screen } from '../../src/components/ui/Screen';
import { useAuth } from '../../src/context/AuthContext';
import { useGame } from '../../src/context/GameContext';
import type { Player } from '../../src/game/types';
import { getWorldSeries } from '../../src/game/worldGen';
import { fetchPublicPlayer } from '../../src/services/playerView';
import { colors } from '../../src/theme';

export default function PlayerProfileScreen() {
  const { uid: paramUid } = useLocalSearchParams<{ uid: string }>();
  const uid = typeof paramUid === 'string' ? paramUid : '';
  const { uid: myUid } = useAuth();
  const { world } = useGame();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    void fetchPublicPlayer(uid).then((p) => {
      setPlayer(p);
      setLoading(false);
    });
  }, [uid]);

  const series = useMemo(
    () => (world ? getWorldSeries(world.seed, world.epochDate) : null),
    [world],
  );

  const isPrivate = player && player.portfolioPublic === false && player.uid !== myUid;

  return (
    <>
      <Stack.Screen
        options={{
          title: player?.displayName ?? 'תיק שחקן',
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>סגור</Text>
            </Pressable>
          ),
        }}
      />
      <Screen scroll padBottom={80}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : !player || !world || !series ? (
          <Text style={styles.muted}>שחקן לא נמצא</Text>
        ) : isPrivate ? (
          <Text style={styles.muted}>השחקן הסתיר את התיק שלו</Text>
        ) : (
          <PublicPortfolioView player={player} series={series} simMs={world.simMs} />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
});
