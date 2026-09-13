/**
 * Le transport résilient des accès serveur à Supabase (D-032).
 *
 * La mise en service du 13 septembre 2026 a montré des `Gateway Timeout`
 * **intermittents** sur l'hébergé (plan gratuit) : la même page rend 200 juste
 * avant et juste après. Sans ce fichier, l'exception remontait en 500 nu.
 *
 * Trois choses, à un seul endroit — le `fetch` que le client Supabase reçoit —
 * plutôt qu'un try/catch par requête :
 *
 * 1. **un délai par requête** (`timeoutMs`), pour qu'une requête qui n'aboutira
 *    pas rende la main avant le plafond de la fonction Vercel ;
 * 2. **un rejeu, borné aux lectures** (`GET`/`HEAD`). Jamais les autres verbes :
 *    un 504 de passerelle dit « pas de réponse à temps », pas « pas exécuté » —
 *    l'amont a pu appliquer l'écriture après la coupure, et la rejouer peut la
 *    doubler. Les RPC passent en POST, lectures comprises (`me()`), et le
 *    transport ne sait pas les distinguer : elles ne sont **pas** rejouées ici,
 *    c'est l'affaire de l'appelant qui, lui, sait ce qu'il appelle.
 * 3. **un journal des requêtes lentes et des échecs**, pour cibler ce qui
 *    dépasse — cold start du plan gratuit ou requête précise, la donnée que
 *    personne n'avait le 13 septembre. **Le chemin seulement, jamais la query
 *    string** : les filtres PostgREST portent des adresses e-mail
 *    (`privacy.md`).
 *
 * Aucune référence à `AbortSignal` au chargement du module : le fichier est
 * embarqué partout où `@rack/core/supabase` l'est (Hermes compris), mais seul
 * le serveur web l'appelle.
 */

export interface JournalRequete {
  method: string;
  /** Chemin sans origine ni query string — jamais de donnée personnelle. */
  path: string;
  /** Statut HTTP, ou `ECHEC` quand la requête n'a pas rendu de réponse. */
  status: number | 'ECHEC';
  durationMs: number;
  /** 1 = premier essai. Une entrée `attempt: 2` dit qu'un rejeu a eu lieu. */
  attempt: number;
}

export interface ResilientFetchOptions {
  /** Délai par tentative. 5 s par défaut : sous le plafond Vercel, au-dessus d'un aller-retour sain. */
  timeoutMs?: number;
  /** Rejeux au-delà du premier essai — lectures `GET`/`HEAD` seulement. */
  retries?: number;
  /** Au-delà de cette durée, une requête **réussie** est journalisée quand même. */
  slowMs?: number;
  /** Sortie du journal — `console.warn` par défaut, remplaçable en test. */
  log?: (entry: JournalRequete) => void;
}

const STATUTS_DE_PASSERELLE = new Set([502, 503, 504, 522, 524]);

/**
 * Typage **structurel**, pas les globaux : ce fichier est typé sous la lib DOM
 * (web) **et** sous celle de React Native (`@rack/core` est partagé), qui ne
 * s'accordent ni sur `RequestInfo` ni sur `AbortSignal`. Le générique préserve
 * le type du `fetch` reçu, l'implémentation ne suppose que ce qu'elle touche.
 */
type ReponseMinimale = { status: number };
type FetchCompatible = (input: never, init?: never) => Promise<ReponseMinimale>;
type InitMinimal = { method?: string; signal?: unknown } & Record<string, unknown>;
type AppelFetch = (
  input: unknown,
  init?: InitMinimal,
) => Promise<{ status: number; body?: { cancel?: () => Promise<unknown> } | null }>;

/** `AbortSignal.timeout`/`any` : Node ≥ 20 et navigateurs — jamais appelé sous Hermes. */
const ABORT = () =>
  (
    globalThis as unknown as Record<
      'AbortSignal',
      { timeout(ms: number): unknown; any(signals: unknown[]): unknown }
    >
  ).AbortSignal;

function cheminSansQuery(input: unknown): string {
  try {
    const brut =
      typeof input === 'object' && input !== null && 'url' in input
        ? String((input as { url: unknown }).url)
        : String(input);
    return new URL(brut).pathname;
  } catch {
    return '(url illisible)';
  }
}

function methodeDe(input: unknown, init: InitMinimal | undefined): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === 'object' && input !== null && 'method' in input) {
    return String((input as { method: unknown }).method).toUpperCase();
  }
  return 'GET';
}

/**
 * Enveloppe un `fetch` pour le passer au client Supabase (`global.fetch`).
 *
 * ```ts
 * createServerClient(url, key, { global: { fetch: resilientFetch(fetch) } })
 * ```
 */
export function resilientFetch<F extends FetchCompatible>(
  fetchImpl: F,
  options: ResilientFetchOptions = {},
): F {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const retries = options.retries ?? 1;
  const slowMs = options.slowMs ?? 2_000;
  const log =
    options.log ?? ((entry: JournalRequete) => console.warn(`[supabase] ${JSON.stringify(entry)}`));
  const appel = fetchImpl as unknown as AppelFetch;

  async function fetchResilient(input: unknown, init?: InitMinimal) {
    const method = methodeDe(input, init);
    const path = cheminSansQuery(input);
    const rejouable = method === 'GET' || method === 'HEAD';
    const essais = rejouable ? retries + 1 : 1;

    let derniereErreur: unknown;

    for (let attempt = 1; attempt <= essais; attempt += 1) {
      const coupure = ABORT().timeout(timeoutMs);
      const signal = init?.signal ? ABORT().any([init.signal, coupure]) : coupure;
      const debut = Date.now();

      try {
        const response = await appel(input, { ...init, signal });
        const durationMs = Date.now() - debut;
        const aRejouer = STATUTS_DE_PASSERELLE.has(response.status) && attempt < essais;

        if (durationMs >= slowMs || STATUTS_DE_PASSERELLE.has(response.status) || attempt > 1) {
          log({ method, path, status: response.status, durationMs, attempt });
        }
        if (!aRejouer) return response;
        // La réponse rejouée ne sera lue par personne : la clore libère la
        // connexion au lieu de la laisser pendre jusqu'au ramasse-miettes.
        void response.body?.cancel?.().catch(() => undefined);
      } catch (error) {
        derniereErreur = error;
        log({ method, path, status: 'ECHEC', durationMs: Date.now() - debut, attempt });
        if (attempt >= essais) throw error;
      }
    }

    // Inatteignable : la boucle rend ou lève toujours. TypeScript ne le voit pas.
    throw derniereErreur;
  }

  return fetchResilient as unknown as F;
}
