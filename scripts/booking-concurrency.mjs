#!/usr/bin/env node
/**
 * Le critère T1 de P1-003 : **N réservations simultanées sur une seule place →
 * exactement une confirmée, zéro compteur faux.**
 *
 * Pourquoi ce n'est pas un test pgTAP. Un fichier pgTAP tourne dans **une**
 * session ; deux réservations concurrentes y seraient séquentielles, et
 * `book_class()` passerait toute la suite au vert sans le moindre `for update`.
 * La contention ne se simule pas, elle se provoque.
 *
 * Pourquoi pas `dblink` non plus, qui aurait tenu dans pgTAP : sous Supabase,
 * `postgres` n'est pas superutilisateur, et dblink exige alors un mot de passe
 * **dans la chaîne de connexion**. Écrire un mot de passe dans un fichier de
 * test versionné, même local, est exactement ce que `/check` interdit. Le ticket
 * prévoyait d'ailleurs un harnais externe (« k6 ou pg_bench »).
 *
 * Comment la simultanéité est obtenue. Ouvrir N processus prend du temps, et
 * démarrés en cascade ils se croiseraient à peine. Chaque session attend donc un
 * **instant commun**, calculé côté serveur, puis appelle `book_class()` :
 *
 *     select pg_sleep(greatest(0, extract(epoch from (<top> - clock_timestamp()))));
 *     select public.book_class(…);
 *
 * Tout le monde se réveille à la même seconde, quel que soit le temps de
 * démarrage. C'est la seule façon d'être sûr que la contention a bien eu lieu —
 * et le script le **vérifie** plutôt que de l'espérer : si les erreurs ne sont
 * pas de la bonne forme, il le dit.
 *
 * Usage :
 *     node scripts/booking-concurrency.mjs [N]     (défaut : 200, comme la spec)
 */

import { spawn, spawnSync } from 'node:child_process';

const CONTAINER = 'supabase_db_imys';
const N = Number(process.argv[2] ?? 200);
/** Marge avant le top de départ. Doit couvrir le démarrage de N processus. */
const COUNTDOWN_SECONDS = Math.max(4, Math.ceil(N / 40));

const TENANT = 'dddddddd-0000-4000-8000-000000000001';
const CLASS = 'dd000000-0000-4000-8000-000000000001';

/** Un `psql` dans le conteneur. Le mot de passe n'entre jamais en jeu. */
function psql(sql, { async: isAsync = false } = {}) {
  const args = ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql];
  if (isAsync) return spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`psql a échoué :\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function log(line) {
  process.stdout.write(`${line}\n`);
}

/**
 * Combien de sessions le serveur peut réellement accepter en plus, maintenant.
 *
 * Marge de cinq : les services Supabase ouvrent et ferment des connexions
 * pendant la ruée, et une session qui n'obtient pas de connexion est une session
 * qui n'a rien prouvé.
 */
function connectionHeadroom() {
  return Number(
    psql(`
    select greatest(0,
      current_setting('max_connections')::int
      - current_setting('superuser_reserved_connections')::int
      - (select count(*) from pg_stat_activity)
      - 5)
  `),
  );
}

// ---------------------------------------------------------------------------
// Décor : une box à part, N membres, un cours à une place
// ---------------------------------------------------------------------------

/**
 * Une box dédiée plutôt que le seed. Le harnais **commite** — il le faut, les
 * sessions concurrentes doivent voir le décor — donc il laisse des traces. Les
 * confiner dans un tenant qui n'appartient à personne rend le nettoyage exact et
 * évite de fausser la suite pgTAP, qui compte les lignes du seed.
 */
function setUp() {
  log(`Décor : 1 cours à 1 place, ${N} membres, box ${TENANT.slice(0, 8)}…`);
  psql(`
    begin;
    delete from public.bookings where tenant_id = '${TENANT}';
    delete from public.classes where tenant_id = '${TENANT}';
    delete from public.class_schedules where tenant_id = '${TENANT}';
    delete from public.memberships where tenant_id = '${TENANT}';
    delete from auth.users where id::text like 'dd1%';
    delete from public.tenants where id = '${TENANT}';

    insert into public.tenants (id, slug, name, country, timezone, currency)
    values ('${TENANT}', 'charge-test', 'Charge', 'FR', 'Europe/Paris', 'EUR');
    insert into public.tenant_settings (tenant_id, max_upcoming_bookings)
    values ('${TENANT}', 1000);
    insert into public.locations (id, tenant_id, name)
    values ('dd200000-0000-4000-8000-000000000001', '${TENANT}', 'Salle');
    insert into public.rooms (id, tenant_id, location_id, name, capacity)
    values ('dd300000-0000-4000-8000-000000000001', '${TENANT}',
            'dd200000-0000-4000-8000-000000000001', 'Salle', 100);
    insert into public.class_types (id, tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('dd400000-0000-4000-8000-000000000001', '${TENANT}',
            '{"fr":"Charge"}'::jsonb, 60, 1);

    -- N personnes, créées par le vrai chemin : le trigger \`on_auth_user_created\`
    -- alimente \`public.users\`. Écrire directement dans \`public.users\` ferait
    -- passer le harnais à côté du mécanisme réel (piège 9 de database.md).
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    select
      ('dd1' || lpad(i::text, 5, '0') || '-0000-4000-8000-000000000001')::uuid,
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'charge' || i || '@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    from generate_series(1, ${N}) as i;

    insert into public.memberships (id, tenant_id, user_id, role, status)
    select
      ('dd500000-' || lpad(i::text, 4, '0') || '-4000-8000-000000000001')::uuid,
      '${TENANT}',
      ('dd1' || lpad(i::text, 5, '0') || '-0000-4000-8000-000000000001')::uuid,
      'MEMBER', 'ACTIVE'
    from generate_series(1, ${N}) as i;

    -- Une série porteuse : classes.schedule_id est not null, une occurrence
    -- appartient toujours à une récurrence.
    insert into public.class_schedules (id, tenant_id, class_type_id, room_id,
                                        coach_membership_id, starts_on, starts_at_local,
                                        rrule, capacity)
    values ('dd600000-0000-4000-8000-000000000001', '${TENANT}',
            'dd400000-0000-4000-8000-000000000001',
            'dd300000-0000-4000-8000-000000000001',
            'dd500000-0001-4000-8000-000000000001',
            current_date, '18:30', 'FREQ=WEEKLY;BYDAY=MO', 1);

    -- **Une place.** Tout le harnais tient dans ce chiffre.
    insert into public.classes (id, tenant_id, schedule_id, class_type_id, room_id,
                                coach_membership_id, starts_at, ends_at, capacity)
    values ('${CLASS}', '${TENANT}', 'dd600000-0000-4000-8000-000000000001',
            'dd400000-0000-4000-8000-000000000001',
            'dd300000-0000-4000-8000-000000000001',
            'dd500000-0001-4000-8000-000000000001',
            now() + interval '2 days', now() + interval '2 days 1 hour', 1);
    commit;
  `);
}

function tearDown() {
  psql(`
    begin;
    delete from public.bookings where tenant_id = '${TENANT}';
    delete from public.classes where tenant_id = '${TENANT}';
    delete from public.class_schedules where tenant_id = '${TENANT}';
    delete from public.memberships where tenant_id = '${TENANT}';
    delete from auth.users where id::text like 'dd1%';
    delete from public.tenants where id = '${TENANT}';
    commit;
  `);
}

// ---------------------------------------------------------------------------
// La ruée
// ---------------------------------------------------------------------------

async function stampede(first, count) {
  const startAt = psql(
    `select (clock_timestamp() + interval '${COUNTDOWN_SECONDS} seconds')::text`,
  );
  log(`  top commun : ${startAt} (${COUNTDOWN_SECONDS} s de marge) · ${count} session(s)`);

  const sessions = Array.from({ length: count }, (_, index) => {
    const i = first + index;
    const membership = `dd500000-${String(i).padStart(4, '0')}-4000-8000-000000000001`;
    const user = `dd1${String(i).padStart(5, '0')}-0000-4000-8000-000000000001`;

    // `set local role` + claims : la fonction voit un vrai `auth.uid()`, comme
    // en production. Un appel en `postgres` prouverait la sérialisation mais
    // sauterait la garde « on ne réserve que pour soi ».
    const sql = `
      select pg_sleep(greatest(0, extract(epoch from (timestamptz '${startAt}' - clock_timestamp()))));
      begin;
      set local role authenticated;
      set local request.jwt.claims = '{"sub":"${user}","role":"authenticated","email":"charge${i}@example.test"}';
      select public.book_class('${CLASS}', '${membership}', 'charge-${i}');
      commit;
    `;

    const child = psql(sql, { async: true });
    return new Promise((resolve) => {
      let out = '';
      let err = '';
      child.stdout.on('data', (c) => (out += c));
      child.stderr.on('data', (c) => (err += c));
      child.on('close', (code) => resolve({ i, code, out: out.trim(), err: err.trim() }));
    });
  });

  return Promise.all(sessions);
}

// ---------------------------------------------------------------------------
// Le verdict
// ---------------------------------------------------------------------------

function verdict(results, peak) {
  const confirmed = Number(
    psql(`select count(*) from public.bookings
          where class_id = '${CLASS}' and status = 'CONFIRMED'`),
  );
  const total = Number(psql(`select count(*) from public.bookings where class_id = '${CLASS}'`));
  const counter = Number(psql(`select booked_count from public.classes where id = '${CLASS}'`));
  const capacity = Number(psql(`select capacity from public.classes where id = '${CLASS}'`));

  const refused = results.filter((r) => r.code !== 0);
  const full = refused.filter((r) => /CLASS_FULL|complet/i.test(r.err)).length;
  const other = refused.filter((r) => !/CLASS_FULL|complet/i.test(r.err));

  const checks = [
    ['exactement une réservation confirmée', confirmed === 1, `${confirmed}`],
    ['aucune réservation fantôme', total === 1, `${total} ligne(s)`],
    ['le compteur du cours vaut 1', counter === 1, `${counter}`],
    ['le compteur ne dépasse jamais la capacité', counter <= capacity, `${counter} / ${capacity}`],
    [`les ${N - 1} autres sont refusées`, refused.length === N - 1, `${refused.length}`],
    // **Le contrôle qui empêche le faux vert.** Si des refus ne sont pas des
    // « cours complet », c'est que des sessions n'ont jamais atteint la fonction
    // — plus de connexion disponible, par exemple. L'invariant paraîtrait tenu
    // alors que la contention n'a pas eu lieu.
    [
      'tous les refus sont « cours complet »',
      other.length === 0,
      `${full} complet, ${other.length} autre(s)`,
    ],
    ['contention réelle sur la place', peak >= 2, `${peak} sessions en même temps`],
  ];

  log('');
  for (const [label, ok, detail] of checks) {
    log(`  ${ok ? '✓' : '✗'} ${label.padEnd(48)} ${detail}`);
  }

  if (other.length > 0) {
    log('\n  Refus d’une autre nature (extrait) :');
    for (const r of other.slice(0, 3)) log(`    #${r.i} — ${r.err.split('\n')[0]}`);
  }

  return checks.every(([, ok]) => ok);
}

// ---------------------------------------------------------------------------

log(`\nP1-003 · T1 — ${N} tentatives de réservation sur une place\n`);

let ok = false;
try {
  setUp();

  // Le plafond se mesure **après** le décor : les insertions ont pu laisser des
  // connexions ouvertes, et un chiffre pris trop tôt serait optimiste.
  const headroom = connectionHeadroom();
  const wave = Math.min(N, headroom);

  log(
    wave < N
      ? `Plafond de connexions : ${headroom}. La ruée se fait par vagues de ${wave} — ` +
          `la contention réelle est celle de la première.`
      : `Plafond de connexions : ${headroom}. Les ${N} sessions tiennent en une seule ruée.`,
  );

  const started = Date.now();
  const results = [];
  for (let first = 1; first <= N; first += wave) {
    const count = Math.min(wave, N - first + 1);
    log(`Vague ${Math.ceil(first / wave)} :`);
    results.push(...(await stampede(first, count)));
  }
  log(`Terminé en ${((Date.now() - started) / 1000).toFixed(1)} s`);

  ok = verdict(results, wave);
} finally {
  tearDown();
}

log(ok ? '\nT1 : PASS — aucune double réservation.\n' : '\nT1 : FAIL.\n');
process.exit(ok ? 0 : 1);
