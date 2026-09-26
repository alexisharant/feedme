import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const BORDER = '#EFEFEF';

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

const IconBack = ({ color = TEXT_DARK, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconCheck = ({ color = '#FFFFFF', size = 12 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const DIETS = [
  { id: 'all',         label: 'Tous régimes' },
  { id: 'vegetarian',  label: 'Végétarien' },
  { id: 'pescatarian', label: 'Pescatarien' },
  { id: 'glutenFree',  label: 'Sans gluten' },
];

const PEOPLE_OPTIONS = [
  { id: '1', label: '1 personne' },
  { id: '2', label: '2 personnes' },
  { id: '4', label: '4 personnes' },
  { id: '6', label: '6+ personnes' },
];

const BUDGETS = [
  { id: 'low',    label: 'Petit budget',   desc: 'Moins de 10€' },
  { id: 'medium', label: 'Budget moyen',   desc: "Jusqu'à 20€" },
  { id: 'high',   label: 'Sans limite',    desc: 'Tous les prix' },
];

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const [diet, setDiet] = useState('all');
  const [people, setPeople] = useState('2');
  const [budget, setBudget] = useState('high');

  useEffect(() => {
    (async () => {
      const d = await AsyncStorage.getItem('diet');
      const p = await AsyncStorage.getItem('defaultPeople');
      const b = await AsyncStorage.getItem('budget');
      if (d) setDiet(d);
      if (p) setPeople(p);
      if (b) setBudget(b);
    })();
  }, []);

  const setDietVal = async (v: string) => {
    haptic();
    setDiet(v);
    await AsyncStorage.setItem('diet', v);
  };

  const setPeopleVal = async (v: string) => {
    haptic();
    setPeople(v);
    await AsyncStorage.setItem('defaultPeople', v);
  };

  const setBudgetVal = async (v: string) => {
    haptic();
    setBudget(v);
    await AsyncStorage.setItem('budget', v);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <IconBack color={TEXT_DARK} size={20} />
        </TouchableOpacity>
        <Text style={styles.title}>Préférences</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.divider} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon régime alimentaire</Text>
          {DIETS.map(d => {
            const isActive = diet === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.option, isActive && styles.optionActive]}
                onPress={() => setDietVal(d.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{d.label}</Text>
                {isActive && (
                  <View style={styles.optionCheck}>
                    <IconCheck color="#FFFFFF" size={12} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pour combien de personnes en général ?</Text>
          {PEOPLE_OPTIONS.map(p => {
            const isActive = people === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.option, isActive && styles.optionActive]}
                onPress={() => setPeopleVal(p.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{p.label}</Text>
                {isActive && (
                  <View style={styles.optionCheck}>
                    <IconCheck color="#FFFFFF" size={12} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget par recette</Text>
          {BUDGETS.map(b => {
            const isActive = budget === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.option, isActive && styles.optionActive]}
                onPress={() => setBudgetVal(b.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{b.label}</Text>
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

        <Text style={styles.hint}>Tes préférences filtrent les recettes proposées dans le feed.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5 },
  divider: { height: 1, backgroundColor: BORDER },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: BORDER,
  },
  optionActive: { backgroundColor: ACCENT_BG, borderColor: ACCENT },
  optionText: { fontSize: 14, fontWeight: '600', color: TEXT_DARK },
  optionTextActive: { color: ACCENT, fontWeight: '800' },
  optionDesc: { fontSize: 12, color: TEXT_GRAY, marginTop: 2 },
  optionDescActive: { color: ACCENT },
  optionCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, color: TEXT_GRAY, textAlign: 'center', marginTop: 8, lineHeight: 18, paddingHorizontal: 20 },
});
