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

// Dernière erreur d'upload, affichée à l'utilisateur pour savoir ce qui bloque.
let lastUploadError = '';

const uploadToCloudinary = async (videoUri: string, mimeType?: string | null): Promise<string | null> => {
  lastUploadError = '';
  const isMov = (mimeType || '').includes('quicktime') || /\.mov$/i.test(videoUri);
  const formData = new FormData();
  formData.append('file', {
    uri: videoUri,
    type: mimeType || (isMov ? 'video/quicktime' : 'video/mp4'),
    name: isMov ? 'recipe.mov' : 'recipe.mp4',
  } as any);
  formData.append('upload_preset', CLOUDINARY_PRESET);

  // On passe par XMLHttpRequest : le fetch d'Expo ne sait pas envoyer un fichier
  // local dans un FormData (« Unsupported FormDataPart implementation »).
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`);
    xhr.onload = () => {
      let data: any = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) {}
      if (data?.secure_url) {
        resolve(data.secure_url);
        return;
      }
      lastUploadError = data?.error?.message || `HTTP ${xhr.status} ${String(xhr.responseText || '').slice(0, 120)}`;
      console.warn('Cloudinary error:', lastUploadError);
      resolve(null);
    };
    xhr.onerror = () => {
      lastUploadError = 'Problème de connexion pendant l\'envoi';
      console.warn('Upload error:', lastUploadError);
      resolve(null);
    };
    xhr.send(formData);
  });
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
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [userLoaded, setUserLoaded] = useState(false);
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
      setUserLoaded(true);
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
      mediaTypes: ['videos'],
      videoMaxDuration: 180,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const sizeMb = asset.fileSize ? Math.round(asset.fileSize / 1024 / 1024) : null;
    setVideoUri(uri);
    setStep('uploading');
    setAiWarning(null);

    const uploadedUrl = await uploadToCloudinary(uri, asset.mimeType);
    if (!uploadedUrl) {
      setStep('idle');
      setVideoUri(null);
      setFormStep(1);
      Alert.alert(
        "L'upload a échoué",
        `${lastUploadError || 'Erreur inconnue'}${sizeMb ? `\n\nTaille de la vidéo : ${sizeMb} Mo` : ''}`,
      );
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
    setFormStep(2);
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
    setFormStep(1);
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

  const goBack = () => {
    haptic();
    if (formStep > 1 && step === 'ready') {
      setFormStep((formStep - 1) as 1 | 2 | 3);
      return;
    }
    router.back();
  };

  const goLogin = () => { haptic(); router.replace('/(modals)/signup' as any); };

  const regimes = [
    { key: 'veg', label: 'Végétarien', value: isVegetarian, set: setIsVegetarian },
    { key: 'pesc', label: 'Pescétarien', value: isPescatarian, set: setIsPescatarian },
    { key: 'gf', label: 'Sans gluten', value: isGlutenFree, set: setIsGlutenFree },
  ];

  const peopleNum = Math.max(1, parseInt(basePeople) || 2);
  const changePeople = (delta: number) => {
    haptic();
    setBasePeople(String(Math.max(1, Math.min(20, peopleNum + delta))));
  };

  const filledIngredients = ingredients.filter(i => i.name.trim()).length;
  const aiFilled = step === 'ready' && !aiWarning;
  const previewUrl = videoUrl ? buildThumbnailUrl(videoUrl, selectedFrameTimestamp, 480) : null;

  // ---------- En-tête avec progression ----------
  const STEP_LABELS = ['Vidéo', 'Infos', 'Ingrédients'];
  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <IconBack color={TEXT_DARK} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle recette</Text>
        <View style={{ width: 38 }} />
      </View>
      {!!user && (
        <View style={styles.progressRow}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const active = n <= formStep;
            return (
              <View key={label} style={styles.progressItem}>
                <View style={[styles.progressBar, active && styles.progressBarActive]} />
                <Text style={[styles.progressLabel, n === formStep && styles.progressLabelActive]}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  // ---------- Pas connecté ----------
  if (userLoaded && !user) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.gate}>
          <View style={styles.gateIcon}><IconCamera color="#FFFFFF" size={34} /></View>
          <Text style={styles.gateTitle}>Partage tes recettes</Text>
          <Text style={styles.gateSub}>Crée ton compte pour publier tes vidéos.{'\n'}L'IA remplit la recette pour toi.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={goLogin} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Créer mon compte</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 14 }} onPress={() => { haptic(); router.replace('/(modals)/login' as any); }}>
            <Text style={styles.linkText}>J'ai déjà un compte</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Étape 1 : vidéo ----------
  const renderStepVideo = () => {
    if (step === 'uploading' || step === 'analyzing') {
      const items = [
        { label: 'Vidéo sélectionnée', done: true, active: false },
        { label: 'Envoi de la vidéo', done: step === 'analyzing', active: step === 'uploading' },
        { label: "L'IA lit la recette", done: false, active: step === 'analyzing' },
        { label: 'Choix de la miniature', done: false, active: false },
      ];
      return (
        <View style={styles.processing}>
          <View style={styles.processingIcon}>
            <Spinner size={44} color={ACCENT} baseColor="rgba(0,200,150,0.15)" />
          </View>
          <Text style={styles.processingTitle}>
            {step === 'uploading' ? 'Envoi de ta vidéo…' : 'On prépare ta recette ✨'}
          </Text>
          <Text style={styles.processingSub}>Ça prend en général moins d'une minute.{'\n'}Garde l'app ouverte.</Text>
          <View style={styles.checklist}>
            {items.map(it => (
              <View key={it.label} style={styles.checkRow}>
                <View style={[styles.checkDot, it.done && styles.checkDotDone, it.active && styles.checkDotActive]}>
                  {it.done ? <IconCheck color="#FFFFFF" size={11} /> : it.active ? <Spinner size={12} color={ACCENT} baseColor="rgba(0,200,150,0.2)" /> : null}
                </View>
                <Text style={[styles.checkText, (it.done || it.active) && styles.checkTextOn]}>{it.label}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }
    return (
      <View style={{ padding: 20 }}>
        <Pressable style={styles.uploader} onPress={pickVideo}>
          <View style={styles.uploaderIcon}><IconCamera color="#FFFFFF" size={34} /></View>
          <Text style={styles.uploaderTitle}>Importe ta vidéo</Text>
          <Text style={styles.uploaderSub}>Celle que tu as déjà postée sur TikTok ou Insta.{'\n'}L'IA remplit la recette à ta place.</Text>
          <View style={styles.uploaderBtn}>
            <Text style={styles.uploaderBtnText}>Choisir dans ma galerie</Text>
          </View>
        </Pressable>
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Pour un résultat parfait</Text>
          <Text style={styles.tip}>📱  Format vertical, 3 minutes max</Text>
          <Text style={styles.tip}>🗣️  Cite les ingrédients et les quantités à voix haute</Text>
          <Text style={styles.tip}>🍽️  Montre bien le plat fini, pour la miniature</Text>
        </View>
      </View>
    );
  };

  // ---------- Étape 2 : infos ----------
  const renderStepInfos = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {aiWarning ? (
        <View style={styles.warningBox}><Text style={styles.warningText}>{aiWarning}</Text></View>
      ) : aiFilled ? (
        <View style={styles.aiBox}>
          <IconSparkles color={ACCENT} size={14} />
          <Text style={styles.aiBoxText}>L'IA a tout rempli. Vérifie et ajuste si besoin.</Text>
        </View>
      ) : null}

      <View style={styles.coverRow}>
        <View style={styles.cover}>
          {previewUrl ? <Image source={{ uri: previewUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <TouchableOpacity onPress={resetVideo} style={styles.coverChange} activeOpacity={0.8}>
            <Text style={styles.coverChangeText}>Changer</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Titre *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex : Pâtes crémeuses au citron"
            placeholderTextColor={TEXT_LIGHT}
            style={[styles.input, styles.titleInput]}
            multiline
            maxLength={70}
          />
          <Text style={styles.counter}>{title.length}/70</Text>
        </View>
      </View>

      {frameTimestamps.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.label}>Miniature</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {frameTimestamps.map((t) => {
              const isSelected = t === selectedFrameTimestamp;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => selectFrame(t)}
                  activeOpacity={0.75}
                  style={[styles.frameThumb, isSelected && styles.frameThumbActive]}
                >
                  <Image source={{ uri: buildThumbnailUrl(videoUrl, t, 240) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  {isSelected && (
                    <View style={styles.frameCheck}><IconCheck color="#FFFFFF" size={11} /></View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Temps de préparation</Text>
        <View style={styles.pillsWrap}>
          {['10 min', '20 min', '30 min', '45 min', '1 h'].map(t => (
            <TouchableOpacity key={t} onPress={() => { haptic(); setTime(t); }} style={[styles.pill, time === t && styles.pillActive]} activeOpacity={0.7}>
              <Text style={[styles.pillText, time === t && styles.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            value={['10 min', '20 min', '30 min', '45 min', '1 h'].includes(time) ? '' : time}
            onChangeText={setTime}
            placeholder="Autre…"
            placeholderTextColor={TEXT_LIGHT}
            style={styles.pillInput}
          />
        </View>
      </View>

      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Pour combien ?</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => changePeople(-1)} activeOpacity={0.7}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
            <Text style={styles.stepVal}>{peopleNum} <Text style={styles.stepUnit}>pers.</Text></Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => changePeople(1)} activeOpacity={0.7}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Prix estimé</Text>
          <View style={styles.priceWrap}>
            <TextInput
              value={priceNum}
              onChangeText={(v) => setPriceNum(v.replace(/[^0-9]/g, ''))}
              placeholder="10"
              placeholderTextColor={TEXT_LIGHT}
              keyboardType="number-pad"
              style={styles.priceInput}
            />
            <Text style={styles.priceUnit}>€</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Catégorie</Text>
        <View style={styles.pillsWrap}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} onPress={() => { haptic(); setCategory(cat); }} style={[styles.pill, category === cat && styles.pillActive]} activeOpacity={0.7}>
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Régimes adaptés</Text>
        <View style={styles.pillsWrap}>
          {regimes.map(r => (
            <TouchableOpacity key={r.key} onPress={() => { haptic(); r.set(!r.value); }} style={[styles.pill, r.value && styles.pillActive]} activeOpacity={0.7}>
              <Text style={[styles.pillText, r.value && styles.pillTextActive]}>{r.value ? '✓ ' : ''}{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  // ---------- Étape 3 : ingrédients ----------
  const renderStepIngredients = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.ingHeader}>
        <View>
          <Text style={styles.bigLabel}>Ingrédients</Text>
          <Text style={styles.ingSub}>Pour {peopleNum} personne{peopleNum > 1 ? 's' : ''} · {filledIngredients} ingrédient{filledIngredients > 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={addIngredient} style={styles.addBtn} activeOpacity={0.7}>
          <IconPlus color={ACCENT} size={14} />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {ingredients.map((ing, idx) => (
        <View key={idx} style={styles.ingCard}>
          <TextInput
            value={ing.amount}
            onChangeText={(v) => updateIngredient(idx, 'amount', v)}
            placeholder="Qté"
            placeholderTextColor={TEXT_LIGHT}
            keyboardType="decimal-pad"
            style={[styles.ingInput, styles.ingAmount]}
          />
          <TextInput
            value={ing.unit}
            onChangeText={(v) => updateIngredient(idx, 'unit', v)}
            placeholder="g, ml…"
            placeholderTextColor={TEXT_LIGHT}
            autoCapitalize="none"
            style={[styles.ingInput, styles.ingUnit]}
          />
          <TextInput
            value={ing.name}
            onChangeText={(v) => updateIngredient(idx, 'name', v)}
            placeholder="Ingrédient"
            placeholderTextColor={TEXT_LIGHT}
            style={[styles.ingInput, styles.ingName]}
          />
          {ingredients.length > 1 && (
            <TouchableOpacity onPress={() => removeIngredient(idx)} style={styles.ingRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <IconClose color={TEXT_GRAY} size={13} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity onPress={addIngredient} style={styles.addRow} activeOpacity={0.7}>
        <IconPlus color={ACCENT} size={16} />
        <Text style={styles.addRowText}>Ajouter un ingrédient</Text>
      </TouchableOpacity>

      {!userIsAdmin && (
        <Text style={styles.disclaimer}>Ta recette sera vérifiée par l'équipe FeedMe avant d'apparaître dans le feed.</Text>
      )}
    </ScrollView>
  );

  // ---------- Bouton du bas ----------
  const renderBottom = () => {
    if (formStep === 2) {
      const ok = title.trim().length > 0;
      return (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, !ok && styles.btnDisabled]}
            disabled={!ok}
            onPress={() => { haptic(); setFormStep(3); }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Suivant : les ingrédients</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (formStep === 3) {
      const ok = filledIngredients > 0 && !submitting;
      return (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, !ok && styles.btnDisabled]}
            disabled={!ok}
            onPress={submit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <Spinner size={22} color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>{userIsAdmin ? 'Publier la recette 🚀' : 'Envoyer ma recette 🚀'}</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {Header}
      <View style={{ flex: 1 }}>
        {formStep === 1 && renderStepVideo()}
        {formStep === 2 && renderStepInfos()}
        {formStep === 3 && renderStepIngredients()}
      </View>
      {renderBottom()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: BORDER },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.3 },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  progressItem: { flex: 1 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: '#EDEDED' },
  progressBarActive: { backgroundColor: ACCENT },
  progressLabel: { fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, marginTop: 5 },
  progressLabelActive: { color: TEXT_DARK, fontWeight: '800' },

  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  gateIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  gateTitle: { fontSize: 22, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5, marginBottom: 8 },
  gateSub: { fontSize: 14, color: TEXT_GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  linkText: { fontSize: 14, fontWeight: '800', color: ACCENT },

  uploader: {
    backgroundColor: '#0E0E0E', borderRadius: 24, paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center',
  },
  uploaderIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  uploaderTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 8 },
  uploaderSub: { fontSize: 13.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  uploaderBtn: { backgroundColor: '#FFFFFF', borderRadius: 100, paddingHorizontal: 22, paddingVertical: 13 },
  uploaderBtnText: { fontSize: 14, fontWeight: '900', color: TEXT_DARK },
  tips: { marginTop: 18, backgroundColor: '#F7F7F7', borderRadius: 18, padding: 16 },
  tipsTitle: { fontSize: 13, fontWeight: '900', color: TEXT_DARK, marginBottom: 10 },
  tip: { fontSize: 13, color: '#444', marginBottom: 7, lineHeight: 18 },

  processing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  processingIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  processingTitle: { fontSize: 20, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.4, marginBottom: 6 },
  processingSub: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center', lineHeight: 19, marginBottom: 26 },
  checklist: { alignSelf: 'stretch', backgroundColor: '#F7F7F7', borderRadius: 18, padding: 16, gap: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#DADADA', alignItems: 'center', justifyContent: 'center' },
  checkDotDone: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkDotActive: { borderColor: ACCENT },
  checkText: { fontSize: 14, fontWeight: '600', color: TEXT_LIGHT },
  checkTextOn: { color: TEXT_DARK },

  aiBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ACCENT_BG, borderRadius: 12, padding: 12, marginBottom: 18 },
  aiBoxText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#00875F' },
  warningBox: { backgroundColor: '#FFF6E5', borderRadius: 12, padding: 12, marginBottom: 18 },
  warningText: { fontSize: 13, color: '#8A5A00', fontWeight: '600', lineHeight: 18 },

  coverRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  cover: { width: 104, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111' },
  coverChange: { position: 'absolute', left: 6, right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 100, paddingVertical: 5, alignItems: 'center' },
  coverChangeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  titleInput: { minHeight: 92, textAlignVertical: 'top', fontSize: 16, fontWeight: '700' },
  counter: { fontSize: 11, color: TEXT_LIGHT, textAlign: 'right', marginTop: 4 },

  section: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '800', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  bigLabel: { fontSize: 22, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: TEXT_DARK },

  frameThumb: { width: 64, height: 92, borderRadius: 10, overflow: 'hidden', borderWidth: 2.5, borderColor: 'transparent', backgroundColor: '#EEE' },
  frameThumbActive: { borderColor: ACCENT },
  frameCheck: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },

  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, height: 36, borderRadius: 100, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: ACCENT },
  pillText: { fontSize: 13, fontWeight: '700', color: TEXT_DARK, textTransform: 'capitalize' },
  pillTextActive: { color: '#FFFFFF' },
  pillInput: { minWidth: 80, height: 36, borderRadius: 100, backgroundColor: '#F2F2F2', paddingHorizontal: 14, fontSize: 13, color: TEXT_DARK },

  row2: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 6, height: 50 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontWeight: '900', color: ACCENT, marginTop: -2 },
  stepVal: { fontSize: 17, fontWeight: '900', color: TEXT_DARK },
  stepUnit: { fontSize: 12, fontWeight: '600', color: TEXT_GRAY },
  priceWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, height: 50, paddingHorizontal: 14 },
  priceInput: { flex: 1, fontSize: 17, fontWeight: '900', color: TEXT_DARK, padding: 0 },
  priceUnit: { fontSize: 16, fontWeight: '800', color: TEXT_GRAY },

  ingHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  ingSub: { fontSize: 13, color: TEXT_GRAY, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ACCENT_BG, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 12, fontWeight: '800', color: ACCENT },
  ingCard: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F7F7F7', borderRadius: 14, padding: 6, marginBottom: 8 },
  ingInput: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: TEXT_DARK },
  ingAmount: { width: 58, textAlign: 'center', fontWeight: '800' },
  ingUnit: { width: 64 },
  ingName: { flex: 1 },
  ingRemove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: ACCENT, borderRadius: 14, paddingVertical: 14, marginTop: 4 },
  addRowText: { fontSize: 14, fontWeight: '800', color: ACCENT },
  disclaimer: { fontSize: 12, color: TEXT_GRAY, textAlign: 'center', marginTop: 18, lineHeight: 17 },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER },
  primaryBtn: {
    alignSelf: 'stretch', backgroundColor: ACCENT, borderRadius: 100, height: 54, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.4 },
});
