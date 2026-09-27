import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { formatCount, RecipeGridTile } from '../../components/RecipeTile';
import { isAdmin } from '../../lib/admin';
import { useCart } from '../../lib/cartStore';
import { openRecipe } from '../../lib/openRecipe';
import { unsaveRecipe } from '../../lib/saves';
import { DbRecipe, migrateDeviceLikesToUser, supabase } from '../../lib/supabase';

// Mon profil façon TikTok : avatar, chiffres, raccourcis, puis grille « Enregistrées » / « J'aime ».
// Les réglages (supermarché, préférences, déconnexion, admin) sont dans l'écran Paramètres (roue dentée).

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

const SUPERMARCHES: { [id: string]: { name: string; logo: any } } = {
  leclerc:     { name: 'E.Leclerc',   logo: require('../../assets/images/logos/leclerc.jpg') },
  carrefour:   { name: 'Carrefour',   logo: require('../../assets/images/logos/carrefour.png') },
  auchan:      { name: 'Auchan',      logo: require('../../assets/images/logos/auchan.jpg') },
  intermarche: { name: 'Intermarché', logo: require('../../assets/images/logos/intermarche.jpg') },
  superu:      { name: 'Super U',     logo: require('../../assets/images/logos/superu.png') },
};

type Tab = 'saved' | 'liked';

const haptic = (type: 'light' | 'medium' = 'light') => {
  try {
    Haptics.impactAsync(type === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

const IconGear = ({ color = TEXT_DARK, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.9" fill="none"/>
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="1.9" fill="none"/>
  </Svg>
);

const IconUser = ({ color = '#FFFFFF', size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" fill="none"/>
    <Path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"/>
  </Svg>
);

const IconBookmark = ({ color = TEXT_DARK, size = 20, filled = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
    <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconHeart = ({ color = TEXT_DARK, size = 20, filled = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconShield = ({ color = ACCENT, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4z" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

const Stat = ({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) => (
  <TouchableOpacity style={styles.stat} onPress={onPress} disabled={!onPress} activeOpacity={0.6}>
    <Text style={styles.statVal}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

const extractRecipes = (rows: any[] | null): DbRecipe[] =>
  (rows || [])
    .map((d: any) => d.recipes)
    .filter((r: any) => r != null && (r.status === undefined || r.status === 'approved')) as DbRecipe[];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [supermarche, setSupermarche] = useState('leclerc');
  const [saved, setSaved] = useState<DbRecipe[]>([]);
  const [liked, setLiked] = useState<DbRecipe[]>([]);
  const [tab, setTab] = useState<Tab>('saved');

  const loadAll = async () => {
    const sm = await AsyncStorage.getItem('supermarche');
    if (sm) setSupermarche(sm);

    const { data } = await supabase.auth.getUser();
    const u = data?.user || null;
    setUser(u);

    if (!u) {
      setSaved([]);
      setLiked([]);
      setIsUserAdmin(false);
      setLoading(false);
      return;
    }

    await migrateDeviceLikesToUser();

    const [savesRes, likesRes, adminStatus] = await Promise.all([
      supabase
        .from('saves')
        .select('recipe_id, created_at, recipes(*, creators(*))')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('likes')
        .select('recipe_id, created_at, recipes(*, creators(*))')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false }),
      isAdmin(),
    ]);
    setSaved(extractRecipes(savesRes.data));
    setLiked(extractRecipes(likesRes.data));
    setIsUserAdmin(adminStatus);

    if (adminStatus) {
      const { count } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingCount(count || 0);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  const goSettings = () => { haptic(); router.push('/(modals)/settings' as any); };
  const goPreferences = () => { haptic(); router.push('/(modals)/preferences' as any); };
  const goAdmin = () => { haptic(); router.push('/(modals)/admin' as any); };
  const goSignup = () => { haptic(); router.push('/(modals)/signup' as any); };
  const goLogin = () => { haptic(); router.push('/(modals)/login' as any); };

  const selectTab = (t: Tab) => {
    if (t === tab) return;
    haptic();
    setTab(t);
  };

  const confirmUnsave = (recipe: DbRecipe) => {
    if (!user) return;
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
            await unsaveRecipe(user.id, recipe.id);
          },
        },
      ],
    );
  };

  const sm = SUPERMARCHES[supermarche] || SUPERMARCHES.leclerc;

  const TopBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <View style={{ width: 38 }} />
      <Text style={styles.topTitle} numberOfLines={1}>
        {user?.email ? user.email.split('@')[0] : 'Mon profil'}
      </Text>
      <TouchableOpacity style={styles.gearBtn} onPress={goSettings} activeOpacity={0.7} hitSlop={8}>
        <IconGear />
      </TouchableOpacity>
    </View>
  );

  // ---------- Non connecté ----------
  if (!loading && !user) {
    return (
      <View style={styles.container}>
        {TopBar}
        <View style={styles.guest}>
          <View style={styles.guestAvatar}>
            <IconUser color="#FFFFFF" size={40} />
          </View>
          <Text style={styles.guestTitle}>Crée ton profil FeedMe</Text>
          <Text style={styles.guestDesc}>
            Enregistre tes recettes préférées, like les vidéos{'\n'}et retrouve tout sur tes appareils
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={goSignup} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>S'inscrire</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={goLogin} activeOpacity={0.7}>
            <Text style={styles.linkBtnText}>J'ai déjà un compte</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smChip} onPress={goSettings} activeOpacity={0.7}>
            <Image source={sm.logo} style={styles.smLogo} resizeMode="contain" />
            <Text style={styles.smChipText}>Mon supermarché : {sm.name}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const initial = user?.email ? user.email[0].toUpperCase() : '';
  const data = tab === 'saved' ? saved : liked;

  const Header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.handle}>@{user?.email ? user.email.split('@')[0] : ''}</Text>
        {isUserAdmin && (
          <View style={styles.adminTag}>
            <Text style={styles.adminTagText}>Admin FeedMe</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <Stat value={formatCount(saved.length)} label="Enregistrées" onPress={() => selectTab('saved')} />
          <View style={styles.statSep} />
          <Stat value={formatCount(liked.length)} label="J'aime" onPress={() => selectTab('liked')} />
          <View style={styles.statSep} />
          <Stat value={String(cart.length)} label="Au panier" />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={goPreferences} activeOpacity={0.7}>
            <Text style={styles.actionText}>Mes préférences</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSm]} onPress={goSettings} activeOpacity={0.7}>
            <Image source={sm.logo} style={styles.smLogo} resizeMode="contain" />
            <Text style={styles.actionText} numberOfLines={1}>{sm.name}</Text>
          </TouchableOpacity>
        </View>

        {isUserAdmin && (
          <TouchableOpacity style={styles.adminBanner} onPress={goAdmin} activeOpacity={0.8}>
            <IconShield />
            <Text style={styles.adminBannerText}>
              {pendingCount === 0
                ? 'Modération : rien en attente'
                : `Modération : ${pendingCount} recette${pendingCount > 1 ? 's' : ''} en attente`}
            </Text>
            {pendingCount > 0 && (
              <View style={styles.pendingDot}>
                <Text style={styles.pendingDotText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'saved' && styles.tabActive]} onPress={() => selectTab('saved')} activeOpacity={0.7}>
          <IconBookmark color={tab === 'saved' ? TEXT_DARK : TEXT_LIGHT} filled={tab === 'saved'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'liked' && styles.tabActive]} onPress={() => selectTab('liked')} activeOpacity={0.7}>
          <IconHeart color={tab === 'liked' ? TEXT_DARK : TEXT_LIGHT} filled={tab === 'liked'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {TopBar}
      <FlatList
        key={tab}
        data={loading ? [] : data}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {tab === 'saved' ? 'Aucune recette enregistrée' : 'Aucune vidéo likée'}
              </Text>
              <Text style={styles.emptySub}>
                {tab === 'saved'
                  ? "Appuie sur le signet 🔖 d'une vidéo pour la garder ici"
                  : 'Les vidéos que tu likes ❤️ apparaîtront ici'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <RecipeGridTile
            recipe={item}
            width={TILE_WIDTH}
            onPress={() => { haptic(); openRecipe(item); }}
            onLongPress={tab === 'saved' ? () => confirmUnsave(item) : undefined}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginHorizontal: 8 },
  gearBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 16 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '900', color: '#FFFFFF' },
  handle: { fontSize: 16, fontWeight: '800', color: TEXT_DARK, marginTop: 10 },
  adminTag: { marginTop: 6, backgroundColor: ACCENT_BG, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  adminTagText: { fontSize: 11, fontWeight: '800', color: ACCENT },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  stat: { alignItems: 'center', minWidth: 86 },
  statVal: { fontSize: 18, fontWeight: '900', color: TEXT_DARK },
  statLabel: { fontSize: 12, fontWeight: '500', color: TEXT_GRAY, marginTop: 2 },
  statSep: { width: 1, height: 18, backgroundColor: BORDER },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 16, alignSelf: 'stretch' },
  actionBtn: {
    flex: 1, height: 40, borderRadius: 8, backgroundColor: '#F2F2F2',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10,
  },
  actionBtnSm: { flex: 0.8 },
  actionText: { fontSize: 13, fontWeight: '800', color: TEXT_DARK },
  smLogo: { width: 20, height: 20, borderRadius: 4 },

  adminBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch',
    marginTop: 12, backgroundColor: ACCENT_BG, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  adminBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: TEXT_DARK },
  pendingDot: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#FF3B5C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pendingDotText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: GAP },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: TEXT_DARK },

  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: TEXT_DARK, marginBottom: 6 },
  emptySub: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center', lineHeight: 18 },

  guest: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  guestAvatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#D8D8D8', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  guestTitle: { fontSize: 20, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.4, marginBottom: 8 },
  guestDesc: { fontSize: 14, color: TEXT_GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  primaryBtn: {
    alignSelf: 'stretch', backgroundColor: ACCENT, borderRadius: 100, paddingVertical: 15, alignItems: 'center',
    shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  linkBtn: { paddingVertical: 14 },
  linkBtnText: { fontSize: 14, fontWeight: '800', color: ACCENT },
  smChip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, backgroundColor: '#F5F5F5', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  smChipText: { fontSize: 13, fontWeight: '700', color: TEXT_DARK },
});
