import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DbRecipe } from '../lib/supabase';

// Tuiles recettes façon TikTok / Instagram.
// - RecipeGridTile : grille 3 colonnes (Enregistrées, profil créateur)
// - RecipeCard     : grille 2 colonnes avec titre sous l'image (Explorer)

const TEXT_DARK = '#000000';
const TEXT_GRAY = '#8E8E8E';

export const formatCount = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n || 0);
};

const IconHeart = ({ color = '#FFFFFF', size = 12 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </Svg>
);

const IconPlay = ({ color = '#FFFFFF', size = 12 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M7 4v16l13-8z" />
  </Svg>
);

// Dégradé noir en bas de l'image (sans librairie externe).
const BottomShade = ({ height = 70 }: { height?: number }) => (
  <View pointerEvents="none" style={[styles.shade, { height }]}>
    <View style={[styles.shadeBand, { opacity: 0.05 }]} />
    <View style={[styles.shadeBand, { opacity: 0.15 }]} />
    <View style={[styles.shadeBand, { opacity: 0.3 }]} />
    <View style={[styles.shadeBand, { opacity: 0.45 }]} />
    <View style={[styles.shadeBand, { opacity: 0.6 }]} />
  </View>
);

type TileProps = {
  recipe: DbRecipe;
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
};

export const RecipeGridTile = ({ recipe, width, onPress, onLongPress }: TileProps) => {
  const height = Math.round(width * 1.33);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.gridTile, { width, height, opacity: pressed ? 0.85 : 1 }]}
    >
      <Image
        source={{ uri: recipe.thumbnail_url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
      />
      <BottomShade height={Math.round(height * 0.5)} />
      <View style={styles.gridInfo} pointerEvents="none">
        <Text style={styles.gridTitle} numberOfLines={2}>{recipe.title}</Text>
        <View style={styles.gridMeta}>
          <IconHeart size={10} />
          <Text style={styles.gridMetaText}>{formatCount(recipe.likes_count || 0)}</Text>
        </View>
      </View>
    </Pressable>
  );
};

export const RecipeCard = ({ recipe, width, onPress }: TileProps) => {
  const imgHeight = Math.round(width * 1.33);
  const creatorName = recipe.creators?.name || 'Dricecook';
  const avatarLetters = recipe.creators?.avatar_letters || creatorName.slice(0, 2).toUpperCase();
  const avatarColor = recipe.creators?.avatar_color || '#00C896';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.cardImgWrap, { height: imgHeight }]}>
        <Image
          source={{ uri: recipe.thumbnail_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
        <BottomShade height={48} />
        <View style={styles.cardBadges} pointerEvents="none">
          <IconPlay size={11} />
          {!!recipe.time && <Text style={styles.cardBadgeText}>{recipe.time}</Text>}
          {!!recipe.price && <Text style={styles.cardBadgeText}>· {recipe.price}</Text>}
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
      <View style={styles.cardFooter}>
        <View style={[styles.cardAvatar, { backgroundColor: avatarColor }]}>
          {recipe.creators?.avatar_url ? (
            <Image source={{ uri: recipe.creators.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Text style={styles.cardAvatarText}>{avatarLetters}</Text>
          )}
        </View>
        <Text style={styles.cardCreator} numberOfLines={1}>{creatorName}</Text>
        <IconHeart color={TEXT_GRAY} size={11} />
        <Text style={styles.cardLikes}>{formatCount(recipe.likes_count || 0)}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  shadeBand: { flex: 1, backgroundColor: '#000000' },

  gridTile: { backgroundColor: '#1A1A1A', overflow: 'hidden', position: 'relative' },
  gridInfo: { position: 'absolute', left: 6, right: 6, bottom: 6 },
  gridTitle: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', lineHeight: 13, marginBottom: 3 },
  gridMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridMetaText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  cardImgWrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0F0F0', position: 'relative' },
  cardBadges: { position: 'absolute', left: 8, bottom: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  cardTitle: { fontSize: 13, fontWeight: '800', color: TEXT_DARK, lineHeight: 17, marginTop: 7, letterSpacing: -0.2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  cardAvatar: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardAvatarText: { fontSize: 7, fontWeight: '900', color: '#FFFFFF' },
  cardCreator: { flex: 1, fontSize: 11, fontWeight: '600', color: TEXT_GRAY },
  cardLikes: { fontSize: 11, fontWeight: '600', color: TEXT_GRAY },
});
