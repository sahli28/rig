'use client';

import { buildTheme, DEFAULT_BRAND } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';

/**
 * Preuve que le web porte les mêmes tokens que le mobile, sans embarquer
 * React Native : tout est peint par les variables CSS de `<ThemeStyle/>`.
 */

const SWATCHES = [
  ['Primary', '--rack-color-primary', '--rack-color-on-primary'],
  ['Surface', '--rack-color-surface', '--rack-color-text'],
  ['Surface 2', '--rack-color-surface-2', '--rack-color-text'],
  ['Success', '--rack-color-success', '--rack-color-surface'],
  ['Warning', '--rack-color-warning', '--rack-color-surface'],
  ['Danger', '--rack-color-danger', '--rack-color-on-danger'],
] as const;

export default function DesignSystemPage() {
  const { t } = useI18n();
  // Rapport de contraste : c'est ce que verra la box dans ses réglages
  // quand elle choisira sa couleur (ticket P1-001).
  const report = buildTheme(DEFAULT_BRAND, 'light').contrast;

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 'var(--rack-text-display)' }}>{t('design_system.title')}</h1>
      <p style={{ color: 'var(--rack-color-text-muted)' }}>{t('design_system.intro')}</p>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 24,
        }}
      >
        {SWATCHES.map(([label, background, foreground]) => (
          <div
            key={label}
            style={{
              background: `var(${background})`,
              color: `var(${foreground})`,
              border: '1px solid var(--rack-color-border)',
              borderRadius: 'var(--rack-radius-md)',
              padding: 16,
              minHeight: 88,
            }}
          >
            {/* Noms des tokens : identifiants techniques, pas de la copie produit. */}
            <strong>{label}</strong>
            <div style={{ fontSize: 'var(--rack-text-caption)' }}>{background}</div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--rack-text-title)' }}>
          {t('design_system.contrast_heading')}
        </h2>
        <p style={{ color: 'var(--rack-color-text-muted)' }}>
          {report.adjusted
            ? t('design_system.contrast_adjusted', {
                requested: report.requestedPrimary,
                requestedRatio: report.requestedRatio.toFixed(2),
                applied: report.appliedPrimary,
                appliedRatio: report.appliedRatio.toFixed(2),
              })
            : t('design_system.contrast_ok', {
                applied: report.appliedPrimary,
                appliedRatio: report.appliedRatio.toFixed(2),
              })}
        </p>
      </section>
    </main>
  );
}
