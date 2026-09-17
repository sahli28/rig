'use client';

import { useActionState } from 'react';
import { useI18n } from '@rack/ui/i18n';
import styles from './reglages.module.css';
import { Feedback, SubmitButton } from './form-bits';
import { savePaymentLink } from './actions';
import { IDLE, type ActionState } from './action-state';

/**
 * Lien externe de paiement (P2-019) — `tenant_settings.payment_link_url`.
 *
 * Le lien est **opaque** : le montant, la formule et la TVA vivent dans le
 * Stripe de la box, qui est le vendeur (§15.6). L'app ne reçoit aucun retour du
 * lien — l'accès reste attribué à la main (P2-018). Champ vidé = lien retiré,
 * le bouton côté membre disparaît.
 *
 * Trois couches disent « https » : le navigateur (`pattern`) pour l'ergonomie,
 * Zod pour le message, le CHECK de la base pour la vérité.
 */
export function PaymentLinkForm({ slug, lien }: { slug: string; lien: string | null }) {
  const { t } = useI18n();
  const [state, action] = useActionState<ActionState, FormData>(
    savePaymentLink.bind(null, slug),
    IDLE,
  );

  return (
    <form className={styles.card} action={action}>
      <h2 className={styles.cardTitle}>{t('settings.tab_payment')}</h2>
      <p className={styles.help}>{t('settings.payment_link_help')}</p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="payment_link_url">
          {t('settings.payment_link_label')}
        </label>
        <input
          id="payment_link_url"
          name="payment_link_url"
          className={styles.input}
          type="url"
          inputMode="url"
          pattern="https://.*"
          maxLength={2000}
          placeholder="https://buy.stripe.com/…"
          defaultValue={lien ?? ''}
        />
        <span className={styles.rowMeta}>{t('settings.payment_link_empty_help')}</span>
      </div>

      <div className={styles.actions}>
        <SubmitButton label={t('settings.save')} />
        <Feedback state={state} />
      </div>
    </form>
  );
}
