import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

const ONBOARDING_KEYS = ['onboardingDone', 'onboarding_done'];

export default function RootLayout() {
  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const values = await AsyncStorage.multiGet(ONBOARDING_KEYS);
      const done = values.some(([, value]) => !!value);
      if (!done) {
        router.replace('/(modals)/onboarding');
      }
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(modals)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
