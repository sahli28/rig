/**
 * Client Supabase du mobile.
 *
 * La session vit dans le **trousseau** (`expo-secure-store`), pas dans
 * `AsyncStorage` : un jeton de session est un identifiant au porteur, et
 * `AsyncStorage` n'est qu'un fichier lisible sur un appareil rooté ou dans une
 * sauvegarde. Le trousseau plafonne une valeur à 2 Ko, ce que dépasse une
 * session Supabase — d'où le découpage de `@rig/core/supabase`.
 */

import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  chunkedStore,
  createRigClient,
  readSupabaseConfig,
  type KeyValueStore,
} from '@rig/core/supabase';

/**
 * Les variables sont lues **littéralement** : Metro remplace le texte
 * `process.env.EXPO_PUBLIC_…` au bundling. Une lecture indirecte
 * (`process.env[nom]`) ne serait jamais remplacée et vaudrait `undefined`.
 */
const config = readSupabaseConfig(
  {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  'EXPO_PUBLIC_',
);

const secureStore: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

/**
 * `expo-secure-store` n'existe pas sur le web, où l'app tourne pour les démos
 * du kit de composants. `localStorage` y tient lieu de stockage : le web mobile
 * n'est pas une cible de production, et un `undefined` ferait planter au
 * démarrage un écran qui n'a rien à voir avec l'authentification.
 */
const webStore: KeyValueStore = {
  getItem: (key) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
  setItem: (key, value) => Promise.resolve(globalThis.localStorage?.setItem(key, value)),
  removeItem: (key) => Promise.resolve(globalThis.localStorage?.removeItem(key)),
};

export const supabase = createRigClient(config, {
  auth: {
    storage: Platform.OS === 'web' ? webStore : chunkedStore(secureStore),
    autoRefreshToken: true,
    persistSession: true,
    // Aucune session ne transite par une URL sur mobile : la connexion se fait
    // au code à six chiffres, pas au lien (voir `docs/adr/`).
    detectSessionInUrl: false,
  },
});

/**
 * Le rafraîchissement silencieux ne tourne que quand l'app est au premier plan.
 * Sans cela, une app en arrière-plan continue de rafraîchir pour rien, et — plus
 * gênant — une app revenue au premier plan après plusieurs heures ne rafraîchit
 * qu'au premier appel, qui échoue alors sur un jeton expiré.
 */
export function startSessionAutoRefresh(): () => void {
  if (Platform.OS === 'web') return () => {};

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });

  if (AppState.currentState === 'active') void supabase.auth.startAutoRefresh();

  return () => {
    subscription.remove();
    void supabase.auth.stopAutoRefresh();
  };
}
