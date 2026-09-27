import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Image, Linking, Pressable, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { cartStore, getDefaultPeople, useCart } from '../../lib/cartStore';
import { isRecipeSaved, saveRecipe, unsaveRecipe } from '../../lib/saves';
import { Ingredient, formatAmount, getCurrentUserId } from '../../lib/supabase';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';

const SUPERMARCHES: { [key: string]: { name: string; url: string } } = {
  leclerc:     { name: 'E.Leclerc',   url: 'https://www.leclercdrive.fr' },
  carrefour:   { name: 'Carrefour',   url: 'https://www.carrefour.fr' },
  auchan:      { name: 'Auchan',      url: 'https://www.auchan.fr' },
  intermarche: { name: 'Intermarché', url: 'https://www.intermarche.com' },
  superu:      { name: 'Super U',     url: 'https://www.coursesu.com/drive/home' },
};

const haptic = (type: 'light' | 'medium' | 'success' = 'light') => {
  try {
    if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

const Spinner = ({ size = 30 }: { size?: number }) => {
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
        borderColor: '#F0F0F0', borderTopColor: ACCENT,
        transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
};

const IconBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT_DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconCart = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M3 6h18" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/>
    <Path d="M16 10a4 4 0 01-8 0" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

const IconPlay = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill={ACCENT}>
    <Path d="M8 5v14l11-7z"/>
  </Svg>
);

const IconCheck = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconMinus = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12h14" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round"/>
  </Svg>
);

const IconPlus = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round"/>
  </Svg>
);

const IconUsers = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    <Path d="M9 11a4 4 0 100-8 4 4 0 000 8z" stroke={ACCENT} strokeWidth="1.8" fill="none"/>
  </Svg>
);

const parseBasePeople = (people: string): number => {
  if (!people) return 2;
  const m = people.match(/(\d+)/);
  return m ? parseInt(m[1]) : 2;
};

const safeParseIngredients = (raw: any): Ingredient[] => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((ing: any) => {
      if (typeof ing === 'string') return { name: ing, amount: null, unit: null };
      if (ing && typeof ing === 'object') {
        return {
          name: ing.name || '',
          amount: typeof ing.amount === 'number' ? ing.amount : null,
          unit: typeof ing.unit === 'string' ? ing.unit : null,
        };
      }
      return { name: String(ing), amount: null, unit: null };
    }).filter((ing: Ingredient) => ing.name);
  } catch (e) {
    return [];
  }
};

const SCREEN_HEIGHT = Dimensions.get('screen').height;
const SHEET_PEEK = 150; // hauteur de la fiche visible quand elle est repliée (créateur + titre)

export default function RecipeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const title = (params.title as string) || 'Recette';
  const creator = (params.creator as string) || 'Dricecook';
  const time = (params.time as string) || '';
  const people = (params.people as string) || '';
  const price = (params.price as string) || '';
  const thumbnail = (params.thumbnail as string) || '';
  const instaUrl = (params.instaUrl as string) || '';
  const recipeId = (params.id as string) || '';
  const videoUrl = (params.videoUrl as string) || '';
  const basePeopleParam = parseInt((params.basePeople as string) || '', 10);

  const ingredients = safeParseIngredients(params.ingredients);

  const basePeople = basePeopleParam > 0 ? basePeopleParam : parseBasePeople(people);
  const [currentPeople, setCurrentPeople] = useState(basePeople);
  const cart = useCart();
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!recipeId) return;
    (async () => {
      const uid = await getCurrentUserId();
      if (uid) setIsSaved(await isRecipeSaved(uid, recipeId));
    })();
  }, [recipeId]);

  const toggleSave = async () => {
    if (!recipeId) return;
    const uid = await getCurrentUserId();
    if (!uid) {
      haptic('light');
      router.push('/(modals)/signup' as any);
      return;
    }
    const was = isSaved;
    haptic(was ? 'light' : 'medium');
    setIsSaved(!was);
    const ok = was ? await unsaveRecipe(uid, recipeId) : await saveRecipe(uid, recipeId);
    if (!ok) setIsSaved(was);
  };
  const cartItem = recipeId ? cart.find(i => i.recipeId === recipeId) || null : null;
  const inCart = !!cartItem;
  const cartUpToDate = inCart && cartItem!.currentPeople === currentPeople;
  const [imgLoading, setImgLoading] = useState(true);
  const [checked, setChecked] = useState<{ [key: number]: boolean }>({});
  const [supermarche, setSupermarche] = useState('leclerc');

  useEffect(() => {
    AsyncStorage.getItem('supermarche').then(sm => {
      if (sm) setSupermarche(sm);
    });
    (async () => {
      const existing = recipeId ? cartStore.getItem(recipeId) : null;
      if (existing) {
        setCurrentPeople(existing.currentPeople);
      } else {
        setCurrentPeople(await getDefaultPeople(basePeople));
      }
    })();
  }, []);

  const addToCart = async () => {
    if (!recipeId || ingredients.length === 0) return;
    if (cartUpToDate) {
      haptic('light');
      return;
    }
    haptic('success');
    if (inCart) {
      await cartStore.setPeople(recipeId, currentPeople);
    } else {
      await cartStore.add({
        recipeId,
        recipeTitle: title,
        basePeople,
        currentPeople,
        baseIngredients: ingredients,
      });
    }
  };

  const cartLabel = !inCart
    ? 'Ajouter au panier'
    : cartUpToDate
    ? 'Dans ton panier ✓'
    : 'Mettre à jour le panier';

  const factor = basePeople > 0 ? currentPeople / basePeople : 1;

  const toggleCheck = (idx: number) => {
    haptic('light');
    setChecked(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const decreasePeople = () => {
    if (currentPeople <= 1) return;
    haptic('light');
    setCurrentPeople(p => p - 1);
  };

  const increasePeople = () => {
    if (currentPeople >= 20) return;
    haptic('light');
    setCurrentPeople(p => p + 1);
  };

  const openInsta = () => {
    if (!instaUrl) return;
    haptic('light');
    Linking.openURL(instaUrl).catch(() => {});
  };

  const checkout = () => {
    haptic('success');
    const sm = SUPERMARCHES[supermarche] || SUPERMARCHES.leclerc;
    router.push({ pathname: '/(modals)/webview' as any, params: { url: sm.url, title: sm.name } });
  };

  const smName = SUPERMARCHES[supermarche]?.name || 'Leclerc';

  // ---- Vidéo plein écran en fond + fiche qui glisse par-dessus ----
  const player = useVideoPlayer(videoUrl || null, (p) => {
    p.loop = true;
    if (videoUrl) p.play();
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const togglePlay = () => {
    if (!videoUrl) return;
    haptic('light');
    try {
      if (player.playing) player.pause();
      else player.play();
    } catch (e) {}
  };

  const bottomBarHeight = insets.bottom + (recipeId ? 132 : 80);
  // Fiche repliée : seul le haut (créateur + titre) dépasse en bas, la vidéo est visible en entier.
  // Fiche dépliée : la recette recouvre la vidéo et les boutons panier/commande apparaissent.
  const sheetTop = Math.max(260, SCREEN_HEIGHT - insets.bottom - SHEET_PEEK);
  // Position « dépliée » : la fiche s'arrête sous l'heure / la batterie et les boutons retour / enregistrer.
  const sheetOpenOffset = Math.max(0, sheetTop - (insets.top + 60));
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);

  const onScrollListener = (e: any) => {
    const isOpen = e.nativeEvent.contentOffset.y > sheetOpenOffset * 0.5;
    if (isOpen !== expandedRef.current) {
      expandedRef.current = isOpen;
      setExpanded(isOpen);
    }
  };

  const toggleSheet = () => {
    haptic('light');
    scrollRef.current?.scrollTo({ y: expandedRef.current ? 0 : sheetOpenOffset, animated: true });
  };

  const bottomBarStyle = {
    transform: [{
      translateY: scrollY.interpolate({
        inputRange: [sheetOpenOffset * 0.4, sheetOpenOffset],
        outputRange: [bottomBarHeight + 40, 0],
        extrapolate: 'clamp' as const,
      }),
    }],
  };

  const mediaStyle = {
    transform: [
      { translateY: scrollY.interpolate({ inputRange: [-200, 0, sheetTop], outputRange: [0, 0, -sheetTop * 0.25], extrapolate: 'clamp' as const }) },
      { scale: scrollY.interpolate({ inputRange: [-200, 0], outputRange: [1.15, 1], extrapolate: 'clamp' as const }) },
    ],
  };
  const dimOpacity = scrollY.interpolate({ inputRange: [0, sheetTop], outputRange: [0, 0.65], extrapolate: 'clamp' });

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, mediaStyle]}>
        {videoUrl ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        ) : null}
        {(!videoUrl || status !== 'readyToPlay') && !!thumbnail && (
          <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        {!!videoUrl && status === 'loading' && (
          <View style={[styles.imgSpinner, { bottom: SCREEN_HEIGHT - sheetTop }]}>
            <Spinner size={36} />
          </View>
        )}
        {!!videoUrl && status === 'readyToPlay' && !isPlaying && (
          <View style={[styles.videoPauseOverlay, { bottom: SCREEN_HEIGHT - sheetTop }]} pointerEvents="none">
            <Svg width={64} height={64} viewBox="0 0 24 24" fill="rgba(255,255,255,0.95)">
              <Path d="M8 5v14l11-7z" />
            </Svg>
          </View>
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: dimOpacity }]} />
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomBarHeight + 20 }}
        scrollEventThrottle={16}
        snapToOffsets={[0, sheetOpenOffset]}
        snapToStart
        snapToEnd={false}
        decelerationRate="fast"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true, listener: onScrollListener },
        )}
      >
        <Pressable style={{ height: sheetTop }} onPress={togglePlay} />
        <View style={[styles.sheet, { minHeight: SCREEN_HEIGHT - insets.top - 60 }]}>
          <Pressable onPress={toggleSheet} hitSlop={12} style={styles.sheetHandleZone}>
            <View style={styles.sheetHandle} />
          </Pressable>
          <View style={styles.peekRow}>
            <Text style={[styles.creator, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>{creator}</Text>
            <TouchableOpacity style={styles.peekBtn} onPress={toggleSheet} activeOpacity={0.8}>
              <Text style={styles.peekBtnText}>{expanded ? 'Voir la vidéo' : `Recette · ${ingredients.length} ingrédients`}</Text>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                <Path d="M6 15l6-6 6 6" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.pills}>
            {!!time && <View style={styles.pill}><Text style={styles.pillText}>{time}</Text></View>}
            {!!price && <View style={styles.pill}><Text style={styles.pillText}>{price}</Text></View>}
          </View>

          {!!instaUrl && (
            <TouchableOpacity style={styles.videoLink} onPress={openInsta} activeOpacity={0.85}>
              <IconPlay />
              <Text style={styles.videoLinkText}>Voir la vidéo sur Instagram</Text>
            </TouchableOpacity>
          )}

          <View style={styles.peopleSection}>
            <View style={styles.peopleHeader}>
              <IconUsers />
              <Text style={styles.peopleLabel}>Pour combien de personnes ?</Text>
            </View>
            <View style={styles.peopleSelector}>
              <TouchableOpacity
                style={[styles.peopleBtn, currentPeople <= 1 && styles.peopleBtnDisabled]}
                onPress={decreasePeople} activeOpacity={0.7} disabled={currentPeople <= 1}
              >
                <IconMinus />
              </TouchableOpacity>
              <View style={styles.peopleCountWrap}>
                <Text style={styles.peopleCount}>{currentPeople}</Text>
                <Text style={styles.peopleCountSub}>{currentPeople === 1 ? 'personne' : 'personnes'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.peopleBtn, currentPeople >= 20 && styles.peopleBtnDisabled]}
                onPress={increasePeople} activeOpacity={0.7} disabled={currentPeople >= 20}
              >
                <IconPlus />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingrédients</Text>
            {ingredients.map((ing, idx) => {
              const isChecked = !!checked[idx];
              const hasAmount = ing.amount !== null && ing.amount !== undefined;
              const adjustedAmount = hasAmount ? (ing.amount || 0) * factor : null;
              const amountStr = hasAmount && adjustedAmount !== null
                ? `${formatAmount(adjustedAmount, ing.unit)}${ing.unit ? ` ${ing.unit}` : ''}`
                : null;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.ingRow, isChecked && styles.ingRowChecked]}
                  onPress={() => toggleCheck(idx)} activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked && <IconCheck />}
                  </View>
                  {amountStr ? (
                    <View style={styles.amountCol}>
                      <Text style={[styles.amountText, isChecked && styles.textChecked]}>{amountStr}</Text>
                    </View>
                  ) : (
                    <View style={styles.amountCol} />
                  )}
                  <Text style={[styles.ingName, isChecked && styles.textChecked]}>{ing.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.ScrollView>

      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()} activeOpacity={0.7}
      >
        <IconBack />
      </TouchableOpacity>
      {!!recipeId && (
        <TouchableOpacity
          style={[styles.saveBtn, { top: insets.top + 12 }, isSaved && styles.saveBtnActive]}
          onPress={toggleSave}
          activeOpacity={0.7}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill={isSaved ? '#FFFFFF' : 'none'}>
            <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={isSaved ? '#FFFFFF' : TEXT_DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}

      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }, bottomBarStyle]}
      >
        {!!recipeId && (
          <TouchableOpacity
            style={[styles.checkoutBtn, cartUpToDate && styles.cartBtnDone]}
            onPress={addToCart}
            activeOpacity={0.85}
          >
            <IconCart />
            <Text style={styles.checkoutBtnText}>{cartLabel}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={recipeId ? styles.secondaryBtn : styles.checkoutBtn}
          onPress={checkout}
          activeOpacity={0.85}
        >
          {!recipeId && <IconCart />}
          <Text style={recipeId ? styles.secondaryBtnText : styles.checkoutBtnText}>Commander chez {smName}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 12,
  },
  sheetHandleZone: { alignSelf: 'stretch', alignItems: 'center', paddingBottom: 12 },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E0E0E0' },
  peekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  peekBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ACCENT, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7,
  },
  peekBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  imgWrap: { width: '100%', height: 300, position: 'relative', backgroundColor: '#F5F5F5' },
  img: { width: '100%', height: '100%' },
  videoWrap: { height: 480, backgroundColor: '#000' },
  videoPauseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
  imgPlaceholder: { width: '100%', height: '100%', backgroundColor: '#F5F5F5' },
  imgSpinner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  saveBtn: {
    position: 'absolute', right: 16,
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  saveBtnActive: { backgroundColor: ACCENT },
  backBtn: {
    position: 'absolute', left: 16,
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  content: { padding: 20, paddingTop: 22 },
  creator: { fontSize: 12, fontWeight: '700', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.7, lineHeight: 32, marginBottom: 14 },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 18 },
  pill: { backgroundColor: '#F5F5F5', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '700', color: TEXT_DARK },
  videoLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: ACCENT, marginBottom: 24,
  },
  videoLinkText: { fontSize: 13, fontWeight: '800', color: ACCENT },
  peopleSection: { backgroundColor: ACCENT_BG, borderRadius: 18, padding: 18, marginBottom: 20 },
  peopleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  peopleLabel: { fontSize: 14, fontWeight: '700', color: TEXT_DARK },
  peopleSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  peopleBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.8, shadowRadius: 0, elevation: 3,
  },
  peopleBtnDisabled: { backgroundColor: TEXT_LIGHT, shadowOpacity: 0 },
  peopleCountWrap: { alignItems: 'center', flex: 1 },
  peopleCount: { fontSize: 32, fontWeight: '900', color: TEXT_DARK, letterSpacing: -1, lineHeight: 36 },
  peopleCountSub: { fontSize: 12, color: TEXT_GRAY, fontWeight: '600', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  ingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    marginBottom: 6, borderWidth: 1, borderColor: BORDER,
  },
  ingRowChecked: { backgroundColor: '#FAFAFA' },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#E0E0E0',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  amountCol: { minWidth: 64 },
  amountText: { fontSize: 14, fontWeight: '800', color: TEXT_DARK },
  ingName: { flex: 1, fontSize: 14, fontWeight: '500', color: TEXT_DARK },
  textChecked: { color: TEXT_LIGHT, textDecorationLine: 'line-through' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  checkoutBtn: {
    backgroundColor: ACCENT, borderRadius: 100, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  checkoutBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  cartBtnDone: { backgroundColor: '#00A87E' },
  secondaryBtn: {
    marginTop: 8, borderRadius: 100, padding: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: ACCENT, backgroundColor: '#FFFFFF',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800', color: ACCENT },
});
