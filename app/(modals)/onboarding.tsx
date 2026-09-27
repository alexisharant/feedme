import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';

const haptic = (t: 'light' | 'success' = 'light') => {
  try {
    if (t === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

const IconBack = ({ color = TEXT_DARK, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconCheck = ({ color = '#FFFFFF', size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconArrowRight = ({ color = '#FFFFFF', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const SUPERMARCHES = [
  { id: 'leclerc',     name: 'E.Leclerc',   logo: require('../../assets/images/logos/leclerc.jpg') },
  { id: 'carrefour',   name: 'Carrefour',   logo: require('../../assets/images/logos/carrefour.png') },
  { id: 'auchan',      name: 'Auchan',      logo: require('../../assets/images/logos/auchan.jpg') },
  { id: 'intermarche', name: 'Intermarché', logo: require('../../assets/images/logos/intermarche.jpg') },
  { id: 'superu',      name: 'Super U',     logo: require('../../assets/images/logos/superu.png') },
];

const DIETS = [
  { id: 'all',         label: 'Tous régimes',   desc: 'Je mange de tout' },
  { id: 'vegetarian',  label: 'Végétarien',     desc: 'Pas de viande, pas de poisson' },
  { id: 'pescatarian', label: 'Pescatarien',    desc: 'Poisson oui, viande non' },
  { id: 'glutenFree',  label: 'Sans gluten',    desc: 'Régime sans gluten' },
];

const PEOPLE_OPTIONS = [
  { id: '1', label: '1 personne',    desc: 'Solo cuisine' },
  { id: '2', label: '2 personnes',   desc: 'En couple ou colocataire' },
  { id: '4', label: '4 personnes',   desc: 'En famille' },
  { id: '6', label: '6+ personnes',  desc: 'Grandes tablées' },
];

const BUDGETS = [
  { id: 'low',    label: 'Petit budget',   desc: 'Moins de 10€ par recette' },
  { id: 'medium', label: 'Budget moyen',   desc: "Jusqu'à 20€ par recette" },
  { id: 'high',   label: 'Sans limite',    desc: 'Tous les prix' },
];

const TOTAL_STEPS = 4;

const INTRO_WIDTH = Dimensions.get('window').width;
const INTRO_SLIDES = [
  { emoji: '🎬', title: 'Des recettes qui donnent faim', text: 'Scrolle des vidéos de cuisine des meilleurs créateurs, comme sur TikTok.' },
  { emoji: '🛒', title: 'La vidéo devient ta liste de courses', text: 'Choisis pour combien de personnes : les quantités sont recalculées et ajoutées à ton panier.' },
  { emoji: '🏪', title: 'Tes courses en un tap', text: 'Commande chez ton supermarché préféré ou partage ta liste à qui tu veux.' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [introDone, setIntroDone] = useState(false);
  const [introIndex, setIntroIndex] = useState(0);
  const introRef = useRef<ScrollView>(null);
  const [supermarche, setSupermarche] = useState<string | null>(null);
  const [diet, setDiet] = useState<string | null>(null);
  const [people, setPeople] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);

  const canNext = () => {
    if (step === 1) return supermarche !== null;
    if (step === 2) return diet !== null;
    if (step === 3) return people !== null;
    if (step === 4) return budget !== null;
    return false;
  };

  const onNext = async () => {
    haptic();
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    haptic('success');
    await AsyncStorage.setItem('supermarche', supermarche!);
    await AsyncStorage.setItem('diet', diet!);
    await AsyncStorage.setItem('defaultPeople', people!);
    await AsyncStorage.setItem('budget', budget!);
    await AsyncStorage.setItem('onboardingDone', 'true');
    router.replace('/(tabs)' as any);
  };

  const onBack = () => {
    if (step <= 1) return;
    haptic();
    setStep(step - 1);
  };

  const progressPct = (step / TOTAL_STEPS) * 100;

  // ---------- Écrans de présentation (avant les questions) ----------
  const goIntro = (i: number) => {
    haptic();
    introRef.current?.scrollTo({ x: i * INTRO_WIDTH, animated: true });
    setIntroIndex(i);
  };
  const finishIntro = () => { haptic(); setIntroDone(true); };

  if (!introDone) {
    const last = introIndex === INTRO_SLIDES.length - 1;
    return (
      <View style={styles.introContainer}>
        <View style={[styles.introTop, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.introLogo}>Feed<Text style={{ color: ACCENT }}>Me</Text></Text>
          {!last && (
            <TouchableOpacity onPress={finishIntro} hitSlop={10}>
              <Text style={styles.introSkip}>Passer</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={introRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIntroIndex(Math.round(e.nativeEvent.contentOffset.x / INTRO_WIDTH))}
          style={{ flex: 1 }}
        >
          {INTRO_SLIDES.map((sl) => (
            <View key={sl.title} style={[styles.introSlide, { width: INTRO_WIDTH }]}>
              <View style={styles.introBadge}>
                <Text style={styles.introEmoji}>{sl.emoji}</Text>
              </View>
              <Text style={styles.introTitle}>{sl.title}</Text>
              <Text style={styles.introText}>{sl.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.introBottom, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.introDots}>
            {INTRO_SLIDES.map((_, i) => (
              <View key={i} style={[styles.introDot, i === introIndex && styles.introDotActive]} />
            ))}
          </View>
          <TouchableOpacity
            style={styles.introBtn}
            onPress={() => (last ? finishIntro() : goIntro(introIndex + 1))}
            activeOpacity={0.85}
          >
            <Text style={styles.introBtnText}>{last ? "C'est parti !" : 'Suivant'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerTop}>
          {step > 1 ? (
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
              <IconBack color={TEXT_DARK} size={20} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.stepIndicator}>Étape {step} sur {TOTAL_STEPS}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <>
            <Text style={styles.title}>Quel est ton supermarché préféré ?</Text>
            <Text style={styles.subtitle}>On t'enverra commander les ingrédients dessus en un clic.</Text>
            <View style={styles.options}>
              {SUPERMARCHES.map(sm => {
                const isActive = supermarche === sm.id;
                return (
                  <TouchableOpacity
                    key={sm.id}
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => { haptic(); setSupermarche(sm.id); }}
                    activeOpacity={0.7}
                  >
                    <Image source={sm.logo} style={styles.smLogo} resizeMode="contain" />
                    <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>{sm.name}</Text>
                    {isActive && (
                      <View style={styles.optionCheck}>
                        <IconCheck color="#FFFFFF" size={12} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Quel est ton régime alimentaire ?</Text>
            <Text style={styles.subtitle}>On filtrera les recettes selon ton choix.</Text>
            <View style={styles.options}>
              {DIETS.map(d => {
                const isActive = diet === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => { haptic(); setDiet(d.id); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>{d.label}</Text>
                      <Text style={[styles.optionDesc, isActive && styles.optionDescActive]}>{d.desc}</Text>
                    </View>
                    {isActive && (
                      <View style={styles.optionCheck}>
                        <IconCheck color="#FFFFFF" size={12} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>Pour combien de personnes tu cuisines ?</Text>
            <Text style={styles.subtitle}>Tu pourras toujours l'ajuster sur chaque recette.</Text>
            <View style={styles.options}>
              {PEOPLE_OPTIONS.map(p => {
                const isActive = people === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => { haptic(); setPeople(p.id); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>{p.label}</Text>
                      <Text style={[styles.optionDesc, isActive && styles.optionDescActive]}>{p.desc}</Text>
                    </View>
                    {isActive && (
                      <View style={styles.optionCheck}>
                        <IconCheck color="#FFFFFF" size={12} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.title}>Quel budget par recette ?</Text>
            <Text style={styles.subtitle}>Pour adapter les recettes proposées.</Text>
            <View style={styles.options}>
              {BUDGETS.map(b => {
                const isActive = budget === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => { haptic(); setBudget(b.id); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>{b.label}</Text>
                      <Text style={[styles.optionDesc, isActive && styles.optionDescActive]}>{b.desc}</Text>
                    </View>
                    {isActive && (
                      <View style={styles.optionCheck}>
                        <IconCheck color="#FFFFFF" size={12} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
          onPress={onNext}
          disabled={!canNext()}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {step === TOTAL_STEPS ? "C'est parti !" : 'Suivant'}
          </Text>
          <IconArrowRight color="#FFFFFF" size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  introContainer: { flex: 1, backgroundColor: '#0A0A0A' },
  introTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  introLogo: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.6 },
  introSkip: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  introSlide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  introBadge: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(0,200,150,0.14)', borderWidth: 2, borderColor: 'rgba(0,200,150,0.5)', alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  introEmoji: { fontSize: 64 },
  introTitle: { fontSize: 30, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', letterSpacing: -1, lineHeight: 34, marginBottom: 14 },
  introText: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 23 },
  introBottom: { paddingHorizontal: 24 },
  introDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  introDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  introDotActive: { width: 22, backgroundColor: ACCENT },
  introBtn: { backgroundColor: ACCENT, borderRadius: 100, height: 56, alignItems: 'center', justifyContent: 'center' },
  introBtnText: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },

  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  stepIndicator: { fontSize: 12, fontWeight: '700', color: TEXT_GRAY, letterSpacing: 0.5, textTransform: 'uppercase' },
  progressBar: { height: 4, backgroundColor: '#F0F0F0', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.7, lineHeight: 32, marginBottom: 8 },
  subtitle: { fontSize: 14, color: TEXT_GRAY, lineHeight: 20, marginBottom: 28 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: BORDER,
  },
  optionActive: { borderColor: ACCENT, backgroundColor: ACCENT_BG },
  optionLabel: { fontSize: 15, fontWeight: '700', color: TEXT_DARK, flex: 1 },
  optionLabelActive: { color: ACCENT, fontWeight: '800' },
  optionDesc: { fontSize: 12, color: TEXT_GRAY, marginTop: 3 },
  optionDescActive: { color: ACCENT },
  optionCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  smLogo: { width: 36, height: 36, borderRadius: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#FFFFFF' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 100, padding: 16,
    shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  nextBtnDisabled: { backgroundColor: '#D0D0D0', shadowOpacity: 0, elevation: 0 },
  nextBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});
