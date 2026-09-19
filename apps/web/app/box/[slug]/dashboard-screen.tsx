'use client';

import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  Users,
} from 'lucide-react';
import { useI18n } from '@rack/ui/i18n';
import type { TranslationKey } from '@rack/core';
import {
  CHECKLIST_ORDER,
  attendancePointsDelta,
  attendanceRate,
  checklistProgress,
  fillRate,
  pointsDelta,
  type BoxDashboard,
} from '@rack/core/supabase';
import { ProgressRing } from './progress-ring';
import { ActivityChart } from './activity-chart';
import styles from './dashboard.module.css';

const CHECK_LABELS: Record<(typeof CHECKLIST_ORDER)[number], TranslationKey> = {
  rooms: 'dashboard.check_rooms',
  class_types: 'dashboard.check_class_types',
  opening_hours: 'dashboard.check_opening_hours',
  schedules: 'dashboard.check_schedules',
  members: 'dashboard.check_members',
  payment_link: 'dashboard.check_payment_link',
};

export function DashboardScreen({
  data,
  slug,
  firstName,
}: {
  data: BoxDashboard;
  slug: string;
  firstName: string | null;
}) {
  const { t } = useI18n();
  const base = `/box/${slug}`;
  const setupHref = `${base}/mise-en-route`;

  /**
   * Chaque item « Configurer » mène à SA destination (D-042), pas au début de
   * l'assistant. Quatre items sont des étapes de l'assistant (on cible l'étape
   * par `?step=`) ; deux vivent ailleurs — « des cours au planning » sur le
   * planning, « un premier membre » sur l'équipe — et pointent vers leur écran.
   */
  const checkHref: Record<(typeof CHECKLIST_ORDER)[number], string> = {
    rooms: `${setupHref}?step=lieux`,
    class_types: `${setupHref}?step=cours`,
    opening_hours: `${setupHref}?step=horaires`,
    schedules: `${base}/planning`,
    members: `${base}/staff`,
    payment_link: `${setupHref}?step=paiement`,
  };

  const fill = fillRate(data.fill);
  const fillDelta = pointsDelta(data.fill, data.fill_prev);
  const attend = attendanceRate(data.attendance);
  const attendDelta = attendancePointsDelta(data.attendance, data.attendance_prev);
  const progress = checklistProgress(data.checklist);

  const greeting =
    firstName === null || firstName === ''
      ? t('dashboard.greeting_neutral')
      : t('dashboard.greeting', { name: firstName });

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{greeting}</h1>
        <p>
          {progress.done < progress.total ? t('dashboard.subtitle_setup') : t('dashboard.subtitle')}
        </p>
      </header>

      <div className={styles.grid}>
        {/* HÉROS : taux de remplissage + graphe d'activité (même fenêtre passée). */}
        <section className={styles.card} aria-labelledby="dash-fill">
          <div className={styles.heroTop}>
            <div>
              <p className={styles.eyebrow} id="dash-fill">
                {t('dashboard.fill_label')}
              </p>
              <p
                className={
                  fill === null ? styles.heroNum : `${styles.heroNum} ${styles.heroNumBrand}`
                }
              >
                {fill === null ? '—' : `${fill} %`}
              </p>
              <p className={styles.ctx}>
                {fill === null
                  ? t('dashboard.fill_empty')
                  : t('dashboard.fill_context', {
                      booked: data.fill.booked,
                      capacity: data.fill.capacity,
                    })}
              </p>
            </div>
            <Delta points={fillDelta} />
          </div>
          <ActivityChart activity={data.activity} />
        </section>

        {/* MISE EN ROUTE : anneau + checklist dérivée de l'état réel. */}
        <section className={styles.card} aria-labelledby="dash-setup">
          <p className={styles.eyebrow} id="dash-setup">
            {t('dashboard.setup_label')}
          </p>
          <div className={styles.ring}>
            <ProgressRing pct={progress.pct} />
            <div>
              <div className={styles.ringPct}>{progress.pct} %</div>
              <div className={styles.ringSub}>
                {t('dashboard.setup_progress', { done: progress.done, total: progress.total })}
              </div>
            </div>
          </div>

          <ul className={styles.checks}>
            {CHECKLIST_ORDER.map((key) => {
              const done = data.checklist[key];
              const label = t(CHECK_LABELS[key]);
              const body = (
                <>
                  <span className={styles.checkBox} aria-hidden="true">
                    <Check size={14} />
                  </span>
                  <span className={styles.checkLabel}>{label}</span>
                  {done ? null : (
                    <span className={styles.checkGo}>{t('dashboard.check_configure')}</span>
                  )}
                </>
              );
              return (
                <li key={key}>
                  {done ? (
                    <div className={`${styles.check} ${styles.checkDone}`}>{body}</div>
                  ) : (
                    <Link
                      className={styles.check}
                      href={checkHref[key]}
                      aria-label={`${label} — ${t('dashboard.check_configure')}`}
                    >
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          <SetupCta href={setupHref} />
        </section>
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileIcon}>
            <Users size={20} aria-hidden="true" />
          </div>
          {data.members_active === 0 ? (
            <>
              <div className={styles.tileKey}>{t('dashboard.members_label')}</div>
              <div className={styles.tileEmpty}>
                {t('dashboard.members_empty')} ·{' '}
                <Link className={styles.tileLink} href={`${base}/staff`}>
                  {t('dashboard.invite')}
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className={styles.tileValue}>{data.members_active}</div>
              <div className={styles.tileKey}>{t('dashboard.members_label')}</div>
            </>
          )}
        </div>

        <div className={styles.tile}>
          <div className={styles.tileIcon}>
            <Check size={20} aria-hidden="true" />
          </div>
          {attend === null ? (
            <>
              <div className={styles.tileKey}>{t('dashboard.attendance_label')}</div>
              <div className={styles.tileEmpty}>{t('dashboard.attendance_empty')}</div>
            </>
          ) : (
            <>
              <div className={styles.tileValue}>{attend} %</div>
              <div className={styles.tileKey}>
                {t('dashboard.attendance_label')} <Delta points={attendDelta} inline />
              </div>
              <div className={styles.tileSub}>
                {t('dashboard.attendance_sub', {
                  present: data.attendance.present,
                  total: data.attendance.total,
                })}
              </div>
            </>
          )}
        </div>

        {/* Expirations : OWNER/MANAGER seulement — `null` côté coach, tuile absente. */}
        {data.subs_expiring === null ? null : (
          <div className={styles.tile}>
            <span className={styles.tileRole}>{t('dashboard.expiring_role')}</span>
            <div className={styles.tileIcon}>
              <CalendarClock size={20} aria-hidden="true" />
            </div>
            {data.subs_expiring === 0 ? (
              <>
                <div className={styles.tileKey}>{t('dashboard.expiring_label')}</div>
                <div className={styles.tileEmpty}>{t('dashboard.expiring_empty')}</div>
              </>
            ) : (
              <>
                <div className={styles.tileValue}>{data.subs_expiring}</div>
                <div className={styles.tileKey}>{t('dashboard.expiring_label')}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** La vraie variation, ou rien : aucune flèche sans chiffre derrière (P2-004). */
function Delta({ points, inline = false }: { points: number | null; inline?: boolean }) {
  const { t } = useI18n();
  if (points === null || points === 0) return null;
  const up = points > 0;
  const text = `${up ? '+' : ''}${points} ${t('dashboard.points_unit')}`;
  const a11y = t(up ? 'dashboard.trend_up' : 'dashboard.trend_down', { points: Math.abs(points) });
  return (
    <span
      className={`${styles.delta} ${up ? styles.deltaUp : styles.deltaDown}`}
      style={inline ? { padding: '2px 8px' } : undefined}
      aria-label={a11y}
    >
      {up ? (
        <ArrowUpRight size={14} aria-hidden="true" />
      ) : (
        <ArrowDownRight size={14} aria-hidden="true" />
      )}
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

function SetupCta({ href }: { href: string }) {
  const { t } = useI18n();
  return (
    <Link
      className={styles.setupCta}
      href={href}
      style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
    >
      <span>{t('dashboard.setup_cta')}</span>
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}
