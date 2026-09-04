import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { invitationPath } from './invitation-link';

describe('invitationPath', () => {
  it('produit le chemin que le back-office affiche et que le QR encode', () => {
    expect(invitationPath('inv-rueil-0001')).toBe('/invitation/inv-rueil-0001');
  });

  it('échappe ce qui doit l’être', () => {
    expect(invitationPath('a b')).toBe('/invitation/a%20b');
  });
});

/**
 * Le test que le 3 septembre 2026 réclamait.
 *
 * `apps/web` fabriquait `/invitation/<jeton>` — le lien du back-office, celui
 * du QR mural — et `apps/mobile` n'avait **aucune route** pour le recevoir.
 * Ouvert sur l'iPhone, ce lien tombait sur « Unmatched Route » ; le layout
 * renvoyait sur `/welcome` sans les paramètres, et le jeton mourait là. Le
 * parcours d'entrée du produit était cassé de bout en bout, sans message.
 *
 * Aucun test unitaire ne pouvait le voir : les deux côtés étaient corrects
 * séparément. C'est leur **jointure** qui manquait, et une jointure faite d'un
 * littéral d'un côté et d'un nom de fichier de l'autre ne se vérifie pas à la
 * relecture. Elle se vérifie ici.
 *
 * Structurel, donc partiel : ce test dit que la route existe, pas qu'elle fait
 * quelque chose d'utile. Le comportement, lui, se voit dans
 * `docs/passe-mobile-iphone.md` § 5 bis — ou en une navigation sur
 * `pnpm --filter @rig/mobile web`.
 */
describe('parité web ↔ mobile de la route d’invitation', () => {
  const token = 'jeton-de-test';
  const path = invitationPath(token);

  it('le mobile a une route pour le lien que le web distribue', () => {
    // `[token]` est la forme expo-router du segment dynamique : le chemin
    // `/invitation/<jeton>` se lit `app/**/invitation/[token].tsx`.
    const routes = [
      'apps/mobile/app/(auth)/invitation/[token].tsx',
      'apps/mobile/app/invitation/[token].tsx',
    ];

    const found = routes.some((route) =>
      existsSync(fileURLToPath(new URL(`../../../../${route}`, import.meta.url))),
    );

    expect(
      found,
      `Aucune route mobile ne reçoit \`${path}\`. Le lien que le back-office ` +
        'distribue tomberait sur « Unmatched Route », et le jeton serait perdu ' +
        'à la redirection qui suit. Routes cherchées :\n  ' +
        routes.join('\n  '),
    ).toBe(true);
  });

  it('le chemin attendu par la route est bien celui que `invitationPath` produit', () => {
    // Si le segment change ici, il faut renommer le dossier de la route — ce
    // qu'aucun compilateur ne dira. Ce test le dit.
    expect(path.split('/')[1]).toBe('invitation');
  });
});
