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

/**
 * Enregistre le jeton push de cet appareil — **si** la box active a le
 * consentement `PUSH` et **si** la permission OS est accordée (demandée si on
 * peut encore le faire). Best-effort : ne **lève jamais** (invariant de `push.ts`).
 *
 * Extrait de l'effet 2 pour être appelable **hors montage** (`D-037`). L'effet a
 * pour deps `[userId, activeTenantId]` : il ne voit donc ni le passage de la
 * préférence à `true`, ni une permission nouvellement accordée, et le jeton
 * n'était posé qu'au prochain redémarrage. Le toggle des Réglages appelle
 * désormais cette fonction dès qu'on active les notifications.
 *
 * Idempotent, donc sûr à rappeler : `getExpoPushTokenAsync` rend le **même**
 * jeton pour l'appareil, et `register_device` réassigne sur conflit de jeton
 * (`security definer`) au lieu d'insérer une seconde ligne — pas de double
 * enregistrement. On ne l'ajoute surtout **pas** aux deps de l'effet, ce qui
 * rouvrirait une boucle d'enregistrement.
 */
export async function ensurePushDeviceRegistered(params: {
  tenantId: string;
  userId: string;
}): Promise<void> {
  try {
    const prefs = await fetchMyPreferences(supabase, {
      tenantId: params.tenantId,
      userId: params.userId,
    });
    if (prefs.push !== true) return;

    const projectId = easProjectId();
    if (projectId === null) return;

    const permission = await Notifications.getPermissionsAsync();
    let granted = permission.granted;
    if (!granted && permission.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await registerDevice(supabase, {
      pushToken: token,
      platform: currentPlatform(),
      appVersion: Constants.expoConfig?.version ?? null,
    });
    await rememberPushToken(token);
  } catch {
    // best-effort : l'absence de push ne casse pas la session
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
  //    permission OS. La fonction est best-effort et idempotente ; elle est aussi
  //    appelée par le toggle des Réglages (`D-037`), pour ne pas attendre le
  //    prochain montage quand on active les notifications en cours de session.
  useEffect(() => {
    if (userId === null || activeTenantId === null) return;
    void ensurePushDeviceRegistered({ tenantId: activeTenantId, userId });
  }, [userId, activeTenantId]);

  // 3. Le lien profond — au démarrage à froid (ouvert via la notif) et app ouverte.
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then(openFromResponse);
    const sub = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => sub.remove();
  }, []);
}
