import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs, router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTabBarShrunk } from '../../lib/tabBarStore';

const ACCENT = '#00C896';
const TEXT_GRAY = '#8E8E8E';

const BAR_BOTTOM = 10;
const BAR_HEIGHT = 60;
const BAR_RADIUS = 30;
const HORIZONTAL_MARGIN = 16;
const SLOTS = 5;

const haptic = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
};

const IconPlay = ({ color, size = 26 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 4l14 8-14 8V4z" fill={color} />
  </Svg>
);

const IconSearch = ({ color, size = 26 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.2" />
    <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const IconUsers = ({ color, size = 26 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" />
    <Path d="M23 21v-2a4 4 0 00-3-3.87" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const IconUser = ({ color, size = 26 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2.2" />
    <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const IconPlus = ({ color, size = 24 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </Svg>
);

function CustomTabBar({ state, navigation }: any) {
  const isFeed = state.index === 0;
  const shrunk = useTabBarShrunk();

  const [pillWidth, setPillWidth] = useState(0);
  const slotWidth = pillWidth / SLOTS;

  const blurAnim = useRef(new Animated.Value(isFeed ? 1 : 0)).current;
  const shrinkAnim = useRef(new Animated.Value(0)).current;
  const selectorX = useRef(new Animated.Value(0)).current;

  // tabIndex (0..3) -> slot (0,1,3,4)
  const tabIndexToSlot = [0, 1, 3, 4];
  const activeSlot = tabIndexToSlot[state.index] ?? 0;

  useEffect(() => {
    Animated.timing(blurAnim, {
      toValue: isFeed ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isFeed]);

  useEffect(() => {
    Animated.timing(shrinkAnim, {
      toValue: shrunk ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shrunk]);

  useEffect(() => {
    if (slotWidth > 0) {
      Animated.spring(selectorX, {
        toValue: activeSlot * slotWidth,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [activeSlot, slotWidth]);

  const onTabPress = (route: any, tabIndex: number) => {
    haptic();
    const event = navigation.emit({ type: 'tabPress', target: route.key });
    if (state.index !== tabIndex && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const onPlusPress = () => {
    haptic();
    router.push('/(modals)/publish' as any);
  };

  const pillScale = shrinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.88],
  });

  const pillOpacity = shrinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
  });

  const lightOpacity = blurAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Animated.View
        style={[
          styles.pill,
          isFeed ? styles.shadowDark : styles.shadowLight,
          {
            opacity: pillOpacity,
            transform: [{ scale: pillScale }],
          },
        ]}
        onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
      >
        {/* Dark blur layer (feed) */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: blurAnim }]} pointerEvents="none">
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* Light blur layer (autres pages) */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: lightOpacity }]} pointerEvents="none">
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.lightOverlay} />
        </Animated.View>

        {/* Selector */}
        {slotWidth > 0 && (
          <Animated.View
            style={[
              styles.selector,
              isFeed ? styles.selectorDark : styles.selectorLight,
              {
                width: slotWidth - 8,
                transform: [{ translateX: selectorX }],
                left: 4,
              },
            ]}
          />
        )}

        {/* Slots */}
        <View style={styles.row}>
          {[0, 1, 2, 3, 4].map((slotIdx) => {
            if (slotIdx === 2) {
              return (
                <Pressable key="plus" style={styles.slot} onPress={onPlusPress} hitSlop={6}>
                  <View style={styles.plusContainer}>
                    <IconPlus color="#FFFFFF" size={22} />
                  </View>
                </Pressable>
              );
            }

            const tabIndex = slotIdx < 2 ? slotIdx : slotIdx - 1;
            const route = state.routes[tabIndex];
            if (!route) return <View key={`empty-${slotIdx}`} style={styles.slot} />;

            const isActive = state.index === tabIndex;

            let Icon: any;
            if (slotIdx === 0) Icon = IconPlay;
            else if (slotIdx === 1) Icon = IconSearch;
            else if (slotIdx === 3) Icon = IconUsers;
            else Icon = IconUser;

            const iconColor = isFeed
              ? '#FFFFFF'
              : isActive
              ? ACCENT
              : TEXT_GRAY;

            return (
              <Pressable
                key={route.key}
                style={styles.slot}
                onPress={() => onTabPress(route, tabIndex)}
                hitSlop={6}
              >
                <Icon color={iconColor} size={slotIdx === 0 ? 24 : 24} />
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="creators" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: BAR_BOTTOM,
    left: HORIZONTAL_MARGIN,
    right: HORIZONTAL_MARGIN,
    alignItems: 'stretch',
  },
  pill: {
    width: '100%',
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  shadowDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  shadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  row: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  },
  slot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selector: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    borderRadius: BAR_RADIUS - 4,
  },
  selectorDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
  selectorLight: { backgroundColor: 'rgba(0,200,150,0.12)' },
  plusContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#008C68',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
});
