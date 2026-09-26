import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Ingredient } from './supabase';

export type CartItem = {
  recipeId: string;
  recipeTitle: string;
  basePeople: number;
  currentPeople: number;
  baseIngredients: Ingredient[];
};

const CART_STORAGE_KEY = 'cart_persistent_v2';
const MIN_PEOPLE = 1;
const MAX_PEOPLE = 20;

let cart: CartItem[] = [];
let loadPromise: Promise<void> | null = null;
const listeners = new Set<(c: CartItem[]) => void>();

const isValidCartItem = (item: any): item is CartItem => {
  return item
    && typeof item.recipeId === 'string'
    && typeof item.recipeTitle === 'string'
    && typeof item.basePeople === 'number' && item.basePeople > 0
    && typeof item.currentPeople === 'number' && item.currentPeople > 0
    && Array.isArray(item.baseIngredients);
};

const clampPeople = (n: number) => Math.max(MIN_PEOPLE, Math.min(MAX_PEOPLE, Math.round(n)));

const emit = () => {
  listeners.forEach((l) => l(cart));
};

const commit = (next: CartItem[]) => {
  cart = next;
  emit();
  AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)).catch(() => {});
};

export const loadCart = (): Promise<void> => {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const saved = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.every(isValidCartItem)) {
            cart = parsed;
          }
        }
      } catch (e) {}
      emit();
    })();
  }
  return loadPromise;
};

export const getDefaultPeople = async (fallback: number): Promise<number> => {
  try {
    const saved = await AsyncStorage.getItem('defaultPeople');
    const n = saved ? parseInt(saved, 10) : NaN;
    return n > 0 ? clampPeople(n) : clampPeople(fallback);
  } catch (e) {
    return clampPeople(fallback);
  }
};

export const cartStore = {
  get: () => cart,

  has: (recipeId: string) => cart.some((i) => i.recipeId === recipeId),

  getItem: (recipeId: string) => cart.find((i) => i.recipeId === recipeId) || null,

  add: async (item: CartItem): Promise<boolean> => {
    await loadCart();
    if (cart.some((i) => i.recipeId === item.recipeId)) return false;
    commit([...cart, { ...item, currentPeople: clampPeople(item.currentPeople) }]);
    return true;
  },

  setPeople: async (recipeId: string, people: number) => {
    await loadCart();
    commit(cart.map((i) => (i.recipeId === recipeId ? { ...i, currentPeople: clampPeople(people) } : i)));
  },

  updatePeople: async (recipeId: string, delta: number) => {
    await loadCart();
    commit(cart.map((i) => (i.recipeId === recipeId ? { ...i, currentPeople: clampPeople(i.currentPeople + delta) } : i)));
  },

  remove: async (recipeId: string) => {
    await loadCart();
    commit(cart.filter((i) => i.recipeId !== recipeId));
  },

  clear: async () => {
    await loadCart();
    commit([]);
  },
};

export function useCart(): CartItem[] {
  const [state, setState] = useState<CartItem[]>(cart);
  useEffect(() => {
    const listener = (c: CartItem[]) => setState(c);
    listeners.add(listener);
    loadCart();
    setState(cart);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}

export const consolidateCart = (items: CartItem[]): Ingredient[] => {
  const map = new Map<string, Ingredient>();
  items.forEach((item) => {
    const scale = item.currentPeople / item.basePeople;
    item.baseIngredients.forEach((ing) => {
      const key = `${ing.name.trim().toLowerCase()}__${(ing.unit || '').trim().toLowerCase()}`;
      const scaledAmount = ing.amount !== null && ing.amount !== undefined ? ing.amount * scale : null;
      const existing = map.get(key);
      if (existing) {
        if (existing.amount !== null && existing.amount !== undefined && scaledAmount !== null) {
          existing.amount = existing.amount + scaledAmount;
        }
      } else {
        map.set(key, { name: ing.name, unit: ing.unit, amount: scaledAmount });
      }
    });
  });
  return Array.from(map.values());
};
