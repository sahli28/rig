// P1-007 — Test des fonctions pures de l'émetteur, sous Deno (le vrai moteur).
//
// On n'assère pas la chaîne d'heure exacte (elle dépend de la version d'ICU) mais
// des **invariants** : titre exact, nom du cours présent, aucun placeholder non
// résolu, la langue rendue, l'agrégation par ligne d'outbox, la révocation d'un
// jeton mort.
//
// Lancer : `deno test supabase/functions/rack-push-emitter/`

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildExpoMessages,
  deepLinkForClass,
  interpretExpoResponse,
  type ClaimedRow,
  type ExpoTicket,
  type OutgoingEntry,
} from './messages.ts';

function reminderRow(overrides: Partial<ClaimedRow> = {}): ClaimedRow {
  return {
    id: 'o1',
    tenant_id: 't1',
    membership_id: 'm1',
    category: 'CLASS_REMINDER',
    context: {
      class_id: 'c1',
      class_name_i18n: { fr: 'CrossFit', en: 'CrossFit' },
      starts_at: '2026-09-16T17:00:00.000Z',
      timezone: 'Europe/Paris',
    },
    locale: 'fr',
    push_tokens: ['ExponentPushToken[aaa]'],
    ...overrides,
  };
}

Deno.test('buildExpoMessages — un message par jeton, contenu résolu (fr)', () => {
  const entries = buildExpoMessages([reminderRow({ push_tokens: ['tok-a', 'tok-b'] })]);
  assertEquals(entries.length, 2, 'deux appareils => deux messages');
  for (const e of entries) {
    assertEquals(e.outboxId, 'o1');
    assertEquals(e.message.title, 'Rappel de cours');
    assert(e.message.body.includes('CrossFit'), 'le nom du cours est présent');
    assert(e.message.body.includes('demain'), 'rendu en français');
    assert(!e.message.body.includes('{'), 'aucun placeholder non résolu');
    assertEquals(e.message.data.url, 'rack:///class/c1');
  }
});

Deno.test('buildExpoMessages — bascule de langue (en)', () => {
  const [entry] = buildExpoMessages([reminderRow({ locale: 'en' })]);
  assertEquals(entry.message.title, 'Class reminder');
  assert(entry.message.body.includes('tomorrow'), 'rendu en anglais');
  assert(!entry.message.body.includes('{'));
});

Deno.test('buildExpoMessages — langue inconnue retombe sur le fr', () => {
  const [entry] = buildExpoMessages([reminderRow({ locale: 'de' })]);
  assertEquals(entry.message.title, 'Rappel de cours');
});

Deno.test('buildExpoMessages — annulation porte la date et le bon gabarit', () => {
  const [entry] = buildExpoMessages([reminderRow({ id: 'o2', category: 'CLASS_CANCELLATION' })]);
  assertEquals(entry.message.title, 'Cours annulé');
  assert(entry.message.body.includes('CrossFit'));
  assert(!entry.message.body.includes('{'), 'les placeholders {date} et {time} sont résolus');
});

Deno.test('buildExpoMessages — promotion : offre à confirmer vs place réservée (drapeau)', () => {
  const base = reminderRow({ id: 'o3', category: 'WAITLIST_PROMOTION' });
  const [offer] = buildExpoMessages([
    { ...base, context: { ...base.context, requires_confirmation: true } },
  ]);
  const [confirmed] = buildExpoMessages([
    { ...base, context: { ...base.context, requires_confirmation: false } },
  ]);

  // Une seule catégorie, un seul titre ; le drapeau `requires_confirmation`
  // choisit lequel des deux corps est rendu.
  assertEquals(offer.message.title, "Une place s'est libérée");
  assertEquals(confirmed.message.title, "Une place s'est libérée");
  assert(offer.message.body !== confirmed.message.body, 'le drapeau change le corps');
  assert(offer.message.body.includes('confirme'), "l'offre invite à confirmer");
  assert(!confirmed.message.body.includes('confirme'), "la place réservée n'y invite pas");
  for (const e of [offer, confirmed]) {
    assert(e.message.body.includes('CrossFit'), 'le nom du cours est présent');
    assert(!e.message.body.includes('{'), 'aucun placeholder non résolu');
    assertEquals(e.message.data.url, 'rack:///class/c1');
  }
});

Deno.test(
  "buildExpoMessages — promotion sans drapeau : défaut = l'offre, jamais un corps vide",
  () => {
    const [entry] = buildExpoMessages([reminderRow({ id: 'o4', category: 'WAITLIST_PROMOTION' })]);
    assertEquals(entry.message.title, "Une place s'est libérée");
    assert(entry.message.body.includes('confirme'), "défaut = corps de l'offre");
    assert(!entry.message.body.includes('{'));
  },
);

Deno.test('buildExpoMessages — une ligne sans jeton ne produit aucun message', () => {
  const entries = buildExpoMessages([reminderRow({ push_tokens: [] })]);
  assertEquals(entries.length, 0);
});

Deno.test('buildExpoMessages — une catégorie sans gabarit est ignorée (MARKETING)', () => {
  const entries = buildExpoMessages([reminderRow({ category: 'MARKETING' })]);
  assertEquals(entries.length, 0);
});

Deno.test('interpretExpoResponse — ok vs error par ligne', () => {
  const entries: OutgoingEntry[] = [
    { outboxId: 'a', token: 't1', message: {} as never },
    { outboxId: 'b', token: 't2', message: {} as never },
  ];
  const tickets: ExpoTicket[] = [
    { status: 'ok', id: 'x' },
    { status: 'error', message: 'boom' },
  ];
  const out = interpretExpoResponse(entries, tickets);
  assertEquals(out.sentOutboxIds, ['a']);
  assertEquals(out.failedOutboxIds, ['b']);
  assertEquals(out.tokensToRevoke, []);
});

Deno.test('interpretExpoResponse — un seul appareil OK suffit à envoyer la ligne', () => {
  const entries: OutgoingEntry[] = [
    { outboxId: 'a', token: 't1', message: {} as never },
    { outboxId: 'a', token: 't2', message: {} as never },
  ];
  const tickets: ExpoTicket[] = [
    { status: 'error', message: 'boom' },
    { status: 'ok', id: 'x' },
  ];
  const out = interpretExpoResponse(entries, tickets);
  assertEquals(out.sentOutboxIds, ['a']);
  assertEquals(out.failedOutboxIds, []);
});

Deno.test('interpretExpoResponse — DeviceNotRegistered révoque le jeton', () => {
  const entries: OutgoingEntry[] = [{ outboxId: 'a', token: 'dead-token', message: {} as never }];
  const tickets: ExpoTicket[] = [
    { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
  ];
  const out = interpretExpoResponse(entries, tickets);
  assertEquals(out.failedOutboxIds, ['a']);
  assertEquals(out.tokensToRevoke, ['dead-token']);
});

Deno.test('deepLinkForClass — scheme rack + route class', () => {
  assertEquals(deepLinkForClass('abc'), 'rack:///class/abc');
});
