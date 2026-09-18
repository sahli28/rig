'use client';

import type { AttendanceRow, ClassWorkout, WorkoutSource } from '@rack/core/supabase';
import { attendanceStateOf, sourcesPourOccurrence } from '@rack/core/supabase';

type SourceCandidate = { id: string; classTypeId: string; day: string; label: string };
import { WorkoutForm } from './workout-form';
import { CapacityForm } from './capacity-form';
import { useActionState, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '@rack/ui/i18n';
import { dayOfWeekday } from '@rack/core/supabase';
import { cancelClass, restoreClass } from './actions';
import { Feedback, SubmitButton } from './form-bits';
import { IDLE } from './action-state';
import styles from './planning.module.css';
import { DAY_LABELS, groupByDay, localDayIn, type Occurrence } from '@rack/core/supabase';

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
  staff,
  workouts,
  roster,
  candidates,
}: {
  slug: string;
  monday: string;
  today: string;
  occurrences: Occurrence[];
  editable: boolean;
  staff: boolean;
  workouts: Record<string, ClassWorkout>;
  roster: Record<string, AttendanceRow[]>;
  candidates: SourceCandidate[];
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
              <th
                key={colonne.date}
                scope="col"
                aria-current={colonne.date === today ? 'date' : undefined}
              >
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
                      staff={staff}
                      workout={workouts[occurrence.id] ?? null}
                      inscrits={roster[occurrence.id] ?? []}
                      sources={sourcesPourOccurrence({
                        occurrence: {
                          id: occurrence.id,
                          classTypeId: occurrence.class_type_id,
                          day: colonne.date,
                        },
                        candidates,
                        workouts,
                      })}
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
  staff,
  workout,
  inscrits,
  sources,
}: {
  slug: string;
  occurrence: Occurrence;
  time: string;
  editable: boolean;
  staff: boolean;
  workout: ClassWorkout | null;
  inscrits: AttendanceRow[];
  sources: WorkoutSource[];
}) {
  const { t, formatTime } = useI18n();
  const [open, setOpen] = useState(false);
  // L'annulation est repliée derrière une affordance secondaire, et se replie
  // avec le dialogue : rouvrir une occurrence ne doit pas rouvrir le motif.
  const [annulationOuverte, setAnnulationOuverte] = useState(false);
  const annule = occurrence.status === 'CANCELLED';

  const contenu = (
    <>
      {/* La plage, pas seulement le départ (D-035) : « à quelle heure je
          ressors » est la question du planning familial, et `ends_at` existait
          en base sans jamais atteindre l'écran web. Même écriture que la carte
          mobile — un tiret demi-cadratin espacé. */}
      <span className={styles.slotTime}>
        {time} – {formatTime(occurrence.ends_at)}
      </span>
      <span>{occurrence.className}</span>
      <span className={styles.slotMeta}>
        {occurrence.roomName} · {occurrence.coachName}
      </span>
      {/* §12.4 : le compteur de places s'annonce quand il change — après une
          modification de capacité, la grille est revalidée sous le lecteur
          d'écran sans qu'il ait bougé. `atomic` : « 7 / 12 places », pas « 7 ». */}
      <span className={styles.slotMeta} aria-live="polite" aria-atomic="true">
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

  // **Un COACH ouvre la carte depuis P1-015** : il n'administre pas le planning,
  // mais c'est lui qui écrit la séance. Sans droit du tout, la carte reste une
  // information — pas un bouton qui ne ferait rien.
  if (!editable && !staff) return <div className={classe}>{contenu}</div>;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(suivant) => {
        setOpen(suivant);
        if (!suivant) setAnnulationOuverte(false);
      }}
    >
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

          {/* **La séance d'abord.** C'est le geste quotidien — quinze à vingt
              fois par semaine — et jusqu'à `D-021` il venait sous le panneau
              d'annulation : pour écrire un WOD, on traversait « Motif » et un
              « Annuler ce cours » primaire. L'annulation est un geste rare et
              destructeur ; elle vient après un trait, derrière un bouton, et
              son envoi n'a pas l'air d'un enregistrement. */}
          {staff && (
            <WorkoutForm
              slug={slug}
              classId={occurrence.id}
              title={workout?.title ?? null}
              body={workout?.body ?? ''}
              publishedAt={workout?.publishedAt ?? null}
              // Les sources de pré-remplissage demandent deux requêtes de plus
              // par cellule : elles arriveront quand l'écran aura prouvé qu'il
              // sert. Le champ reste utilisable sans elles.
              sources={sources}
            />
          )}

          {/* Qui vient (P1-027) — noms complets : le staff gère la box
              (décision du 14 sept. 2026, privacy.md), et la portée est celle
              de la vue elle-même, jamais un filtre d'écran (règle 2). Lecture
              seule : cocher la présence reste au mobile, en salle (P1-008a). */}
          <section className={styles.roster}>
            <h3 className={styles.label}>
              {t('planning.roster_heading', {
                count: inscrits.length,
                capacity: occurrence.capacity,
              })}
            </h3>
            {inscrits.length === 0 ? (
              <p className={styles.hint}>{t('attendance.empty_body')}</p>
            ) : (
              <ul className={styles.rosterList}>
                {inscrits.map((inscrit) => {
                  const etat = attendanceStateOf(inscrit);
                  return (
                    <li key={inscrit.booking_id} className={styles.rosterRow}>
                      <span>
                        {[inscrit.first_name, inscrit.last_name].filter(Boolean).join(' ') || '—'}
                      </span>
                      {etat !== 'pending' && (
                        <span className={styles.rosterState}>
                          {t(
                            etat === 'present'
                              ? 'planning.roster_present'
                              : 'planning.roster_no_show',
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {editable && (
            <>
              {staff && <hr className={styles.separator} />}
              {/* Les places de CE cours (P1-025) — admin seulement, avant la
                  zone destructrice : changer une jauge est un geste courant,
                  annuler reste derrière son trait (D-021). */}
              {!annule && (
                <CapacityForm
                  slug={slug}
                  classId={occurrence.id}
                  capacity={occurrence.capacity}
                  booked={occurrence.booked_count}
                />
              )}
              {/* La zone destructrice sous SON trait (D-021, D-033) : la jauge
                  au-dessus est un geste courant, annuler n'en partage ni la
                  ligne ni le voisinage. */}
              <hr className={styles.separator} />
              {annule ? (
                <RestoreForm slug={slug} id={occurrence.id} />
              ) : annulationOuverte ? (
                <CancelForm slug={slug} id={occurrence.id} />
              ) : (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => setAnnulationOuverte(true)}
                  >
                    {t('planning.cancel_class')}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Fermer vit au niveau du dialogue, pas dans un formulaire : un coach
              n'a pas de panneau d'annulation, et il doit pouvoir sortir aussi.
              Un LIEN discret (D-033) : sortir n'est pas une action, et un
              troisième bouton de même poids était ce que la passe reprochait. */}
          <div className={styles.actionsEnd} style={{ marginTop: 16 }}>
            <Dialog.Close asChild>
              <button type="button" className={styles.dialogClose}>
                {t('common.close')}
              </button>
            </Dialog.Close>
          </div>
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
        Le point le plus important de cet écran. Il disait « personne n'est
        prévenu » ; depuis P1-007, c'est faux — l'annulation envoie une push aux
        membres inscrits. Mais **seulement à ceux qui l'ont activée** : pas de
        push consentie, pas d'appareil, pas d'e-mail (P2-015) => pas prévenu. Le
        silence recréerait exactement le risque que cette ligne existe pour
        écarter : annuler en croyant que seize personnes le savent.
      */}
      <p className={styles.warning}>{t('planning.cancel_push_only')}</p>

      <label className={styles.field}>
        <span className={styles.label}>{t('planning.cancel_reason')}</span>
        <textarea name="reason" className={styles.textarea} maxLength={280} required />
        <span className={styles.hint}>{t('planning.cancel_reason_hint')}</span>
      </label>

      <div className={styles.actions}>
        {/* Une seule action primaire par écran, et c'est « Enregistrer » la
            séance. L'envoi destructeur est en variante `danger`. */}
        <SubmitButton label={t('planning.cancel_confirm')} variant="danger" />
        <Feedback state={state} />
      </div>
    </form>
  );
}

function RestoreForm({ slug, id }: { slug: string; id: string }) {
  const { t } = useI18n();

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.secondary}
        onClick={() => void restoreClass(slug, id)}
      >
        {t('planning.restore_class')}
      </button>
    </div>
  );
}
