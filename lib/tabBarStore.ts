import { useEffect, useRef, useState } from 'react';

let isShrunk = false;
const listeners = new Set<(v: boolean) => void>();

export const tabBarStore = {
  shrink: () => {
    if (!isShrunk) {
      isShrunk = true;
      listeners.forEach((l) => l(true));
    }
  },
  grow: () => {
    if (isShrunk) {
      isShrunk = false;
      listeners.forEach((l) => l(false));
    }
  },
  subscribe: (fn: (v: boolean) => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  get: () => isShrunk,
};

export function useTabBarShrunk() {
  const [shrunk, setShrunk] = useState(isShrunk);
  useEffect(() => {
    return tabBarStore.subscribe(setShrunk);
  }, []);
  return shrunk;
}

export function useTabBarScroll(delay: number = 600) {
  const timeoutRef = useRef<any>(null);
  return {
    onScroll: () => {
      tabBarStore.shrink();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => tabBarStore.grow(), delay);
    },
    scrollEventThrottle: 32,
  };
}