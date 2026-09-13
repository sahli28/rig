'use client';

import { useI18n } from '@rack/ui/i18n';
import styles from './notice.module.css';

/**
 * La frontière d'erreur du back-office (D-032).
 *
 * Les `Gateway Timeout` intermittents de l'hébergé (plan gratuit) remontaient
 * en 500 nu de Next — page blanche, digest illisible — alors que la même page
 * répond 200 juste après. Ici : le message de la `Notice`, et un bouton qui
 * rejoue le rendu (`reset()`), parce que « réessaie dans un instant » sans
 * bouton pour le faire serait une phrase, pas une affordance.
 *
 * Elle attrape aussi ce qu'une Server Action laisse échapper — mais les
 * actions des écrans n'en laissent plus : leur `contexte()` rend un état
 * d'erreur que le formulaire affiche en place, ce qui préserve la saisie.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className={styles.notice}>
      <h1 className={styles.title}>{t('shell.unavailable_title')}</h1>
      <p className={styles.body}>{t('shell.unavailable_body')}</p>
      <button type="button" className={styles.link} onClick={() => reset()}>
        {t('shell.retry')}
      </button>
    </div>
  );
}
