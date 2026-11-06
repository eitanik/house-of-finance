import { storage } from '../utils/storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';

import { getFirebaseAuth, isFirebaseConfigured } from '../firebase/config';
import { uidFromName } from './GameContext';

const LOCAL_USER_KEY = 'hof-user';

type AuthState = {
  uid: string | null;
  displayName: string | null;
  loading: boolean;
  mode: 'firebase' | 'local';
  signInLocal: (displayName: string) => Promise<void>;
  signInEmail: (email: string, password: string, register?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mode = isFirebaseConfigured() ? 'firebase' : 'local';
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode === 'local') {
      void storage.getItem(LOCAL_USER_KEY).then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as { uid: string; displayName: string };
          setUid(parsed.uid);
          setDisplayName(parsed.displayName);
        }
        setLoading(false);
      });
      return;
    }
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user: User | null) => {
      setUid(user?.uid ?? null);
      setDisplayName(
        user?.displayName ??
          user?.email?.split('@')[0] ??
          (user ? `אורח_${user.uid.slice(0, 5)}` : null),
      );
      setLoading(false);
    });
  }, [mode]);

  const signInLocal = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('שם נדרש');
    const id = uidFromName(trimmed);
    await storage.setItem(LOCAL_USER_KEY, JSON.stringify({ uid: id, displayName: trimmed }));
    setUid(id);
    setDisplayName(trimmed);
  };

  const signInEmail = async (email: string, password: string, register?: boolean) => {
    const trimmed = email.trim();
    if (!trimmed) {
      throw new Error('יש להזין כתובת אימייל');
    }
    // Firebase rejects many formats; catch obvious mistakes before the SDK call.
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!looksLikeEmail.test(trimmed)) {
      throw new Error('כתובת האימייל לא תקינה — השתמשו בפורמט כמו name@gmail.com');
    }
    if (!password || password.length < 6) {
      throw new Error('הסיסמה חייבת להכיל לפחות 6 תווים');
    }
    const auth = getFirebaseAuth();
    if (register) {
      await createUserWithEmailAndPassword(auth, trimmed, password);
    } else {
      await signInWithEmailAndPassword(auth, trimmed, password);
    }
  };

  const signOut = async () => {
    if (mode === 'local') {
      await storage.removeItem(LOCAL_USER_KEY);
      setUid(null);
      setDisplayName(null);
      return;
    }
    await getFirebaseAuth().signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        uid,
        displayName,
        loading,
        mode,
        signInLocal,
        signInEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
