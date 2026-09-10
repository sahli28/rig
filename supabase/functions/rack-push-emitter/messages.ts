// P1-007 — L'émetteur : les deux fonctions pures, séparées du transport.
//
// `buildExpoMessages` (rendu) et `interpretExpoResponse` (lecture de la réponse)
// n'ont **aucun** effet de bord : elles se testent en `deno test` sans HTTP ni
// base. C'est ce qui les rend honnêtes — et Deno **est** le moteur de l'émetteur,
// donc les tester ici n'est pas une violation de D-010 (contrairement à Vitest
// sous Node pour du code qui tourne sous Hermes).
//
// Le rendu i18n vient des **mêmes** `fr.json`/`en.json` que l'app : une seule
// source de vérité (règle 8). L'app ne peut pas composer la notification (elle ne
// tourne pas quand une push part), donc le rendu se fait ici, côté serveur, où
// `Intl` est complet — l'interdit d'`Intl` du dépôt vise Hermes (le mobile), pas
// Deno.

import fr from '../../../packages/core/src/i18n/locales/fr.json' with { type: 'json' };
import en from '../../../packages/core/src/i18n/locales/en.json' with { type: 'json' };

const BUNDLES: Record<string, Record<string, string>> = { fr, en };

/** La langue par défaut si la langue résolue n'est pas connue du bundle. */
const FALLBACK_LOCALE = 'fr';

/** Catégorie -> clés i18n. Les littéraux sont ici pour que `i18n:check` les voie
 *  employés (il scanne `supabase/functions`). */
const TEMPLATES: Record<string, { title: string; body: string; withDate: boolean }> = {
  CLASS_REMINDER: {
    title: 'push.class_reminder_title',
    body: 'push.class_reminder_body',
    withDate: false,
  },
  CLASS_CANCELLATION: {
    title: 'push.class_cancellation_title',
    body: 'push.class_cancellation_body',
    withDate: true,
  },
};

const PLACEHOLDER = /\{(\w+)\}/g;

/** Interpolation `{clé}`, à l'identique de `packages/core/src/i18n/translate.ts`
 *  (un placeholder sans valeur reste visible, jamais un trou silencieux). */
function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (match, name: string) =>
    values[name] === undefined ? match : values[name],
  );
}

function bundleFor(locale: string): Record<string, string> {
  return BUNDLES[locale] ?? BUNDLES[FALLBACK_LOCALE];
}

function formatTime(startsAt: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startsAt));
}

function formatDate(startsAt: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
  }).format(new Date(startsAt));
}

export interface PushContext {
  class_id: string;
  class_name_i18n: Record<string, string>;
  starts_at: string;
  timezone: string;
}

export interface ClaimedRow {
  id: string;
  tenant_id: string;
  membership_id: string;
  category: string;
  context: PushContext;
  locale: string;
  push_tokens: string[];
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { url: string };
  sound: 'default';
  priority: 'high';
}

/** Une entrée par (ligne d'outbox, jeton) : plusieurs appareils => plusieurs
 *  messages, tous rattachés à la même ligne pour corréler la réponse d'Expo. */
export interface OutgoingEntry {
  outboxId: string;
  token: string;
  message: ExpoMessage;
}

/** Le lien profond ouvert au toucher de la notification. Scheme `rack` (app.json)
 *  + la route expo-router `/class/[id]`. */
export function deepLinkForClass(classId: string): string {
  return `rack:///class/${classId}`;
}

function render(row: ClaimedRow): { title: string; body: string } {
  const tpl = TEMPLATES[row.category];
  const locale = row.locale in BUNDLES ? row.locale : FALLBACK_LOCALE;
  const bundle = bundleFor(locale);
  const className =
    row.context.class_name_i18n?.[locale] ?? row.context.class_name_i18n?.[FALLBACK_LOCALE] ?? '';
  const values: Record<string, string> = {
    class: className,
    time: formatTime(row.context.starts_at, row.context.timezone, locale),
  };
  if (tpl.withDate) {
    values.date = formatDate(row.context.starts_at, row.context.timezone, locale);
  }
  return {
    title: interpolate(bundle[tpl.title], values),
    body: interpolate(bundle[tpl.body], values),
  };
}

/**
 * Transforme les lignes claimées en messages Expo, un par jeton d'appareil.
 * Une ligne sans jeton ne produit aucun message : l'appelant la traitera comme
 * « rien à envoyer » (voir index.ts).
 */
export function buildExpoMessages(rows: ClaimedRow[]): OutgoingEntry[] {
  const entries: OutgoingEntry[] = [];
  for (const row of rows) {
    if (!TEMPLATES[row.category]) continue; // catégorie sans gabarit (MARKETING au pilote)
    const { title, body } = render(row);
    for (const token of row.push_tokens ?? []) {
      entries.push({
        outboxId: row.id,
        token,
        message: {
          to: token,
          title,
          body,
          data: { url: deepLinkForClass(row.context.class_id) },
          sound: 'default',
          priority: 'high',
        },
      });
    }
  }
  return entries;
}

/** Un ticket de la réponse Expo (`POST /--/api/v2/push/send`), dans l'ordre des
 *  messages envoyés. */
export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface EmitOutcome {
  /** Lignes dont au moins un jeton a réussi. */
  sentOutboxIds: string[];
  /** Lignes dont tous les jetons ont échoué. */
  failedOutboxIds: string[];
  /** Jetons morts (`DeviceNotRegistered`) à révoquer, dédupliqués. */
  tokensToRevoke: string[];
}

/**
 * Lit la réponse d'Expo et décide, **par ligne d'outbox**, de l'issue. Une ligne
 * est envoyée si l'un de ses appareils a reçu ; échouée si tous ont échoué. Un
 * `DeviceNotRegistered` supprime le jeton (critère « supprimé au premier échec »).
 *
 * `tickets` est aligné positionnellement sur `entries` — c'est le contrat de
 * l'API Expo, et la raison pour laquelle `buildExpoMessages` préserve l'ordre.
 */
export function interpretExpoResponse(
  entries: OutgoingEntry[],
  tickets: ExpoTicket[],
): EmitOutcome {
  const anyOk = new Map<string, boolean>();
  const revoke = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ticket = tickets[i];
    const ok = ticket?.status === 'ok';
    anyOk.set(entry.outboxId, (anyOk.get(entry.outboxId) ?? false) || ok);
    if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      revoke.add(entry.token);
    }
  }

  const sentOutboxIds: string[] = [];
  const failedOutboxIds: string[] = [];
  for (const [outboxId, ok] of anyOk) {
    (ok ? sentOutboxIds : failedOutboxIds).push(outboxId);
  }

  return { sentOutboxIds, failedOutboxIds, tokensToRevoke: [...revoke] };
}
