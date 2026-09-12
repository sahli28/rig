#!/usr/bin/env node
/**
 * L'hébergé porte-t-il les gabarits d'e-mail du dépôt ? (`D-029`)
 *
 * ## Pourquoi ce contrôle existe
 *
 * Trois dérives dashboard ↔ dépôt en dix jours, même cause : les gabarits
 * vivent deux fois — `supabase/templates/*.html` + objets dans `config.toml`
 * côté dépôt, une recopie **manuelle** dans le dashboard côté hébergé — et le
 * runbook disait « recopier à la main » sans que rien ne le vérifie. La
 * troisième s'est payée le 12 septembre 2026 : première connexion propriétaire
 * cassée jusqu'à la recopie. Même filet que `heberge-derive.mjs` (P1-023) :
 * regarder le **résultat** — ce que l'hébergé sert — au lieu de l'intention.
 *
 * ## Ce qu'il couvre, et ce qu'il ne couvre pas
 *
 * Les gabarits que le dépôt définit — `confirmation` et `magic_link`, corps
 * **et** objet — comparés à la config Auth du projet hébergé, en lecture seule
 * (API de gestion Supabase, `GET /v1/projects/{ref}/config/auth`). La longueur
 * d'OTP, la Site URL et le reste de la config restent sur la checklist de
 * `deploiement-heberge.md` : un vert ici ne dit rien d'eux. Et il ne POUSSE
 * jamais rien — `supabase config push` écraserait la config entière (dont
 * `site_url = localhost`), c'est précisément le geste que ce script n'est pas.
 *
 * ## Prérequis, et pourquoi un jeton
 *
 * - `supabase link` fait (le ref est lu dans `supabase/.temp/project-ref`) ;
 * - **`SUPABASE_ACCESS_TOKEN`** : un jeton d'accès personnel
 *   (dashboard → Account → Access Tokens), passé en variable d'environnement
 *   au moment du geste — jamais écrit dans un fichier du dépôt. Le jeton du
 *   `supabase login` vit dans le trousseau Windows, qu'un script n'a pas à
 *   fouiller. Sans jeton : ILLISIBLE, jamais un verdict.
 * - `SUPABASE_API_URL` (défaut `https://api.supabase.com`) n'existe que pour
 *   prouver les issues contre un simulateur local — même variable que le CLI.
 *
 * ## Les issues (règle 10 : nommées, jamais une impression)
 *
 * - **exit 0** — À JOUR : N champs comparés, l'hébergé sert exactement les
 *   gabarits du dépôt.
 * - **exit 1** — DÉRIVE : chaque champ en cause, avec où recopier.
 * - **exit 2** — ILLISIBLE : jeton absent, API injoignable, ou le dépôt ne se
 *   lit plus comme attendu (le contrôle ne voit pas ce qu'il contrôle).
 *   **Ne rien conclure d'un exit 2** — surtout pas un vert.
 */

import { readFileSync } from 'node:fs';

function illisible(raison) {
  console.error('GABARITS : ILLISIBLE — ne rien conclure (surtout pas un vert).');
  console.error(`  ${raison}`);
  console.error(
    '  Jeton : dashboard Supabase → Account → Access Tokens, puis SUPABASE_ACCESS_TOKEN=sbp_… pnpm gabarits:derive',
  );
  process.exit(2);
}

/** CRLF → LF et bords rognés : la recopie à la main ne doit dériver que sur le contenu. */
function normalise(texte) {
  return (texte ?? '').replace(/\r\n/g, '\n').trim();
}

/**
 * Lecture minimale de `config.toml` : les deux sections de gabarit, rien
 * d'autre. Pas de dépendance TOML pour quatre lignes — mais un échec bruyant
 * si la forme attendue n'y est plus (l'auto-recoupement de D-014 : un contrôle
 * qui ne voit plus ce que le dépôt définit ne rend jamais « à jour »).
 */
function gabaritsDuDepot() {
  const toml = readFileSync('supabase/config.toml', 'utf8');
  const gabarits = {};

  for (const nom of ['confirmation', 'magic_link']) {
    const section = new RegExp(
      `\\[auth\\.email\\.template\\.${nom}\\]\\s*\\n((?:[^\\[]|\\[(?!\\[))*?)(?=\\n\\[|$)`,
    ).exec(toml);
    if (section === null)
      illisible(`section [auth.email.template.${nom}] introuvable dans config.toml.`);

    const subject = /(?<=^subject = ")(.*)(?="\s*$)/m.exec(section[1]);
    const contentPath = /(?<=^content_path = ")(.*)(?="\s*$)/m.exec(section[1]);
    if (subject === null || contentPath === null) {
      illisible(`subject ou content_path manquant sous [auth.email.template.${nom}].`);
    }

    let corps;
    try {
      corps = readFileSync(contentPath[0].replace(/^\.\//, ''), 'utf8');
    } catch (e) {
      illisible(`gabarit ${contentPath[0]} illisible (${e.message}).`);
    }
    gabarits[nom] = { objet: subject[0], corps };
  }
  return gabarits;
}

const depot = gabaritsDuDepot();

const jeton = process.env.SUPABASE_ACCESS_TOKEN;
if (!jeton) illisible('SUPABASE_ACCESS_TOKEN absent — le trousseau du CLI ne se lit pas d’ici.');

let ref;
try {
  ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  if (!/^[a-z]{20}$/.test(ref)) throw new Error(`ref inattendu « ${ref} »`);
} catch (e) {
  illisible(`projet non lié — supabase/.temp/project-ref illisible (${e.message}).`);
}

const base = process.env.SUPABASE_API_URL ?? 'https://api.supabase.com';
let config;
try {
  const reponse = await fetch(`${base}/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${jeton}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  config = await reponse.json();
} catch (e) {
  illisible(`l'API de gestion n'a pas répondu proprement (${e.message}).`);
}

/** Champ API ↔ champ du dépôt. La casse des clés vient de la spec de l'API de gestion. */
const CHAMPS = [
  ['confirmation — objet', 'mailer_subjects_confirmation', depot.confirmation.objet],
  ['confirmation — corps', 'mailer_templates_confirmation_content', depot.confirmation.corps],
  ['magic_link — objet', 'mailer_subjects_magic_link', depot.magic_link.objet],
  ['magic_link — corps', 'mailer_templates_magic_link_content', depot.magic_link.corps],
];

// Un champ absent de la réponse n'est pas une égalité vide : si l'API ne rend
// aucun des quatre, elle a changé de forme et on ne compare plus rien.
if (CHAMPS.every(([, cle]) => config[cle] === undefined || config[cle] === null)) {
  illisible(
    'la réponse de l’API ne porte aucun des champs de gabarit attendus — sa forme a changé.',
  );
}

const derives = [];
for (const [nom, cle, attendu] of CHAMPS) {
  const heberge = normalise(config[cle]);
  const local = normalise(attendu);
  if (heberge !== local) {
    derives.push({
      nom,
      detail:
        heberge === ''
          ? 'l’hébergé sert le gabarit PAR DÉFAUT de Supabase (champ vide) — le code à 6 chiffres n’y est pas'
          : `contenus différents (dépôt ${local.length} car., hébergé ${heberge.length} car.)`,
    });
  }
}

if (derives.length === 0) {
  console.log(
    `GABARITS : À JOUR — ${CHAMPS.length} champs (confirmation + magic_link, corps et objet), l'hébergé sert exactement ceux du dépôt.`,
  );
  console.log(
    '  (Ne couvre que ces gabarits : OTP à 6, Site URL et le reste restent sur la checklist de deploiement-heberge.md.)',
  );
  process.exit(0);
}

console.error('GABARITS : DÉRIVE');
for (const { nom, detail } of derives) {
  console.error(`  - ${nom} : ${detail}`);
}
console.error(
  '  Correctif : dashboard Supabase → Authentication → Emails, recopier depuis supabase/templates/*.html et les subject de config.toml — puis relancer ce contrôle.',
);
process.exit(1);
