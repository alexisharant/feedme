import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, Linking, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { DbRecipe, supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
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

const Spinner = ({ size = 30, color = ACCENT, baseColor = '#F0F0F0' }: { size?: number; color?: string; baseColor?: string }) => {
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
        borderWidth: 3, borderRadius: size / 2,
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

const IconHeart = ({ color = HEART, size = 11 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
  </Svg>
);

const IconTikTok = ({ color = TEXT_DARK, size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43V8.55a8.16 8.16 0 004.77 1.52V6.62a4.85 4.85 0 01-1.84-.04z"/>
  </Svg>
);

const IconInsta = ({ color = TEXT_DARK, size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" stroke={color} strokeWidth="1.8"/>
    <Path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5z" stroke={color} strokeWidth="1.8"/>
    <Path d="M17.5 6.5h.01" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
  </Svg>
);

type Creator = {
  id: string; handle: string; name: string;
  avatar_letters: string; avatar_color: string;
  bio: string | null;
  tiktok_url: string | null; instagram_url: string | null;
  tiktok_followers: string | null; instagram_followers: string | null;
};

export default function CreatorProfileScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const creatorId = (params.id as string) || '';

  const [creator, setCreator] = useState<Creator | null>(null);
  const [recipes, setRecipes] = useState<DbRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbLoading, setThumbLoading] = useState<{ [key: string]: boolean }>({});

  const loadData = async () => {
    if (!creatorId) { setLoading(false); return; }
    const { data: creatorData } = await supabase.from('creators').select('*').eq('id', creatorId).single();
    if (creatorData) setCreator(creatorData as Creator);
    const { data: recipesData } = await supabase
      .from('recipes').select('*')
      .eq('creator_id', creatorId)
      .eq('status', 'approved')
      .order('likes_count', { ascending: false });
    if (recipesData) {
      setRecipes(recipesData as DbRecipe[]);
      const loadMap: { [key: string]: boolean } = {};
      recipesData.forEach((r: any) => { loadMap[r.id] = true; });
      setThumbLoading(loadMap);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadData(); }, [creatorId]));

  const openRecipe = (recipe: DbRecipe) => {
    haptic();
    router.push({
      pathname: '/(modals)/recipe' as any,
      params: {
        id: recipe.id,
        basePeople: String(recipe.base_people || ''),
        title: recipe.title, creator: creator?.name || '',
        time: recipe.time, people: recipe.people, price: recipe.price,
        thumbnail: recipe.thumbnail_url,
        ingredients: JSON.stringify(recipe.ingredients),
        instaUrl: recipe.insta_url || '',
      },
    });
  };

  const openTikTok = () => { haptic(); if (creator?.tiktok_url) Linking.openURL(creator.tiktok_url).catch(() => {}); };
  const openInstagram = () => { haptic(); if (creator?.instagram_url) Linking.openURL(creator.instagram_url).catch(() => {}); };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size={36} color={ACCENT} baseColor="#F0F0F0" />
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={styles.errorText}>Créateur introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonError}>
          <Text style={styles.backButtonErrorText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <IconBack color={TEXT_DARK} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroBlock}>
          <View style={[styles.bigAvatar, { backgroundColor: creator.avatar_color }]}>
            <Text style={styles.bigAvatarText}>{creator.avatar_letters}</Text>
          </View>
          <Text style={styles.creatorName}>{creator.name}</Text>
          <Text style={styles.creatorHandle}>@{creator.handle}</Text>
          {!!creator.bio && <Text style={styles.creatorBio}>{creator.bio}</Text>}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{creator.tiktok_followers || '0'}</Text>
            <Text style={styles.statLabel}>TikTok</Text>
          </View>
          <View style={styles.statSeparator} />
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{creator.instagram_followers || '0'}</Text>
            <Text style={styles.statLabel}>Instagram</Text>
          </View>
          <View style={styles.statSeparator} />
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{recipes.length}</Text>
            <Text style={styles.statLabel}>Recettes</Text>
          </View>
        </View>

        <View style={styles.socialRow}>
          {!!creator.tiktok_url && (
            <TouchableOpacity style={styles.socialBtn} onPress={openTikTok} activeOpacity={0.85}>
              <IconTikTok color={TEXT_DARK} size={15} />
              <Text style={styles.socialBtnText}>TikTok</Text>
            </TouchableOpacity>
          )}
          {!!creator.instagram_url && (
            <TouchableOpacity style={styles.socialBtn} onPress={openInstagram} activeOpacity={0.85}>
              <IconInsta color={TEXT_DARK} size={15} />
              <Text style={styles.socialBtnText}>Instagram</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.recipesSection}>
          <Text style={styles.sectionTitle}>Ses recettes</Text>
          {recipes.length === 0 ? (
            <Text style={styles.emptyRecipes}>Aucune recette publiée pour l'instant</Text>
          ) : (
            recipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeRow}
                onPress={() => openRecipe(recipe)}
                activeOpacity={0.8}
              >
                <View style={styles.thumbWrap}>
                  <Image
                    source={{ uri: recipe.thumbnail_url }}
                    style={styles.thumb}
                    onLoadEnd={() => setThumbLoading(prev => ({ ...prev, [recipe.id]: false }))}
                  />
                  {thumbLoading[recipe.id] && (
                    <View style={styles.thumbSpinner}>
                      <Spinner size={20} />
                    </View>
                  )}
                </View>
                <View style={styles.recipeBody}>
                  <Text style={styles.recipeName} numberOfLines={2}>{recipe.title}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{recipe.time}</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.metaText}>{recipe.price}</Text>
                    <View style={styles.metaDot} />
                    <IconHeart color={TEXT_GRAY} size={10} />
                    <Text style={[styles.metaText, { marginLeft: 2 }]}>{formatLikes(recipe.likes_count)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerBar: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBlock: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  bigAvatar: {
    width: 92, height: 92, borderRadius: 46,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  bigAvatarText: { fontSize: 30, fontWeight: '900', color: '#FFFFFF' },
  creatorName: { fontSize: 24, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.7 },
  creatorHandle: { fontSize: 13, fontWeight: '700', color: ACCENT, marginTop: 2 },
  creatorBio: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center', marginTop: 10, paddingHorizontal: 24, lineHeight: 18 },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 18, marginBottom: 14,
    paddingVertical: 14, alignItems: 'center',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 17, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, fontWeight: '700' },
  statSeparator: { width: 1, height: 28, backgroundColor: BORDER },
  socialRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 24 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#F5F5F5',
    borderRadius: 100, padding: 12,
  },
  socialBtnText: { fontSize: 13, fontWeight: '700', color: TEXT_DARK },
  recipesSection: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 },
  recipeRow: {
    backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER, marginBottom: 10,
  },
  thumbWrap: { width: 76, height: 76, position: 'relative', backgroundColor: '#F5F5F5' },
  thumb: { width: 76, height: 76 },
  thumbSpinner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  recipeBody: { flex: 1, padding: 12 },
  recipeName: { fontSize: 14, fontWeight: '800', color: TEXT_DARK, letterSpacing: -0.3, lineHeight: 18, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, color: TEXT_GRAY, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: TEXT_LIGHT },
  emptyRecipes: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center', paddingVertical: 24 },
  errorText: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginBottom: 16 },
  backButtonError: { backgroundColor: ACCENT, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 12 },
  backButtonErrorText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
