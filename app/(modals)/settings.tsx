import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Image, ScrollView, StyleSheet, Switch,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { isAdmin } from '../../lib/admin';
import { countSaved } from '../../lib/saves';
import { getDeviceId, migrateDeviceLikesToUser, supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

const SUPERMARCHES = [
  { id: 'leclerc',     name: 'E.Leclerc',   logo: require('../../assets/images/logos/leclerc.jpg') },
  { id: 'carrefour',   name: 'Carrefour',   logo: require('../../assets/images/logos/carrefour.png') },
  { id: 'auchan',      name: 'Auchan',      logo: require('../../assets/images/logos/auchan.jpg') },
  { id: 'intermarche', name: 'Intermarché', logo: require('../../assets/images/logos/intermarche.jpg') },
  { id: 'superu',      name: 'Super U',     logo: require('../../assets/images/logos/superu.png') },
];

const IconUser = ({ color = '#FFFFFF', size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" fill="none"/>
    <Path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"/>
  </Svg>
);

const IconStore = ({ color = ACCENT, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M9 22V12h6v10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconHeart = ({ color = ACCENT, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconBell = ({ color = ACCENT, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </Svg>
);

const IconChevron = ({ color = TEXT_LIGHT, size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconSettings = ({ color = ACCENT, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" fill="none"/>
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="1.8" fill="none"/>
  </Svg>
);

const IconShield = ({ color = ACCENT, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

const IconLogout = ({ color = '#FF3B5C', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </Svg>
);

const IconBookmark = ({ color = '#00C896', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [supermarche, setSupermarche] = useState('leclerc');
  const [notifs, setNotifs] = useState(true);
  const [showSmPicker, setShowSmPicker] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const loadAll = async () => {
    const { data } = await supabase.auth.getUser();
    const u = data?.user || null;
    setUser(u);

    if (u) {
      await migrateDeviceLikesToUser();
    }

    const adminStatus = await isAdmin();
    setIsUserAdmin(adminStatus);

    if (adminStatus) {
      const { count } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingCount(count || 0);
    } else {
      setPendingCount(0);
    }

    const sm = await AsyncStorage.getItem('supermarche');
    if (sm) setSupermarche(sm);

    setFavCount(u ? await countSaved(u.id) : 0);

    const savedNotifs = await AsyncStorage.getItem('notifs');
    if (savedNotifs !== null) setNotifs(savedNotifs === 'true');
  };

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  const changeSupermarche = async (id: string) => {
    haptic();
    await AsyncStorage.setItem('supermarche', id);
    setSupermarche(id);
    setShowSmPicker(false);
  };

  const toggleNotifs = async (val: boolean) => {
    haptic();
    setNotifs(val);
    await AsyncStorage.setItem('notifs', val.toString());
  };

  const goToFavorites = () => { haptic(); router.push('/(modals)/favorites' as any); };
  const replayOnboarding = async () => {
    haptic();
    await AsyncStorage.multiRemove(['onboardingDone', 'onboarding_done']);
    router.replace('/(modals)/onboarding' as any);
  };

  const goToPreferences = () => { haptic(); router.push('/(modals)/preferences' as any); };
  const goToLogin = () => { haptic(); router.push('/(modals)/login' as any); };
  const goToSignup = () => { haptic(); router.push('/(modals)/signup' as any); };
  const goToAdmin = () => { haptic(); router.push('/(modals)/admin' as any); };

  const logout = () => {
    Alert.alert(
      'Se déconnecter',
      'Tu veux vraiment te déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion', style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            setUser(null);
            setFavCount(0);
            setIsUserAdmin(false);
            setPendingCount(0);
            router.back();
          },
        },
      ],
    );
  };

  const currentSM = SUPERMARCHES.find(s => s.id === supermarche) || SUPERMARCHES[0];
  const userInitial = user?.email ? user.email[0].toUpperCase() : '';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.settingsHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.settingsBack} onPress={() => router.back()} activeOpacity={0.7}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={TEXT_DARK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </TouchableOpacity>
        <Text style={styles.settingsTitle}>Paramètres</Text>
        <View style={{ width: 38 }} />
      </View>

      {isUserAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <TouchableOpacity style={styles.row} onPress={goToAdmin} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, styles.adminIcon]}><IconShield color={ACCENT} size={18} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Modération & ajout</Text>
                <Text style={styles.rowValue}>
                  {pendingCount === 0 ? 'Aucune recette en attente' : pendingCount === 1 ? '1 recette en attente' : `${pendingCount} recettes en attente`}
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              {pendingCount > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
                </View>
              )}
              <IconChevron />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mon supermarché</Text>
        <TouchableOpacity style={styles.row} onPress={() => { haptic(); setShowSmPicker(!showSmPicker); }} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><IconStore color={ACCENT} size={18} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Enseigne choisie</Text>
              <View style={styles.rowValueRow}>
                <Image source={currentSM.logo} style={styles.smLogoSmall} resizeMode="contain" />
                <Text style={styles.rowValue}>{currentSM.name}</Text>
              </View>
            </View>
          </View>
          <IconChevron />
        </TouchableOpacity>
        {showSmPicker && (
          <View style={styles.smPicker}>
            {SUPERMARCHES.map(sm => (
              <TouchableOpacity
                key={sm.id}
                style={[styles.smOption, supermarche === sm.id && styles.smOptionActive]}
                onPress={() => changeSupermarche(sm.id)}
                activeOpacity={0.7}
              >
                <Image source={sm.logo} style={styles.smLogoSmall} resizeMode="contain" />
                <Text style={[styles.smOptionName, supermarche === sm.id && styles.smOptionNameActive]}>{sm.name}</Text>
                {supermarche === sm.id && (
                  <View style={styles.smCheck}><Text style={styles.smCheckText}>✓</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Réglages</Text>
        <TouchableOpacity style={styles.row} onPress={goToPreferences} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><IconSettings color={ACCENT} size={18} /></View>
            <Text style={styles.rowLabel}>Préférences</Text>
          </View>
          <IconChevron />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={replayOnboarding} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><IconStore color={ACCENT} size={18} /></View>
            <Text style={styles.rowLabel}>Revoir la présentation de l'app</Text>
          </View>
          <IconChevron />
        </TouchableOpacity>
      </View>

      {user && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
            <IconLogout color="#FF3B5C" size={18} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.version}>FeedMe v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  settingsBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  settingsTitle: { fontSize: 18, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5 },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  title: { fontSize: 32, fontWeight: '900', color: TEXT_DARK, letterSpacing: -1 },
  avatarSection: { alignItems: 'center', paddingVertical: 24, marginBottom: 8 },
  avatarBig: { width: 84, height: 84, borderRadius: 42, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarInitial: { fontSize: 36, fontWeight: '900', color: '#FFFFFF' },
  avatarName: { fontSize: 15, fontWeight: '800', color: TEXT_DARK, paddingHorizontal: 20 },
  avatarSub: { fontSize: 12, color: TEXT_GRAY, marginTop: 4 },
  authCard: { marginHorizontal: 16, marginVertical: 14, padding: 22, backgroundColor: ACCENT_BG, borderRadius: 18, alignItems: 'center' },
  authAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  authTitle: { fontSize: 17, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.3, marginBottom: 6 },
  authDesc: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  authBtns: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  authBtnPrimary: { flex: 1, backgroundColor: ACCENT, borderRadius: 100, padding: 12, alignItems: 'center', shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  authBtnPrimaryText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  authBtnSecondary: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 100, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: ACCENT },
  authBtnSecondaryText: { fontSize: 14, fontWeight: '800', color: ACCENT },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingHorizontal: 4 },
  row: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, borderWidth: 1, borderColor: BORDER },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center' },
  adminIcon: { backgroundColor: '#E8FBF5' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: TEXT_DARK },
  rowValue: { fontSize: 12, color: TEXT_GRAY, marginTop: 2 },
  rowValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pendingBadge: { backgroundColor: '#FF3B5C', minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pendingBadgeText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  smLogoSmall: { width: 22, height: 22, borderRadius: 5 },
  smPicker: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, marginBottom: 8, marginTop: 4 },
  smOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  smOptionActive: { backgroundColor: ACCENT_BG },
  smOptionName: { flex: 1, fontSize: 14, fontWeight: '600', color: TEXT_DARK },
  smOptionNameActive: { color: ACCENT, fontWeight: '800' },
  smCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  smCheckText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FFD0D6' },
  logoutText: { fontSize: 14, fontWeight: '700', color: '#FF3B5C' },
  version: { textAlign: 'center', fontSize: 12, color: TEXT_LIGHT, marginTop: 8, marginBottom: 30 },
});
