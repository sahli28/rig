'use client';

import { useId, useState } from 'react';
import { useI18n } from '@rack/ui/i18n';
import { activityStats } from '@rack/core/supabase';
import styles from './dashboard.module.css';

/**
 * Le graphe d'activité 30 jours — SVG **fait main**, une seule teinte (la
 * primaire de la box), aire à dégradé + ligne à bouts arrondis. Aucune
 * bibliothèque de graphes.
 *
 * Accessibilité (méthode `dataviz`, exigence P2-004) — deux chemins complémentaires :
 *  - **le tracé se manipule au clavier**, pas seulement à la souris : `Tab` pose
 *    le focus, ←/→ (et Origine/Fin) déplacent le curseur, une région `aria-live`
 *    annonce le point actif ;
 *  - **un tableau lisible par l'AT** porte la donnée complète (le SVG lui-même est
 *    décoratif : une silhouette ne dit rien à un lecteur d'écran).
 *
 * Le sombre n'est pas une inversion : les couleurs sont des tokens
 * (`--rack-color-primary` recalculé par `buildTheme` selon le schéma).
 */

const W = 720;
const H = 180;
const PAD = 12;

type Point = { day: string; count: number };

export function ActivityChart({ activity }: { activity: ReadonlyArray<Point> }) {
  const { t, formatDate } = useI18n();
  const gradientId = useId();
  const stats = activityStats(activity);
  const [active, setActive] = useState<number | null>(null);

  const n = activity.length;
  const scaleMax = Math.max(1, stats.max);
  const x = (i: number) => PAD + (n <= 1 ? 0 : (i * (W - 2 * PAD)) / (n - 1));
  const y = (v: number) => H - PAD - (v / scaleMax) * (H - 2 * PAD);
  const flat = stats.total === 0;

  const line = activity
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`)
    .join(' ');
  const area =
    n === 0
      ? ''
      : `M${x(0).toFixed(1)} ${H - PAD} ${activity
          .map((p, i) => `L${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`)
          .join(' ')} L${x(n - 1).toFixed(1)} ${H - PAD} Z`;

  let peak = 0;
  activity.forEach((p, i) => {
    const best = activity[peak];
    if (best === undefined || p.count > best.count) peak = i;
  });
  const peakPoint = activity[peak];
  const activePoint = active === null ? undefined : activity[active];

  const pointLabel = (p: Point) =>
    t('dashboard.activity_point', {
      date: formatDate(`${p.day}T12:00:00Z`, { style: 'long' }),
      count: p.count,
    });

  function onKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    if (n === 0) return;
    const cur = active ?? n - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = Math.min(n - 1, cur + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, cur - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = n - 1;
    else if (event.key === 'Escape') {
      setActive(null);
      return;
    }
    if (next !== null) {
      event.preventDefault();
      setActive(next);
    }
  }

  return (
    <figure className={styles.chartWrap} style={{ margin: 0 }}>
      <figcaption className={styles.eyebrow} style={{ marginBottom: 8 }}>
        {t('dashboard.activity_label')}
      </figcaption>

      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        tabIndex={0}
        aria-label={t('dashboard.activity_a11y', { max: stats.max })}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? n - 1)}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        onPointerMove={(event) => {
          if (n === 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const rel = ((event.clientX - rect.left) / rect.width) * W;
          const i = Math.round((rel - PAD) / ((W - 2 * PAD) / Math.max(1, n - 1)));
          setActive(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--rack-color-primary)" stopOpacity={flat ? 0 : 0.32} />
            <stop offset="1" stopColor="var(--rack-color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {area === '' ? null : (
          <path className={styles.chartArea} d={area} fill={`url(#${gradientId})`} />
        )}
        <path
          className={styles.chartLine}
          d={line}
          fill="none"
          stroke="var(--rack-color-primary)"
          strokeWidth={flat ? 2 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={flat ? '2 6' : undefined}
          opacity={flat ? 0.6 : 1}
        />
        {active !== null && activePoint !== undefined && !flat ? (
          <circle
            cx={x(active)}
            cy={y(activePoint.count)}
            r={5}
            fill="var(--rack-color-primary)"
            stroke="var(--rack-color-surface-2)"
            strokeWidth={2}
          />
        ) : null}
        {/* Ancrage chiffré discret : le pic annoté, pour que le graphe ne soit pas
            qu'une silhouette (P2-004, optionnel 3). */}
        {flat || peakPoint === undefined ? null : (
          <text
            x={Math.min(W - 24, Math.max(24, x(peak)))}
            y={Math.max(14, y(peakPoint.count) - 10)}
            textAnchor="middle"
            fill="var(--rack-color-text-muted)"
            style={{ fontSize: 12, fontWeight: 700 }}
          >
            {stats.max}
          </text>
        )}
      </svg>

      {/* Bornes de la fenêtre (optionnel 3) : dater le graphe sans grille. */}
      {stats.firstDay !== null && stats.lastDay !== null ? (
        <div className={styles.axis} aria-hidden="true">
          <span>{formatDate(`${stats.firstDay}T12:00:00Z`, { style: 'short' })}</span>
          <span>{formatDate(`${stats.lastDay}T12:00:00Z`, { style: 'short' })}</span>
        </div>
      ) : null}

      {/* Curseur souris ET clavier : la même infobulle. */}
      {active !== null && activePoint !== undefined ? (
        <div
          className={styles.tip}
          style={{ left: `${(x(active) / W) * 100}%`, top: `${y(activePoint.count)}px` }}
        >
          {pointLabel(activePoint)}
        </div>
      ) : null}

      {/* Annonce du point actif pour l'AT qui pilote le curseur au clavier. */}
      <div className={styles.srOnly} aria-live="polite">
        {activePoint === undefined ? '' : pointLabel(activePoint)}
      </div>

      {/* La donnée complète, lisible par l'AT — le « tableau équivalent ». */}
      <table className={styles.srOnly}>
        <caption>{t('dashboard.activity_table_caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('dashboard.activity_col_day')}</th>
            <th scope="col">{t('dashboard.activity_col_count')}</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((p) => (
            <tr key={p.day}>
              <td>{formatDate(`${p.day}T12:00:00Z`, { style: 'long' })}</td>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
