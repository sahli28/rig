'use client';

/**
 * La séance d'une occurrence, écrite par le coach (P1-015).
 *
 * **Un `textarea`, et c'est tout le produit.** Le coach tape son texte et le
 * structure lui-même — échauffement, force, metcon, charges, Rx et Scaled. Le
 * jour où l'envie viendra de modéliser ces blocs parce que `P2-009` en aura
 * besoin, relire le ticket : ce serait le Program Builder déguisé, pour
 * quelqu'un qui n'en veut pas.
 */

import { useActionState, useState } from 'react';
import { useI18n } from '@rack/ui/i18n';
import type { WorkoutSource } from '@rack/core/supabase';
import { saveWorkout } from './actions';
import { IDLE, type ActionState } from './action-state';
import { Feedback, SubmitButton } from './form-bits';
import styles from './planning.module.css';

export function WorkoutForm({
  slug,
  classId,
  title,
  body,
  publishedAt,
  sources,
}: {
  slug: string;
  classId: string;
  title: string | null;
  body: string;
  publishedAt: string | null;
  sources: WorkoutSource[];
}) {
  const { t } = useI18n();
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveWorkout.bind(null, slug, classId),
    IDLE,
  );

  /**
   * **Le pré-remplissage copie, il ne lie pas.**
   *
   * On pose le texte dans le champ, et c'est fini : la source n'est plus
   * mentionnée nulle part, et modifier ce qu'on vient de reprendre ne la touche
   * pas. C'est toute la différence entre alléger le cours du soir et subir une
   * contrainte — et c'est la raison pour laquelle il s'agit d'un état local et
   * non d'une référence enregistrée.
   */
  const [titre, setTitre] = useState(title ?? '');
  const [corps, setCorps] = useState(body);

  /**
   * Le cas destructeur : il y **avait** une séance, et le champ est maintenant
   * vide. `trim()` ici comme côté serveur — « une espace » est ce qui rendait
   * la perte silencieuse, et les deux couches doivent en juger pareil.
   */
  const efface = body.trim() !== '' && corps.trim() === '';

  function reprendre(source: WorkoutSource) {
    setTitre(source.title ?? '');
    setCorps(source.body);
  }

  return (
    <form action={formAction} className={styles.form}>
      <p className={styles.hint}>
        {publishedAt === null ? t('workout.unpublished') : t('workout.published')}
      </p>

      {sources.length === 0 ? (
        <p className={styles.hint}>{t('workout.prefill_none')}</p>
      ) : (
        <fieldset className={styles.field}>
          <legend className={styles.label}>{t('workout.prefill')}</legend>
          {sources.map((source) => (
            <button
              key={source.classId}
              type="button"
              className={styles.secondary}
              onClick={() => reprendre(source)}
            >
              {source.label}
            </button>
          ))}
        </fieldset>
      )}

      <label className={styles.field}>
        <span className={styles.label}>{t('workout.title_field')}</span>
        <input
          name="title"
          className={styles.input}
          maxLength={120}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
        />
        <span className={styles.hint}>{t('workout.title_hint')}</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('workout.body')}</span>
        {/* `rows` généreux : une séance fait dix à quinze lignes, et écrire dans
            une fente de trois lignes est le meilleur moyen de retourner dans
            l'autre outil. */}
        <textarea
          name="body"
          className={styles.textarea}
          rows={14}
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
        />
        <span className={styles.hint}>{t('workout.body_hint')}</span>
      </label>

      {/* **Publier n'est pas enregistrer.** Le coach écrit son brouillon quand il
          veut et le publie quand il est prêt ; confondre les deux publierait un
          texte à moitié tapé au premier enregistrement.

          Et **publier ne prévient personne** : la convention est déjà à deux pas
          dans ce fichier — `planning.cancel_no_notification`, écrite pour ne pas
          laisser croire que seize personnes sont au courant. Elle vaut ici. */}
      <label className={styles.field}>
        <span className={styles.label}>
          <input type="checkbox" name="publish" defaultChecked={publishedAt !== null} />{' '}
          {t('workout.publish')}
        </span>
      </label>

      <p className={styles.warning}>{t('workout.publish_no_notification')}</p>

      {/* **Vider le champ efface la séance, et ça se dit avant.**
          La confirmation n'apparaît que dans le cas destructeur — vider un champ
          qui portait un texte. Vider un champ déjà vide n'efface rien et ne
          demande donc rien : une friction sans information est du bruit, et
          c'est la même règle que la feuille de confirmation de P1-004.

          Le drapeau part au serveur, qui le vérifie : `saveWorkout()` refuse
          l'effacement sans lui. Ce qui est ici est l'avertissement, pas la
          garde. */}
      {efface && (
        <label className={styles.field}>
          <p className={styles.warning}>{t('workout.confirm_delete')}</p>
          <span className={styles.label}>
            <input type="checkbox" name="confirm" /> {t('workout.confirm_delete_check')}
          </span>
        </label>
      )}

      <div className={styles.actions}>
        <SubmitButton label={efface ? t('workout.delete') : t('workout.save')} />
      </div>

      {/* `Feedback` porte `role="status"` / `role="alert"` : sans lui, ni
          l'enregistrement ni l'échec ne sont **annoncés** à un lecteur d'écran.
          Le remède était dans le fichier d'à côté, employé par `CancelForm`. */}
      <Feedback state={state} />
    </form>
  );
}
