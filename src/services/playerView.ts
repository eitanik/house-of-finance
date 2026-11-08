import type { Player } from '../game/types';
import { isFirebaseConfigured } from '../firebase/config';
import { fetchLocalPlayer } from './localGameStore';
import { fetchPlayerByUid } from './firestoreGame';

export async function fetchPublicPlayer(uid: string): Promise<Player | null> {
  if (!isFirebaseConfigured()) {
    return fetchLocalPlayer(uid);
  }
  return fetchPlayerByUid(uid);
}
