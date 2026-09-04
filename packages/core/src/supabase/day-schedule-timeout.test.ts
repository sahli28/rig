import { describe, expect, it } from 'vitest';
import { DAY_SCHEDULE_TIMEOUT_MS, fetchDaySchedule } from './planning';
import type { RackClient } from './client';

/**
 * **Le critère de déterminisme, rendu exécutable.**
 *
 * La passe du 4 septembre 2026 a trouvé un écran qui, hors ligne sur un jour
 * jamais visité, affichait des squelettes « très longtemps », puis tantôt
 * « Planning indisponible », tantôt rien. Même geste, résultat différent.
 *
 * La cause n'était pas l'échec — l'état final était correct — mais **l'absence
 * de borne** : rien ne coupait court, l'app attendait que le système
 * d'exploitation abandonne, et ce délai varie.
 *
 * Un critère écrit dans un ticket ne se vérifie qu'à la main, sur un téléphone,
 * quand on y pense. Celui-ci se vérifie à chaque `pnpm test`.
 */

/**
 * Un client dont **aucune requête ne répond jamais** — le sous-sol de box avec
 * du wifi qui capte mal, pas le mode avion. Il ne rejette qu'à l'abandon, comme
 * le fait `supabase-js` sur un `abortSignal`.
 */
function clientSansReponse(): RackClient {
  const chaine = {
    signal: undefined as AbortSignal | undefined,
    select: () => chaine,
    eq: () => chaine,
    is: () => chaine,
    gte: () => chaine,
    lt: () => chaine,
    order: () => chaine,
    abortSignal(signal: AbortSignal) {
      chaine.signal = signal;
      return chaine;
    },
    then(onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
      return new Promise((_resolve, rejeter) => {
        chaine.signal?.addEventListener('abort', () => {
          rejeter(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        });
      }).then(onOk, onErr);
    },
  };

  return { from: () => chaine } as unknown as RackClient;
}

const requete = {
  tenantId: 'aaaaaaaa-0000-4000-8000-000000000001',
  date: '2026-09-04',
  timeZone: 'Europe/Paris',
  locale: 'fr',
};

describe('fetchDaySchedule — la lecture est bornée', () => {
  it('abandonne au bout du délai plutôt que d’attendre le système', async () => {
    // 120 ms au lieu de 5 s : le test vérifie **qu'une borne existe et qu'elle
    // est respectée**, pas la valeur de production. Celle-ci est un choix de
    // produit, vérifiée par la constante ci-dessous.
    const debut = Date.now();

    await expect(
      fetchDaySchedule(clientSansReponse(), { ...requete, timeoutMs: 120 }),
    ).rejects.toThrow();

    const ecoule = Date.now() - debut;
    // **Les deux bornes, et la basse compte autant que la haute.** Sans elle, ce
    // test passerait aussi si le faux client rejetait instantanément : il
    // prouverait « ça échoue » au lieu de « ça échoue au bout du délai », et ne
    // verrait pas la disparition de la minuterie.
    expect(ecoule, 'la lecture a rendu la main avant le délai').toBeGreaterThanOrEqual(100);
    expect(ecoule, 'la lecture a attendu bien au-delà du délai').toBeLessThan(1_000);
  });

  it('rend la main **au même moment** à chaque fois — c’est tout l’objet', async () => {
    // Le défaut n'était pas la lenteur, c'était l'écart entre deux exécutions
    // du même geste. Trois tentatives, et l'écart doit rester une marge de
    // planification, pas un ordre de grandeur.
    const durees: number[] = [];
    for (let essai = 0; essai < 3; essai += 1) {
      const debut = Date.now();
      await expect(
        fetchDaySchedule(clientSansReponse(), { ...requete, timeoutMs: 120 }),
      ).rejects.toThrow();
      durees.push(Date.now() - debut);
    }

    const ecart = Math.max(...durees) - Math.min(...durees);
    expect(ecart, `durées observées : ${durees.join(', ')} ms`).toBeLessThan(150);
  });

  it('le délai de production vaut cinq secondes, et c’est une décision', () => {
    // Épinglé plutôt que subi. Le p95 visé pour une écriture de réservation est
    // de 800 ms (P1-003) et une lecture de journée est plus légère : cinq
    // secondes valent plus de six fois la pire latence acceptable, donc ce délai
    // ne peut pas couper une requête qui allait aboutir. Et il reste sous les
    // dix secondes à partir desquelles on tue une app plutôt que de l'attendre.
    expect(DAY_SCHEDULE_TIMEOUT_MS).toBe(5_000);
  });
});
