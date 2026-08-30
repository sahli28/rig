'use client';

import { buildTheme, DEFAULT_BRAND } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';

/**
 * Preuve que le web porte les mêmes tokens que le mobile, sans embarquer
 * React Native : tout est peint par les variables CSS de `<ThemeStyle/>`.
 */

const SWATCHES = [
  ['Primary', '--rig-color-primary', '--rig-color-on-primary'],
  ['Surface', '--rig-color-surface', '--rig-color-text'],
  ['Surface 2', '--rig-color-surface-2', '--rig-color-text'],
  ['Success', '--rig-color-success', '--rig-color-surface'],
  ['Warning', '--rig-color-warning', '--rig-color-surface'],
  ['Danger', '--rig-color-danger', '--rig-color-on-danger'],
] as const;

export default function DesignSystemPage() {
  const { t } = useI18n();
  // Rapport de contraste : c'est ce que verra la box dans ses réglages
  // quand elle choisira sa couleur (ticket P1-001).
  const report = buildTheme(DEFAULT_BRAND, 'light').contrast;

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 'var(--rig-text-display)' }}>{t('design_system.title')}</h1>
      <p style={{ color: 'var(--rig-color-text-muted)' }}>{t('design_system.intro')}</p>

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
              border: '1px solid var(--rig-color-border)',
              borderRadius: 'var(--rig-radius-md)',
              padding: 16,
              minHeight: 88,
            }}
          >
            {/* Noms des tokens : identifiants techniques, pas de la copie produit. */}
            <strong>{label}</strong>
            <div style={{ fontSize: 'var(--rig-text-caption)' }}>{background}</div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--rig-text-title)' }}>{t('design_system.contrast_heading')}</h2>
        <p style={{ color: 'var(--rig-color-text-muted)' }}>
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
