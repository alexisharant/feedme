import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { DbRecipe, getCurrentUserId, supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';
const HEART = '#FF3B5C';

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

const formatLikes = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return n.toString();
};

const parseTimeMinutes = (time: string): number => {
  if (!time) return 0;
  const hmMatch = time.match(/(\d+)\s*h\s*(\d+)/i);
  if (hmMatch) return parseInt(hmMatch[1]) * 60 + parseInt(hmMatch[2]);
  const hMatch = time.match(/(\d+)\s*h/i);
  if (hMatch) return parseInt(hMatch[1]) * 60;
  const mMatch = time.match(/(\d+)/);
  return mMatch ? parseInt(mMatch[1]) : 0;
};

const parsePeople = (people: string): number => {
  if (!people) return 0;
  const m = people.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
};

const Spinner = ({ size = 22, color = ACCENT, baseColor = '#F0F0F0' }: { size?: number; color?: string; baseColor?: string }) => {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        width: size, height: size, borderWidth: 2.5, borderRadius: size / 2,
        borderColor: baseColor, borderTopColor: color,
        transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
};

const IconBack = ({ color = TEXT_DARK, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconClose = ({ color = '#FFFFFF', size = 10 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.6" strokeLinecap="round"/>
  </Svg>
);

const IconHeart = ({ color = HEART, size = 11 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
  </Svg>
);

const IconHeartOutline = ({ color = TEXT_LIGHT, size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const categories = [
  { id: 'all',      label: 'Tout' },
  { id: 'rapide',   label: 'Rapide' },
  { id: 'budget',   label: 'Petit budget' },
  { id: 'recevoir', label: 'Pour recevoir' },
  { id: 'plaisir',  label: 'Plaisir' },
];

const matchesCategory = (recipe: DbRecipe, cat: string): boolean => {
  if (cat === 'all') return true;
  if (cat === 'rapide') return parseTimeMinutes(recipe.time) > 0 && parseTimeMinutes(recipe.time) <= 30;
  if (cat === 'budget') return (recipe.price_num || 0) > 0 && (recipe.price_num || 0) <= 10;
  if (cat === 'recevoir') return parsePeople(recipe.people) >= 4;
  if (cat === 'plaisir') return recipe.category === 'dessert';
  return true;
};

const FavCard = ({ recipe, onPress, onRemove }: { recipe: DbRecipe; onPress: () => void; onRemove: () => void }) => {
  const [loading, setLoading] = useState(true);
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardTouch} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.thumbWrap}>
          <Image source={{ uri: recipe.thumbnail_url }} style={styles.thumb} onLoadEnd={() => setLoading(false)} />
          {loading && (<View style={styles.thumbSpinner}><Spinner size={20} /></View>)}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardCreator}>{recipe.creators?.name || 'Dricecook'}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{recipe.time}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>{recipe.price}</Text>
            <View style={styles.metaDot} />
            <IconHeart color={TEXT_GRAY} size={10} />
            <Text style={[styles.metaText, { marginLeft: 2 }]}>{formatLikes(recipe.likes_count || 0)}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <IconClose color="#FFFFFF" size={10} />
      </TouchableOpacity>
    </View>
  );
};

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<DbRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [userId, setUserId] = useState<string | null>(null);

  const loadFavorites = async () => {
    setLoading(true);
    const uid = await getCurrentUserId();
    setUserId(uid);

    if (!uid) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('likes')
      .select('recipe_id, created_at, recipes(*, creators(id, handle, name, avatar_letters, avatar_color))')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const recipes = data
        .map((d: any) => d.recipes)
        .filter((r: any) => r != null) as DbRecipe[];
      setFavorites(recipes);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadFavorites(); }, []));

  const removeFavorite = async (recipe: DbRecipe) => {
    if (!userId) return;
    haptic();
    await supabase.from('likes').delete().eq('user_id', userId).eq('recipe_id', recipe.id);
    await supabase
      .from('recipes')
      .update({ likes_count: Math.max(0, (recipe.likes_count || 0) - 1) })
      .eq('id', recipe.id);
    setFavorites(prev => prev.filter(f => f.id !== recipe.id));
  };

  const openRecipe = (recipe: DbRecipe) => {
    haptic();
    router.push({
      pathname: '/(modals)/recipe' as any,
      params: {
        id: recipe.id,
        basePeople: String(recipe.base_people || ''),
        title: recipe.title,
        creator: recipe.creators?.name || '',
        time: recipe.time, people: recipe.people, price: recipe.price,
        thumbnail: recipe.thumbnail_url,
        ingredients: JSON.stringify(recipe.ingredients),
        instaUrl: recipe.insta_url || '',
      },
    });
  };

  const filtered = favorites.filter(r => matchesCategory(r, activeCat));

  if (!loading && !userId) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <IconBack color={TEXT_DARK} size={20} />
          </TouchableOpacity>
          <Text style={styles.title}>Mes favoris</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <IconHeartOutline color={ACCENT} size={36} />
          </View>
          <Text style={styles.emptyTitle}>Connecte-toi pour voir tes favoris</Text>
          <Text style={styles.emptySub}>Sauvegarde tes recettes et retrouve-les{'\n'}sur tous tes appareils</Text>
          <TouchableOpacity
            style={styles.signupBtn}
            onPress={() => { haptic(); router.replace('/(modals)/signup' as any); }}
            activeOpacity={0.85}
          >
            <Text style={styles.signupBtnText}>Créer mon compte</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => { haptic(); router.replace('/(modals)/login' as any); }}
            activeOpacity={0.7}
          >
            <Text style={styles.loginBtnText}>J'ai déjà un compte</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <IconBack color={TEXT_DARK} size={20} />
        </TouchableOpacity>
        <Text style={styles.title}>Mes favoris</Text>
        <View style={{ width: 38 }} />
      </View>

      {favorites.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catsContent}
        >
          {categories.map(cat => {
            const isActive = activeCat === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.cat, isActive && styles.catActive]}
                onPress={() => { haptic(); setActiveCat(cat.id); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.catText, isActive && styles.catTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loadingBox}><Spinner size={28} /></View>
      ) : favorites.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><IconHeartOutline color={TEXT_LIGHT} size={36} /></View>
          <Text style={styles.emptyTitle}>Aucun favori pour l'instant</Text>
          <Text style={styles.emptySub}>Like une recette dans le feed pour la retrouver ici</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aucun favori dans cette catégorie</Text>
          <Text style={styles.emptySub}>Essaie une autre catégorie</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map((fav) => (
            <FavCard
              key={fav.id}
              recipe={fav}
              onPress={() => openRecipe(fav)}
              onRemove={() => removeFavorite(fav)}
            />
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5 },
  catsContent: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  cat: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#F5F5F5' },
  catActive: { backgroundColor: ACCENT },
  catText: { fontSize: 13, fontWeight: '600', color: TEXT_DARK },
  catTextActive: { color: '#FFFFFF', fontWeight: '700' },
  divider: { height: 1, backgroundColor: BORDER },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 0 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 12, position: 'relative' },
  cardTouch: { flexDirection: 'row', alignItems: 'center' },
  thumbWrap: { width: 90, height: 90, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, overflow: 'hidden', backgroundColor: '#F5F5F5', position: 'relative' },
  thumb: { width: 90, height: 90 },
  thumbSpinner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: 12, paddingRight: 36 },
  cardCreator: { fontSize: 11, fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: TEXT_DARK, letterSpacing: -0.3, lineHeight: 18, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, color: TEXT_GRAY, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: TEXT_LIGHT },
  removeBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: TEXT_DARK, marginBottom: 8, textAlign: 'center', letterSpacing: -0.3 },
  emptySub: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  signupBtn: {
    backgroundColor: ACCENT, borderRadius: 100, paddingHorizontal: 28, paddingVertical: 14,
    shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
    marginBottom: 10,
  },
  signupBtnText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  loginBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  loginBtnText: { fontSize: 13, fontWeight: '700', color: ACCENT },
});
