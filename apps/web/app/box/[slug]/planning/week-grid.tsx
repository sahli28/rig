'use client';

import { useActionState, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '@rig/ui/i18n';
import { dayOfWeekday } from '@rig/core/supabase';
import { cancelClass, restoreClass } from './actions';
import { Feedback, SubmitButton } from './form-bits';
import { IDLE } from './action-state';
import styles from './planning.module.css';
import { DAY_LABELS, groupByDay, localDayIn, type Occurrence } from './view-model';

/**
 * La semaine, en tableau.
 *
 * C'est bien un `<table>` : sept colonnes de données dont chaque cellule
 * appartient à un jour nommé. Une pile de `<div>` afficherait la même chose et
 * perdrait la relation — un lecteur d'écran ne pourrait plus annoncer
 * « mercredi » avant « 18h30 » (`.claude/rules/ui.md`).
 */
export function WeekGrid({
  slug,
  monday,
  today,
  occurrences,
  editable,
}: {
  slug: string;
  monday: string;
  today: string;
  occurrences: Occurrence[];
  editable: boolean;
}) {
  // Le fuseau vient du contexte, pas d'une prop : c'est celui de la box, et
  // `useI18n()` le porte déjà. Le passer depuis le serveur ferait un second
  // endroit où la même valeur peut être fausse.
  //
  // Et surtout, le regroupement se fait **ici** et non côté serveur : une
  // fonction ne traverse pas la frontière Server → Client Component. Passer
  // `dayOf` en prop aurait échoué à la sérialisation, à l'exécution.
  const { t, timeZone, formatTime } = useI18n();
  const colonnes = groupByDay(monday, occurrences, localDayIn(timeZone));

  if (occurrences.length === 0) {
    return <p className={styles.empty}>{t('planning.empty_week')}</p>;
  }

  return (
    <div className={styles.gridScroll}>
      <table className={styles.grid}>
        <caption className={styles.srOnly}>{t('planning.grid_label')}</caption>
        <thead>
          <tr>
            {colonnes.map((colonne, index) => (
              <th key={colonne.date} scope="col">
                {t(DAY_LABELS[dayOfWeekday(index)])}
                <span className={colonne.date === today ? styles.today : styles.dayDate}>
                  {colonne.date.slice(8)}/{colonne.date.slice(5, 7)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {colonnes.map((colonne) => (
              <td key={colonne.date}>
                {colonne.occurrences.length === 0 ? (
                  <span className={styles.empty}>{t('planning.empty_day')}</span>
                ) : (
                  colonne.occurrences.map((occurrence) => (
                    <OccurrenceCard
                      key={occurrence.id}
                      slug={slug}
                      occurrence={occurrence}
                      time={formatTime(occurrence.starts_at)}
                      editable={editable}
                    />
                  ))
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function OccurrenceCard({
  slug,
  occurrence,
  time,
  editable,
}: {
  slug: string;
  occurrence: Occurrence;
  time: string;
  editable: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const annule = occurrence.status === 'CANCELLED';

  const contenu = (
    <>
      <span className={styles.slotTime}>{time}</span>
      <span>{occurrence.className}</span>
      <span className={styles.slotMeta}>
        {occurrence.roomName} · {occurrence.coachName}
      </span>
      <span className={styles.slotMeta}>
        {t('planning.places', {
          booked: occurrence.booked_count,
          capacity: occurrence.capacity,
        })}
      </span>
      {/*
        L'état annulé n'est pas porté par la seule couleur : le mot est là, et
        le motif avec lui.
      */}
      {annule && (
        <span className={styles.slotCancelledLabel}>
          {occurrence.cancellation_reason === null
            ? t('planning.cancelled')
            : t('planning.cancelled_because', { reason: occurrence.cancellation_reason })}
        </span>
      )}
    </>
  );

  const classe = annule ? `${styles.slot} ${styles.slotCancelled}` : styles.slot;

  // Un COACH voit le planning sans pouvoir le modifier : la carte reste une
  // information, pas un bouton qui ne fait rien.
  if (!editable) return <div className={classe}>{contenu}</div>;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={classe}>
          {contenu}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog}>
          <Dialog.Title className={styles.dialogTitle}>
            {time} · {occurrence.className}
          </Dialog.Title>

          {annule ? (
            <RestoreForm slug={slug} id={occurrence.id} />
          ) : (
            <CancelForm slug={slug} id={occurrence.id} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CancelForm({ slug, id }: { slug: string; id: string }) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(cancelClass.bind(null, slug, id), IDLE);

  return (
    <form action={formAction} className={styles.form}>
      {/*
        Le point le plus important de cet écran, et il dit une limite plutôt
        qu'une fonctionnalité : **personne n'est prévenu**. Le push est P1-007,
        l'e-mail P2-015 ; aucun des deux n'existe. Laisser croire le contraire
        ferait annuler un cours en pensant que seize personnes le savent.
      */}
      <p className={styles.warning}>{t('planning.cancel_no_notification')}</p>

      <label className={styles.field}>
        <span className={styles.label}>{t('planning.cancel_reason')}</span>
        <textarea name="reason" className={styles.textarea} maxLength={280} required />
        <span className={styles.hint}>{t('planning.cancel_reason_hint')}</span>
      </label>

      <div className={styles.actions}>
        <SubmitButton label={t('planning.cancel_class')} />
        <Dialog.Close asChild>
          <button type="button" className={styles.secondary}>
            {t('common.close')}
          </button>
        </Dialog.Close>
        <Feedback state={state} />
      </div>
    </form>
  );
}

function RestoreForm({ slug, id }: { slug: string; id: string }) {
  const { t } = useI18n();

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.primary} onClick={() => void restoreClass(slug, id)}>
        {t('planning.restore_class')}
      </button>
      <Dialog.Close asChild>
        <button type="button" className={styles.secondary}>
          {t('common.close')}
        </button>
      </Dialog.Close>
    </div>
  );
}
