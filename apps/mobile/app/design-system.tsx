import { useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { DEFAULT_BRAND, ThemeProvider, useTheme, type ColorScheme } from '@rig/ui/theme';
import { SegmentedControl } from '@rig/ui/native';
import { Gallery } from '../components/gallery';

/**
 * Écran de démonstration du système de design.
 *
 * Il sert de preuve vivante des deux promesses du ticket P0-002 : le kit rend
 * correctement dans les deux schémas, et changer la couleur de marque dans un
 * seul objet suffit à repeindre toute l'app — correction de contraste comprise.
 */

const BRANDS = [
  { value: '#E4572E', label: 'Corail' },
  { value: '#16457A', label: 'Marine' },
  { value: '#1B7F4B', label: 'Vert' },
  // Volontairement illisible : démontre la correction automatique.
  { value: '#FFE800', label: 'Jaune ⚠' },
] as const;

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
        accessibilityLabel="Schéma de couleurs"
        value={scheme}
        onChange={(value) => onScheme(value === 'dark' ? 'dark' : 'light')}
        options={[
          { value: 'light', label: 'Clair' },
          { value: 'dark', label: 'Sombre' },
        ]}
      />
      <SegmentedControl
        accessibilityLabel="Couleur de marque"
        value={primary}
        onChange={onPrimary}
        options={BRANDS.map((brand) => ({ value: brand.value, label: brand.label }))}
      />
    </View>
  );
}

export default function DesignSystemScreen() {
  const [scheme, setScheme] = useState<ColorScheme>('light');
  const [primary, setPrimary] = useState<string>(DEFAULT_BRAND.primary);

  return (
    <>
      <Stack.Screen options={{ title: 'Système de design' }} />
      {/* Les contrôles restent sous le thème de l'app ; seule la galerie
          bascule, pour qu'on puisse comparer sans perdre la navigation. */}
      <Controls scheme={scheme} onScheme={setScheme} primary={primary} onPrimary={setPrimary} />
      <ThemeProvider brand={{ ...DEFAULT_BRAND, primary }} scheme={scheme}>
        <Gallery />
      </ThemeProvider>
    </>
  );
}
