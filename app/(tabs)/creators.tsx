import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { formatCount } from '../../components/RecipeTile';
import { supabase } from '../../lib/supabase';

// Page Créateurs : partenaires en grandes cartes + « Créateurs du moment » avec aperçu de leurs vidéos.

const ACCENT = '#00C896';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';
const TRENDING_COUNT = 10;
const PARTNER_CARD_W = 150;
const PARTNER_CARD_H = 230;
const MINI_THUMB = 64;

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

type Creator = {
  id: string;
  handle: string;
  name: string;
  avatar_letters: string;
  avatar_color: string;
  avatar_url: string | null;
  is_partner: boolean;
  total_likes: number;
  recipe_count: number;
  thumbs: string[];
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

const IconCheck = ({ color = '#FFFFFF', size = 10 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconChevron = ({ color = TEXT_LIGHT, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const Spinner = ({ size = 28, color = ACCENT, baseColor = '#F0F0F0' }: { size?: number; color?: string; baseColor?: string }) => {
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

const Avatar = ({ creator, size, verified }: { creator: Creator; size: number; verified?: boolean }) => (
  <View style={{ width: size, height: size }}>
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: creator.avatar_color }]}>
      {creator.avatar_url ? (
        <Image source={{ uri: creator.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{creator.avatar_letters}</Text>
      )}
    </View>
    {verified && (
      <View style={[styles.verified, { width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19 }]}>
        <IconCheck size={size * 0.2} />
      </View>
    )}
  </View>
);

const recipesLabel = (n: number) => (n === 0 ? 'Aucune recette' : n === 1 ? '1 recette' : `${n} recettes`);

const PartnerCard = ({ creator, onPress }: { creator: Creator; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.partnerCard, { opacity: pressed ? 0.85 : 1 }]}>
    {/* Fond de la carte : photo du créateur, sinon sa dernière vidéo, sinon sa couleur */}
    {creator.avatar_url || creator.thumbs[0] ? (
      <Image
        source={{ uri: (creator.avatar_url || creator.thumbs[0]) as string }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
      />
    ) : (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: creator.avatar_color }]} />
    )}
    <View style={styles.partnerShade} pointerEvents="none">
      <View style={[styles.shadeBand, { opacity: 0.1 }]} />
      <View style={[styles.shadeBand, { opacity: 0.3 }]} />
      <View style={[styles.shadeBand, { opacity: 0.55 }]} />
      <View style={[styles.shadeBand, { opacity: 0.7 }]} />
    </View>
    <View style={styles.partnerInfo} pointerEvents="none">
      <View style={styles.partnerAvatarRing}>
        <Avatar creator={creator} size={40} verified />
      </View>
      <Text style={styles.partnerName} numberOfLines={1}>{creator.name}</Text>
      <Text style={styles.partnerMeta} numberOfLines={1}>
        {recipesLabel(creator.recipe_count)} · {formatCount(creator.total_likes)} j'aime
      </Text>
      <View style={styles.partnerCta}>
        <Text style={styles.partnerCtaText}>Voir le profil</Text>
      </View>
    </View>
  </Pressable>
);

const CreatorRow = ({ creator, rank, onPress }: { creator: Creator; rank?: number; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
    <View style={styles.rowTop}>
      {typeof rank === 'number' && <Text style={styles.rank}>{rank}</Text>}
      <Avatar creator={creator} size={44} verified={creator.is_partner} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{creator.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          @{creator.handle} · {recipesLabel(creator.recipe_count)} · {formatCount(creator.total_likes)} j'aime
        </Text>
      </View>
      <IconChevron />
    </View>
    {creator.thumbs.length > 0 && (
      <View style={styles.thumbRow}>
        {creator.thumbs.slice(0, 3).map((uri, i) => (
          <Image key={i} source={{ uri }} style={styles.miniThumb} contentFit="cover" cachePolicy="memory-disk" transition={150} />
        ))}
      </View>
    )}
  </Pressable>
);

export default function CreatorsScreen() {
  const insets = useSafeAreaInsets();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadCreators = async () => {
    const { data: creatorsData, error } = await supabase
      .from('creators')
      .select('*');
    if (error || !creatorsData) {
      setLoading(false);
      return;
    }

    const { data: recipesData } = await supabase
      .from('recipes')
      .select('creator_id, likes_count, thumbnail_url, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    const stats: { [id: string]: { likes: number; count: number; thumbs: string[] } } = {};
    (recipesData || []).forEach((r: any) => {
      if (!r.creator_id) return;
      const s = stats[r.creator_id] || (stats[r.creator_id] = { likes: 0, count: 0, thumbs: [] });
      s.likes += r.likes_count || 0;
      s.count += 1;
      if (r.thumbnail_url && s.thumbs.length < 3) s.thumbs.push(r.thumbnail_url);
    });

    setCreators(creatorsData.map((c: any) => ({
      id: c.id,
      handle: c.handle,
      name: c.name,
      avatar_letters: c.avatar_letters,
      avatar_color: c.avatar_color || ACCENT,
      avatar_url: c.avatar_url || null,
      is_partner: !!c.is_partner,
      total_likes: stats[c.id]?.likes || 0,
      recipe_count: stats[c.id]?.count || 0,
      thumbs: stats[c.id]?.thumbs || [],
    })));
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadCreators(); }, []));

  const goToCreator = (creator: Creator) => {
    haptic();
    router.push({ pathname: '/(modals)/creator-profile' as any, params: { id: creator.id } });
  };

  const partners = useMemo(
    () => creators.filter(c => c.is_partner).sort((a, b) => b.total_likes - a.total_likes),
    [creators],
  );

  const trending = useMemo(
    () => creators
      .filter(c => !c.is_partner && c.recipe_count > 0)
      .sort((a, b) => b.total_likes - a.total_likes)
      .slice(0, TRENDING_COUNT),
    [creators],
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return creators
      .filter(c => c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.is_partner !== b.is_partner) return a.is_partner ? -1 : 1;
        return b.total_likes - a.total_likes;
      });
  }, [search, creators]);

  const isSearching = search.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>Créateurs</Text>
        <View style={styles.searchBar}>
          <IconSearch color={TEXT_GRAY} size={17} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un créateur…"
            placeholderTextColor={TEXT_LIGHT}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={styles.clearBtn}>
                <IconClose color="#FFFFFF" size={10} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <Spinner size={28} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          {isSearching ? (
            searchResults.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Aucun créateur trouvé</Text>
                <Text style={styles.emptySub}>Essaie un autre nom</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {searchResults.map(c => (
                  <CreatorRow key={c.id} creator={c} onPress={() => goToCreator(c)} />
                ))}
              </View>
            )
          ) : (
            <>
              {partners.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Partenaires FeedMe</Text>
                  <Text style={styles.sectionSub}>Les chefs officiellement présents sur l'app</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partnersScroll}>
                    {partners.map(c => (
                      <PartnerCard key={c.id} creator={c} onPress={() => goToCreator(c)} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {trending.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Créateurs du moment</Text>
                  <Text style={styles.sectionSub}>Les plus likés de la communauté</Text>
                  <View style={styles.list}>
                    {trending.map((c, i) => (
                      <CreatorRow key={c.id} creator={c} rank={i + 1} onPress={() => goToCreator(c)} />
                    ))}
                  </View>
                </View>
              )}

              {partners.length === 0 && trending.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Aucun créateur pour l'instant</Text>
                  <Text style={styles.emptySub}>Reviens bientôt !</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  title: { fontSize: 32, fontWeight: '900', color: TEXT_DARK, letterSpacing: -1, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F5F5F5', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, padding: 0 },
  clearBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#C7C7C7', alignItems: 'center', justifyContent: 'center' },

  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  scrollContent: { paddingBottom: 120 },

  section: { paddingTop: 22 },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.4, paddingHorizontal: 20 },
  sectionSub: { fontSize: 13, color: TEXT_GRAY, marginTop: 3, marginBottom: 14, paddingHorizontal: 20 },

  partnersScroll: { gap: 10, paddingHorizontal: 20 },
  partnerCard: {
    width: PARTNER_CARD_W, height: PARTNER_CARD_H, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#1A1A1A', position: 'relative',
  },
  partnerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: PARTNER_CARD_H * 0.6 },
  shadeBand: { flex: 1, backgroundColor: '#000000' },
  partnerInfo: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  partnerAvatarRing: { alignSelf: 'flex-start', borderRadius: 24, borderWidth: 2, borderColor: '#FFFFFF', marginBottom: 8 },
  partnerName: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  partnerMeta: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  partnerCta: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  partnerCtaText: { fontSize: 11, fontWeight: '800', color: TEXT_DARK },

  list: { paddingHorizontal: 20 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 18, fontSize: 15, fontWeight: '900', color: TEXT_LIGHT, textAlign: 'center' },
  rowName: { fontSize: 15, fontWeight: '800', color: TEXT_DARK },
  rowMeta: { fontSize: 12, color: TEXT_GRAY, marginTop: 2 },
  thumbRow: { flexDirection: 'row', gap: 6, marginTop: 10, paddingLeft: 30 + 44 - 18 },
  miniThumb: { width: MINI_THUMB, height: Math.round(MINI_THUMB * 1.33), borderRadius: 8, backgroundColor: '#F0F0F0' },

  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { fontWeight: '900', color: '#FFFFFF' },
  verified: {
    position: 'absolute', right: -2, bottom: -2, backgroundColor: ACCENT,
    borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },

  emptyBox: { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginBottom: 6 },
  emptySub: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center' },
});
