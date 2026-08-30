import { useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { DEFAULT_BRAND, ThemeProvider, useTheme, type ColorScheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { SegmentedControl } from '@rig/ui/native';
import type { TranslationKey } from '@rig/core';
import { Gallery } from '../components/gallery';

/**
 * Écran de démonstration du système de design.
 *
 * Preuve vivante des promesses de P0-002 : le kit rend dans les deux schémas,
 * et changer la couleur de marque dans un seul objet repeint toute l'app —
 * correction de contraste comprise.
 */

const BRANDS: ReadonlyArray<{ value: string; labelKey: TranslationKey }> = [
  { value: '#E4572E', labelKey: 'design_system.brand_coral' },
  { value: '#16457A', labelKey: 'design_system.brand_navy' },
  { value: '#1B7F4B', labelKey: 'design_system.brand_green' },
  // Volontairement illisible : démontre la correction automatique.
  { value: '#FFE800', labelKey: 'design_system.brand_yellow' },
];

function Controls({
  scheme,
  onScheme,
  primary,
  onPrimary,
}: {
  scheme: ColorScheme;
  onScheme: (value: ColorScheme) => void;
  primary: string;
  onPrimary: (value: string) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={{
        gap: theme.space(3),
        padding: theme.space(4),
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.surface2,
      }}
    >
      <SegmentedControl
        accessibilityLabel={t('design_system.scheme_label')}
        value={scheme}
        onChange={(value) => onScheme(value === 'dark' ? 'dark' : 'light')}
        options={[
          { value: 'light', label: t('design_system.scheme_light') },
          { value: 'dark', label: t('design_system.scheme_dark') },
        ]}
      />
      <SegmentedControl
        accessibilityLabel={t('design_system.brand_label')}
        value={primary}
        onChange={onPrimary}
        options={BRANDS.map((brand) => ({ value: brand.value, label: t(brand.labelKey) }))}
      />
    </View>
  );
}

export default function DesignSystemScreen() {
  const [scheme, setScheme] = useState<ColorScheme>('light');
  const [primary, setPrimary] = useState<string>(DEFAULT_BRAND.primary);
  const { t } = useI18n();

  return (
    <>
      <Stack.Screen options={{ title: t('design_system.title') }} />
      {/* Les contrôles restent sous le thème de l'app ; seule la galerie
          bascule, pour comparer sans perdre la navigation. */}
      <Controls scheme={scheme} onScheme={setScheme} primary={primary} onPrimary={setPrimary} />
      <ThemeProvider brand={{ ...DEFAULT_BRAND, primary }} scheme={scheme}>
        <Gallery />
      </ThemeProvider>
    </>
  );
}
