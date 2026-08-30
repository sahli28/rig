'use client';

/**
 * Fournisseur de thème, sans dépendance plateforme : il ne connaît que React.
 *
 * La directive `use client` est là pour Next : `createContext` n'existe pas
 * dans un Server Component, et le barrel `@rig/ui/theme` est importé côté
 * serveur pour générer les variables CSS. React Native ignore la directive.
 *
 * Le schéma clair/sombre est passé en propriété plutôt que détecté ici, parce
 * que la détection diffère selon la plateforme (`useColorScheme` côté React
 * Native, `matchMedia` côté web). Chaque app fournit la sienne ; le thème, lui,
 * se calcule au même endroit pour tout le monde.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { buildTheme } from './build-theme';
import { DEFAULT_BRAND, type ColorScheme, type TenantBrand, type Theme } from './tokens';

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  /** Marque de la box. Par défaut celle de la plateforme. */
  brand?: TenantBrand;
  scheme: ColorScheme;
  children: ReactNode;
}

export function ThemeProvider({ brand, scheme, children }: ThemeProviderProps) {
  const resolvedBrand = brand ?? DEFAULT_BRAND;
  const theme = useMemo(() => buildTheme(resolvedBrand, scheme), [resolvedBrand, scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/**
 * Lève si aucun `<ThemeProvider>` n'englobe l'appel. Un composant sans thème
 * afficherait des couleurs en dur : mieux vaut un échec bruyant.
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error('useTheme() exige un <ThemeProvider> parent.');
  }
  return theme;
}
