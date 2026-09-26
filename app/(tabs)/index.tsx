import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEvent } from 'expo';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { cartStore, consolidateCart, getDefaultPeople, useCart } from '../../lib/cartStore';
import { fetchSavedIds, saveRecipe, unsaveRecipe } from '../../lib/saves';
import { DbRecipe, formatAmount, getCurrentUserId, getDeviceId, Ingredient, supabase } from '../../lib/supabase';
import { useTabBarScroll } from '../../lib/tabBarStore';

const screen = Dimensions.get('screen');
const SCREEN_HEIGHT = screen.height;
const SCREEN_WIDTH = screen.width;
const SLIDE_HEIGHT = SCREEN_HEIGHT;
const DOUBLE_TAP_DELAY = 280;
const BOTTOM_BAR_OFFSET = 90;
const LIKE_BTN_TARGET_X = SCREEN_WIDTH - 34;
// Position du bouton cœur (1er des 4 boutons d'action à droite) pour l'animation du cœur volant.
// Chaque bouton = icône 44 + espace 4 + libellé ~13 ; 18 d'écart entre boutons.
const ACTION_COUNT = 4;
const ACTION_ITEM_HEIGHT = 44 + 4 + 13;
const ACTION_GAP = 18;
const LIKE_BTN_TARGET_Y = SLIDE_HEIGHT - (BOTTOM_BAR_OFFSET + ACTION_COUNT * ACTION_ITEM_HEIGHT + (ACTION_COUNT - 1) * ACTION_GAP - 22);
const PRELOAD_RANGE = 1;

const haptic = (type: 'light' | 'medium' | 'heavy' | 'success' = 'light') => {
  try {
    if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

const formatLikes = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return n.toString();
};

const displayIngredient = (ing: Ingredient): string => {
  if (ing.amount === null || ing.amount === undefined) return ing.name;
  const formatted = formatAmount(ing.amount, ing.unit);
  if (ing.unit) return `${formatted} ${ing.unit} · ${ing.name}`;
  return `${formatted} · ${ing.name}`;
};

const Spinner = ({ size = 40, color = '#FFFFFF', baseColor = 'rgba(255,255,255,0.15)' }: { size?: number; color?: string; baseColor?: string }) => {
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

const Poster = ({ uri }: { uri?: string | null }) => {
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={0}
    />
  );
};

type FeedVideoProps = {
  uri: string;
  posterUri?: string | null;
  isActive: boolean;
  shouldPlay: boolean;
  onBufferingChange: (isLoading: boolean) => void;
};

const FeedVideo = ({ uri, posterUri, isActive, shouldPlay, onBufferingChange }: FeedVideoProps) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
    try {
      p.bufferOptions = {
        preferredForwardBufferDuration: 4,
        waitsToMinimizeStalling: false,
      };
    } catch (e) {}
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const onBufferingChangeRef = useRef(onBufferingChange);
  onBufferingChangeRef.current = onBufferingChange;

  useEffect(() => {
    try {
      if (shouldPlay) {
        player.muted = false;
        player.play();
      } else {
        player.pause();
        if (!isActive) player.muted = true;
      }
    } catch (e) {}
  }, [shouldPlay, isActive, player]);

  useEffect(() => {
    if (isActive) return;
    try { player.currentTime = 0; } catch (e) {}
  }, [isActive, player]);

  useEffect(() => {
    if (isActive) onBufferingChangeRef.current(status === 'loading');
  }, [status, isActive]);

  const showPoster = !isActive || status !== 'readyToPlay';

  return (
    <View style={styles.video} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      {showPoster && <Poster uri={posterUri} />}
    </View>
  );
};

const IconCart = ({ color = '#fff', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M3 6h18" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <Path d="M16 10a4 4 0 01-8 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

const IconHeart = ({ color = '#fff', size = 26, filled = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconComment = ({ color = '#fff', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconBookmark = ({ color = '#fff', size = 26, filled = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
    <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconShare = ({ color = '#fff', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth="1.8" fill="none"/>
    <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth="1.8" fill="none"/>
    <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth="1.8" fill="none"/>
    <Path d="M8.59 13.51L15.42 17.49" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <Path d="M15.41 6.51L8.59 10.49" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </Svg>
);

const IconBag = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M3 6h18" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <Path d="M16 10a4 4 0 01-8 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

const IconPlay = ({ size = 64 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="rgba(255,255,255,0.95)">
    <Path d="M8 5v14l11-7z"/>
  </Svg>
);

const IconX = ({ color = '#8E8E8E', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </Svg>
);

const SUPERMARCHES: { [key: string]: { name: string; url: string } } = {
  leclerc:     { name: 'E.Leclerc',   url: 'https://www.leclercdrive.fr' },
  carrefour:   { name: 'Carrefour',   url: 'https://www.carrefour.fr' },
  auchan:      { name: 'Auchan',      url: 'https://www.auchan.fr' },
  intermarche: { name: 'Intermarché', url: 'https://www.intermarche.com' },
  superu:      { name: 'Super U',     url: 'https://www.coursesu.com/drive/home' },
};

const filterRecipes = (recipes: DbRecipe[], diet: string, budget: string): DbRecipe[] => {
  return recipes.filter(v => {
    if (diet === 'vegetarian' && !v.is_vegetarian) return false;
    if (diet === 'pescatarian' && !v.is_vegetarian && !v.is_pescatarian) return false;
    if (diet === 'glutenFree' && !v.is_gluten_free) return false;
    if (budget === 'low' && v.price_num > 10) return false;
    if (budget === 'medium' && v.price_num > 20) return false;
    return true;
  });
};

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const tabScroll = useTabBarScroll();
  const [allRecipes, setAllRecipes] = useState<DbRecipe[]>([]);
  const [recipes, setRecipes] = useState<DbRecipe[]>([]);
  const [likes, setLikes] = useState<{ [key: string]: boolean }>({});
  const [saved, setSaved] = useState<{ [key: string]: boolean }>({});
  const [likesCount, setLikesCount] = useState<{ [key: string]: number }>({});
  const [pausedIds, setPausedIds] = useState<{ [key: string]: boolean }>({});
  const [bufferingIds, setBufferingIds] = useState<{ [key: string]: boolean }>({});
  const cart = useCart();
  const [showCart, setShowCart] = useState(false);
  const [toast, setToast] = useState('');
  const [supermarche, setSupermarche] = useState('leclerc');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const [loading, setLoading] = useState(true);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const flyAnim = useRef(new Animated.Value(0)).current;

  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find(v => v.isViewable && v.index !== null && v.index !== undefined);
    if (first && typeof first.index === 'number') {
      setActiveIndex(prev => (prev === first.index ? prev : (first.index as number)));
    }
  }).current;

  useEffect(() => {
    return () => { if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current); };
  }, []);

  const consolidatedIngredients = useMemo(() => consolidateCart(cart), [cart]);

  const loadAll = async () => {
    const { data: recipesData } = await supabase
      .from('recipes')
      .select('*, creators(id, handle, name, avatar_letters, avatar_color)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    const loadedRecipes = (recipesData || []) as DbRecipe[];
    setAllRecipes(loadedRecipes);

    const countMap: { [key: string]: number } = {};
    const bufferMap: { [key: string]: boolean } = {};
    loadedRecipes.forEach(r => {
      countMap[r.id] = r.likes_count;
      bufferMap[r.id] = true;
    });
    setLikesCount(countMap);
    setBufferingIds(bufferMap);

    const sm = await AsyncStorage.getItem('supermarche');
    if (sm) setSupermarche(sm);

    const diet = (await AsyncStorage.getItem('diet')) || 'all';
    const budget = (await AsyncStorage.getItem('budget')) || 'high';
    setRecipes(filterRecipes(loadedRecipes, diet, budget));

    const userId = await getCurrentUserId();
    let likesQuery;
    if (userId) {
      likesQuery = supabase.from('likes').select('recipe_id').eq('user_id', userId);
    } else {
      const deviceId = await getDeviceId();
      likesQuery = supabase.from('likes').select('recipe_id').eq('device_id', deviceId);
    }
    const { data: likesData } = await likesQuery;
    const likeMap: { [key: string]: boolean } = {};
    (likesData || []).forEach((l: any) => { likeMap[l.recipe_id] = true; });
    setLikes(likeMap);

    setSaved(userId ? await fetchSavedIds(userId) : {});

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      loadAll();
      return () => setIsFocused(false);
    }, [])
  );

  const showAuthPrompt = () => {
    Alert.alert(
      'Crée ton compte',
      'Connecte-toi pour sauvegarder tes recettes et les retrouver sur tous tes appareils.',
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: "S'inscrire", onPress: () => router.push('/(modals)/signup' as any) },
      ]
    );
  };

  const showToast = (msg: string) => {
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const triggerHeartFly = () => {
    flyAnim.setValue(0);
    Animated.timing(flyAnim, { toValue: 1, duration: 1100, useNativeDriver: true }).start();
  };

  const togglePause = (recipeId: string) => {
    setPausedIds(prev => ({ ...prev, [recipeId]: !prev[recipeId] }));
  };

  const handleVideoPress = (recipe: DbRecipe) => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;
      handleDoubleTapLike(recipe);
    } else {
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        togglePause(recipe.id);
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  // Le compteur likes_count est mis à jour automatiquement par Supabase (trigger SQL).
  const addLikeToDB = async (recipe: DbRecipe, userId: string) => {
    await supabase.from('likes').insert({ user_id: userId, recipe_id: recipe.id });
  };

  const removeLikeFromDB = async (recipe: DbRecipe, userId: string) => {
    await supabase.from('likes').delete().eq('user_id', userId).eq('recipe_id', recipe.id);
  };

  const handleDoubleTapLike = async (recipe: DbRecipe) => {
    haptic('heavy');
    const userId = await getCurrentUserId();
    if (!userId) { showAuthPrompt(); return; }
    triggerHeartFly();
    if (likes[recipe.id]) return;
    setLikes(prev => ({ ...prev, [recipe.id]: true }));
    setLikesCount(prev => ({ ...prev, [recipe.id]: (prev[recipe.id] || 0) + 1 }));
    await addLikeToDB(recipe, userId);
  };

  const toggleSave = async (recipe: DbRecipe) => {
    const userId = await getCurrentUserId();
    if (!userId) { haptic('light'); showAuthPrompt(); return; }
    const wasSaved = !!saved[recipe.id];
    haptic(wasSaved ? 'light' : 'medium');
    setSaved(prev => ({ ...prev, [recipe.id]: !wasSaved }));
    showToast(wasSaved ? 'Retirée de tes recettes' : 'Recette enregistrée 🔖');
    const ok = wasSaved ? await unsaveRecipe(userId, recipe.id) : await saveRecipe(userId, recipe.id);
    if (!ok) setSaved(prev => ({ ...prev, [recipe.id]: wasSaved }));
  };

  const toggleLike = async (recipe: DbRecipe) => {
    const userId = await getCurrentUserId();
    if (!userId) { haptic('light'); showAuthPrompt(); return; }
    const wasLiked = !!likes[recipe.id];
    if (wasLiked) {
      haptic('light');
      setLikes(prev => ({ ...prev, [recipe.id]: false }));
      setLikesCount(prev => ({ ...prev, [recipe.id]: Math.max(0, (prev[recipe.id] || 0) - 1) }));
      await removeLikeFromDB(recipe, userId);
    } else {
      haptic('medium');
      triggerHeartFly();
      setLikes(prev => ({ ...prev, [recipe.id]: true }));
      setLikesCount(prev => ({ ...prev, [recipe.id]: (prev[recipe.id] || 0) + 1 }));
      await addLikeToDB(recipe, userId);
    }
  };

  const addToCart = async (recipe: DbRecipe) => {
    if (cartStore.has(recipe.id)) {
      haptic('light');
      showToast('Déjà dans ton panier !');
      return;
    }
    haptic('medium');
    const basePeople = recipe.base_people || 2;
    const people = await getDefaultPeople(basePeople);
    await cartStore.add({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      basePeople,
      currentPeople: people,
      baseIngredients: recipe.ingredients,
    });
    showToast(`${recipe.ingredients.length} ingrédients ajoutés !`);
  };

  const updatePeople = (recipeId: string, delta: number) => {
    haptic('light');
    cartStore.updatePeople(recipeId, delta);
  };

  const removeRecipe = (recipeId: string) => {
    haptic('medium');
    cartStore.remove(recipeId);
  };

  const clearCart = () => {
    haptic('medium');
    cartStore.clear();
  };

  const handleShare = async (recipe: DbRecipe) => {
    haptic('light');
    try {
      await Share.share({
        message: `Regarde cette recette de ${recipe.creators?.name || 'Dricecook'} : ${recipe.title} 🍽️\n\n${recipe.insta_url || ''}`,
        url: recipe.insta_url || '',
        title: recipe.title,
      });
    } catch (e) {}
  };

  const handleComment = async (recipe: DbRecipe) => {
    haptic('light');
    try { if (recipe.insta_url) await Linking.openURL(recipe.insta_url); } catch (e) {}
  };

  const goToCreator = (recipe: DbRecipe) => {
    const creatorId = recipe.creator_id || recipe.creators?.id;
    if (creatorId) {
      haptic('light');
      router.push({ pathname: '/(modals)/creator-profile' as any, params: { id: creatorId } });
    }
  };

  const checkout = () => {
    haptic('success');
    const sm = SUPERMARCHES[supermarche] || SUPERMARCHES.leclerc;
    setShowCart(false);
    router.push({ pathname: '/(modals)/webview', params: { url: sm.url, title: sm.name } });
  };

  const openCart = () => { haptic('light'); setShowCart(true); };

  const onBufferingChange = (recipeId: string, isLoading: boolean) => {
    setBufferingIds(prev => {
      if (prev[recipeId] === isLoading) return prev;
      return { ...prev, [recipeId]: isLoading };
    });
  };

  const smName = SUPERMARCHES[supermarche]?.name || 'Leclerc';

  const HEART_START_X = SCREEN_WIDTH / 2;
  const HEART_START_Y = SCREEN_HEIGHT / 2;
  const DX = LIKE_BTN_TARGET_X - HEART_START_X;
  const DY = LIKE_BTN_TARGET_Y - HEART_START_Y;

  const renderSlide = ({ item: recipe, index }: { item: DbRecipe; index: number }) => {
    const isActive = activeIndex === index;
    const isNear = Math.abs(activeIndex - index) <= PRELOAD_RANGE;
    const isPaused = !!pausedIds[recipe.id];
    const isBuffering = !!bufferingIds[recipe.id];
    const isLiked = !!likes[recipe.id];
    const count = likesCount[recipe.id] || 0;
    const creatorName = recipe.creators?.name || 'Dricecook';
    const avatarLetters = recipe.creators?.avatar_letters || 'DC';
    return (
      <View style={styles.slide}>
        <Pressable style={styles.videoTouchArea} onPress={() => handleVideoPress(recipe)}>
          {isNear ? (
            <FeedVideo
              uri={recipe.video_url}
              posterUri={recipe.thumbnail_url}
              isActive={isActive}
              shouldPlay={isActive && isFocused && !isPaused}
              onBufferingChange={(isLoading) => onBufferingChange(recipe.id, isLoading)}
            />
          ) : (
            <View style={styles.video} pointerEvents="none">
              <Poster uri={recipe.thumbnail_url} />
            </View>
          )}
        </Pressable>

        {isBuffering && isActive && !isPaused && (
          <View pointerEvents="none" style={styles.spinnerOverlay}>
            <Spinner size={48} color="#FFFFFF" baseColor="rgba(255,255,255,0.15)" />
          </View>
        )}

        {isPaused && isActive && (
          <View pointerEvents="none" style={styles.pauseOverlay}>
            <IconPlay size={72} />
          </View>
        )}

        <View style={styles.slideBody} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.creatorRow}
            onPress={() => goToCreator(recipe)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 20 }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetters}</Text>
            </View>
            <Text style={styles.creatorName}>{creatorName}</Text>
          </TouchableOpacity>
          <Text style={styles.slideTitle}>{recipe.title}</Text>
          <View style={styles.pillsRow}>
            <View style={styles.pill}><Text style={styles.pillText}>⏱ {recipe.time}</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>{recipe.people}</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>{recipe.price}</Text></View>
          </View>
          <TouchableOpacity style={styles.orderBtn} onPress={() => addToCart(recipe)} activeOpacity={0.85}>
            <IconCart color="#fff" size={16} />
            <Text style={styles.orderBtnText}>Ajouter au panier</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(recipe)} activeOpacity={0.7}>
            <View style={[styles.actionIcon, isLiked && styles.actionIconLiked]}>
              <IconHeart color="#fff" size={22} filled={isLiked} />
            </View>
            <Text style={styles.actionLabel}>{formatLikes(count)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleSave(recipe)} activeOpacity={0.7}>
            <View style={[styles.actionIcon, !!saved[recipe.id] && styles.actionIconSaved]}>
              <IconBookmark color="#fff" size={21} filled={!!saved[recipe.id]} />
            </View>
            <Text style={styles.actionLabel}>{saved[recipe.id] ? 'Enregistrée' : 'Enregistrer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleComment(recipe)} activeOpacity={0.7}>
            <View style={styles.actionIcon}><IconComment color="#fff" size={22} /></View>
            <Text style={styles.actionLabel}>Commenter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(recipe)} activeOpacity={0.7}>
            <View style={styles.actionIcon}><IconShare color="#fff" size={22} /></View>
            <Text style={styles.actionLabel}>Partager</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.logo}>Feed<Text style={styles.logoSub}>Me</Text></Text>
        <TouchableOpacity style={styles.cartBtn} onPress={openCart} activeOpacity={0.7}>
          <IconBag color="#000" size={20} />
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyFeed}>
          <Spinner size={56} color="#00C896" baseColor="rgba(255,255,255,0.15)" />
          <Text style={[styles.emptySub, { marginTop: 16 }]}>Chargement des recettes...</Text>
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>Aucune recette ne correspond</Text>
          <Text style={styles.emptySub}>Tes préférences sont peut-être trop strictes.{'\n'}Essaie d'ajuster ton régime ou ton budget.</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => { haptic('light'); router.push('/(modals)/preferences' as any); }}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyBtnText}>Modifier mes préférences</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          renderItem={renderSlide}
          extraData={{ activeIndex, isFocused, pausedIds, bufferingIds, likes, likesCount, saved }}
          style={styles.feed}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SLIDE_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum={true}
          getItemLayout={(_, index) => ({ length: SLIDE_HEIGHT, offset: SLIDE_HEIGHT * index, index })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onScroll={tabScroll.onScroll}
          scrollEventThrottle={tabScroll.scrollEventThrottle}
          onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.y / SLIDE_HEIGHT))}
        />
      )}

      <Animated.View
        pointerEvents="none"
        style={[styles.heartFly, {
          opacity: flyAnim.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: flyAnim.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, DX] }) },
            { translateY: flyAnim.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, DY] }) },
            { scale: flyAnim.interpolate({ inputRange: [0, 0.2, 0.45, 1], outputRange: [0.3, 1.4, 1, 0.15] }) },
          ],
        }]}
      >
        <IconHeart color="#FF3B5C" size={140} filled />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.toast, {
        opacity: toastAnim,
        transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }]}>
        <Text style={styles.toastText}>{toast}</Text>
      </Animated.View>

      {showCart && (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerBg} onPress={() => setShowCart(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHandle} />
            <View style={styles.drawerTitleRow}>
              <IconBag color="#000" size={22} />
              <Text style={styles.drawerTitle}>Mon panier</Text>
              {cart.length > 0 && (
                <Text style={styles.drawerCount}>{cart.length} recette{cart.length > 1 ? 's' : ''}</Text>
              )}
            </View>

            {cart.length === 0 ? (
              <Text style={styles.drawerEmpty}>Ton panier est vide.{'\n'}Ajoute une recette pour voir les ingrédients !</Text>
            ) : (
              <>
                <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.sectionTitle}>Mes recettes</Text>
                  {cart.map((item) => (
                    <View key={item.recipeId} style={styles.recipeCard}>
                      <View style={styles.recipeCardTop}>
                        <Text style={styles.recipeCardName} numberOfLines={2}>{item.recipeTitle}</Text>
                        <TouchableOpacity
                          onPress={() => removeRecipe(item.recipeId)}
                          style={styles.removeBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.6}
                        >
                          <IconX color="#8E8E8E" size={16} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.peopleRow}>
                        <Text style={styles.peopleLabel}>Personnes</Text>
                        <View style={styles.peopleCtrl}>
                          <TouchableOpacity
                            onPress={() => updatePeople(item.recipeId, -1)}
                            style={[styles.peopleBtn, item.currentPeople <= 1 && styles.peopleBtnDisabled]}
                            disabled={item.currentPeople <= 1}
                            activeOpacity={0.6}
                          >
                            <Text style={styles.peopleBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.peopleCount}>{item.currentPeople}</Text>
                          <TouchableOpacity
                            onPress={() => updatePeople(item.recipeId, 1)}
                            style={[styles.peopleBtn, item.currentPeople >= 20 && styles.peopleBtnDisabled]}
                            disabled={item.currentPeople >= 20}
                            activeOpacity={0.6}
                          >
                            <Text style={styles.peopleBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}

                  <View style={styles.sectionDivider} />
                  <Text style={styles.sectionTitle}>
                    Liste de courses <Text style={styles.sectionCount}>({consolidatedIngredients.length})</Text>
                  </Text>
                  <View style={styles.ingsBox}>
                    {consolidatedIngredients.map((ing, i) => (
                      <View key={i} style={styles.ingRow}>
                        <View style={styles.ingDot} />
                        <Text style={styles.ingText}>{displayIngredient(ing)}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.drawerBtns}>
                  <TouchableOpacity style={styles.clearBtn} onPress={clearCart} activeOpacity={0.7}>
                    <Text style={styles.clearBtnText}>Vider</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.checkoutBtn} onPress={checkout} activeOpacity={0.85}>
                    <IconCart color="#fff" size={16} />
                    <Text style={styles.checkoutBtnText}>Commander chez {smName}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topbar: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'transparent',
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  logo: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  logoSub: { color: 'rgba(255,255,255,0.85)' },
  cartBtn: { position: 'relative', backgroundColor: '#FFFFFF', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cartBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#00C896', minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', paddingHorizontal: 3 },
  cartBadgeText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
  feed: { flex: 1, marginTop: 0 },
  slide: { height: SLIDE_HEIGHT, width: SCREEN_WIDTH, position: 'relative', backgroundColor: '#000' },
  videoTouchArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  spinnerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pauseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  slideBody: { position: 'absolute', bottom: BOTTOM_BAR_OFFSET, left: 16, right: 70, zIndex: 10, elevation: 10 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, alignSelf: 'flex-start' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#00C896', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },
  creatorName: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  slideTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 10, lineHeight: 24, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  pillsRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  pill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  pillText: { fontSize: 11, fontWeight: '500', color: '#FFFFFF' },
  orderBtn: { backgroundColor: '#00C896', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  orderBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  actions: { position: 'absolute', right: 12, bottom: BOTTOM_BAR_OFFSET, gap: 18, alignItems: 'center', zIndex: 10, elevation: 10 },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  actionIconSaved: { backgroundColor: '#00C896', borderColor: '#00C896' },
  actionIconLiked: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  actionLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  heartFly: { position: 'absolute', top: SCREEN_HEIGHT / 2 - 70, left: SCREEN_WIDTH / 2 - 70, zIndex: 1000 },
  toast: { position: 'absolute', bottom: 160, alignSelf: 'center', backgroundColor: 'rgba(0,200,150,0.95)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, zIndex: 999 },
  toastText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 500 },
  drawerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '85%', borderTopWidth: 1, borderTopColor: '#EFEFEF' },
  drawerHandle: { width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  drawerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  drawerTitle: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  drawerCount: { fontSize: 12, fontWeight: '600', color: '#8E8E8E', marginLeft: 'auto' },
  drawerEmpty: { textAlign: 'center', fontSize: 14, color: '#8E8E8E', lineHeight: 22, paddingVertical: 24 },
  drawerScroll: { marginBottom: 14 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#000', letterSpacing: -0.3, marginBottom: 10, textTransform: 'uppercase' },
  sectionCount: { fontSize: 12, fontWeight: '600', color: '#8E8E8E', textTransform: 'none' },
  sectionDivider: { height: 1, backgroundColor: '#EFEFEF', marginVertical: 18 },

  recipeCard: { backgroundColor: '#FAFAFA', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#EFEFEF', marginBottom: 10 },
  recipeCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  recipeCardName: { fontSize: 15, fontWeight: '800', color: '#000', flex: 1, letterSpacing: -0.3, paddingRight: 8 },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFEFEF', alignItems: 'center', justifyContent: 'center' },
  peopleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  peopleLabel: { fontSize: 13, fontWeight: '600', color: '#8E8E8E' },
  peopleCtrl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peopleBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#00C896', alignItems: 'center', justifyContent: 'center' },
  peopleBtnDisabled: { borderColor: '#EFEFEF', opacity: 0.5 },
  peopleBtnText: { fontSize: 18, fontWeight: '900', color: '#00C896', marginTop: -2 },
  peopleCount: { fontSize: 16, fontWeight: '900', color: '#000', minWidth: 22, textAlign: 'center' },

  ingsBox: { backgroundColor: '#FAFAFA', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#EFEFEF' },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  ingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00C896' },
  ingText: { fontSize: 13, fontWeight: '500', color: '#000', flex: 1 },

  drawerBtns: { flexDirection: 'row', gap: 8 },
  clearBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 100, borderWidth: 1.5, borderColor: '#FFD0D6', backgroundColor: '#FFFFFF' },
  clearBtnText: { fontSize: 13, fontWeight: '700', color: '#FF3B5C' },
  checkoutBtn: { flex: 1, backgroundColor: '#00C896', padding: 14, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#008C68', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  checkoutBtnText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },

  emptyFeed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#0A0A0A' },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#00C896', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100, shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  emptyBtnText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
});
