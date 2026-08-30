import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeStyle } from './theme-style';
import './globals.css';

export const metadata: Metadata = {
  title: 'RIG',
  description: 'Réservation, programmation et coopération inter-box',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // La langue est figée ici tant que l'i18n n'est pas posée (ticket P0-003).
  // La marque viendra du tenant résolu par sous-domaine (ticket P0-005).
  return (
    <html lang="fr">
      <head>
        <ThemeStyle />
      </head>
      <body>{children}</body>
    </html>
  );
}
