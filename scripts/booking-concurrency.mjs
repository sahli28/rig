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
 * pas de la bonne forme, il le dit, et un échantillonneur compte combien de
 * sessions se sont réellement croisées dans la fonction.
 *
 * Usage :
 *     node scripts/booking-concurrency.mjs [N]     (défaut : 200, comme la spec)
 */

import { spawn, spawnSync } from 'node:child_process';

/**
 * Le conteneur Postgres, **découvert et non supposé**.
 *
 * Le CLI Supabase le nomme `supabase_db_<dossier du projet>` : il valait
 * `supabase_db_imys` sur la machine où ce script est né, et
 * `supabase_db_rig` sur un runner GitHub, qui clone dans `rig/`. Un nom en dur
 * marchait donc partout sauf en CI — c'est-à-dire au seul endroit où personne ne
 * l'aurait vu échouer autrement qu'en cherchant pourquoi.
 */
function findContainer() {
  const result = spawnSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  );
  const names = (result.stdout ?? '')
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error(
      'Aucun conteneur `supabase_db_*` en cours d’exécution.\n' +
        'Démarre la base avec `pnpm exec supabase start` avant ce script.',
    );
  }
  if (names.length > 1) {
    // Deux projets Supabase ouverts : deviner lequel serait pire que refuser.
    throw new Error(
      `Plusieurs conteneurs Supabase actifs (${names.join(', ')}).\n` +
        'Arrête les projets que tu ne testes pas : ce script ne devine pas lequel viser.',
    );
  }
  return names[0];
}

const CONTAINER = findContainer();

/**
 * Le nombre de tentatives. La spec §16.4 (T1) en demande 200 ; la CI en lance
 * moins, et le workflow dit pourquoi — voir `.github/workflows/ci.yml`.
 */
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 200);

/**
 * Le scénario. Deux invariants différents, un seul mécanisme.
 *
 * - `book` (T1) — N réservations sur **une** place : exactement une confirmée ;
 * - `cancel` (P1-004) — un cours plein, ses occupants annulent pendant que
 *   d'autres réservent. L'invariant n'est **pas** « exactement une confirmée » :
 *   c'est `booked_count = count(bookings CONFIRMED)`. Un décrément perdu fait
 *   dériver le compteur vers le haut, et le cours reste complet pour toujours
 *   alors qu'il a des places — silencieux, et la box perd des inscriptions sans
 *   jamais savoir pourquoi.
 *
 * Les deux partagent le top commun, l'échantillonneur de pic et le refus des
 * faux verts. Un second script les aurait dupliqués, puis laissé diverger.
 */
const SCENARIO = process.argv.includes('--scenario')
  ? process.argv[process.argv.indexOf('--scenario') + 1]
  : 'book';

if (!['book', 'cancel'].includes(SCENARIO)) {
  throw new Error(`Scénario inconnu : ${SCENARIO}. Attendu : book | cancel.`);
}

/**
 * En scénario `cancel`, le tiers des sessions **détient** une place et l'annule ;
 * les deux autres tiers tentent de réserver. Le cours part donc plein, et les
 * incréments croisent les décréments sur toute la durée de la ruée — ce qui est
 * exactement la situation qu'on veut mettre en défaut.
 */
const HOLDERS = SCENARIO === 'cancel' ? Math.max(1, Math.floor(N / 3)) : 0;
const CAPACITY = SCENARIO === 'cancel' ? HOLDERS : 1;

/** Marge avant le top de départ. Doit couvrir le démarrage de N processus. */
const COUNTDOWN_SECONDS = Math.max(4, Math.ceil(N / 40));

const TENANT = 'dddddddd-0000-4000-8000-000000000001';
const CLASS = 'dd000000-0000-4000-8000-000000000001';

/** Les sessions de la ruée, et l'échantillonneur qui les compte. */
const STAMPEDE_APP = 'rack-stampede';
const SAMPLER_APP = 'rack-peak-sampler';

/**
 * Un `psql` dans le conteneur. Le mot de passe n'entre jamais en jeu.
 *
 * `PGAPPNAME` plutôt qu'un `set application_name` en tête de requête : libpq le
 * pose à l'ouverture de la connexion, donc avant la première instruction, et il
 * survit à l'échec de la transaction.
 */
function psql(sql, { async: isAsync = false, appName = 'rack-harness' } = {}) {
  const args = [
    'exec',
    '-i',
    '-e',
    `PGAPPNAME=${appName}`,
    CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-tAc',
    sql,
  ];
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
            current_date, '18:30', 'FREQ=WEEKLY;BYDAY=MO', ${CAPACITY});

    -- La capacité : une place en scénario book, autant que de détenteurs en cancel.
    insert into public.classes (id, tenant_id, schedule_id, class_type_id, room_id,
                                coach_membership_id, starts_at, ends_at, capacity)
    values ('${CLASS}', '${TENANT}', 'dd600000-0000-4000-8000-000000000001',
            'dd400000-0000-4000-8000-000000000001',
            'dd300000-0000-4000-8000-000000000001',
            'dd500000-0001-4000-8000-000000000001',
            now() + interval '2 days', now() + interval '2 days 1 hour', ${CAPACITY});
    commit;
  `);

  if (SCENARIO === 'cancel') {
    // Les détenteurs réservent **par `book_class()`**, pas par un `insert`
    // direct : un décor qui court-circuite le vrai chemin ne prépare pas l'état
    // que le vrai chemin produit (piège 9 de `.claude/rules/database.md`).
    // Séquentiel et avant le top : ce n'est pas la partie qu'on mesure.
    for (let i = 1; i <= HOLDERS; i++) {
      psql(`
        begin;
        set local role authenticated;
        set local request.jwt.claims = '{"sub":"dd1${String(i).padStart(5, '0')}-0000-4000-8000-000000000001","role":"authenticated","email":"charge${i}@example.test"}';
        select public.book_class('${CLASS}', 'dd500000-${String(i).padStart(4, '0')}-4000-8000-000000000001', 'hold-${i}');
        commit;
      `);
    }
    log(`  ${HOLDERS} place(s) prise(s) avant la ruée — le cours part plein`);
  }
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
// La contention, mesurée
// ---------------------------------------------------------------------------

/**
 * Combien de sessions se sont **réellement** croisées sur la place.
 *
 * La taille prévue d'une vague dit ce qu'on a lancé, pas ce qui s'est croisé :
 * une session partie après le top, ou qui n'a jamais obtenu de connexion, n'a
 * contendu avec personne. Annoncer ce chiffre comme une contention serait
 * énoncer une intention et la présenter comme une mesure.
 *
 * L'échantillonneur ouvre donc une session à part et compte, toutes les 2 ms,
 * les sessions de la ruée **sorties du sommeil** : `wait_event` vaut `PgSleep`
 * tant qu'elles attendent le top, et autre chose — rien, ou l'attente du verrou
 * de ligne — dès qu'elles courent après la place. Le maximum de ces relevés est
 * la simultanéité atteinte.
 *
 * Deux pièges, tous deux payés à l'exécution :
 *
 * - **`pg_stat_activity` est figée pour la durée d'une transaction.** Un bloc
 *   `do` en est une seule : sans `pg_stat_clear_snapshot()`, la boucle relit
 *   mille fois le même instantané — celui d'avant la ruée — et ne voit jamais
 *   personne. Premier relevé de ce harnais : zéro session, sur une ruée qui
 *   avait bel et bien eu lieu ;
 * - il faut lui donner **le top**, sinon il ne sait pas quand se taire. Il
 *   s'arrête deux secondes après le top, une fois la dernière session sortie.
 *   Le garde-fou temporel n'est là que pour qu'il ne survive pas à un harnais
 *   interrompu.
 */
function startPeakSampler(startAt) {
  const child = psql(
    `
    do $sampler$
    declare
      v_top timestamptz := timestamptz '${startAt}';
      v_deadline timestamptz := clock_timestamp() + interval '${COUNTDOWN_SECONDS + 60} seconds';
      v_peak int := 0;
      v_seen int;
    begin
      loop
        perform pg_stat_clear_snapshot();

        select count(*) into v_seen
        from pg_stat_activity
        where application_name = '${STAMPEDE_APP}'
          and state = 'active'
          and coalesce(wait_event, '') <> 'PgSleep';

        if v_seen > v_peak then v_peak := v_seen; end if;

        exit when v_seen = 0 and clock_timestamp() > v_top + interval '2 seconds';
        exit when clock_timestamp() > v_deadline;
        perform pg_sleep(0.002);
      end loop;
      raise notice 'RACK_PEAK=%', v_peak;
    end $sampler$;
  `,
    { async: true, appName: SAMPLER_APP },
  );

  return new Promise((resolve) => {
    let err = '';
    child.stderr.on('data', (c) => (err += c));
    child.on('close', () => {
      const found = /RACK_PEAK=([0-9]+)/.exec(err);
      resolve(found === null ? 0 : Number(found[1]));
    });
  });
}

// ---------------------------------------------------------------------------
// La ruée
// ---------------------------------------------------------------------------

async function stampede(first, count) {
  const startAt = psql(
    `select (clock_timestamp() + interval '${COUNTDOWN_SECONDS} seconds')::text`,
  );
  log(`  top commun : ${startAt} (${COUNTDOWN_SECONDS} s de marge) · ${count} session(s)`);

  // Démarré **avant** les sessions : une vague courte doit être vue en entier.
  const peak = startPeakSampler(startAt);

  const sessions = Array.from({ length: count }, (_, index) => {
    const i = first + index;

    // **Qui agit, et sur quoi.**
    //
    // En `cancel`, les sessions se répartissent en trois tiers :
    //
    //   1 … HOLDERS          un détenteur annule **sa** réservation ;
    //   HOLDERS+1 … 2×HOLDERS le **jumeau** du même détenteur — deux onglets,
    //                         même compte, même réservation, même instant ;
    //   au-delà               les autres tentent de réserver.
    //
    // Le tiers du milieu est celui qui manquait, et son absence a coûté un
    // défaut. Une première tentative faisait annuler **deux fois dans la même
    // session** : séquentiel, donc le second appel sortait au contrôle
    // pré-verrou et ne prouvait rien. Le harnais restait vert sur la version
    // fautive — vérifié en la remettant exprès.
    //
    // Ce qu'il fallait, c'est deux **sessions** sur la même ligne : elles
    // franchissent toutes les deux le contrôle avant le verrou, se sérialisent
    // dessus, et la seconde décrémentait une seconde fois.
    const jumeau = SCENARIO === 'cancel' && i > HOLDERS && i <= HOLDERS * 2;
    const acteur = jumeau ? i - HOLDERS : i;
    const annule = SCENARIO === 'cancel' && i <= HOLDERS * 2;

    const membership = `dd500000-${String(acteur).padStart(4, '0')}-4000-8000-000000000001`;
    const user = `dd1${String(acteur).padStart(5, '0')}-0000-4000-8000-000000000001`;

    // `set local role` + claims : la fonction voit un vrai `auth.uid()`, comme
    // en production. Un appel en `postgres` prouverait la sérialisation mais
    // sauterait la garde « on n'annule que pour soi ».
    const sql = `
      select pg_sleep(greatest(0, extract(epoch from (timestamptz '${startAt}' - clock_timestamp()))));
      begin;
      set local role authenticated;
      set local request.jwt.claims = '{"sub":"${user}","role":"authenticated","email":"charge${acteur}@example.test"}';
      ${
        annule
          ? `select public.cancel_booking(
               (select b.id from public.bookings b where b.idempotency_key = 'hold-${acteur}')
             );`
          : `select public.book_class('${CLASS}', '${membership}', 'charge-${i}');`
      }
      commit;
    `;

    const child = psql(sql, { async: true, appName: STAMPEDE_APP });
    return new Promise((resolve) => {
      let out = '';
      let err = '';
      child.stdout.on('data', (c) => (out += c));
      child.stderr.on('data', (c) => (err += c));
      child.on('close', (code) => resolve({ i, code, out: out.trim(), err: err.trim() }));
    });
  });

  const results = await Promise.all(sessions);
  return { results, peak: await peak };
}

// ---------------------------------------------------------------------------
// Le verdict
// ---------------------------------------------------------------------------

/**
 * L'invariant de `cancel` : **`booked_count = count(bookings CONFIRMED)`**.
 *
 * Ce n'est pas « exactement une confirmée » — le nombre juste dépend de
 * l'entrelacement, et prétendre le connaître d'avance serait tester
 * l'ordonnanceur au lieu de la fonction. Ce qui doit tenir quel que soit
 * l'ordre, c'est l'égalité entre le compteur et la réalité.
 *
 * Un décrément perdu fait dériver le compteur **vers le haut** : le cours reste
 * complet alors qu'il a des places, personne ne peut plus réserver, et rien ne
 * le signale. C'est la panne la plus coûteuse de cette famille, parce qu'elle
 * est silencieuse et qu'elle dure.
 */
function verdictCancel(results, peak) {
  const counter = Number(psql(`select booked_count from public.classes where id = '${CLASS}'`));
  const confirmed = Number(
    psql(`select count(*) from public.bookings
          where class_id = '${CLASS}' and status = 'CONFIRMED'`),
  );
  const capacity = Number(psql(`select capacity from public.classes where id = '${CLASS}'`));
  const cancelled = Number(
    psql(`select count(*) from public.bookings
          where class_id = '${CLASS}' and status = 'CANCELLED'`),
  );

  // Les trois tiers, comme les sessions les ont produits : détenteurs, jumeaux,
  // réservants. Compter les jumeaux parmi les réservants ferait dire au verdict
  // autre chose que ce qui s'est passé.
  const annulations = results.filter((r) => r.i <= HOLDERS * 2);
  const reservations = results.filter((r) => r.i > HOLDERS * 2);
  const annulationsRatees = annulations.filter((r) => r.code !== 0);
  const refusHorsMetier = reservations.filter(
    (r) => r.code !== 0 && !/CLASS_FULL|complet/i.test(r.err),
  );

  const checks = [
    // **L'invariant.** Tout le reste n'est que contexte.
    [
      'booked_count = nombre de réservations confirmées',
      counter === confirmed,
      `${counter} vs ${confirmed}`,
    ],
    [
      'le compteur reste dans ses bornes',
      counter >= 0 && counter <= capacity,
      `${counter} / ${capacity}`,
    ],
    // Les jumeaux comptent : une annulation rejouée depuis un second onglet doit
    // **réussir sans rien faire**, pas échouer. Un refus serait tout aussi faux
    // qu'un double décrément — la personne a annulé, une fois.
    [
      `les ${annulations.length} annulations réussissent (dont ${HOLDERS} jumelles)`,
      annulationsRatees.length === 0,
      `${annulations.length - annulationsRatees.length} / ${annulations.length}`,
    ],
    ['toutes les places tenues ont été rendues', cancelled >= HOLDERS, `${cancelled} annulée(s)`],
    // Sans ce contrôle, une session qui n'a jamais atteint la fonction — plus de
    // connexion, par exemple — passerait pour un refus métier, et l'invariant
    // paraîtrait tenu sans que la contention ait eu lieu.
    [
      'les refus de réservation sont tous « cours complet »',
      refusHorsMetier.length === 0,
      `${refusHorsMetier.length} refus d'une autre nature`,
    ],
    ['contention réelle sur le compteur', peak >= 2, `${peak} sessions en même temps`],
  ];

  log('');
  for (const [label, ok, detail] of checks) {
    log(`  ${ok ? '✓' : '✗'} ${label.padEnd(52)} ${detail}`);
  }

  if (refusHorsMetier.length > 0) {
    log('\nRefus d’une autre nature (extrait) :');
    for (const r of refusHorsMetier.slice(0, 3)) log(`    #${r.i} — ${r.err.split('\n')[0]}`);
  }
  if (annulationsRatees.length > 0) {
    log('\nAnnulations en échec (extrait) :');
    for (const r of annulationsRatees.slice(0, 3)) log(`    #${r.i} — ${r.err.split('\n')[0]}`);
  }

  return checks.every(([, ok]) => ok);
}

function verdict(results, peak) {
  if (SCENARIO === 'cancel') return verdictCancel(results, peak);

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
    // Mesuré par `startPeakSampler()`, pas déduit de la taille de la vague : ce
    // qu'on a lancé n'est pas ce qui s'est croisé.
    [
      'contention réelle sur la place',
      peak >= 2,
      `${peak} sessions dans la fonction au même instant`,
    ],
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

const TITRE =
  SCENARIO === 'cancel'
    ? `P1-004 — ${HOLDERS} annulations et ${N - HOLDERS} réservations, au même instant`
    : `P1-003 · T1 — ${N} tentatives de réservation sur une place`;

log(`\n${TITRE}\n`);

let ok = false;
try {
  setUp();

  // Le plafond se mesure **après** le décor : les insertions ont pu laisser des
  // connexions ouvertes, et un chiffre pris trop tôt serait optimiste.
  // Une connexion de moins : l'échantillonneur en occupe une pendant toute la
  // ruée, et une session qui n'obtient pas de connexion ne prouve rien.
  const headroom = connectionHeadroom();
  const wave = Math.min(N, Math.max(1, headroom - 1));

  log(
    wave < N
      ? `Plafond de connexions : ${headroom}. La ruée se fait par vagues de ${wave} — ` +
          `la contention retenue est la plus forte des vagues.`
      : `Plafond de connexions : ${headroom}. Les ${N} sessions tiennent en une seule ruée.`,
  );

  const started = Date.now();
  const results = [];
  let peak = 0;
  for (let first = 1; first <= N; first += wave) {
    const count = Math.min(wave, N - first + 1);
    log(`Vague ${Math.ceil(first / wave)} :`);
    const round = await stampede(first, count);
    results.push(...round.results);
    peak = Math.max(peak, round.peak);
    log(`  contention observée : ${round.peak} / ${count} sessions`);
  }
  log(`Terminé en ${((Date.now() - started) / 1000).toFixed(1)} s`);

  ok = verdict(results, peak);
} finally {
  tearDown();
}

const VERDICT =
  SCENARIO === 'cancel'
    ? 'le compteur dit la vérité — aucun décrément perdu'
    : 'aucune double réservation';

log(ok ? `\nPASS — ${VERDICT}.\n` : `\nFAIL — ${TITRE}.\n`);
process.exit(ok ? 0 : 1);
