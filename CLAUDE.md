# FeedMe — contexte pour Claude Code

## Le projet
FeedMe est une app mobile iOS/Android : un réseau social de recettes en vidéo façon TikTok, où chaque recette devient une liste de courses et un panier à commander au supermarché (E.Leclerc, Carrefour, Auchan, Intermarché, Super U).
- Fondateurs : **Alexis** (fondateur non technique, c'est lui qui travaille avec toi) et **Cédric « Dricecook »** (créateur de recettes, 1,8 M TikTok / 450 k Insta, premier partenaire).
- Objectif UX : une app **fluide et naturelle**, aussi simple que TikTok/Instagram pour des jeunes. Rien de rigide.
- Contact : feedme@gmail.com

## Comment travailler avec Alexis
- Réponds **en français**, court et direct, sans jargon. Alexis n'est pas développeur.
- Après chaque modif : un résumé bref de ce qui a été fait, puis une liste **« À tester »** (étapes concrètes à faire sur son iPhone).
- Il teste sur un vrai iPhone ; c'est son test qui valide. Ne dis pas « c'est réglé » avant son retour.
- Pour Supabase : donne-lui le SQL à coller dans **Supabase → SQL Editor → New query → Run**, et dis ce qu'il doit voir (« Success »).
- Propose un commit Git après chaque fonctionnalité testée et validée (message en français, court).
- Livre des fichiers complets et cohérents ; vérifie que le fichier sur le disque est bien la bonne version après une modif.

## Stack
- **Expo SDK 57**, React Native 0.86, React 19, TypeScript, **expo-router** (dossier `app/`)
- **Supabase** (base, auth, stockage) — `lib/supabase.ts` (URL + clé publishable)
- **Cloudinary** pour les vidéos (upload non signé, preset `feedme_unsigned`, cloud `dvzyudtuk`)
- **IA d'analyse des vidéos** : `https://feedme-admin.vercel.app/api/analyze` (projet Next.js séparé « feedme-admin » sur Vercel ; il contient aussi un vieux formulaire admin devenu inutile)
- Vidéo : **expo-video** (plus expo-av, supprimé en SDK 55+). Images : **expo-image**.
- Build : **EAS** (profil `development` avec expo-dev-client). Projet EAS : compte `raranx`, bundle `com.raranx.feedme`.

## Commandes utiles
- Lancer le live : `npx expo start --tunnel` (Alexis et Cédric scannent le QR code avec l'app de dev installée)
- Build iOS de dev : `npx eas build --platform ios --profile development`
  - ⚠️ Bug connu Apple/EAS « iTunes service key is empty » : avant le build, dans PowerShell :
    `$env:EXPO_APP_STORE_AUTH_SERVICE_KEY='e0b80c3bf78523bfe80974d320935bfa30add02e1bff88ec2166c6bd5a706c42'`
- Ajouter un iPhone : `npx eas device:create`
- Vérifier le projet : `npx expo-doctor`
- Installer une lib Expo : toujours `npx expo install <lib>` (jamais `npm install` pour les libs Expo → versions incompatibles)
- Une lib avec du code natif = nouveau build EAS nécessaire. Du JS seul = simple Reload.

## Structure
- `app/(tabs)/` : `index.tsx` (feed vertical FlatList + panier en tiroir), `explore.tsx` (grille 2 colonnes), `creators.tsx` (partenaires + créateurs du moment), `account.tsx` (profil façon TikTok : Enregistrées / J'aime), `_layout.tsx` (barre d'onglets flottante custom)
- `app/(modals)/` : `recipe.tsx` (vidéo plein écran + fiche qui glisse, snap 2 positions), `creator-profile.tsx`, `favorites.tsx` (recettes enregistrées, grille 3 col.), `publish.tsx` (publication en 3 étapes : Vidéo → Infos → Ingrédients, IA), `onboarding.tsx` (3 écrans de présentation + 4 questions), `settings.tsx`, `preferences.tsx`, `admin.tsx` (modération), `login.tsx`, `signup.tsx`, `webview.tsx` (site du supermarché)
- `app/_layout.tsx` : redirige vers l'onboarding si `onboardingDone` absent (AsyncStorage)
- `lib/` : `supabase.ts` (client + types DbRecipe/DbCreator), `cartStore.ts` (panier global persistant + ingrédients cochés), `saves.ts` (enregistrements), `orders.ts` (log des commandes via RPC), `openRecipe.ts`, `admin.ts` (check admin côté UI seulement), `tabBarStore.ts`
- `components/RecipeTile.tsx` : `RecipeGridTile` (grille 3 col.) et `RecipeCard` (grille 2 col.), `formatCount`

## Données Supabase (tables `public`)
- `recipes` : id, creator_id, title, video_url, thumbnail_url, insta_url, time, people, base_people, price, price_num, category, is_vegetarian, is_pescatarian, is_gluten_free, ingredients (jsonb [{name, amount, unit}]), likes_count, status ('pending' | 'approved' | 'rejected'), created_at
- `creators` : id (uuid), user_id, handle, name, avatar_letters, avatar_color, avatar_url, bio, is_partner, tiktok_url, instagram_url, tiktok_followers, instagram_followers
- `likes` (user_id, recipe_id) : j'aime public. `likes_count` est mis à jour **par un trigger SQL** (`sync_recipe_likes_count`) — ne jamais le modifier depuis l'app.
- `saves` (user_id, recipe_id) : recettes enregistrées (signet), séparées des likes.
- `admins` (email) + fonction `is_admin()` : vérification admin **côté serveur**. Pour ajouter un admin : `insert into public.admins (email) values ('...');`
- `orders` + `order_recipes` : photo du panier à chaque appui sur « Commander » (supermarché, recettes, personnes, coût estimé, part de chaque créateur). **Aucun droit direct pour l'app** : écriture uniquement via la fonction RPC `log_order` (security definer). C'est une intention d'achat, pas un achat confirmé.
- Storage : bucket public `avatars` (photos des créateurs)

### Sécurité (RLS) — à respecter
- recipes : lecture = approuvées + les siennes + admin ; création = connecté, sur son propre profil créateur, forcément `pending` (sauf admin) ; modification/suppression = admin uniquement.
- likes / saves : chacun ne lit et ne modifie que les siens.
- creators : lecture publique ; création = son propre profil, jamais `is_partner` (sauf admin) ; modification = admin.
- Toute nouvelle table doit avoir la RLS activée avec des règles explicites.

## Pièges connus (déjà rencontrés)
- `fetch` d'Expo ne sait pas envoyer un fichier local dans un FormData (« Unsupported FormDataPart implementation ») → utiliser **XMLHttpRequest** pour les uploads (voir `uploadToCloudinary` dans `publish.tsx`).
- `StyleSheet.absoluteFillObject` n'existe plus → utiliser `StyleSheet.absoluteFill` ou `position: 'absolute', top: 0, left: 0, right: 0, bottom: 0`.
- `ImagePicker.MediaTypeOptions` est déprécié → `mediaTypes: ['videos']`.
- La barre d'onglets flottante passe **par-dessus** les écrans : prévoir ~90 px de marge en bas (listes, tiroirs, boutons).
- En haut d'écran, respecter `insets.top` (Dynamic Island).
- Supabase gratuit se met en **pause** après une semaine d'inactivité → si tout est vide dans l'app, vérifier sur supabase.com et cliquer « Restore ».
- `app.json` : pas de `newArchEnabled` ni `edgeToEdgeEnabled` (refusés en SDK 57).

## Style visuel
- Vert principal `#00C896`, fond vert clair `#E8FBF5`, noir `#000`, gris `#8E8E8E`, bordures `#EFEFEF`. Coins très arrondis, boutons « pilule », retours haptiques (`expo-haptics`) sur les actions.
- Le logo actuel (bleu, `assets/images/icon.png` 1024×1024) est provisoire : un nouveau logo arrive.

## Où on en est / prochaines étapes
Fait récemment : panier partagé et liste cochable/partageable, like ≠ enregistrer, grilles façon TikTok, refonte Créateurs + profil, fiche recette glissante, publication en 3 étapes, onboarding avec présentation, sécurité RLS, suivi des commandes.

À faire :
1. **Charger le feed et Explorer par paquets** (pagination) — aujourd'hui tout est chargé d'un coup.
2. **Protéger l'IA sur Vercel** (`/api/analyze` est ouverte à tous → consommation de crédits) et supprimer le vieux formulaire admin.
3. **Détecter les commandes vraiment payées** dans la webview supermarché (page de confirmation) — estimation seulement.
4. Plus tard, avant le lancement : hébergement vidéo moins cher (ex. Bunny Stream), Supabase Pro, TestFlight pour la bêta, nouveau logo.
5. Business (à décider avec Cédric) : rémunération des créateurs, partenariat API avec une enseigne, mise en avant de produits par les marques (retail media).
