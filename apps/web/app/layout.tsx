import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'RIG',
  description: 'Réservation, programmation et coopération inter-box',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // La langue est figée ici tant que l'i18n n'est pas posée (ticket P0-003).
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
