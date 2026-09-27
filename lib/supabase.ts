import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://khrjuidyqcizedjlivlt.supabase.co';
const supabaseAnonKey = 'sb_publishable_kbn7y5ECYuEK1WBLMpBXTA_w_DSC230';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    await AsyncStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch (e) { return null; }
}

export async function migrateDeviceLikesToUser(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    const deviceId = await getDeviceId();
    await supabase
      .from('likes')
      .update({ user_id: userId, device_id: null })
      .eq('device_id', deviceId)
      .is('user_id', null);
  } catch (e) {
    console.log('Migration error:', e);
  }
}

export type Ingredient = {
  name: string;
  amount: number | null;
  unit: string | null;
};

export type DbCreator = {
  id: string;
  handle: string;
  name: string;
  avatar_letters: string;
  avatar_color: string;
  avatar_url?: string | null;
  bio: string | null;
  tiktok_url: string | null;
  instagram_url: string | null;
  tiktok_followers: string | null;
  instagram_followers: string | null;
};

export type DbRecipe = {
  id: string;
  creator_id: string;
  title: string;
  video_url: string;
  thumbnail_url: string;
  insta_url: string | null;
  time: string;
  people: string;
  base_people: number;
  price: string;
  price_num: number;
  category: string;
  is_vegetarian: boolean;
  is_pescatarian: boolean;
  is_gluten_free: boolean;
  ingredients: Ingredient[];
  likes_count: number;
  creators?: DbCreator;
};

export const formatAmount = (amount: number, unit: string | null): string => {
  if (!unit) return Math.max(1, Math.round(amount)).toString();
  if ((unit === 'g' || unit === 'ml') && amount >= 50) {
    return (Math.round(amount / 10) * 10).toString();
  }
  if (unit === 'g' || unit === 'ml') return Math.round(amount).toString();
  if (unit === 'cl' || unit === 'l' || unit === 'kg') {
    return amount % 1 === 0 ? amount.toString() : amount.toFixed(1);
  }
  return Math.max(1, Math.round(amount)).toString();
};

export const formatIngredient = (ing: Ingredient, factor: number = 1): string => {
  if (ing.amount === null || ing.amount === undefined) {
    return ing.name;
  }
  const adjusted = ing.amount * factor;
  const formatted = formatAmount(adjusted, ing.unit);
  if (ing.unit) {
    return `${formatted} ${ing.unit} · ${ing.name}`;
  }
  return `${formatted} · ${ing.name}`;
};