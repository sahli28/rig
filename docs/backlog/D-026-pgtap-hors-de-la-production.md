# `D-026` — pgTAP ne devrait pas s'installer en production

**Phase** `dette` (non programmée, hors ①) · **Estimation** `0,5` j·h · **Dépend de** rien · **Spec** ADR 0002 (surface minimale) · **Trouvé** au déploiement hébergé de `P1-017`, le 11 septembre 2026

## Objectif

L'extension de **test** `pgtap` n'est présente que là où l'on teste (local, CI),
pas sur la base de production hébergée.

## Pourquoi ce ticket existe

`20260830143104_extensions_and_helpers.sql:17` fait
`create extension if not exists pgtap with schema extensions;`. Comme toutes les
migrations s'appliquent partout à l'identique, **pgTAP s'installe aussi sur
l'hébergé** — vérifié le 11 septembre (`select extname … 'pgtap'` rend `pgtap`).

Ce n'est pas une anomalie (c'est bien nos migrations qui l'installent), mais
c'est de l'**outillage de test en production** : de la surface qui n'a aucune
raison d'exister là où tournent les données de 80 membres. Rien ne l'exploite
aujourd'hui, d'où « dette » et non « bug ». La règle qu'il enfreint est celle de
la surface minimale (ADR 0002) : ce qui n'a pas de raison d'être en production
n'y est pas.

**À ne pas faire, et c'est la moitié de la valeur de ce ticket :** le retirer à
la main sur l'hébergé (`drop extension pgtap`). La prochaine `db push` ou toute
reconstruction le recréerait — on se battrait contre le dépôt. La correction est
dans le dépôt, pas sur la base.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 11 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| L'install de pgTAP | `20260830143104_extensions_and_helpers.sql:17` | ✅ existe — c'est ce qu'on déplace hors des migrations de schéma |
| Le lancement des tests pgTAP | `scripts/test-db.mjs`, `supabase test db` | ✅ — ils **supposent** pgTAP présent ; c'est le point à traiter (qui l'installe si plus la migration ?) |
| La reconstruction CI | `supabase db reset` en CI | ✅ — la solution doit garder pgTAP disponible en CI **et** en local, sans le mettre en prod |

## Piste (à valider à l'ouverture)

Sortir `create extension pgtap` des migrations **versionnées** (qui partent en
prod) vers une étape **de test uniquement** : un fichier SQL joué par le harnais
avant `pg_prove` (local et CI), ou le mécanisme d'amorçage de test de la CLI. Le
schéma de production cesse alors de porter pgTAP, sans que les tests perdent quoi
que ce soit.

Deux choses à vérifier avant de trancher, parce qu'elles peuvent renverser la
piste :

- **Le hook `guard-migrations` et la règle 13** : `20260830143104` est une
  migration versionnée déjà appliquée en production (l'hébergé). La retirer de ce
  fichier, c'est éditer une migration immuable — donc, base de prod existante,
  **une migration ajoutée** qui fait `drop extension pgtap` sur l'hébergé, pas une
  édition en place. Mais `drop extension` sur une base où pgTAP n'a rien créé est
  sûr ; à confirmer.
- **CI** : `supabase db reset` en CI doit continuer d'avoir pgTAP. Si l'install
  quitte les migrations, la CI doit l'installer autrement **avant** `test:db`,
  sinon elle rougit partout. À faire dans le même lot, pas après.

## Hors périmètre

- **Les autres extensions** (`pg_cron`, `pg_net`, `supabase_vault`, `pgcrypto`,
  …) : elles, le produit les utilise en production. Seul pgTAP est de l'outillage
  de test. Ne pas élargir ce ticket à un audit d'extensions.

## Notes

Trouvé parce que `P1-017` a d'abord cru pgTAP-sur-l'hébergé anormal, avant de
retrouver la ligne qui l'installe. La leçon est notée dans `P1-017` : une
présence qu'on ne s'explique pas, on en cherche la source dans le dépôt avant de
la « corriger » sur la base — sinon on normalise une anomalie ou on se bat contre
une migration.
