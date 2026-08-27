import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="webview" />
      <Stack.Screen name="recipe" />
      <Stack.Screen name="modal" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}
