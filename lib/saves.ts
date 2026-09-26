import { supabase } from './supabase';

// Recettes « enregistrées » (signet), séparées des likes.
// Les likes = j'aime public (compteur). Les saves = ma collection perso.

export async function fetchSavedIds(userId: string): Promise<{ [recipeId: string]: boolean }> {
  const { data } = await supabase.from('saves').select('recipe_id').eq('user_id', userId);
  const map: { [recipeId: string]: boolean } = {};
  (data || []).forEach((row: any) => { map[row.recipe_id] = true; });
  return map;
}

export async function isRecipeSaved(userId: string, recipeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('saves')
    .select('recipe_id')
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .maybeSingle();
  return !!data;
}

export async function saveRecipe(userId: string, recipeId: string): Promise<boolean> {
  const { error } = await supabase.from('saves').insert({ user_id: userId, recipe_id: recipeId });
  return !error || error.code === '23505';
}

export async function unsaveRecipe(userId: string, recipeId: string): Promise<boolean> {
  const { error } = await supabase.from('saves').delete().eq('user_id', userId).eq('recipe_id', recipeId);
  return !error;
}

export async function countSaved(userId: string): Promise<number> {
  const { count } = await supabase
    .from('saves')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count || 0;
}
