# `D-025` — L'émetteur est déclenchable sans authentification

**Phase** `dette` (non programmée, hors ①) · **Estimation** `0,5` j·h · **Dépend de** `P1-007` ✅ (l'émetteur), `P1-017` (l'émetteur déployé, `verify_jwt = false`) · **Spec** §12.3, ADR 0002 (garde-fou n°6 : deux couches) · **Trouvé** au déploiement hébergé de `P1-017`, le 11 septembre 2026

## Objectif

Le drain de l'émetteur ne se déclenche que pour un appelant qui **prouve qu'il
est le nôtre** — un en-tête secret partagé entre `pg_net` et la fonction. Un
inconnu qui apprend l'URL ne peut plus dépenser nos invocations de fonction.

## Pourquoi ce ticket existe, et pourquoi il n'est pas un blocage

`P1-017` a déployé `rack-push-emitter` en `verify_jwt = false` — **voulu** : le
réveil (`kick_push_emitter` → `net.http_post`) et le balayage `pg_cron` ne
portent aucun JWT, et la porte d'acceptation de `P1-007` l'exige (« `curl` sans
apikey rend 200 »). Vérifié le 11 septembre : `curl -i` sans en-tête d'auth rend
bien `200`.

**La conséquence, mesurée et bornée :** n'importe qui qui connaît l'URL peut
`POST` dessus et déclencher un drain. Ce que ça **ne** fait **pas** — et c'est ce
qui en fait une dette, pas une urgence :

- **Aucune fuite de donnée.** L'émetteur ne lit aucune entrée de l'appelant : il
  draine `push_outbox` (ce qui était **déjà** éligible et enfilé) et rend un
  décompte (`{claimed, sent, failed}`). Un déclenchement externe ne fait que ce
  que le balayage `pg_cron` fait déjà toutes les 30 s.
- **Aucun envoi de trop.** Il n'envoie que les lignes `pending` existantes ; une
  fois drainées, elles sont `sent`. Rappeler l'URL en boucle ne fabrique pas de
  notifications.

**Ce que ça fait :** chaque appel est une **invocation de fonction**. Sur un plan
gratuit ou d'entrée, elles sont comptées et plafonnées — une boucle (malveillante
ou un simple crawler) épuise le quota. C'est un risque de **disponibilité et de
coût**, pas de confidentialité. ADR 0002 (garde-fou n°6) veut deux couches ; ici
il n'y en a qu'une (l'obscurité de l'URL), la même situation que le `TRUNCATE` de
D-006 avant qu'on la ferme.

## La piste, et pourquoi c'est ici que Vault gagne sa place

Un **en-tête secret partagé**, `verify_jwt` restant `false` :

- `kick_push_emitter` ajoute un en-tête (`x-rack-emitter-token: <secret>`) à son
  `net.http_post` ;
- la fonction rejette (`401`) toute requête sans ce secret, **avant** de drainer.
  Le contrôle est dans **notre** code sur **notre** en-tête, pas la validation
  JWT de Supabase — donc `curl` sans le secret rend `401`, mais le contrat
  « joignable sans apikey Supabase » de `P1-007` est intact.

**Et c'est le premier vrai secret du dépôt côté base.** L'arbitrage de `P1-017`
(table de configuration plutôt que Vault) tenait parce que l'URL de l'émetteur
n'est **pas** un secret. Ce jeton, lui, en est un : il ne va **pas** dans
`app_runtime_config` (lisible en clair par qui a `bypassrls`), il va dans
**Vault** (`vault.create_secret` / `vault.decrypted_secrets`, vérifié disponible
sur l'hébergé le 11 septembre — `supabase_vault 0.3.1`). `kick_push_emitter` lit
le jeton dans Vault et la fonction le lit dans un secret d'edge runtime
(`supabase secrets set`). Vault a enfin quelque chose à garder.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 11 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `kick_push_emitter` (l'émetteur du header) | `20260911100800_push_emitter_url_config.sql` | ✅ existe — lit déjà l'URL dans `app_runtime_config` ; ajouterait la lecture du jeton (Vault) et l'en-tête |
| La fonction (le vérificateur du header) | `supabase/functions/rack-push-emitter/index.ts` | ✅ existe — ajouterait un contrôle `x-rack-emitter-token` en tête de handler, avant `claim` |
| Vault | hébergé : `supabase_vault 0.3.1` (vérifié) ; local : présent | ✅ disponible, **utilisé nulle part aujourd'hui** — ce serait sa première utilisation, et elle est justifiée (un vrai secret) |
| `supabase secrets set` pour l'edge runtime | plateforme | ⚠️ mécanisme connu ; la procédure `docs/procedures/` le documentera |
| L'arbitrage table-vs-Vault | `P1-017` (§ « l'URL de l'émetteur vient d'une table »), migration `20260911100800` | ✅ écrit — pose explicitement que le secret, lui, ira dans Vault |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| Le contrôle du jeton dans la fonction | `kick_push_emitter` (qui envoie le jeton) et le balayage `pg_cron` | celui-ci — **pas d'appelant manquant** (règle 7) : l'unique déclencheur légitime est `kick_push_emitter`, qui est mis à jour dans le même ticket |

## Hors périmètre

- **La limitation de débit** (rate limiting) proprement dite. C'est un autre
  levier, contre un attaquant qui aurait le jeton ; ici on ferme la porte à qui
  ne l'a pas. À ouvrir séparément si le besoin se mesure.
- **Tout autre usage de Vault.** Ce ticket y range **un** secret ; il n'y
  déménage pas l'URL (qui n'en est pas un) ni quoi que ce soit d'autre.

## Notes

Pas maintenant, pas dans `P1-017` : au pilote, l'URL n'est pas publiée et le
risque est théorique. Ce ticket existe pour que la deuxième couche soit une
décision écrite et datée, pas un oubli qu'on redécouvre le jour où l'URL fuite
dans un journal ou un dépôt.
