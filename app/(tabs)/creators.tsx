import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';

const SUGGESTIONS_COUNT = 10;

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

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

const IconSearch = ({ color = TEXT_GRAY, size = 17 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" fill="none"/>
    <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </Svg>
);

const IconClose = ({ color = '#FFFFFF', size = 10 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.6" strokeLinecap="round"/>
  </Svg>
);

const IconCheck = ({ color = '#FFFFFF', size = 10 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

type Creator = {
  id: string;
  handle: string;
  name: string;
  avatar_letters: string;
  avatar_color: string;
  is_partner: boolean;
  total_likes: number;
};

const VerifiedBadge = ({ size = 18 }: { size?: number }) => (
  <View style={[styles.verifiedBadge, { width: size, height: size, borderRadius: size / 2 }]}>
    <IconCheck color="#FFFFFF" size={size * 0.6} />
  </View>
);

export default function CreatorsScreen() {
  const insets = useSafeAreaInsets();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadCreators = async () => {
    const { data: creatorsData, error } = await supabase
      .from('creators')
      .select('id, handle, name, avatar_letters, avatar_color, is_partner');

    if (error || !creatorsData) {
      setLoading(false);
      return;
    }

    const { data: recipesData } = await supabase
      .from('recipes')
      .select('creator_id, likes_count')
      .eq('status', 'approved');

    const likesByCreator: { [key: string]: number } = {};
    (recipesData || []).forEach((r: any) => {
      if (r.creator_id) {
        likesByCreator[r.creator_id] = (likesByCreator[r.creator_id] || 0) + (r.likes_count || 0);
      }
    });

    const enriched: Creator[] = creatorsData.map((c: any) => ({
      id: c.id,
      handle: c.handle,
      name: c.name,
      avatar_letters: c.avatar_letters,
      avatar_color: c.avatar_color || ACCENT,
      is_partner: !!c.is_partner,
      total_likes: likesByCreator[c.id] || 0,
    }));

    setCreators(enriched);
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

  const suggestions = useMemo(
    () => creators
      .filter(c => !c.is_partner)
      .sort((a, b) => b.total_likes - a.total_likes)
      .slice(0, SUGGESTIONS_COUNT),
    [creators],
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return creators
      .filter(c => c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.is_partner && !b.is_partner) return -1;
        if (!a.is_partner && b.is_partner) return 1;
        return b.total_likes - a.total_likes;
      });
  }, [search, creators]);

  const isSearching = search.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>Créateurs</Text>
        <Text style={styles.subtitle}>Les chefs qui font saliver ta TL</Text>

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
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loadingBox}>
          <Spinner size={28} />
        </View>
      ) : isSearching ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {searchResults.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Aucun créateur trouvé</Text>
              <Text style={styles.emptySub}>Essaie un autre nom</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {searchResults.map((creator) => (
                <TouchableOpacity
                  key={creator.id}
                  style={styles.listRow}
                  onPress={() => goToCreator(creator)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatarSmall, { backgroundColor: creator.avatar_color }]}>
                    <Text style={styles.avatarSmallText}>{creator.avatar_letters}</Text>
                    {creator.is_partner && (
                      <View style={styles.verifiedBadgeSmall}>
                        <IconCheck color="#FFFFFF" size={8} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.listName} numberOfLines={1}>{creator.name}</Text>
                      {creator.is_partner && (
                        <View style={styles.partnerTag}>
                          <Text style={styles.partnerTagText}>Partenaire</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.listHandle} numberOfLines={1}>@{creator.handle}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {partners.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Créateurs partenaires</Text>
                <View style={styles.partnerCountBadge}>
                  <Text style={styles.partnerCountText}>{partners.length}</Text>
                </View>
              </View>
              <Text style={styles.sectionSub}>Les chefs officiellement présents sur FeedMe</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.partnersScroll}
              >
                {partners.map((creator) => (
                  <TouchableOpacity
                    key={creator.id}
                    style={styles.partnerCard}
                    onPress={() => goToCreator(creator)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.partnerAvatarWrap}>
                      <View style={[styles.partnerAvatar, { backgroundColor: creator.avatar_color }]}>
                        <Text style={styles.partnerAvatarText}>{creator.avatar_letters}</Text>
                      </View>
                      <VerifiedBadge size={22} />
                    </View>
                    <Text style={styles.partnerName} numberOfLines={1}>{creator.name}</Text>
                    <Text style={styles.partnerHandle} numberOfLines={1}>@{creator.handle}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggestions pour toi</Text>
              <Text style={styles.sectionSub}>Les créateurs montants de la communauté</Text>

              <View style={styles.list}>
                {suggestions.map((creator) => (
                  <TouchableOpacity
                    key={creator.id}
                    style={styles.listRow}
                    onPress={() => goToCreator(creator)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatarSmall, { backgroundColor: creator.avatar_color }]}>
                      <Text style={styles.avatarSmallText}>{creator.avatar_letters}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listName} numberOfLines={1}>{creator.name}</Text>
                      <Text style={styles.listHandle} numberOfLines={1}>@{creator.handle}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {partners.length === 0 && suggestions.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Aucun créateur pour l'instant</Text>
              <Text style={styles.emptySub}>Reviens bientôt !</Text>
            </View>
          )}

          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonTitle}>Tu cherches quelqu'un en particulier ?</Text>
            <Text style={styles.comingSoonDesc}>Utilise la barre de recherche en haut pour trouver{'\n'}n'importe quel créateur sur FeedMe</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#FFFFFF' },
  title: { fontSize: 32, fontWeight: '900', color: TEXT_DARK, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: TEXT_GRAY, marginTop: 4, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 100,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, padding: 0 },
  clearBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#C7C7C7', alignItems: 'center', justifyContent: 'center' },

  divider: { height: 1, backgroundColor: BORDER },
  scrollContent: { paddingBottom: 120 },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { paddingVertical: 40, paddingHorizontal: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center' },

  section: { marginTop: 22 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.4 },
  partnerCountBadge: { backgroundColor: ACCENT_BG, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  partnerCountText: { fontSize: 11, fontWeight: '800', color: ACCENT },
  sectionSub: { fontSize: 12, color: TEXT_GRAY, paddingHorizontal: 20, marginTop: 2, marginBottom: 14 },

  partnersScroll: { paddingHorizontal: 16, gap: 4 },
  partnerCard: { width: 92, alignItems: 'center', paddingHorizontal: 4 },
  partnerAvatarWrap: { position: 'relative', marginBottom: 8 },
  partnerAvatar: {
    width: 78, height: 78, borderRadius: 39,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: ACCENT,
  },
  partnerAvatarText: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  verifiedBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFFFFF',
  },
  partnerName: { fontSize: 12, fontWeight: '800', color: TEXT_DARK, textAlign: 'center', letterSpacing: -0.2 },
  partnerHandle: { fontSize: 10, fontWeight: '600', color: ACCENT, textAlign: 'center', marginTop: 1 },

  list: { paddingHorizontal: 16 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  avatarSmall: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarSmallText: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  verifiedBadgeSmall: {
    position: 'absolute', bottom: -1, right: -1,
    width: 17, height: 17, borderRadius: 8.5,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listName: { fontSize: 14, fontWeight: '800', color: TEXT_DARK, letterSpacing: -0.3 },
  listHandle: { fontSize: 12, fontWeight: '500', color: TEXT_GRAY, marginTop: 1 },
  partnerTag: { backgroundColor: ACCENT_BG, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  partnerTagText: { fontSize: 9, fontWeight: '800', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.3 },

  comingSoon: {
    marginHorizontal: 16,
    backgroundColor: '#FAFAFA', borderRadius: 18, padding: 22, alignItems: 'center',
    borderWidth: 1, borderColor: BORDER, marginTop: 28,
  },
  comingSoonTitle: { fontSize: 14, fontWeight: '800', color: TEXT_DARK, marginBottom: 6 },
  comingSoonDesc: { fontSize: 12, color: TEXT_GRAY, textAlign: 'center', lineHeight: 18 },
});
