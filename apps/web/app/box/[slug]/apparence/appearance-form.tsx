'use client';

import { useActionState, useState } from 'react';
import { useI18n } from '@rack/ui/i18n';
import { buildTheme, themeToCssVars, type ColorScheme } from '@rack/ui/theme';
import { fontOptions } from '@rack/core/supabase';
import styles from './apparence.module.css';
import { IDLE, type ActionState } from './action-state';
import { saveAppearance } from './actions';

type Appearance = {
  app_name: string;
  primary_color: string;
  radius: number;
  font: string;
};

/**
 * L'écran d'apparence.
 *
 * **Le cœur n'est pas le sélecteur de couleur, c'est l'aperçu.** La base garde
 * la couleur telle que la box la saisit ; c'est `ensureContrast()` qui corrige à
 * l'affichage. Sans aperçu, un propriétaire choisit un jaune pâle, voit autre
 * chose dans l'app, et croit que c'est cassé.
 *
 * `buildTheme()` rend déjà tout ce qu'il faut dire — `theme.contrast` porte la
 * couleur demandée, celle appliquée, et les deux ratios. C'est la première fois
 * depuis P0-002 que ce code voit une couleur choisie par un humain.
 */
export function AppearanceForm({ slug, appearance }: { slug: string; appearance: Appearance }) {
  const { t } = useI18n();
  const [state, action] = useActionState<ActionState, FormData>(
    saveAppearance.bind(null, slug),
    IDLE,
  );

  const [brouillon, setBrouillon] = useState<Appearance>(appearance);
  const polices = fontOptions(appearance.font);

  const marque = {
    appName: brouillon.app_name,
    logoUrl: null,
    primary: brouillon.primary_color,
    radius: brouillon.radius,
    font: brouillon.font,
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} action={action}>
        <h1 className={styles.title}>{t('appearance.title')}</h1>
        <p className={styles.help}>{t('appearance.help')}</p>

        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="app_name">
              {t('appearance.app_name')}
            </label>
            <input
              id="app_name"
              name="app_name"
              className={styles.input}
              maxLength={60}
              required
              value={brouillon.app_name}
              onChange={(e) => setBrouillon({ ...brouillon, app_name: e.target.value })}
            />
            <span className={styles.rowMeta}>{t('appearance.app_name_help')}</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="primary_color">
              {t('appearance.primary')}
            </label>
            <div className={styles.colorRow}>
              <input
                id="primary_color"
                name="primary_color"
                className={styles.color}
                type="color"
                value={brouillon.primary_color}
                onChange={(e) => setBrouillon({ ...brouillon, primary_color: e.target.value })}
              />
              {/* La saisie hexadécimale n'est pas un doublon : une box arrive
                  avec une charte, et le code de sa couleur est écrit dessus. */}
              <input
                className={styles.input}
                type="text"
                aria-label={t('appearance.primary_hex')}
                pattern="#[0-9a-fA-F]{6}"
                value={brouillon.primary_color}
                onChange={(e) => setBrouillon({ ...brouillon, primary_color: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="radius">
              {t('appearance.radius', { value: String(brouillon.radius) })}
            </label>
            <input
              id="radius"
              name="radius"
              className={styles.range}
              type="range"
              min={0}
              max={48}
              step={1}
              value={brouillon.radius}
              onChange={(e) => setBrouillon({ ...brouillon, radius: Number(e.target.value) })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="font">
              {t('appearance.font')}
            </label>
            <select
              id="font"
              name="font"
              className={styles.select}
              value={brouillon.font}
              onChange={(e) => setBrouillon({ ...brouillon, font: e.target.value })}
            >
              {polices.map((police) => (
                <option key={police} value={police}>
                  {police}
                </option>
              ))}
            </select>
            {/* Une liste, pas un champ libre : une famille absente du système
                retomberait silencieusement sur `system-ui`. */}
            <span className={styles.rowMeta}>{t('appearance.font_help')}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            {t('settings.save')}
          </button>
          {state.status === 'ok' ? (
            <span className={styles.feedback} role="status">
              {t('settings.saved')}
            </span>
          ) : null}
          {state.status === 'error' ? (
            <span className={styles.error} role="alert">
              {t(state.key)}
            </span>
          ) : null}
        </div>
      </form>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('appearance.preview_title')}</h2>
        <p className={styles.help}>{t('appearance.preview_help')}</p>

        <div className={styles.previews}>
          <Preview brand={marque} scheme="light" />
          <Preview brand={marque} scheme="dark" />
        </div>
      </section>
    </div>
  );
}

/**
 * Un aperçu par schéma. Les deux, parce que la correction de contraste dépend du
 * fond : une couleur qui passe en clair peut échouer en sombre, et l'app suit le
 * réglage du téléphone — pas un choix de la box.
 */
function Preview({
  brand,
  scheme,
}: {
  brand: { appName: string; logoUrl: null; primary: string; radius: number; font: string };
  scheme: ColorScheme;
}) {
  const { t } = useI18n();
  const theme = buildTheme(brand, scheme);
  const vars = themeToCssVars(theme);

  return (
    <div className={styles.preview} style={vars as React.CSSProperties}>
      <span className={styles.previewScheme}>
        {t(scheme === 'light' ? 'appearance.scheme_light' : 'appearance.scheme_dark')}
      </span>

      <div className={styles.previewSurface}>
        <span className={styles.previewAppName}>{brand.appName}</span>
        <p className={styles.previewMuted}>{t('appearance.preview_sample')}</p>
        <button type="button" className={styles.previewButton} disabled>
          {t('appearance.preview_button')}
        </button>
      </div>

      {/* Ce que la box a demandé, ce qui sera affiché, et pourquoi. C'est la
          seule façon d'éviter qu'un propriétaire croie l'app cassée : la couleur
          enregistrée est bien la sienne, c'est le rendu qui est corrigé. */}
      {theme.contrast.adjusted ? (
        <p className={styles.warning}>
          {t('appearance.contrast_adjusted', {
            requested: theme.contrast.requestedPrimary,
            applied: theme.contrast.appliedPrimary,
            requestedRatio: theme.contrast.requestedRatio.toFixed(1),
            appliedRatio: theme.contrast.appliedRatio.toFixed(1),
          })}
        </p>
      ) : (
        <p className={styles.rowMeta}>
          {t('appearance.contrast_ok', {
            ratio: theme.contrast.appliedRatio.toFixed(1),
          })}
        </p>
      )}
    </div>
  );
}
