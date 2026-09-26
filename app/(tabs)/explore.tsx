import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { DbRecipe, supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

const formatLikes = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return n.toString();
};

const IconSearch = ({ color = TEXT_GRAY, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" fill="none"/>
    <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </Svg>
);

const IconClose = ({ color = TEXT_GRAY, size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
  </Svg>
);

const IconHeart = ({ color = TEXT_GRAY, size = 12 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
  </Svg>
);

const IconFlame = ({ color = '#FF6B35', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>
  </Svg>
);

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
        width: size, height: size,
        borderWidth: 2.5, borderRadius: size / 2,
        borderColor: baseColor,
        borderTopColor: color,
        transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
};

const categories = [
  { id: 'all',        label: 'Tout' },
  { id: 'mostliked',  label: 'Tendances' },
  { id: 'français',   label: 'Français' },
  { id: 'monde',      label: 'Monde' },
  { id: 'sain',       label: 'Healthy' },
  { id: 'végétarien', label: 'Veggie' },
  { id: 'dessert',    label: 'Dessert' },
];

const RecipeCard = ({ recipe, onPress }: { recipe: DbRecipe; onPress: () => void }) => {
  const [imgLoading, setImgLoading] = useState(true);
  const creatorName = recipe.creators?.name || 'Dricecook';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.thumbWrap}>
        <Image
          source={{ uri: recipe.thumbnail_url }}
          style={styles.thumb}
          onLoadEnd={() => setImgLoading(false)}
        />
        {imgLoading && (
          <View style={styles.thumbSpinner}>
            <Spinner size={22} color={ACCENT} baseColor="#F0F0F0" />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardCreator}>{creatorName}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{recipe.time}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaText}>{recipe.price}</Text>
          <View style={styles.metaDot} />
          <IconHeart color={TEXT_GRAY} size={11} />
          <Text style={[styles.metaText, { marginLeft: 2 }]}>{formatLikes(recipe.likes_count)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [allRecipes, setAllRecipes] = useState<DbRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');

  const loadRecipes = async () => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*, creators(id, handle, name, avatar_letters, avatar_color)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (!error && data) setAllRecipes(data as DbRecipe[]);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadRecipes(); }, []));

  let filtered = [...allRecipes];

  if (activeCat === 'mostliked') {
    filtered = [...filtered].sort((a, b) => b.likes_count - a.likes_count);
  } else if (activeCat !== 'all') {
    filtered = filtered.filter(r => r.category === activeCat);
  }

  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.creators?.name || '').toLowerCase().includes(q)
    );
  }

  const goToRecipe = (recipe: DbRecipe) => {
    haptic();
    router.push({
      pathname: '/(modals)/recipe' as any,
      params: {
        id: recipe.id,
        basePeople: String(recipe.base_people || ''),
        title: recipe.title,
        creator: recipe.creators?.name || '',
        time: recipe.time,
        people: recipe.people,
        price: recipe.price,
        thumbnail: recipe.thumbnail_url,
        ingredients: JSON.stringify(recipe.ingredients),
        instaUrl: recipe.insta_url || '',
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>Explorer</Text>

        <View style={styles.searchBar}>
          <IconSearch color={TEXT_GRAY} size={17} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une recette, un chef…"
            placeholderTextColor={TEXT_LIGHT}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.clearBtn}>
                <IconClose color="#FFFFFF" size={10} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
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
                {cat.id === 'mostliked' && (
                  <IconFlame color={isActive ? '#FFFFFF' : '#FF6B35'} size={13} />
                )}
                <Text style={[styles.catText, isActive && styles.catTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loadingBox}>
          <Spinner size={28} color={ACCENT} baseColor="#F0F0F0" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            {search ? 'Aucun résultat' : 'Aucune recette dans cette catégorie'}
          </Text>
          <Text style={styles.emptySub}>
            {search ? 'Essaie un autre mot-clé' : 'Reviens plus tard !'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onPress={() => goToRecipe(recipe)} />
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#FFFFFF' },
  title: { fontSize: 32, fontWeight: '900', color: TEXT_DARK, letterSpacing: -1, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 100, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, padding: 0 },
  clearBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#C7C7C7', alignItems: 'center', justifyContent: 'center' },
  catsContent: { gap: 8, paddingRight: 12 },
  cat: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 100, backgroundColor: '#F5F5F5',
  },
  catActive: { backgroundColor: ACCENT },
  catText: { fontSize: 13, fontWeight: '600', color: TEXT_DARK },
  catTextActive: { color: '#FFFFFF', fontWeight: '700' },
  divider: { height: 1, backgroundColor: BORDER },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginBottom: 6 },
  emptySub: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  card: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderRadius: 16, overflow: 'hidden', marginBottom: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  thumbWrap: { width: 100, height: 100, position: 'relative', backgroundColor: '#F5F5F5' },
  thumb: { width: 100, height: 100 },
  thumbSpinner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cardCreator: { fontSize: 11, fontWeight: '700', color: TEXT_GRAY, marginBottom: 3, letterSpacing: 0.2, textTransform: 'uppercase' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: TEXT_DARK, letterSpacing: -0.3, lineHeight: 19, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: TEXT_GRAY, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: TEXT_LIGHT },
});
