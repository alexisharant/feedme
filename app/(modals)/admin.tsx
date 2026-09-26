import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { isAdmin } from '../../lib/admin';
import { DbRecipe, formatAmount, Ingredient, supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';
const DANGER = '#FF3B5C';

const haptic = (type: 'light' | 'medium' | 'success' = 'light') => {
  try {
    if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

const displayIngredient = (ing: Ingredient): string => {
  if (ing.amount === null || ing.amount === undefined) return ing.name;
  const formatted = formatAmount(ing.amount, ing.unit);
  if (ing.unit) return `${formatted} ${ing.unit} · ${ing.name}`;
  return `${formatted} · ${ing.name}`;
};

const Spinner = ({ size = 40, color = ACCENT }: { size?: number; color?: string }) => {
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
        borderColor: '#EFEFEF', borderTopColor: color,
        transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
};

const AdminVideo = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
    />
  );
};

const IconBack = ({ color = TEXT_DARK, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconCheck = ({ color = '#FFFFFF', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconClose = ({ color = '#FFFFFF', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
  </Svg>
);

const IconClock = ({ color = TEXT_GRAY, size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 6v6l4 2" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <Path d="M12 22a10 10 0 100-20 10 10 0 000 20z" stroke={color} strokeWidth="1.8" fill="none"/>
  </Svg>
);

const IconPlay = ({ size = 48 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
    <Path d="M8 5v14l11-7z"/>
  </Svg>
);

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [pendingRecipes, setPendingRecipes] = useState<DbRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const load = async () => {
    const adminStatus = await isAdmin();
    if (!adminStatus) {
      Alert.alert('Accès refusé', 'Cette page est réservée aux admins.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    setAuthorized(true);

    const { data, error } = await supabase
      .from('recipes')
      .select('*, creators(id, handle, name, avatar_letters, avatar_color)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error) {
      setPendingRecipes((data || []) as DbRecipe[]);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    setPlayingId(null);
    load();
    return () => setPlayingId(null);
  }, []));

  const playVideo = (recipeId: string) => {
    haptic();
    setPlayingId(recipeId);
  };

  const approveRecipe = async (recipe: DbRecipe) => {
    haptic('success');
    setActionLoading(recipe.id);
    setPlayingId(null);
    const { error } = await supabase
      .from('recipes')
      .update({ status: 'approved' })
      .eq('id', recipe.id);
    setActionLoading(null);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      setPendingRecipes(prev => prev.filter(r => r.id !== recipe.id));
    }
  };

  const rejectRecipe = (recipe: DbRecipe) => {
    Alert.alert(
      'Refuser cette recette ?',
      `"${recipe.title}" ne sera pas publiée.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            haptic('medium');
            setActionLoading(recipe.id);
            setPlayingId(null);
            const { error } = await supabase
              .from('recipes')
              .update({ status: 'rejected' })
              .eq('id', recipe.id);
            setActionLoading(null);
            if (error) {
              Alert.alert('Erreur', error.message);
            } else {
              setPendingRecipes(prev => prev.filter(r => r.id !== recipe.id));
            }
          },
        },
      ],
    );
  };

  const goBack = () => { haptic(); setPlayingId(null); router.back(); };

  if (!authorized && !loading) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <IconBack color={TEXT_DARK} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modération</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <Spinner size={48} color={ACCENT} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : pendingRecipes.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.emptyIcon}>
            <IconCheck color={ACCENT} size={36} />
          </View>
          <Text style={styles.emptyTitle}>Tout est à jour !</Text>
          <Text style={styles.emptySub}>Aucune recette en attente de modération.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.counter}>
            {pendingRecipes.length} recette{pendingRecipes.length > 1 ? 's' : ''} en attente
          </Text>

          {pendingRecipes.map((recipe) => {
            const isActing = actionLoading === recipe.id;
            const isPlaying = playingId === recipe.id;
            const creatorName = recipe.creators?.name || 'Inconnu';
            return (
              <View key={recipe.id} style={styles.card}>
                <View style={styles.videoWrap}>
                  {isPlaying ? (
                    <AdminVideo uri={recipe.video_url} />
                  ) : (
                    <Pressable style={styles.thumbWrap} onPress={() => playVideo(recipe.id)}>
                      {recipe.thumbnail_url ? (
                        <Image source={{ uri: recipe.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.thumb, styles.thumbFallback]} />
                      )}
                      <View style={styles.playOverlay}>
                        <View style={styles.playBtn}>
                          <IconPlay size={28} />
                        </View>
                      </View>
                    </Pressable>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.recipeTitle} numberOfLines={2}>{recipe.title}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{creatorName}</Text>
                    </View>
                    {recipe.time && (
                      <View style={styles.metaPillRow}>
                        <IconClock color={TEXT_GRAY} size={11} />
                        <Text style={styles.metaText}>{recipe.time}</Text>
                      </View>
                    )}
                    {recipe.people && <Text style={styles.metaText}>{recipe.people}</Text>}
                    {recipe.price && <Text style={styles.metaText}>{recipe.price}</Text>}
                  </View>

                  {recipe.category && (
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{recipe.category}</Text>
                    </View>
                  )}

                  {recipe.ingredients && recipe.ingredients.length > 0 && (
                    <View style={styles.ingsBox}>
                      <Text style={styles.ingsTitle}>Ingrédients ({recipe.ingredients.length})</Text>
                      {recipe.ingredients.slice(0, 8).map((ing, i) => (
                        <View key={i} style={styles.ingRow}>
                          <View style={styles.ingDot} />
                          <Text style={styles.ingText}>{displayIngredient(ing)}</Text>
                        </View>
                      ))}
                      {recipe.ingredients.length > 8 && (
                        <Text style={styles.ingMore}>+ {recipe.ingredients.length - 8} autres</Text>
                      )}
                    </View>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => rejectRecipe(recipe)}
                      style={[styles.actionBtn, styles.rejectBtn, isActing && styles.actionBtnDisabled]}
                      disabled={isActing}
                      activeOpacity={0.8}
                    >
                      <IconClose color={DANGER} size={16} />
                      <Text style={styles.rejectText}>Refuser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => approveRecipe(recipe)}
                      style={[styles.actionBtn, styles.approveBtn, isActing && styles.actionBtnDisabled]}
                      disabled={isActing}
                      activeOpacity={0.85}
                    >
                      {isActing ? (
                        <Spinner size={18} color="#FFFFFF" />
                      ) : (
                        <>
                          <IconCheck color="#FFFFFF" size={16} />
                          <Text style={styles.approveText}>Approuver</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.3 },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { fontSize: 14, color: TEXT_GRAY, marginTop: 16 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5, marginBottom: 8 },
  emptySub: { fontSize: 14, color: TEXT_GRAY, textAlign: 'center', lineHeight: 22 },

  scroll: { flex: 1 },
  counter: { fontSize: 12, fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },

  card: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  videoWrap: { width: '100%', height: 320, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  thumbWrap: { width: '100%', height: '100%', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { backgroundColor: '#1A1A1A' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },

  cardBody: { padding: 16 },
  recipeTitle: { fontSize: 17, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.3, marginBottom: 10, lineHeight: 21 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  metaPill: { backgroundColor: ACCENT_BG, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  metaPillText: { fontSize: 11, fontWeight: '800', color: ACCENT },
  metaPillRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: TEXT_GRAY },
  categoryPill: { alignSelf: 'flex-start', backgroundColor: '#F5F5F5', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  categoryPillText: { fontSize: 11, fontWeight: '600', color: TEXT_DARK, textTransform: 'capitalize' },

  ingsBox: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 14 },
  ingsTitle: { fontSize: 11, fontWeight: '800', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  ingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT },
  ingText: { fontSize: 13, fontWeight: '500', color: TEXT_DARK, flex: 1 },
  ingMore: { fontSize: 12, fontWeight: '600', color: TEXT_GRAY, marginTop: 6, paddingLeft: 13 },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 100 },
  actionBtnDisabled: { opacity: 0.6 },
  rejectBtn: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FFD0D6' },
  rejectText: { fontSize: 14, fontWeight: '800', color: DANGER },
  approveBtn: { backgroundColor: ACCENT, shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  approveText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
});
