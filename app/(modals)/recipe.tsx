import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, Linking, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { cartStore, getDefaultPeople, useCart } from '../../lib/cartStore';
import { Ingredient, formatAmount } from '../../lib/supabase';

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
  const basePeopleParam = parseInt((params.basePeople as string) || '', 10);

  const ingredients = safeParseIngredients(params.ingredients);

  const basePeople = basePeopleParam > 0 ? basePeopleParam : parseBasePeople(people);
  const [currentPeople, setCurrentPeople] = useState(basePeople);
  const cart = useCart();
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

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 190 }}>
        <View style={styles.imgWrap}>
          {thumbnail ? (
            <>
              <Image source={{ uri: thumbnail }} style={styles.img} onLoadEnd={() => setImgLoading(false)} />
              {imgLoading && (
                <View style={styles.imgSpinner}>
                  <Spinner size={36} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.imgPlaceholder} />
          )}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 12 }]}
            onPress={() => router.back()} activeOpacity={0.7}
          >
            <IconBack />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.creator}>{creator}</Text>
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
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  imgWrap: { width: '100%', height: 300, position: 'relative', backgroundColor: '#F5F5F5' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', backgroundColor: '#F5F5F5' },
  imgSpinner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
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
