import Link from 'next/link';

export default function HomePage() {
  // Back-office provisoire : le planning et les membres arrivent en P1.
  // Les chaînes visibles passeront par i18n au ticket P0-003.
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 'var(--rig-text-display)' }}>RIG</h1>
      <p style={{ color: 'var(--rig-color-text-muted)' }}>
        Socle en place. Le back-office arrive en P1.
      </p>
      <Link href="/design-system">Voir le système de design</Link>
    </main>
  );
}
