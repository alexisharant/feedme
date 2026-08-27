import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { migrateDeviceLikesToUser, supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';
const TEXT_LIGHT = '#BDBDBD';
const BORDER = '#EFEFEF';
const ERROR = '#FF3B5C';

const haptic = (t: 'light' | 'success' | 'error' = 'light') => {
  try {
    if (t === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (t === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

const IconBack = ({ color = TEXT_DARK, size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const translateError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect';
  if (m.includes('email not confirmed')) return 'Email non confirmé. Vérifie tes emails.';
  if (m.includes('rate limit')) return 'Trop de tentatives, réessaie dans quelques secondes.';
  if (m.includes('network')) return 'Pas de connexion internet';
  return msg;
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Remplis tous les champs');
      haptic('error');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setLoading(false);
      haptic('error');
      setError(translateError(err.message));
      return;
    }
    await migrateDeviceLikesToUser();
    setLoading(false);
    haptic('success');
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <IconBack color={TEXT_DARK} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Feed<Text style={{ color: ACCENT }}>Me</Text></Text>

        <Text style={styles.title}>Bon retour parmi nous</Text>
        <Text style={styles.subtitle}>Connecte-toi pour retrouver tes recettes</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email} onChangeText={setEmail}
            placeholder="ton@email.com"
            placeholderTextColor={TEXT_LIGHT}
            keyboardType="email-address"
            autoCapitalize="none" autoCorrect={false} autoComplete="email"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password} onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={TEXT_LIGHT}
            secureTextEntry autoCapitalize="none" autoComplete="password"
          />
        </View>

        <TouchableOpacity
          style={styles.forgotBtn}
          onPress={() => { haptic(); router.push('/(modals)/forgot-password' as any); }}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={submit} activeOpacity={0.85} disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>Se connecter</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>OU</Text><View style={styles.line} /></View>

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => { haptic(); router.replace('/(modals)/signup' as any); }}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>Pas encore de compte ? <Text style={{ color: ACCENT, fontWeight: '800' }}>S'inscrire</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingTop: 12 },
  logo: { fontSize: 32, fontWeight: '900', color: TEXT_DARK, letterSpacing: -1, textAlign: 'center', marginBottom: 32, marginTop: 8 },
  title: { fontSize: 24, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, color: TEXT_GRAY, marginBottom: 28 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: TEXT_DARK },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 6, marginTop: -4, marginBottom: 8 },
  forgotText: { fontSize: 13, fontWeight: '700', color: ACCENT },
  errorBox: { backgroundColor: '#FFEBED', borderRadius: 10, padding: 12, marginTop: 6, marginBottom: 6 },
  errorText: { fontSize: 13, color: ERROR, fontWeight: '600' },
  btn: { backgroundColor: ACCENT, borderRadius: 100, padding: 16, alignItems: 'center', marginTop: 10, shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  btnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontSize: 11, fontWeight: '700', color: TEXT_LIGHT, letterSpacing: 1 },
  linkBtn: { alignItems: 'center', padding: 12 },
  linkText: { fontSize: 14, color: TEXT_GRAY, fontWeight: '600' },
});
