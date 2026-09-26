import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, FlatList, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { RecipeCard } from '../../components/RecipeTile';
import { openRecipe } from '../../lib/openRecipe';
import { DbRecipe, supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';

const H_PADDING = 14;
const COL_GAP = 10;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - COL_GAP) / 2);

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
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

  const filtered = useMemo(() => {
    let list = [...allRecipes];
    if (activeCat === 'mostliked') {
      list.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    } else if (activeCat !== 'all') {
      list = list.filter(r => r.category === activeCat);
    }
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.creators?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allRecipes, activeCat, search]);

  const goToRecipe = (recipe: DbRecipe) => {
    haptic();
    openRecipe(recipe);
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
      </View>

      <View style={styles.catsBar}>
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
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <RecipeCard recipe={item} width={CARD_WIDTH} onPress={() => goToRecipe(item)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingBottom: 10, backgroundColor: '#FFFFFF' },
  title: { fontSize: 32, fontWeight: '900', color: TEXT_DARK, letterSpacing: -1, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 100,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, padding: 0 },
  clearBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#C7C7C7', alignItems: 'center', justifyContent: 'center' },
  catsBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: BORDER },
  catsContent: { gap: 8, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  cat: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, height: 34,
    borderRadius: 100, backgroundColor: '#F5F5F5',
  },
  catActive: { backgroundColor: ACCENT },
  catText: { fontSize: 13, fontWeight: '600', color: TEXT_DARK },
  catTextActive: { color: '#FFFFFF', fontWeight: '700' },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginBottom: 6 },
  emptySub: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center' },
  listContent: { paddingHorizontal: H_PADDING, paddingTop: 14, paddingBottom: 120 },
  row: { gap: COL_GAP, marginBottom: 18 },
});
