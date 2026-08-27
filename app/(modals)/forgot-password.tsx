import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';

const ACCENT = '#00C896';
const ACCENT_BG = '#E8FBF5';
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

const IconMail = ({ color = ACCENT, size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M22 6l-10 7L2 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IconCheck = ({ color = '#FFFFFF', size = 38 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      setError('Renseigne ton email');
      haptic('error');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (err) {
      haptic('error');
      setError(err.message);
      return;
    }
    haptic('success');
    setSent(true);
  };

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <IconBack color={TEXT_DARK} size={20} />
          </TouchableOpacity>
        </View>
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <IconCheck color="#FFFFFF" size={36} />
          </View>
          <Text style={styles.successTitle}>Email envoyé !</Text>
          <Text style={styles.successDesc}>
            On t'a envoyé un email à{'\n'}
            <Text style={{ fontWeight: '800', color: TEXT_DARK }}>{email}</Text>
            {'\n\n'}Clique sur le lien dedans pour{'\n'}choisir un nouveau mot de passe.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        <View style={styles.iconWrap}><IconMail color={ACCENT} size={36} /></View>

        <Text style={styles.title}>Mot de passe oublié ?</Text>
        <Text style={styles.subtitle}>Renseigne ton email, on t'envoie un lien pour le réinitialiser.</Text>

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
            <Text style={styles.btnText}>Envoyer le lien</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingTop: 24 },
  iconWrap: { alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: TEXT_GRAY, textAlign: 'center', marginBottom: 30, lineHeight: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: TEXT_DARK },
  errorBox: { backgroundColor: '#FFEBED', borderRadius: 10, padding: 12, marginTop: 6, marginBottom: 6 },
  errorText: { fontSize: 13, color: ERROR, fontWeight: '600' },
  btn: { backgroundColor: ACCENT, borderRadius: 100, padding: 16, alignItems: 'center', marginTop: 18, shadowColor: '#008C68', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  btnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginBottom: 28, shadowColor: '#008C68', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  successTitle: { fontSize: 24, fontWeight: '900', color: TEXT_DARK, letterSpacing: -0.5, marginBottom: 16, textAlign: 'center' },
  successDesc: { fontSize: 14, color: TEXT_GRAY, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
