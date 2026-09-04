'use client';

import { useActionState } from 'react';
import { useI18n } from '@rack/ui/i18n';
import { DEFAULT_CLASS_TYPE_COLOR, localizedText } from '@rack/core/supabase';
import styles from './reglages.module.css';
import { Feedback, SubmitButton } from './form-bits';
import { addClassType, archiveClassType, saveClassType } from './actions';
import { IDLE, type ActionState } from './action-state';

export type TypeDeCours = {
  id: string;
  name_i18n: unknown;
  description_i18n: unknown;
  duration_minutes: number;
  color: string;
  default_capacity: number;
};

/**
 * Types de cours — `class_types`.
 *
 * La couleur est une **donnée de la box**, pas un token : la règle 7 interdit
 * les couleurs en dur dans le style, pas qu'une box choisisse celle de son WOD.
 * Elle ne porte jamais l'information seule — le nom est toujours à côté de la
 * pastille (`.claude/rules/ui.md`, accessibilité).
 */
export function ClassTypesForm({ slug, types }: { slug: string; types: TypeDeCours[] }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState<ActionState, FormData>(
    addClassType.bind(null, slug),
    IDLE,
  );

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('settings.types_title')}</h2>
        <p className={styles.help}>{t('settings.types_help')}</p>

        {types.length === 0 ? (
          <p className={styles.empty}>{t('settings.types_empty')}</p>
        ) : (
          <ul className={styles.list}>
            {types.map((type) => (
              <li key={type.id} className={styles.row}>
                <span className={styles.dot} style={{ background: type.color }} aria-hidden />
                <span className={styles.rowMain}>{localizedText(type.name_i18n, locale)}</span>
                <span className={styles.rowMeta}>
                  {t('settings.types_summary', {
                    minutes: String(type.duration_minutes),
                    capacity: String(type.default_capacity),
                  })}
                </span>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => void archiveClassType(slug, type.id)}
                >
                  {t('settings.types_archive')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {types.map((type) => (
        <ClassTypeRow key={type.id} slug={slug} type={type} />
      ))}

      <form className={styles.card} action={action}>
        <h2 className={styles.cardTitle}>{t('settings.types_add_title')}</h2>
        <ClassTypeFields />
        <div className={styles.actions}>
          <SubmitButton label={t('settings.types_add')} />
          <Feedback state={state} />
        </div>
      </form>
    </>
  );
}

/** Édition d'un type existant. Sa durée et sa capacité changent avec la saison. */
function ClassTypeRow({ slug, type }: { slug: string; type: TypeDeCours }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState<ActionState, FormData>(
    saveClassType.bind(null, slug, type.id),
    IDLE,
  );

  return (
    <form className={styles.card} action={action}>
      <h3 className={styles.cardTitle}>{localizedText(type.name_i18n, locale)}</h3>
      <ClassTypeFields type={type} />
      <div className={styles.actions}>
        <SubmitButton label={t('settings.save')} />
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** Les champs, partagés par la création et l'édition — même forme, même ordre. */
function ClassTypeFields({ type }: { type?: TypeDeCours }) {
  const { t } = useI18n();
  const prefixe = type?.id ?? 'nouveau';

  return (
    <div className={styles.grid}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${prefixe}-name-fr`}>
          {t('settings.types_name_fr')}
        </label>
        <input
          id={`${prefixe}-name-fr`}
          name="name_fr"
          className={styles.input}
          defaultValue={localizedText(type?.name_i18n, 'fr')}
          maxLength={120}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${prefixe}-name-en`}>
          {t('settings.types_name_en')}
        </label>
        <input
          id={`${prefixe}-name-en`}
          name="name_en"
          className={styles.input}
          defaultValue={
            localizedText(type?.name_i18n, 'en') === localizedText(type?.name_i18n, 'fr')
              ? ''
              : localizedText(type?.name_i18n, 'en')
          }
          maxLength={120}
        />
        <span className={styles.rowMeta}>{t('settings.types_name_en_help')}</span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${prefixe}-duration`}>
          {t('settings.types_duration')}
        </label>
        <input
          id={`${prefixe}-duration`}
          name="duration_minutes"
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          defaultValue={type?.duration_minutes ?? 60}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${prefixe}-capacity`}>
          {t('settings.types_capacity')}
        </label>
        <input
          id={`${prefixe}-capacity`}
          name="default_capacity"
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          defaultValue={type?.default_capacity ?? 12}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${prefixe}-color`}>
          {t('settings.types_color')}
        </label>
        <input
          id={`${prefixe}-color`}
          name="color"
          className={styles.color}
          type="color"
          defaultValue={type?.color ?? DEFAULT_CLASS_TYPE_COLOR}
        />
        <span className={styles.rowMeta}>{t('settings.types_color_help')}</span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${prefixe}-description`}>
          {t('settings.types_description')}
        </label>
        <input
          id={`${prefixe}-description`}
          name="description_fr"
          className={styles.input}
          defaultValue={localizedText(type?.description_i18n, 'fr')}
          maxLength={120}
        />
      </div>
    </div>
  );
}
