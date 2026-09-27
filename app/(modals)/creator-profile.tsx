import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, FlatList, Linking, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Image } from 'expo-image';
import { formatCount, RecipeGridTile } from '../../components/RecipeTile';
import { openRecipe } from '../../lib/openRecipe';
import { DbRecipe, supabase } from '../../lib/supabase';

// Profil créateur façon TikTok : en-tête (avatar, stats, réseaux) + grille 3 colonnes.

const ACCENT = '#00C896';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const BORDER = '#EFEFEF';

const GAP = 2;
const COLS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = Math.floor((SCREEN_WIDTH - GAP * (COLS - 1)) / COLS);

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

type Creator = {
  id: string; handle: string; name: string;
  avatar_letters: string; avatar_color: string;
  avatar_url?: string | null;
  bio: string | null;
  is_partner?: boolean;
  tiktok_url: string | null; instagram_url: string | null;
  tiktok_followers: string | null; instagram_followers: string | null;
};

const IconBack = ({ color = TEXT_DARK, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconCheck = ({ color = '#FFFFFF', size = 12 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconGrid = ({ color = TEXT_DARK, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2"/>
    <Rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2"/>
    <Rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2"/>
    <Rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2"/>
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
        width: size, height: size, borderWidth: 3, borderRadius: size / 2,
        borderColor: baseColor, borderTopColor: color,
        transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
};

const Stat = ({ value, label }: { value: string; label: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statVal}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function CreatorProfileScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const creatorId = (params.id as string) || '';

  const [creator, setCreator] = useState<Creator | null>(null);
  const [recipes, setRecipes] = useState<DbRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!creatorId) { setLoading(false); return; }
    const { data: creatorData } = await supabase.from('creators').select('*').eq('id', creatorId).single();
    if (creatorData) setCreator(creatorData as Creator);
    const { data: recipesData } = await supabase
      .from('recipes').select('*')
      .eq('creator_id', creatorId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (recipesData) setRecipes(recipesData as DbRecipe[]);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadData(); }, [creatorId]));

  const totalLikes = useMemo(
    () => recipes.reduce((sum, r) => sum + (r.likes_count || 0), 0),
    [recipes],
  );

  const openLink = (url: string | null) => {
    if (!url) return;
    haptic();
    Linking.openURL(url).catch(() => {});
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Spinner size={36} />
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={[styles.center, { padding: 32 }]}>
        <Text style={styles.errorText}>Créateur introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
          <Text style={styles.errorBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const followers = creator.tiktok_followers || creator.instagram_followers;

  const Header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: creator.avatar_color || ACCENT }]}>
            {creator.avatar_url ? (
              <Image source={{ uri: creator.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <Text style={styles.avatarText}>{creator.avatar_letters}</Text>
            )}
          </View>
          {creator.is_partner && (
            <View style={styles.verified}>
              <IconCheck size={11} />
            </View>
          )}
        </View>

        <Text style={styles.name}>{creator.name}</Text>
        <Text style={styles.handle}>@{creator.handle}</Text>

        <View style={styles.statsRow}>
          <Stat value={String(recipes.length)} label="Recettes" />
          <View style={styles.statSep} />
          <Stat value={formatCount(totalLikes)} label="J'aime" />
          {!!followers && (
            <>
              <View style={styles.statSep} />
              <Stat value={followers} label="Abonnés" />
            </>
          )}
        </View>

        {!!creator.bio && <Text style={styles.bio}>{creator.bio}</Text>}

        {(!!creator.tiktok_url || !!creator.instagram_url) && (
          <View style={styles.socialRow}>
            {!!creator.tiktok_url && (
              <TouchableOpacity style={styles.socialBtn} onPress={() => openLink(creator.tiktok_url)} activeOpacity={0.8}>
                <IconTikTok size={15} />
                <Text style={styles.socialText}>TikTok</Text>
              </TouchableOpacity>
            )}
            {!!creator.instagram_url && (
              <TouchableOpacity style={styles.socialBtn} onPress={() => openLink(creator.instagram_url)} activeOpacity={0.8}>
                <IconInsta size={15} />
                <Text style={styles.socialText}>Instagram</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        <View style={styles.tabActive}>
          <IconGrid size={18} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <IconBack />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{creator.name}</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune recette publiée pour l'instant</Text>
        }
        renderItem={({ item }) => (
          <RecipeGridTile
            recipe={item}
            width={TILE_WIDTH}
            onPress={() => { haptic(); openRecipe(item, creator.name); }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  errorText: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginBottom: 16 },
  errorBtn: { backgroundColor: ACCENT, borderRadius: 100, paddingHorizontal: 22, paddingVertical: 12 },
  errorBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginHorizontal: 8 },

  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { fontSize: 32, fontWeight: '900', color: '#FFFFFF' },
  verified: {
    position: 'absolute', right: 2, bottom: 2,
    width: 26, height: 26, borderRadius: 13, backgroundColor: ACCENT,
    borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 20, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.4 },
  handle: { fontSize: 14, fontWeight: '600', color: TEXT_GRAY, marginTop: 2 },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  stat: { alignItems: 'center', minWidth: 78 },
  statVal: { fontSize: 18, fontWeight: '900', color: TEXT_DARK },
  statLabel: { fontSize: 12, fontWeight: '500', color: TEXT_GRAY, marginTop: 2 },
  statSep: { width: 1, height: 18, backgroundColor: BORDER, marginHorizontal: 6 },

  bio: { fontSize: 13, color: TEXT_DARK, textAlign: 'center', lineHeight: 19, marginTop: 14 },

  socialRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, height: 38, borderRadius: 8, backgroundColor: '#F2F2F2',
  },
  socialText: { fontSize: 13, fontWeight: '800', color: TEXT_DARK },

  tabBar: { flexDirection: 'row', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: GAP },
  tabActive: { paddingVertical: 10, paddingHorizontal: 40, borderBottomWidth: 2, borderBottomColor: TEXT_DARK },

  empty: { textAlign: 'center', color: TEXT_GRAY, fontSize: 13, paddingVertical: 40 },
});
