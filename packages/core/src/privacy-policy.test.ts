import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { POLICY_VERSION, PRIVACY_POLICY_PATH_SEGMENT, privacyPolicyUrl } from './privacy-policy';

const RACINE = new URL('../../../', import.meta.url);
const MIGRATIONS = fileURLToPath(new URL('supabase/migrations/', RACINE));

/**
 * La règle 10 appliquée à une valeur (D-023).
 *
 * `current_policy_version()` conditionne l'accès : `me()` ne tient un
 * consentement pour satisfait que si sa version est la sienne. Cette constante
 * affirmait `'2026-08-01'` alors qu'aucun texte ne portait cette date — un
 * consentement enregistré avec IP et user-agent sur un document inexistant.
 * Ces tests interdisent que la constante, le texte publié et sa date divergent
 * de nouveau sans qu'un rouge le dise.
 *
 * Ils lisent hors du paquet (migrations, seed, `apps/web`) : les trois chemins
 * sont dans `globalDependencies` de `turbo.json`, même commit.
 */

/**
 * La **dernière** définition fait foi : la fonction est en `create or replace`,
 * et deux migrations la portent déjà. Prendre la première rendrait le test
 * aveugle à toute mise à jour — exactement le faux vert qu'il doit empêcher.
 */
function versionSqlEffective(): string | undefined {
  let version: string | undefined;
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const source = readFileSync(`${MIGRATIONS}${file}`, 'utf8');
    for (const match of source.matchAll(
      /create or replace function public\.current_policy_version\s*\(\)[\s\S]*?select '(\d{4}-\d{2}-\d{2})'::text;/g,
    )) {
      version = match[1];
    }
  }
  return version;
}

describe('la constante SQL et le texte publié portent la même date', () => {
  it('la dernière définition de current_policy_version() dit la date du texte', () => {
    expect(versionSqlEffective()).toBe(POLICY_VERSION);
  });

  it('la date est une vraie date au format de la fonction', () => {
    expect(POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(new Date(`${POLICY_VERSION}T00:00:00Z`).getTime())).toBe(false);
  });

  it('le seed ne porte aucune version en dur — il appelle la fonction', () => {
    // La sœur du même trou : quatre lignes de `consents` figées à
    // `'2026-08-01'` auraient fait redemander ACCEPT_CONSENTS à Léa au premier
    // `db:reset`. Le seed appelle `current_policy_version()` pour que la
    // question ne se repose jamais.
    const seed = readFileSync(fileURLToPath(new URL('supabase/seed.sql', RACINE)), 'utf8');
    const insertion = /insert into public\.consents[\s\S]*?;/g.exec(seed)?.[0];
    expect(insertion, 'le seed doit toujours poser des consentements').toBeDefined();
    expect(insertion).toContain('public.current_policy_version()');
    expect(insertion).not.toMatch(/'\d{4}-\d{2}-\d{2}'/);
  });
});

/**
 * Structurel, donc partiel — même statut que la parité d'`invitation-link` :
 * la route existe et affiche la bonne date, il ne dit pas que le texte est
 * lisible. Le comportement se voit au geste de `docs/passe-mobile-iphone.md`
 * § 5 (le lien s'ouvre sur l'appareil) et en ouvrant la page.
 */
describe('parité mobile ↔ web du lien vers la politique', () => {
  const page = `apps/web/app/${PRIVACY_POLICY_PATH_SEGMENT}/page.tsx`;

  it('le web a une page à l’adresse que le mobile ouvre', () => {
    expect(
      existsSync(fileURLToPath(new URL(page, RACINE))),
      `Aucune page ne sert \`${privacyPolicyUrl()}\`. Le lien de l'écran de ` +
        'consentement ouvrirait un 404 : un consentement recueilli sur un texte ' +
        `inaccessible n'est pas éclairé. Page attendue : ${page}`,
    ).toBe(true);
  });

  it('la page affiche la version depuis la constante, pas une date recopiée', () => {
    const dossier = fileURLToPath(new URL(`apps/web/app/${PRIVACY_POLICY_PATH_SEGMENT}/`, RACINE));
    const sources = readdirSync(dossier)
      .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      .map((f) => readFileSync(`${dossier}${f}`, 'utf8'))
      .join('\n');
    expect(sources).toContain('POLICY_VERSION');
    // Une date en dur dans le document redeviendrait une seconde source de
    // vérité — celle que personne ne met à jour.
    expect(sources).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
