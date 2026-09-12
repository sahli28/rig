'use client';

import Link from 'next/link';
import { useI18n } from '@rack/ui/i18n';
import { LanguageSwitcher } from './language-switcher';
import { PendingBanner } from './pending-banner';

type Box = { slug: string; name: string };

/**
 * L'accueil web, une fois la session résolue **côté serveur** (`page.tsx`) :
 * - `public` : personne n'est connecté → bienvenue et « Se connecter » ;
 * - `signed-in` sans box → « Aucune box » + créer une box / rejoindre par
 *   invitation ;
 * - `signed-in` avec plusieurs → un choix. Le cas d'une **box unique** redirige
 *   directement côté serveur, il n'arrive jamais ici.
 *
 * Le lien vers le système de design est une **affordance de débogage** (règle 9,
 * D-019 : sur un accueil, une telle affordance est une sonde) — développement
 * seulement.
 */
export function HomeScreen({ variant, boxes }: { variant: 'public' | 'signed-in'; boxes: Box[] }) {
  const { t } = useI18n();
  const muted = { color: 'var(--rack-color-text-muted)' };

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 'var(--rack-text-display)' }}>Rack</h1>

      {variant === 'public' ? (
        <>
          <p style={muted}>{t('home.tagline')}</p>
          <p>
            <Link href="/login">{t('home.sign_in_cta')}</Link>
          </p>
          <LanguageSwitcher />
        </>
      ) : boxes.length === 0 ? (
        <>
          <h2 style={{ fontSize: 'var(--rack-text-title)' }}>{t('home.no_box_title')}</h2>
          <p style={muted}>{t('home.no_box_description')}</p>
          <PendingBanner />
          <p>
            <Link href="/creer-une-box">{t('home.create_box_cta')}</Link>
          </p>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 'var(--rack-text-title)' }}>{t('home.choose_box')}</h2>
          <ul>
            {boxes.map((box) => (
              <li key={box.slug}>
                <Link href={`/box/${box.slug}`}>{box.name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {process.env.NODE_ENV !== 'production' ? (
        <p>
          <Link href="/design-system">{t('home.design_system_cta')}</Link>
        </p>
      ) : null}
    </main>
  );
}
