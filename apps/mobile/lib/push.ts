/**
 * La synchronisation d'appareil : fuseau, jeton push, lien profond.
 *
 * Monté une fois sous `SessionProvider` (dans `ThemedStack`). Trois effets
 * indépendants, tous best-effort — **rien ici ne casse la session si le réseau,
 * la permission ou le compte Expo manquent** :
 *
 * 1. le **fuseau**, écrit inconditionnellement (même push refusé) : les quiet
 *    hours se calculent que la personne reçoive des notifications ou non ;
 * 2. le **jeton**, enregistré seulement si la box active a le consentement `PUSH`
 *    **et** la permission OS — on ne réclame pas la permission à qui n'a rien
 *    demandé ;
 * 3. le **lien profond** : toucher une notification ouvre l'écran concerné, au
 *    démarrage à froid comme app ouverte.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Localization from 'expo-localization';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { fetchMyPreferences, registerDevice, updateTimezone } from '@rack/core/supabase';
import type { DevicePlatform } from '@rack/core/supabase';
import { supabase } from './supabase';
import { useSession } from './session';
import { rememberPushToken } from './push-registration';

// Premier plan : afficher la notification même quand l'app est ouverte. Posé au
// chargement du module (une seule fois), pas dans le hook.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function currentPlatform(): DevicePlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/** Le projectId EAS, écrit par `eas init` dans `app.json` (`extra.eas.projectId`).
 *  Requis par `getExpoPushTokenAsync`, même en build local. Absent tant que le
 *  compte Expo n'est pas lié : le hook s'abstient alors, sans erreur. */
function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const id = extra?.eas?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function openFromResponse(response: Notifications.NotificationResponse | null): void {
  const data = response?.notification.request.content.data as { url?: string } | undefined;
  if (typeof data?.url === 'string' && data.url.length > 0) {
    void Linking.openURL(data.url);
  }
}

export function useDeviceSync(): void {
  const { me, activeTenantId } = useSession();
  const userId = me?.user.id ?? null;

  // 1. Le fuseau — inconditionnel, best-effort.
  useEffect(() => {
    if (userId === null) return;
    const tz = Localization.getCalendars()[0]?.timeZone;
    if (!tz) return;
    void updateTimezone(supabase, userId, tz).catch(() => {});
  }, [userId]);

  // 2. Le jeton — conditionné au consentement PUSH de la box active et à la
  //    permission OS.
  useEffect(() => {
    if (userId === null || activeTenantId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await fetchMyPreferences(supabase, { tenantId: activeTenantId, userId });
        if (cancelled || prefs.push !== true) return;

        const projectId = easProjectId();
        if (projectId === null) return;

        const permission = await Notifications.getPermissionsAsync();
        let granted = permission.granted;
        if (!granted && permission.canAskAgain) {
          granted = (await Notifications.requestPermissionsAsync()).granted;
        }
        if (cancelled || !granted) return;

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled || !token) return;

        await registerDevice(supabase, {
          pushToken: token,
          platform: currentPlatform(),
          appVersion: Constants.expoConfig?.version ?? null,
        });
        await rememberPushToken(token);
      } catch {
        // best-effort : l'absence de push ne casse pas la session
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, activeTenantId]);

  // 3. Le lien profond — au démarrage à froid (ouvert via la notif) et app ouverte.
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then(openFromResponse);
    const sub = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => sub.remove();
  }, []);
}
