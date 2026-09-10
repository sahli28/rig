// P1-007 — L'émetteur : la première brique serveur du produit (ADR 0004).
//
// Il ne décide de rien : il draine `push_outbox` (via `claim_push_outbox`, en
// `service_role`), rend les messages, les POST à Expo Push (qui route vers APNs
// ou FCM), puis renvoie l'issue en base (`mark_push_sent`/`mark_push_failed`/
// `revoke_device`). Toute la décision d'éligibilité a été prise à l'enfilage
// (lot 1). `verify_jwt = false` (config.toml) : il est réveillé par un
// `net.http_post` sans en-tête d'auth, et c'est le `service_role` du runtime qui
// lui donne accès à la base.
//
// Le POST live vers exp.host, le saut APNs et le pruning bout-en-bout ne sont pas
// couverts par un test automatique (D-010) — passe iPhone. Les deux fonctions
// pures (rendu, lecture de réponse) le sont, elles, en `deno test`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import {
  buildExpoMessages,
  interpretExpoResponse,
  type ClaimedRow,
  type ExpoTicket,
} from './messages.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CLAIM_LIMIT = 100;
const EXPO_CHUNK = 100; // Expo accepte jusqu'à 100 messages par requête.

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.rpc('claim_push_outbox', { p_limit: CLAIM_LIMIT });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const claimed = (data ?? []) as ClaimedRow[];
  if (claimed.length === 0) {
    return Response.json({ claimed: 0 });
  }

  const entries = buildExpoMessages(claimed);

  // Lignes claimées sans aucun jeton d'appareil : rien à envoyer. On les sort en
  // échec (borné à 5 prises par mark_push_failed) plutôt que de les reprendre
  // indéfiniment — un jeton n'apparaît pas par un retry.
  const withMessages = new Set(entries.map((e) => e.outboxId));
  const noDevice = claimed.filter((r) => !withMessages.has(r.id)).map((r) => r.id);

  const tickets: ExpoTicket[] = [];
  for (let i = 0; i < entries.length; i += EXPO_CHUNK) {
    const chunk = entries.slice(i, i + EXPO_CHUNK);
    const resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(chunk.map((e) => e.message)),
    });
    const json = await resp.json().catch(() => ({}));
    const chunkTickets = (json?.data ?? []) as ExpoTicket[];
    // La réponse est alignée positionnellement sur les messages envoyés ; si
    // Expo en rend moins (erreur globale), on complète en erreur pour ne pas
    // décaler l'interprétation ligne à ligne.
    for (let j = 0; j < chunk.length; j++) {
      tickets.push(chunkTickets[j] ?? { status: 'error', message: 'no ticket' });
    }
  }

  const outcome = interpretExpoResponse(entries, tickets);

  if (outcome.sentOutboxIds.length > 0) {
    await supabase.rpc('mark_push_sent', { p_ids: outcome.sentOutboxIds });
  }
  const failed = [...outcome.failedOutboxIds, ...noDevice];
  if (failed.length > 0) {
    await supabase.rpc('mark_push_failed', { p_ids: failed, p_error: 'expo send failed' });
  }
  for (const token of outcome.tokensToRevoke) {
    await supabase.rpc('revoke_device', { p_push_token: token });
  }

  return Response.json({
    claimed: claimed.length,
    sent: outcome.sentOutboxIds.length,
    failed: failed.length,
    revoked: outcome.tokensToRevoke.length,
  });
});
