import { router } from 'expo-router';
import { DbRecipe } from './supabase';

// Ouvre la fiche recette (vidéo + ingrédients + panier) depuis n'importe quel écran.
export function openRecipe(recipe: DbRecipe, creatorName?: string) {
  router.push({
    pathname: '/(modals)/recipe' as any,
    params: {
      id: recipe.id,
      videoUrl: recipe.video_url || '',
      basePeople: String(recipe.base_people || ''),
      title: recipe.title,
      creator: creatorName || recipe.creators?.name || '',
      time: recipe.time,
      people: recipe.people,
      price: recipe.price,
      thumbnail: recipe.thumbnail_url,
      ingredients: JSON.stringify(recipe.ingredients),
      instaUrl: recipe.insta_url || '',
    },
  });
}
