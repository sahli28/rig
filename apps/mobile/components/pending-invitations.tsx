import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { Banner, Button, EmptyState, Skeleton } from '@rack/ui/native';
import { errorMessageKeyOf, type TranslationKey } from '@rack/core';
import {
  acceptPendingInvitation,
  fetchPendingInvitations,
  type PendingInvitation,
} from '@rack/core/supabase';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { useRelireAuRetour } from '../lib/use-relire-au-retour';

/**
 * Le chaînon manquant du parcours des 80 (P1-024).
 *
 * Une personne importée par sa box n'a **pas de jeton** : son invitation
 * l'attend en base, appariée à son adresse (`P1-001d`). Le web avait son
 * appelant (`/invitations`) ; le mobile — là où vit un membre — n'en avait
 * aucun, et l'accueil répondait « Aucune box pour l'instant » à quelqu'un que
 * sa box venait d'inscrire.
 *
 * Ce composant remplace l'état vide de l'accueil quand `memberships` est vide :
 * il liste ce qui attend l'adresse vérifiée de la session, et « Rejoindre »
 * appelle `accept_pending_invitation()` puis `reload()` — l'appartenance, le
 * thème et le fuseau arrivent sans redémarrage.
 */

/** La même table que `apps/web/app/invitations/pending-list.tsx` — deux écrans, un vocabulaire. */
const ROLE_KEYS: Record<string, TranslationKey> = {
  OWNER: 'invitation.role_owner',
  MANAGER: 'invitation.role_manager',
  COACH: 'invitation.role_coach',
  MEMBER: 'invitation.role_member',
};

export function InvitationsEnAttente() {
  const theme = useTheme();
  const { t } = useI18n();
  const { me, reload } = useSession();

  // `null` = pas encore lu : l'état vide ne doit pas clignoter avant la réponse.
  const [invitations, setInvitations] = useState<PendingInvitation[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  /** Seule la lecture la plus récente a le droit d'écrire — même motif que l'accueil. */
  const lecture = useRef(0);

  const charger = useCallback(async (silencieux = false) => {
    const jeton = ++lecture.current;
    try {
      const attendues = await fetchPendingInvitations(supabase);
      if (jeton !== lecture.current) return;
      setInvitations(attendues);
      // Une relecture silencieuse n'efface pas l'erreur affichée : celle qui
      // suit une acceptation ratée (« invitation expirée ») doit rester lisible
      // pendant que la liste, elle, se met à jour — sinon l'invitation disparaît
      // sans explication. Vu au harnais, pas déduit.
      if (!silencieux) setErrorKey(null);
    } catch (error) {
      if (jeton !== lecture.current) return;
      // Une relecture silencieuse qui échoue laisse la liste en place (D-016) :
      // elle vient d'une lecture réussie, un réseau tombé ne la rend pas fausse.
      if (!silencieux) {
        setInvitations([]);
        setErrorKey(errorMessageKeyOf(error));
      }
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  /**
   * L'accueil est la racine de la pile : il ne remonte jamais (D-016). Une box
   * qui envoie ses invitations pendant que la personne regarde l'écran vide
   * doit être visible au retour dans l'app, pas au prochain redémarrage.
   */
  useRelireAuRetour(useCallback(() => void charger(true), [charger]));

  async function rejoindre(invitation: PendingInvitation) {
    setBusyId(invitation.invitation_id);
    setErrorKey(null);
    try {
      await acceptPendingInvitation(supabase, invitation.invitation_id);
      // `reload()` relit `me()` : l'appartenance existe, le parent quitte cette
      // branche et l'accueil de la box prend la place — ce composant disparaît.
      await reload();
    } catch (error) {
      setErrorKey(errorMessageKeyOf(error));
      // L'invitation a pu expirer entre l'affichage et le tap : relire plutôt
      // que laisser un bouton qui re-échouera à l'identique.
      void charger(true);
    } finally {
      setBusyId(null);
    }
  }

  if (invitations === null) return <Skeleton height={96} />;

  if (invitations.length === 0) {
    return (
      <>
        {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}
        <EmptyState title={t('home.no_box_title')} description={t('home.no_box_description')} />
      </>
    );
  }

  return (
    <View style={{ gap: theme.space(3) }}>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.title,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
        }}
      >
        {t('pending.title')}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.body,
          fontFamily: theme.fontFamily,
        }}
      >
        {t('pending.intro', { email: me?.user.email ?? '' })}
      </Text>

      {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}

      {invitations.map((invitation) => (
        <View
          key={invitation.invitation_id}
          style={{
            gap: theme.space(2),
            padding: theme.space(3),
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface2,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.body,
              fontFamily: theme.fontFamily,
              fontWeight: '600',
            }}
          >
            {invitation.tenant_name}
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typography.small,
              fontFamily: theme.fontFamily,
            }}
          >
            {t(ROLE_KEYS[invitation.role] ?? 'invitation.role_member')}
          </Text>
          <Button
            label={t('pending.join')}
            // « Rejoindre » seul ne dit pas quoi : le lecteur d'écran ne lit que
            // l'élément, pas la carte autour (règle des boutons de ui.md).
            accessibilityLabel={`${t('pending.join')} ${invitation.tenant_name}`}
            onPress={() => void rejoindre(invitation)}
            loading={busyId === invitation.invitation_id}
            disabled={busyId !== null && busyId !== invitation.invitation_id}
            fullWidth
          />
        </View>
      ))}
    </View>
  );
}
