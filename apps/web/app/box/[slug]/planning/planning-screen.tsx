'use client';

import Link from 'next/link';
import { useI18n } from '@rack/ui/i18n';
import { parseWeeklyRrule } from '@rack/core/supabase';
import { SeriesForm } from './series-form';
import { WeekGrid } from './week-grid';
import styles from './planning.module.css';
import { DAY_LABELS, type Choice, type Occurrence, type Serie } from '@rack/core/supabase';

/**
 * Le planning : la semaine affichée, puis les séries qui la produisent.
 *
 * Cet ordre n'est pas neutre. Ce qu'on vient vérifier, c'est la semaine ; les
 * séries sont la mécanique derrière. Les mettre en premier ferait de l'écran un
 * formulaire de configuration alors que c'est un écran de consultation qui sait
 * aussi éditer.
 */
export function PlanningScreen({
  slug,
  monday,
  today,
  previousWeek,
  nextWeek,
  thisWeek,
  occurrences,
  series,
  classTypes,
  rooms,
  coaches,
  editable,
}: {
  slug: string;
  monday: string;
  today: string;
  previousWeek: string;
  nextWeek: string;
  thisWeek: string;
  occurrences: Occurrence[];
  series: Serie[];
  classTypes: Choice[];
  rooms: Choice[];
  coaches: Choice[];
  editable: boolean;
}) {
  const { t, formatDate } = useI18n();
  const lien = (semaine: string) => `/box/${slug}/planning?semaine=${semaine}`;

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.cardTitle}>{t('planning.title')}</h1>
        <p className={styles.help}>{t('planning.intro')}</p>

        {/*
          Navigation par liens, pas par boutons : chaque semaine est une URL, ce
          qui la rend partageable et rechargeable — et le rendu reste serveur.
        */}
        <nav className={styles.weekBar} aria-label={t('planning.grid_label')}>
          <Link href={lien(previousWeek)} className={styles.secondary} rel="prev">
            {t('planning.previous_week')}
          </Link>
          <h2 className={styles.weekLabel}>
            {t('planning.week_of', { date: formatDate(monday, { style: 'long' }) })}
          </h2>
          {monday !== thisWeek && (
            <Link href={lien(thisWeek)} className={styles.secondary}>
              {t('planning.this_week')}
            </Link>
          )}
          <Link href={lien(nextWeek)} className={styles.secondary} rel="next">
            {t('planning.next_week')}
          </Link>
        </nav>
      </section>

      <section className={styles.card}>
        <WeekGrid
          slug={slug}
          monday={monday}
          today={today}
          occurrences={occurrences}
          editable={editable}
        />
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('planning.series_heading')}</h2>

        {series.length === 0 ? (
          <p className={styles.help}>{t('planning.series_empty')}</p>
        ) : (
          <ul className={styles.seriesList}>
            {series.map((serie) => (
              <li key={serie.id} className={styles.seriesRow}>
                <div className={styles.seriesMain}>
                  <span className={styles.seriesName}>
                    {serie.className} · {serie.starts_at_local.slice(0, 5)}
                  </span>
                  <span className={styles.seriesRule}>
                    <Recurrence rrule={serie.rrule} />
                  </span>
                </div>
                {editable && (
                  <SeriesForm
                    slug={slug}
                    serie={serie}
                    classTypes={classTypes}
                    rooms={rooms}
                    coaches={coaches}
                    trigger={
                      <button type="button" className={styles.secondary}>
                        {t('planning.edit_series')}
                      </button>
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {editable && (
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <SeriesForm
              slug={slug}
              classTypes={classTypes}
              rooms={rooms}
              coaches={coaches}
              trigger={
                <button type="button" className={styles.primary}>
                  {t('planning.new_series')}
                </button>
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * La règle en toutes lettres : « lundi, mercredi · toutes les 2 semaines ·
 * jusqu'au 31 décembre ».
 *
 * Une RRULE brute ne se lit pas, et personne ne devrait avoir à l'apprendre pour
 * vérifier son planning. Une chaîne illisible — venue d'une écriture directe en
 * base, par exemple — se rend telle quelle plutôt que de faire disparaître la
 * ligne : mieux vaut montrer qu'on ne sait pas lire que montrer un vide.
 */
function Recurrence({ rrule }: { rrule: string }) {
  const { t, formatDate } = useI18n();
  const parsed = parseWeeklyRrule(rrule);

  if (parsed === null) return <>{rrule}</>;

  const jours = parsed.days.map((day) => t(DAY_LABELS[day])).join(', ');
  const rythme =
    parsed.interval === 1
      ? t('planning.series_every_week')
      : t('planning.series_every_n_weeks', { n: parsed.interval });
  const fin =
    parsed.until === null
      ? t('planning.series_no_end')
      : t('planning.series_until', { date: formatDate(parsed.until, { style: 'long' }) });

  return (
    <>
      {jours} · {rythme} · {fin}
    </>
  );
}
