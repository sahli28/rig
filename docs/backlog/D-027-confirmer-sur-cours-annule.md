# `D-027` — Confirmer une offre sur un cours annulé ment au membre

**Phase** `dette` (non programmée, hors ①) · **Estimation** `0,5` j·h · **Dépend de** `P1-006` ✅ (`confirm_promotion`, `cancel_class_bookings`), `P1-004` ✅ · **Spec** §4-P2, §5.3 · **Trouvé** à la relecture de clôture de `P1-006`, le 12 septembre 2026

## Objectif

Quand la box annule un cours pendant qu'une offre de liste d'attente court, le
membre qui tape « Confirmer » doit lire **« Ce cours a été annulé »**, pas
**« Cette offre a expiré. La place est passée au suivant. »** — qui est faux (il
n'y a plus de cours, la place n'est passée à personne) et **génère un message au
support**.

## Le défaut, précisément

`cancel_class_bookings` passe toute entrée `WAITING`/`OFFERED` du cours à
`CLASS_CANCELLED` (`supabase/migrations/20260911101100_waitlist_functions.sql:580`).
Si le membre avait une offre en cours et tape « Confirmer » ensuite,
`confirm_promotion` relit l'état sous le verrou et tombe dans la **branche
générique** (même fichier, l. 304) :

```sql
if v_entry.status <> 'OFFERED' or v_entry.expires_at is null or v_entry.expires_at <= now() then
  perform public.app_error('OFFER_EXPIRED', 'Cette offre a expiré. La place est passée au suivant.', '23514');
end if;
```

`CLASS_CANCELLED` n'est pas `OFFERED` → `OFFER_EXPIRED`. Le membre reçoit un
message qui décrit un autre monde (l'offre cascadée au suivant), et **rien ne lui
dit que la box a annulé son cours**.

## Ce que la relecture a aussi trouvé, et qui décide le périmètre

**Le membre en offre ne reçoit aucune notification d'annulation.**
`cancel_class_bookings` n'enfile un `CLASS_CANCELLATION` que pour les **réservations
`CONFIRMED`** (la CTE `annulees`, l. 568-574). Or une entrée `OFFERED` **n'a pas
encore de `booking`** — le siège est tenu par `booked_count`, la réservation n'est
créée qu'à la confirmation. Le membre en offre n'est donc **pas** dans le lot
notifié : le message de `confirm_promotion` est aujourd'hui son **seul** signal.
C'est ce qui rend le message faux d'autant plus grave — et c'est à trancher à
l'ouverture : le bon message d'erreur suffit-il, ou faut-il **aussi** le prévenir
(enfiler un `CLASS_CANCELLATION` pour les `OFFERED` dans `cancel_class_bookings`) ?

## Ce que ce ticket suppose et qui doit exister

*Vérifié dans le dépôt, le 12 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `confirm_promotion(entry_id)` | `20260911101100_waitlist_functions.sql:270` | ✅ existe — la branche à corriger est l. 304 |
| Le statut `CLASS_CANCELLED` | posé par `cancel_class_bookings` (l. 580) | ✅ existe |
| Un code d'erreur applicatif + sa clé i18n | `APP_ERROR_CODES` (`packages/core`), `fr.json`/`en.json` | ⚠️ **à ajouter** : un code `CLASS_CANCELLED` et son libellé FR/EN — sinon `errors.test.ts` rougit (« tout code levé a sa clé i18n ») |
| L'écran de confirmation | mobile (offre push → confirmer) | ✅ existe — il réagit au **code**, pas au texte |

## Périmètre

- **Une branche avant la garde générique** dans `confirm_promotion` : entrée
  `CLASS_CANCELLED` → lever `CLASS_CANCELLED` (« Ce cours a été annulé. »), pas
  `OFFER_EXPIRED`. Règle 13 : la migration s'édite **en place** tant qu'aucune
  base de prod n'existe — `P1-017` a créé une base hébergée **sans données**,
  vérifier la constante `UNE_BASE_DE_PRODUCTION_EXISTE` (`pnpm migrations:immuables`
  avertit, le hook `guard-migrations.mjs` bloque l'Edit).
- **La sœur** : `leave_waitlist` traite déjà `CLASS_CANCELLED` comme terminal et
  idempotent (l. 351) — à **vérifier**, pas à supposer.
- **Un test pgTAP** dans `waitlist_test.sql` : offre en cours → la box annule →
  `confirm_promotion` rend `CLASS_CANCELLED`, pas `OFFER_EXPIRED`.
- i18n FR/EN du message, même commit.
- Selon l'arbitrage ci-dessus : peut-être l'enfilage d'un `CLASS_CANCELLATION`
  pour les `OFFERED` dans `cancel_class_bookings` (avec son test).

## Hors périmètre

- Le compte-rendu d'annulation côté box (`D-024`).
- Toute refonte du flux d'offre : ce ticket corrige un message et, au plus,
  ajoute une notification manquante — il ne touche pas la mécanique du siège tenu.

## Critères d'acceptation

- [ ] `confirm_promotion` sur une entrée `CLASS_CANCELLED` rend un code
      `CLASS_CANCELLED` (« Ce cours a été annulé. »), pas `OFFER_EXPIRED`
- [ ] pgTAP : le scénario offre-puis-annulation-du-cours est figé
- [ ] Le message est traduit FR/EN et l'écran réagit au **code**
- [ ] La décision sur la notification du membre en offre est **écrite** (faite, ou
      renvoyée avec sa raison)
- [ ] `rls-auditor` **SAFE** (la migration change), `pnpm test:db` vert

## Notes

Ne pas gonfler : le cœur est une branche `if` et un message. Le seul vrai choix
est la notification du membre en offre — et il se tranche à l'ouverture, l'écran
et `cancel_class_bookings` sous les yeux, pas en cours de route.
