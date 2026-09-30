import { CartItem, ingredientKey } from './cartStore';
import { getCurrentUserId, getDeviceId, supabase } from './supabase';

// Enregistre une « photo » du panier au moment où l'utilisateur appuie sur « Commander ».
// Sert aux stats et, plus tard, à la rémunération des créateurs (part de chaque recette).
// Ne bloque jamais l'utilisateur : en cas d'erreur, on continue sans rien afficher.

export async function logOrder(
  cart: CartItem[],
  supermarche: string,
  checked: { [key: string]: boolean } = {},
): Promise<void> {
  try {
    if (!cart || cart.length === 0) return;

    const ids = cart.map((c) => c.recipeId);
    const { data: recipesData } = await supabase
      .from('recipes')
      .select('id, creator_id, price_num, base_people')
      .in('id', ids);
    const byId: { [id: string]: any } = {};
    (recipesData || []).forEach((r: any) => { byId[r.id] = r; });

    // Coût estimé de chaque recette pour le nombre de personnes choisi
    const lines = cart.map((item) => {
      const r = byId[item.recipeId] || {};
      const base = r.base_people || item.basePeople || 2;
      const estCost = (Number(r.price_num) || 0) * (item.currentPeople / base);
      const ingredientsTotal = item.baseIngredients.length;
      const ingredientsSkipped = item.baseIngredients.filter((ing) => checked[ingredientKey(ing)]).length;
      return {
        recipe_id: item.recipeId,
        creator_id: r.creator_id || null,
        title: item.recipeTitle,
        people: item.currentPeople,
        est_cost: Math.round(estCost * 100) / 100,
        ingredients_total: ingredientsTotal,
        ingredients_skipped: ingredientsSkipped,
      };
    });

    const estTotal = lines.reduce((s, l) => s + l.est_cost, 0);
    const withShare = lines.map((l) => ({
      ...l,
      share: estTotal > 0 ? Math.round((l.est_cost / estTotal) * 10000) / 10000 : Math.round((1 / lines.length) * 10000) / 10000,
    }));

    const userId = await getCurrentUserId();
    const deviceId = userId ? null : await getDeviceId();

    // Fonction SQL sécurisée côté Supabase : elle enregistre la commande et ses recettes d'un coup.
    // (L'app n'a aucun droit direct sur les tables orders / order_recipes.)
    const { error } = await supabase.rpc('log_order', {
      p_supermarche: supermarche,
      p_device_id: deviceId,
      p_est_total: Math.round(estTotal * 100) / 100,
      p_lines: withShare,
    });
    if (error) console.warn('logOrder error:', error.message);
  } catch (e) {
    console.warn('logOrder exception:', e);
  }
}
