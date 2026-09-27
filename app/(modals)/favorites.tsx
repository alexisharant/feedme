import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Dimensions, Easing, FlatList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { RecipeGridTile } from '../../components/RecipeTile';
import { openRecipe } from '../../lib/openRecipe';
import { unsaveRecipe } from '../../lib/saves';
import { DbRecipe, getCurrentUserId, supabase } from '../../lib/supabase';

// Mes recettes enregistrées (signet) — grille 3 colonnes façon TikTok / Insta.

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';

const GAP = 2;
const COLS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = Math.floor((SCREEN_WIDTH - GAP * (COLS - 1)) / COLS);

const haptic = (type: 'light' | 'medium' = 'light') => {
  try {
    Haptics.impactAsync(type === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

const IconBack = ({ color = TEXT_DARK, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconBookmark = ({ color = ACCENT, size = 34 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
        width: size, height: size, borderWidth: 2.5, borderRadius: size / 2,
        borderColor: baseColor, borderTopColor: color,
        transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
};

export default function SavedRecipesScreen() {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState<DbRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const loadSaved = async () => {
    const uid = await getCurrentUserId();
    setUserId(uid);
    if (!uid) {
      setSaved([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('saves')
      .select('recipe_id, created_at, recipes(*, creators(*))')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const recipes = data
        .map((d: any) => d.recipes)
        .filter((r: any) => r != null && (r.status === undefined || r.status === 'approved')) as DbRecipe[];
      setSaved(recipes);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadSaved(); }, []));

  const confirmRemove = (recipe: DbRecipe) => {
    if (!userId) return;
    haptic('medium');
    Alert.alert(
      'Retirer cette recette ?',
      `« ${recipe.title} » ne sera plus dans tes recettes enregistrées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            setSaved(prev => prev.filter(r => r.id !== recipe.id));
            await unsaveRecipe(userId, recipe.id);
          },
        },
      ],
    );
  };

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <IconBack />
      </TouchableOpacity>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.title}>Enregistrées</Text>
        {!loading && !!userId && saved.length > 0 && (
          <Text style={styles.subtitle}>{saved.length} recette{saved.length > 1 ? 's' : ''}</Text>
        )}
      </View>
      <View style={{ width: 38 }} />
    </View>
  );

  if (!loading && !userId) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><IconBookmark /></View>
          <Text style={styles.emptyTitle}>Connecte-toi pour retrouver tes recettes</Text>
          <Text style={styles.emptySub}>Enregistre des recettes et retrouve-les{'\n'}sur tous tes appareils</Text>
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
      {Header}
      {loading ? (
        <View style={styles.loadingBox}><Spinner size={28} /></View>
      ) : saved.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><IconBookmark /></View>
          <Text style={styles.emptyTitle}>Aucune recette enregistrée</Text>
          <Text style={styles.emptySub}>Appuie sur le signet d'une vidéo{'\n'}pour la garder ici</Text>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <RecipeGridTile
              recipe={item}
              width={TILE_WIDTH}
              onPress={() => { haptic(); openRecipe(item); }}
              onLongPress={() => confirmRemove(item)}
            />
          )}
          ListFooterComponent={
            <Text style={styles.hint}>Appui long sur une recette pour la retirer</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontWeight: '600', color: TEXT_GRAY, marginTop: 2 },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  hint: { textAlign: 'center', fontSize: 12, color: TEXT_LIGHT, paddingVertical: 18 },
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
