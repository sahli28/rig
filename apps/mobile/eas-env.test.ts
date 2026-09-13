import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Le garde-fou de `D-031` : la build de production a crashé **au lancement**
 * sur TestFlight parce que les `EXPO_PUBLIC_*` ne vivaient que dans
 * `.env.local` — gitignoré, donc absent du build EAS cloud — et que
 * `readSupabaseConfig()` lève, à raison, quand elles manquent.
 *
 * Ce test fige la condition **nécessaire** (les variables déclarées dans les
 * profils qui buildent dans le cloud), pas la condition suffisante — l'app qui
 * se lance reste un critère d'appareil, dit dans le ticket. Le profil
 * `development` n'est pas concerné : son JavaScript vient de Metro sur la
 * machine de dev, où `.env.local` existe.
 */
const eas = JSON.parse(readFileSync(new URL('./eas.json', import.meta.url), 'utf8')) as {
  build: Record<string, { env?: Record<string, string> }>;
};

const PROFILS_CLOUD = ['preview', 'production'] as const;

describe('eas.json — les variables publiques des builds cloud (D-031)', () => {
  it.each(PROFILS_CLOUD)('le profil « %s » expose l’URL et la clé publiques', (profil) => {
    const env = eas.build[profil]?.env;

    expect(env, `le profil ${profil} n'a pas de bloc env`).toBeDefined();
    // La forme du projet hébergé, pas une valeur locale : une URL 127.0.0.1
    // dans une build TestFlight serait exactement le crash qu'on vient de payer.
    expect(env?.['EXPO_PUBLIC_SUPABASE_URL']).toMatch(/^https:\/\/[a-z]{20}\.supabase\.co$/);
    expect(env?.['EXPO_PUBLIC_SUPABASE_ANON_KEY']).toMatch(/^sb_publishable_/);
  });

  // La frontière de la décision D-031 : ce fichier est versionné parce que ses
  // valeurs sont publiques par construction. Une clé qui ne commence pas par
  // EXPO_PUBLIC_ est soit un secret (service_role, SMTP, Brevo, jeton), soit
  // une variable que le bundle n'embarquera pas — dans les deux cas un défaut.
  it('aucun bloc env ne porte autre chose que du EXPO_PUBLIC_*', () => {
    for (const [profil, config] of Object.entries(eas.build)) {
      for (const cle of Object.keys(config.env ?? {})) {
        expect(cle, `${profil}.env porte « ${cle} »`).toMatch(/^EXPO_PUBLIC_/);
      }
    }
  });
});
