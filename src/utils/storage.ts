import { Platform } from 'react-native';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memory = new Map<string, string>();

const memoryStorage: StorageLike = {
  getItem: async (k) => memory.get(k) ?? null,
  setItem: async (k, v) => {
    memory.set(k, v);
  },
  removeItem: async (k) => {
    memory.delete(k);
  },
};

function webStorage(): StorageLike | null {
  if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
    return {
      getItem: async (k) => globalThis.localStorage.getItem(k),
      setItem: async (k, v) => globalThis.localStorage.setItem(k, v),
      removeItem: async (k) => globalThis.localStorage.removeItem(k),
    };
  }
  return null;
}

export const storage: StorageLike = webStorage() ?? memoryStorage;
