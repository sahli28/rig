# P2-009 — Le modèle d'entraînement, et la porte qu'on laisse ouverte

**Phase** P2 · **Estimation** 6 j·h · **Dépend de** P0-004, **P1-002 (dur)** · **Spec** §7.2, §7.3, §4-P5 (RM5.1, RM5.7)

## Objectif

Poser en base tout ce que la programmation manipulera : `programs`,
`program_weeks`, `sessions`, `blocks`, `movements`, `block_movements`,
`variants` — avec leurs policies, leurs tests, et le référentiel de mouvements
semé en FR et EN.

Aucun écran. C'est un ticket de socle, comme P0-004, et il s'assume comme tel :
la seule chose qu'on ne peut pas rétro-installer sans douleur, c'est la forme des
données.

## `programs.tenant_id` est **nullable** dès la première migration

C'est la décision qui structure ce ticket, et elle ne coûte rien aujourd'hui.

Un programme appartient soit à une box (« Cycle Force Automne » chez CrossFit
Lyon 7), soit à **la plateforme** — un programme Rack, un programme vendu par un
coach en marketplace (S11), un programme suivi par quelqu'un qui n'est membre
d'aucune box. Ce dernier cas est le B2C, et il n'est pas au programme. Mais si
`tenant_id` est `not null` en 2026, l'ouvrir en 2028 veut dire migrer une table
qui porte alors des dizaines de milliers de séances et de scores, et réécrire
toutes ses policies. Le rendre nullable maintenant coûte une ligne et un test.

**Même motif hybride que `consents`**, seule table du schéma dans ce cas
aujourd'hui (`..._compliance_and_ledger.sql:16`). Le prédicat s'écrit pareil :

    using (tenant_id is null or tenant_id in (select public.current_tenant_ids()))

Un programme plateforme est **lisible par tous, écrivable par personne** hors
d'un rôle d'administration de plateforme : la policy d'écriture exige un
`tenant_id` non nul appartenant à l'appelant. C'est la différence avec
`consents`, où le `null` est écrit par l'utilisateur lui-même.

### Ce que ce ticket ajoute au test anti-fuite

`rls_leak_test.sql` vérifie la **présence** de `tenant_id`, pas sa nullabilité.
`consents` y passe donc sans exception déclarée — et c'est un angle mort : une
troisième table hybride s'ajouterait sans que personne ne s'en aperçoive, alors
que c'est exactement le genre de décision qui doit se relire.

Ce ticket ajoute une **huitième vérification** et sa liste d'exceptions :

    create temporary table tenant_id_nullable_exempt (table_name text primary key, reason text);
    insert into tenant_id_nullable_exempt values
      ('consents', 'consentement plateforme (CGU Rack) vs consentement de box'),
      ('programs', 'programme de plateforme ou de marketplace vs programme de box');

Le contrôle : toute table hors de cette liste a `tenant_id not null`. Une
quatrième table hybride devient alors un geste conscient, visible en revue —
c'est la seule chose que le test anti-fuite sait faire, et elle vaut son coût.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `current_tenant_ids()`, `current_admin_tenant_ids()` | `..._extensions_and_helpers.sql` | ✅ existe |
| `uuid_generate_v7()` | idem | ✅ existe |
| Le motif de table hybride | `consents`, `.claude/rules/database.md:46` | ✅ existe — on le recopie, on ne l'invente pas |
| `class_types` (rattacher une séance à un type de cours) | P1-001b | ✅ existe |
| **`classes`, pour rattacher une séance à une occurrence** | P1-002 | ❌ **prérequis dur — à créer par P1-002.** Tranché : `sessions.class_id` n'est **pas** nullable et sa FK est posée directement sur `classes`. P1-002 est au jalon pilote et P2-009 au MVP vendable : `classes` existera depuis des mois. Rien à trancher au plan |
| `memberships` avec rôle COACH | P0-004, P1-001c | ✅ existe |
| Rôle applicatif d'administration de plateforme | — | ❌ **n'existe pas.** Le produit n'a pas de super-admin. La policy d'écriture des programmes plateforme refuse donc **tout le monde** : ils se sèment en migration. À rouvrir avec la marketplace (S11) |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `programs`, `program_weeks`, `sessions`, `blocks`, `block_movements`, `variants` | le Program Builder | **P2-010** |
| `movements` (référentiel global, semé) | bibliothèque de mouvements, saisie de bloc | P2-010, P2-011, P2-013 |
| `publish_session()` (respecte `published_at`, RM5.2) | le bouton « publier », le planificateur | P2-010, P2-012 |
| `version_program()` (RM5.1) | l'édition d'un programme déjà publié | P2-010 |

**Aucune de ces fonctions n'a d'appelant dans ce ticket.** C'est assumé et c'est
écrit : ce ticket reste **en attente** tant que P2-010 n'existe pas, et le README
du backlog le dit. Règle 7 de `CLAUDE.md`, appliquée d'avance pour une fois.

## Périmètre

- `movements` — **global, sans `tenant_id`**, comme `users`. Exception à
  déclarer dans `tenant_id_exempt` de `rls_leak_test.sql`, avec sa raison.
  Colonnes : `slug` unique, `name_i18n`, `category`, `modality`
  (`WEIGHTLIFTING` | `GYMNASTICS` | `MONOSTRUCTURAL`), `default_load_rx_male_g`,
  `default_load_rx_female_g`, `scaling_hint_i18n`, `measured_by`
  (`TIME` | `LOAD` | `REPS` | `DISTANCE`).
- **Mouvements privés d'une box** (RM5.7) : surtout **pas** une seconde table
  hybride. Deux exceptions au lieu d'une, et le référentiel perdrait son sens de
  référentiel. Option retenue à défendre au plan : une colonne
  `owner_tenant_id` nullable **avec** la même vérification de nullabilité — ou,
  mieux, on attend qu'une box le demande. Aucune ne l'a demandé.
- Semis d'un référentiel de départ : **~80 mouvements** CrossFit courants, FR et
  EN, dans une migration. Pas 400 : ce qui n'est pas relu n'est pas fiable, et un
  référentiel faux est pire qu'un référentiel court.
- `programs` : `tenant_id` **nullable**, `type` (`CROSSFIT_CYCLE` | `CUSTOM` —
  `HYROX_PREP` **ajouté par le ticket P3 qui l'implémente**, par un `alter type … add value` d'une ligne — Hyrox reste en v1, mais une valeur d'enum sans code derrière ne vaut rien), `name_i18n`, `weeks`,
  `status`, `version`, `parent_program_id`, `created_by_membership_id`,
  `deleted_at`.
- `program_weeks`, `sessions`, `blocks`, `block_movements`, `variants` selon
  §7.3, tous en `tenant_id not null` — **seul `programs` est hybride.**
  `sessions.class_id` porte une FK **non nullable** vers `classes` : une séance
  qui n'est rattachée à aucun cours n'a ni date ni public, et le modèle ne doit
  pas permettre de l'écrire. FK **composite `(class_id, tenant_id)`** vers
  `classes (id, tenant_id)` — règle 4 de `.claude/rules/database.md`, sans quoi
  une séance de la box A référencerait un cours de la box B. Une
  séance appartient toujours à quelqu'un ; c'est le programme qui peut être
  universel. Voir le point à trancher ci-dessous.
- RLS forcée partout, policies lecture COACH+ / écriture COACH, tests pgTAP
  d'isolation dans un nouveau `training_model_test.sql`.

## Le point à trancher au plan : la séance d'un programme plateforme

Si `programs.tenant_id` peut être nul mais que `sessions.tenant_id` ne le peut
pas, un programme plateforme ne porte aucune séance — et la porte qu'on croyait
ouvrir est fermée un cran plus bas. Deux issues, à choisir explicitement :

1. **Propager la nullabilité** à `sessions`, `blocks`, `block_movements`,
   `variants` : cinq exceptions au lieu d'une, et un test anti-fuite qui perd
   l'essentiel de sa force.
2. **Un programme plateforme est un patron**, qu'une box *importe* : l'import
   crée un `programs` de la box (avec `parent_program_id`), et ses séances lui
   appartiennent. Une seule exception, la marketplace reste possible, et le
   modèle dit quelque chose de vrai — un programme acheté devient le vôtre.

**La seconde, sauf argument contraire au plan.** Plus simple à défendre en RLS,
et c'est déjà la sémantique commerciale de S11.

## Hors périmètre

- Tout écran (P2-010, P2-012).
- Scores, PR, leaderboard (P2-013, P2-014).
- Benchmarks (`benchmarks`, S3, P3) et Hyrox (`hyrox_stations`, v2) : deux
  référentiels globaux de plus, à ne surtout pas poser « pendant qu'on y est ».
- L'achat de programmes (S11, P3).

## Critères d'acceptation

- [ ] Le test anti-fuite passe, **avec sa huitième vérification** sur la
      nullabilité de `tenant_id` et ses deux exceptions déclarées
- [ ] Un COACH de la box A ne voit aucun programme de la box B
- [ ] Un programme `tenant_id is null` est **lisible** par un membre de
      n'importe quelle box, et **écrivable par personne**
- [ ] Un programme publié qu'on modifie crée une version ; l'ancienne reste
      lisible (RM5.1)
- [ ] Une séance dont `published_at` est future est invisible d'un MEMBER et
      visible d'un COACH (RM5.2)
- [ ] Le semis de mouvements est complet en FR **et** en EN — `pnpm i18n:check`
      ne regarde pas la base, c'est un test pgTAP qui le vérifie
- [ ] `pnpm db:reset && pnpm test:db` vert

## Notes

`rls-auditor` obligatoire. C'est la plus grosse migration depuis P0-004, et la
première depuis à toucher la forme du test anti-fuite lui-même.
