'use server';

/**
 * L'écriture de l'import.
 *
 * **Le fichier n'arrive jamais ici** : il est décodé, analysé et mappé dans le
 * navigateur, et seules les lignes retenues traversent le réseau — sans les
 * colonnes qu'on n'importe pas. Un CSV d'effectif est un fichier de données
 * personnelles ; ne pas le recevoir, c'est ne jamais avoir à le stocker, le
 * journaliser, ni l'oublier dans un répertoire temporaire
 * (`.claude/rules/privacy.md`).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  can,
  claimInvitationsToEmail,
  fetchMe,
  findMembershipBySlug,
  importMembers,
  markEmailDelivery,
} from '@rack/core/supabase';
import {
  ImportRowSchema,
  MAX_IMPORT_ROWS,
  errorMessageKeyOf,
  renderInvitationEmail,
  type RenderedEmail,
} from '@rack/core';
import { serverClient } from '../../../../lib/supabase/server';
import type { ImportState } from './import-state';

const RowsSchema = z.array(ImportRowSchema).min(1).max(MAX_IMPORT_ROWS);

export async function runImport(
  slug: string,
  _prev: ImportState,
  form: FormData,
): Promise<ImportState> {
  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null || !can(membership.role, 'members')) {
    return { status: 'error', key: 'errors.forbidden_role' };
  }

  // Les lignes arrivent en JSON, revalidées ici : l'analyse du navigateur sert
  // l'écran, elle ne fait pas autorité. La base les revalide une troisième fois.
  const brut = form.get('rows');
  let parsed;
  try {
    parsed = RowsSchema.safeParse(JSON.parse(typeof brut === 'string' ? brut : '[]'));
  } catch {
    return { status: 'error', key: 'errors.import_invalid_row' };
  }
  if (!parsed.success) return { status: 'error', key: 'errors.import_invalid_row' };

  try {
    const result = await importMembers(client, membership.tenant_id, parsed.data);
    revalidatePath(`/box/${slug}/membres`);
    revalidatePath(`/box/${slug}/staff`);
    return { status: 'done', result };
  } catch (error) {
    return { status: 'error', key: errorMessageKeyOf(error) };
  }
}

/**
 * Un rejet Brevo, avec son **code HTTP** — la seule information qui sépare une
 * adresse morte (à corriger) d'un quota atteint (à réessayer). `status = null`
 * quand `fetch` lui-même échoue (réseau), ce qui est toujours temporaire.
 */
class BrevoError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'BrevoError';
  }
}

/**
 * `permanent` (adresse à corriger) vs `temporary` (à réessayer). Un `4xx` **hors
 * 429** est un rejet définitif de la requête (adresse invalide) ; `429`, `5xx` et
 * l'échec réseau (`status = null`) sont transitoires. Cette même classe pilote le
 * marquage en base (`failed_permanent` vs `failed`) **et** l'écran.
 */
function classifyBrevoFailure(error: unknown): 'permanent' | 'temporary' {
  const status = error instanceof BrevoError ? error.status : null;
  return status !== null && status >= 400 && status < 500 && status !== 429
    ? 'permanent'
    : 'temporary';
}

/**
 * Poste un e-mail transactionnel via l'API Brevo. **Non exporté** : ce n'est pas
 * une action serveur mais l'appel HTTP que `sendInvitations` orchestre. La clé vit
 * en variable d'env **serveur** (jamais dans le bundle client, jamais commitée).
 * Rend l'id de message Brevo, ou **lève une `BrevoError`** sur rejet — l'appelant
 * la classe et marque `failed` | `failed_permanent`.
 */
async function sendViaBrevo(
  apiKey: string,
  to: { email: string; name: string | null },
  email: RenderedEmail,
): Promise<string | null> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Rack', email: 'bonjour@rack-app.fr' },
      to: [to.name ? { email: to.email, name: to.name } : { email: to.email }],
      subject: email.subject,
      htmlContent: email.htmlContent,
      textContent: email.textContent,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new BrevoError(res.status, `Brevo ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json().catch(() => ({}))) as { messageId?: string };
  return json.messageId ?? null;
}

/**
 * Envoie (ou relance) les invitations de la box par e-mail — le lundi matin de
 * `P1-016`. Réserve un lot d'invitations PENDING nominatives sans envoi récent
 * (idempotence + vagues), rend l'e-mail « connecte-toi avec cette adresse » — pas
 * de jeton, l'effectif rejoint par appariement d'e-mail — le poste via Brevo et
 * journalise chaque issue. Un échec Brevo n'entraîne pas les envois suivants :
 * l'e-mail est un effet de bord, jamais une condition.
 */
export async function sendInvitations(
  slug: string,
  _prev: ImportState,
  _form: FormData,
): Promise<ImportState> {
  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null || !can(membership.role, 'members')) {
    return { status: 'error', key: 'errors.forbidden_role' };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const inviteUrl = process.env.RACK_INVITE_URL ?? '';
  // Rien n'est réservé sans la clé ni l'URL : sinon on laisserait des lignes
  // `sending` qui n'aboutiraient jamais et bloqueraient la fenêtre d'idempotence.
  if (apiKey === undefined || apiKey === '' || inviteUrl === '') {
    return { status: 'error', key: 'errors.email_send_failed' };
  }

  // La box porte le nom et la langue de l'e-mail : l'invité n'a pas encore de compte.
  const scoped = await fetchMe(client, membership.tenant_id);
  const tenant = scoped.current_tenant;
  if (tenant === null) return { status: 'error', key: 'errors.forbidden_role' };
  const locale = tenant.default_locale === 'en' ? 'en' : 'fr';

  let claimed;
  try {
    // Un lot borné (vague) : 20 POST Brevo en série tiennent sous le maxDuration de
    // la route (voir page.tsx). L'opérateur reclique pour la vague suivante —
    // l'idempotence (claim/mark) garantit « jamais deux fois ».
    claimed = await claimInvitationsToEmail(client, membership.tenant_id, { limit: 20 });
  } catch (error) {
    return { status: 'error', key: errorMessageKeyOf(error) };
  }

  let sent = 0;
  const failures: { email: string; kind: 'permanent' | 'temporary' }[] = [];
  for (const invitation of claimed) {
    const email = renderInvitationEmail(locale, {
      boxName: tenant.name,
      email: invitation.email,
      inviteUrl,
    });
    try {
      const providerMessageId = await sendViaBrevo(
        apiKey,
        { email: invitation.email, name: invitation.first_name },
        email,
      );
      await markEmailDelivery(client, invitation.delivery_id, {
        status: 'sent',
        providerMessageId,
      });
      sent += 1;
    } catch (error) {
      const kind = classifyBrevoFailure(error);
      const reason = error instanceof Error ? error.message : String(error);
      // Le marquage de l'échec ne doit pas, à son tour, faire tomber l'envoi suivant.
      // `failed_permanent` retire l'adresse des prochaines vagues (adresse morte) ;
      // `failed` reste réessayable (quota, réseau).
      await markEmailDelivery(client, invitation.delivery_id, {
        status: kind === 'permanent' ? 'failed_permanent' : 'failed',
        error: reason,
      }).catch(() => undefined);
      failures.push({ email: invitation.email, kind });
    }
  }

  revalidatePath(`/box/${slug}/membres`);
  return { status: 'sent', sent, failed: failures.length, failures };
}
