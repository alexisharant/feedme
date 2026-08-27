import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Image, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { isAdmin } from '../../lib/admin';
import { supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';

const CLOUDINARY_CLOUD = 'dvzyudtuk';
const CLOUDINARY_PRESET = 'feedme_unsigned';
const AI_API_URL = 'https://feedme-admin.vercel.app/api/analyze';

const CATEGORIES = ['français', 'monde', 'italien', 'asiatique', 'mexicain', 'dessert', 'apéro', 'autre'];

const haptic = (type: 'light' | 'medium' | 'success' = 'light') => {
  try {
    if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

const Spinner = ({ size = 24, color = '#FFFFFF', baseColor = 'rgba(255,255,255,0.3)' }: { size?: number; color?: string; baseColor?: string }) => {
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

const IconBack = ({ color = TEXT_DARK, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconPlus = ({ color = ACCENT, size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
  </Svg>
);

const IconClose = ({ color = TEXT_GRAY, size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
  </Svg>
);

const IconCamera = ({ color = '#FFFFFF', size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth="2" fill="none"/>
  </Svg>
);

const IconSparkles = ({ color = ACCENT, size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zm6 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/>
  </Svg>
);

const IconCheck = ({ color = '#FFFFFF', size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

type IngredientInput = { name: string; amount: string; unit: string };

const getOrCreateCreator = async (user: any): Promise<string | null> => {
  const { data: existing } = await supabase
    .from('creators')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const emailPrefix = (user.email || 'user').split('@')[0];
  const handle = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 9999);
  const name = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  const initial = (name[0] || 'U').toUpperCase();

  const { data: newCreator, error } = await supabase
    .from('creators')
    .insert({
      handle,
      name,
      avatar_letters: initial,
      avatar_color: '#00C896',
      user_id: user.id,
      bio: null,
      tiktok_url: null,
      instagram_url: null,
      tiktok_followers: 0,
      instagram_followers: 0,
    })
    .select('id')
    .single();

  if (error || !newCreator) {
    console.warn('Creator create error:', error);
    return null;
  }
  return newCreator.id;
};

const uploadToCloudinary = async (videoUri: string): Promise<string | null> => {
  const formData = new FormData();
  formData.append('file', { uri: videoUri, type: 'video/mp4', name: 'recipe.mp4' } as any);
  formData.append('upload_preset', CLOUDINARY_PRESET);

  try {
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await resp.json();
    if (data.secure_url) return data.secure_url;
    console.warn('Cloudinary error:', data);
    return null;
  } catch (e) {
    console.warn('Upload error:', e);
    return null;
  }
};

const analyzeVideo = async (videoUrl: string): Promise<any> => {
  try {
    const resp = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });
    return await resp.json();
  } catch (e) {
    console.warn('AI error:', e);
    return null;
  }
};

const buildThumbnailUrl = (videoUrl: string, timestamp: number, width: number = 720): string => {
  return videoUrl
    .replace('/video/upload/', `/video/upload/so_${timestamp},w_${width}/`)
    .replace(/\.mp4$/, '.jpg');
};

export default function PublishScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  const [step, setStep] = useState<'idle' | 'uploading' | 'analyzing' | 'ready'>('idle');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [frameTimestamps, setFrameTimestamps] = useState<number[]>([]);
  const [selectedFrameTimestamp, setSelectedFrameTimestamp] = useState<number>(12);

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [basePeople, setBasePeople] = useState('2');
  const [priceNum, setPriceNum] = useState('');
  const [category, setCategory] = useState('monde');
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [isPescatarian, setIsPescatarian] = useState(false);
  const [isGlutenFree, setIsGlutenFree] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientInput[]>([{ name: '', amount: '', unit: '' }]);

  const [submitting, setSubmitting] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user || null;
      setUser(u);
      if (u) {
        const adminStatus = await isAdmin();
        setUserIsAdmin(adminStatus);
      }
    })();
  }, []);

  const pickVideo = async () => {
    haptic();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorise l'accès à tes vidéos pour publier une recette.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 180,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setVideoUri(uri);
    setStep('uploading');
    setAiWarning(null);

    const uploadedUrl = await uploadToCloudinary(uri);
    if (!uploadedUrl) {
      setStep('idle');
      setVideoUri(null);
      Alert.alert('Erreur', "L'upload de la vidéo a échoué. Réessaie.");
      return;
    }
    setVideoUrl(uploadedUrl);
    setStep('analyzing');

    const aiResult = await analyzeVideo(uploadedUrl);
    if (aiResult?.success && aiResult.recipe) {
      const r = aiResult.recipe;
      if (r.title) setTitle(r.title);
      if (r.time) setTime(r.time);
      if (r.base_people) setBasePeople(String(r.base_people));
      if (r.price_num) setPriceNum(String(r.price_num));
      if (r.category) setCategory(r.category);
      if (typeof r.is_vegetarian === 'boolean') setIsVegetarian(r.is_vegetarian);
      if (typeof r.is_pescatarian === 'boolean') setIsPescatarian(r.is_pescatarian);
      if (typeof r.is_gluten_free === 'boolean') setIsGlutenFree(r.is_gluten_free);
      if (Array.isArray(r.ingredients) && r.ingredients.length > 0) {
        setIngredients(r.ingredients.map((i: any) => ({
          name: i.name || '',
          amount: i.amount != null ? String(i.amount) : '',
          unit: i.unit || '',
        })));
      }
      if (Array.isArray(aiResult.frameTimestamps)) {
        setFrameTimestamps(aiResult.frameTimestamps);
      }
      if (typeof aiResult.bestFrameTimestamp === 'number') {
        setSelectedFrameTimestamp(aiResult.bestFrameTimestamp);
      }
      haptic('success');
    } else if (aiResult?.error === 'no_audio' || aiResult?.error === 'no_content') {
      setAiWarning("La vidéo n'a pas d'audio détectable. Remplis les champs à la main.");
      if (Array.isArray(aiResult.frameTimestamps)) setFrameTimestamps(aiResult.frameTimestamps);
    } else if (aiResult?.error === 'parse_failed') {
      setAiWarning("L'IA a eu du mal à analyser. Vérifie et complète les champs.");
      if (Array.isArray(aiResult.frameTimestamps)) setFrameTimestamps(aiResult.frameTimestamps);
    } else {
      setAiWarning("L'analyse IA a échoué. Remplis les champs à la main.");
    }
    setStep('ready');
  };

  const resetVideo = () => {
    haptic();
    setVideoUri(null);
    setVideoUrl('');
    setStep('idle');
    setAiWarning(null);
    setFrameTimestamps([]);
    setSelectedFrameTimestamp(12);
    setTitle('');
    setTime('');
    setBasePeople('2');
    setPriceNum('');
    setCategory('monde');
    setIsVegetarian(false);
    setIsPescatarian(false);
    setIsGlutenFree(false);
    setIngredients([{ name: '', amount: '', unit: '' }]);
  };

  const selectFrame = (timestamp: number) => {
    haptic();
    setSelectedFrameTimestamp(timestamp);
  };

  const addIngredient = () => {
    haptic();
    setIngredients(prev => [...prev, { name: '', amount: '', unit: '' }]);
  };

  const removeIngredient = (idx: number) => {
    haptic();
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, field: keyof IngredientInput, value: string) => {
    setIngredients(prev => prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)));
  };

  const submit = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Tu dois être connecté pour publier.');
      return;
    }
    if (!videoUrl) {
      Alert.alert('Vidéo manquante', 'Choisis ta vidéo avant de publier.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Champ manquant', 'Donne un titre à ta recette.');
      return;
    }
    const cleanIngredients = ingredients
      .filter(i => i.name.trim())
      .map(i => ({
        name: i.name.trim(),
        amount: i.amount.trim() ? parseFloat(i.amount.replace(',', '.')) : null,
        unit: i.unit.trim() || null,
      }));
    if (cleanIngredients.length === 0) {
      Alert.alert('Ingrédients', 'Ajoute au moins un ingrédient.');
      return;
    }

    haptic('medium');
    setSubmitting(true);

    const creatorId = await getOrCreateCreator(user);
    if (!creatorId) {
      setSubmitting(false);
      Alert.alert('Erreur', "Impossible de créer ton profil créateur. Réessaie.");
      return;
    }

    const basePeopleNum = parseInt(basePeople) || 2;
    const priceNumber = priceNum.trim() ? parseInt(priceNum) : 0;
    const priceStr = priceNumber > 0 ? `~${priceNumber}€` : '';
    const thumbnailUrl = buildThumbnailUrl(videoUrl, selectedFrameTimestamp);

    const { error } = await supabase.from('recipes').insert({
      creator_id: creatorId,
      title: title.trim(),
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      insta_url: '',
      time: time.trim(),
      people: `${basePeopleNum} pers.`,
      base_people: basePeopleNum,
      price: priceStr,
      price_num: priceNumber,
      category,
      is_vegetarian: isVegetarian,
      is_pescatarian: isPescatarian,
      is_gluten_free: isGlutenFree,
      ingredients: cleanIngredients,
      likes_count: 0,
      status: userIsAdmin ? 'approved' : 'pending',
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      haptic('success');
      Alert.alert(
        'Recette envoyée ✅',
        userIsAdmin
          ? 'Ta recette est publiée et visible dans le feed.'
          : "Ta recette a été envoyée. Elle sera publiée après validation par l'équipe FeedMe (généralement sous 24h).",
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  };

  const goBack = () => { haptic(); router.back(); };

  const regimes = [
    { key: 'veg', label: 'Végétarien', value: isVegetarian, set: setIsVegetarian },
    { key: 'pesc', label: 'Pescétarien', value: isPescatarian, set: setIsPescatarian },
    { key: 'gf', label: 'Sans gluten', value: isGlutenFree, set: setIsGlutenFree },
  ];

  const renderUploader = () => {
    if (step === 'idle') {
      return (
        <Pressable style={styles.uploader} onPress={pickVideo}>
          <View style={styles.uploaderIcon}>
            <IconCamera color="#FFFFFF" size={32} />
          </View>
          <Text style={styles.uploaderTitle}>Choisir ta vidéo</Text>
          <Text style={styles.uploaderSub}>L'IA s'occupera de tout remplir{'\n'}et tu choisiras ta miniature préférée</Text>
        </Pressable>
      );
    }
    if (step === 'uploading' || step === 'analyzing') {
      return (
        <View style={styles.uploader}>
          <Spinner size={36} color={ACCENT} baseColor="rgba(0,200,150,0.15)" />
          <Text style={[styles.uploaderTitle, { marginTop: 14 }]}>
            {step === 'uploading' ? 'Upload en cours...' : 'Analyse de la recette...'}
          </Text>
          <Text style={styles.uploaderSub}>
            {step === 'uploading' ? 'Ta vidéo arrive sur nos serveurs' : "L'IA détecte les ingrédients et choisit la meilleure miniature"}
          </Text>
        </View>
      );
    }
    const previewUrl = videoUrl ? buildThumbnailUrl(videoUrl, selectedFrameTimestamp) : null;
    return (
      <View style={{ marginBottom: 22 }}>
        <View style={styles.videoPreview}>
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.videoThumb} resizeMode="cover" />
          ) : videoUri ? (
            <Image source={{ uri: videoUri }} style={styles.videoThumb} resizeMode="cover" />
          ) : null}
          <View style={styles.videoOverlay}>
            <View style={styles.aiBadge}>
              <IconSparkles color={ACCENT} size={12} />
              <Text style={styles.aiBadgeText}>Miniature de ta recette</Text>
            </View>
            <TouchableOpacity onPress={resetVideo} style={styles.resetBtn} activeOpacity={0.7}>
              <IconClose color="#FFFFFF" size={16} />
              <Text style={styles.resetBtnText}>Changer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {frameTimestamps.length > 1 && (
          <View style={styles.frameSelectorWrap}>
            <Text style={styles.frameSelectorLabel}>Choisis la miniature qui te plaît le plus</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.framesScroll}
            >
              {frameTimestamps.map((t) => {
                const isSelected = t === selectedFrameTimestamp;
                const frameUrl = buildThumbnailUrl(videoUrl, t, 240);
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => selectFrame(t)}
                    activeOpacity={0.75}
                    style={[styles.frameThumb, isSelected && styles.frameThumbActive]}
                  >
                    <Image source={{ uri: frameUrl }} style={styles.frameThumbImg} resizeMode="cover" />
                    {isSelected && (
                      <View style={styles.frameCheck}>
                        <IconCheck color="#FFFFFF" size={12} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const formDisabled = step !== 'ready';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <IconBack color={TEXT_DARK} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publier une recette</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderUploader()}

        {aiWarning && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{aiWarning}</Text>
          </View>
        )}

        <View style={[styles.field, formDisabled && styles.fieldDisabled]} pointerEvents={formDisabled ? 'none' : 'auto'}>
          <Text style={styles.label}>Titre de la recette *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="L'IA va le proposer..."
            placeholderTextColor={TEXT_LIGHT}
            style={styles.input}
            editable={!formDisabled}
          />
        </View>

        <View style={[styles.row2, formDisabled && styles.fieldDisabled]} pointerEvents={formDisabled ? 'none' : 'auto'}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Temps</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="20 min"
              placeholderTextColor={TEXT_LIGHT}
              style={styles.input}
              editable={!formDisabled}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Personnes</Text>
            <TextInput
              value={basePeople}
              onChangeText={setBasePeople}
              placeholder="2"
              placeholderTextColor={TEXT_LIGHT}
              keyboardType="number-pad"
              style={styles.input}
              editable={!formDisabled}
            />
          </View>
        </View>

        <View style={[styles.field, formDisabled && styles.fieldDisabled]} pointerEvents={formDisabled ? 'none' : 'auto'}>
          <Text style={styles.label}>Prix estimé (€)</Text>
          <TextInput
            value={priceNum}
            onChangeText={setPriceNum}
            placeholder="10"
            placeholderTextColor={TEXT_LIGHT}
            keyboardType="number-pad"
            style={styles.input}
            editable={!formDisabled}
          />
        </View>

        <View style={[styles.field, formDisabled && styles.fieldDisabled]} pointerEvents={formDisabled ? 'none' : 'auto'}>
          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.pillsWrap}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => { haptic(); setCategory(cat); }}
                style={[styles.pill, category === cat && styles.pillActive]}
                activeOpacity={0.7}
                disabled={formDisabled}
              >
                <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.field, formDisabled && styles.fieldDisabled]} pointerEvents={formDisabled ? 'none' : 'auto'}>
          <Text style={styles.label}>Régimes adaptés</Text>
          <View style={styles.pillsWrap}>
            {regimes.map(r => (
              <TouchableOpacity
                key={r.key}
                onPress={() => { haptic(); r.set(!r.value); }}
                style={[styles.pill, r.value && styles.pillActive]}
                activeOpacity={0.7}
                disabled={formDisabled}
              >
                <Text style={[styles.pillText, r.value && styles.pillTextActive]}>
                  {r.value ? '✓ ' : ''}{r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.field, formDisabled && styles.fieldDisabled]} pointerEvents={formDisabled ? 'none' : 'auto'}>
          <View style={styles.ingHeader}>
            <Text style={styles.label}>Ingrédients *</Text>
            <TouchableOpacity onPress={addIngredient} style={styles.addBtn} activeOpacity={0.7} disabled={formDisabled}>
              <IconPlus color={ACCENT} size={14} />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {ingredients.map((ing, idx) => (
            <View key={idx} style={styles.ingRow}>
              <TextInput
                value={ing.amount}
                onChangeText={(v) => updateIngredient(idx, 'amount', v)}
                placeholder="Qté"
                placeholderTextColor={TEXT_LIGHT}
                keyboardType="numeric"
                style={[styles.input, styles.ingAmount]}
                editable={!formDisabled}
              />
              <TextInput
                value={ing.unit}
                onChangeText={(v) => updateIngredient(idx, 'unit', v)}
                placeholder="Unité"
                placeholderTextColor={TEXT_LIGHT}
                autoCapitalize="none"
                style={[styles.input, styles.ingUnit]}
                editable={!formDisabled}
              />
              <TextInput
                value={ing.name}
                onChangeText={(v) => updateIngredient(idx, 'name', v)}
                placeholder="Nom"
                placeholderTextColor={TEXT_LIGHT}
                style={[styles.input, styles.ingName]}
                editable={!formDisabled}
              />
              {ingredients.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeIngredient(idx)}
                  style={styles.ingRemove}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={formDisabled}
                >
                  <IconClose color={TEXT_GRAY} size={14} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={submitting || formDisabled}
          style={[styles.submitBtn, (submitting || formDisabled) && styles.submitBtnDisabled]}
          activeOpacity={0.85}
        >
          {submitting ? (
            <Spinner size={22} color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              {userIsAdmin ? 'Publier la recette' : 'Envoyer pour validation'}
            </Text>
          )}
        </TouchableOpacity>
        {!userIsAdmin && user && step === 'ready' && (
          <Text style={styles.disclaimer}>
            Ta recette sera examinée par l'équipe FeedMe avant publication.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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

  scroll: { flex: 1 },

  uploader: {
    backgroundColor: ACCENT_BG, borderRadius: 18, padding: 28, alignItems: 'center',
    borderWidth: 2, borderColor: ACCENT, borderStyle: 'dashed', marginBottom: 22,
  },
  uploaderIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#008C68', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  uploaderTitle: { fontSize: 17, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.3, marginBottom: 6 },
  uploaderSub: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center', lineHeight: 18 },

  videoPreview: { borderRadius: 18, overflow: 'hidden', height: 220, backgroundColor: '#000' },
  videoThumb: { width: '100%', height: '100%' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  aiBadgeText: { fontSize: 11, fontWeight: '800', color: ACCENT },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  resetBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  frameSelectorWrap: { marginTop: 14 },
  frameSelectorLabel: { fontSize: 12, fontWeight: '700', color: TEXT_GRAY, marginBottom: 10, textAlign: 'center' },
  framesScroll: { gap: 8, paddingHorizontal: 4 },
  frameThumb: {
    width: 72, height: 100, borderRadius: 10, overflow: 'hidden',
    borderWidth: 2.5, borderColor: 'transparent',
    backgroundColor: '#F0F0F0', position: 'relative',
  },
  frameThumbActive: { borderColor: ACCENT, shadowColor: '#008C68', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  frameThumbImg: { width: '100%', height: '100%' },
  frameCheck: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },

  warningBox: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE0A3', borderRadius: 12, padding: 12, marginBottom: 18 },
  warningText: { fontSize: 12, color: '#8B5E00', lineHeight: 17 },

  field: { marginBottom: 18 },
  fieldDisabled: { opacity: 0.45 },
  label: { fontSize: 11, fontWeight: '800', color: TEXT_DARK, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '500', color: TEXT_DARK,
  },
  row2: { flexDirection: 'row', gap: 12 },

  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive: { backgroundColor: ACCENT_BG, borderColor: ACCENT },
  pillText: { fontSize: 12, fontWeight: '600', color: TEXT_GRAY, textTransform: 'capitalize' },
  pillTextActive: { color: ACCENT, fontWeight: '800' },

  ingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: ACCENT_BG },
  addBtnText: { fontSize: 12, fontWeight: '800', color: ACCENT },
  ingRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 },
  ingAmount: { flex: 0.7, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13 },
  ingUnit: { flex: 0.9, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13 },
  ingName: { flex: 2, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13 },
  ingRemove: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },

  submitBtn: { backgroundColor: ACCENT, borderRadius: 100, padding: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12, shadowColor: '#008C68', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  disclaimer: { textAlign: 'center', fontSize: 11, color: TEXT_GRAY, marginTop: 10, lineHeight: 16 },
});
