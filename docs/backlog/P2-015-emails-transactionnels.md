# P2-015 — Les e-mails transactionnels, et le canal qui n'existe pas

**Phase** P2 · **Estimation** 4 j·h · **Dépend de** P0-003 · **Spec** §2.2 (M19), §4-P4, §8

## Pourquoi ce ticket a été écrit après coup

**Aucun ticket du backlog n'envoie un e-mail.** Ce n'était écrit nulle part, et
trois tickets s'appuient pourtant dessus :

- **M19** exige « i18n FR/EN complet (UI + **e-mails** + push) ». Aujourd'hui,
  `supabase/config.toml:260` porte `subject = "Ton code RIG / Your RIG code"` —
  les deux langues dans la même chaîne. C'est un contournement de P0-005a, pas
  de l'internationalisation, et il ne passe pas à l'échelle d'une facture.
- **P1-007** écrit dans son périmètre : « les notifications transactionnelles
  restent en **e-mail** même push désactivé ». Il suppose un canal que personne
  ne construit.
- **P2-006** doit envoyer une facture (§4-P4, étape 4) et **P2-008** doit
  relancer un impayé. Une relance de paiement par push seul n'est pas une
  relance : le membre qui ne paie plus a souvent désinstallé l'app.

C'est le cas type de la règle 8 de `CLAUDE.md` — un prérequis invisible, partagé
par trois tickets, que chacun croyait déjà là.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Catalogue i18n et sa vérification | `packages/core`, `pnpm i18n:check` | ✅ existe (331 clés) — **mais il ne couvre pas les gabarits d'e-mail**, à étendre ici |
| Locale de la personne | `users.locale` (P0-005a), `tenants.default_locale` (P1-001b) | ✅ existent — la règle de repli est à écrire : personne, puis box, puis `fr` |
| Thème du tenant (marque dans l'e-mail) | `themes` + `buildTheme()` (P0-002, P1-001e) | ✅ existe — un e-mail de box porte **ses** couleurs, comme la page d'invitation |
| **Un domaine à nous, avec SPF, DKIM et DMARC** | — | ❌ **n'existe pas.** Prérequis administratif : sans authentification de domaine, tout part en spam. D-008 attend déjà un domaine ; c'est le **second** ticket bloqué par la même absence |
| Compte Resend (ou équivalent) | §8 le recommande, §17.3 le budgète à 20 $/mois | ❌ à ouvrir |
| Un moyen de lire les e-mails en local | Mailpit, port **55324** (`docs/REPRISE.md` §5) | ✅ existe |
| Gabarits d'auth Supabase | `supabase/templates/*.html` | ⚠️ existent, **bilingues dans une seule chaîne**. À refaire proprement ici |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `sendEmail(template, locale, data)` | invitation, facture, relance, expiration de crédits | **P1-001c** (rétroactif), P2-006, P2-007, P2-008 |
| Gabarits FR/EN thémés | idem | idem |
| Journal des envois | le support, quand quelqu'un dit « je n'ai rien reçu » | celui-ci |

**Le premier appelant réel est P2-006.** Si ce ticket est fait avant, il livre
une fonction sans appelant — règle 7. Il est donc écrit pour être fait **juste
avant** P2-006, et le README l'ordonne ainsi.

## Périmètre

- Une couche d'envoi unique, côté serveur. Pas de client d'e-mail dans
  `apps/mobile` ni dans un composant.
- Gabarits, en FR et EN, dans le même commit :
  - invitation nominative (aujourd'hui, P1-001c n'envoie **rien** — le jeton se
    transmet à la main, tenable au pilote, pas au-delà) ;
  - confirmation de paiement, avec le lien vers la facture Stripe hébergée ;
  - échec de prélèvement, avec le lien de mise à jour du moyen de paiement ;
  - crédits qui expirent, à J-14 et J-3 (RM4.3) ;
  - suppression de compte demandée, et confirmée (P2-002).
- Résolution de la langue : locale de la personne, sinon `default_locale` de la
  box, sinon `fr`. Une seule fonction, testée.
- Marque de la box dans les e-mails de box ; marque **RIG** dans les e-mails de
  plateforme. C'est la même distinction que `DEFAULT_BRAND` contre le défaut
  d'une box neuve, tranchée en P1-001e — la refaire ici serait la refaire à
  l'envers.
- Table `email_deliveries` : à qui, quel gabarit, quand, quel statut, l'`id` du
  fournisseur. **Ni le corps ni les données personnelles au-delà de
  l'adresse** — un journal d'envois n'est pas une copie de la boîte mail.
- Reprise des gabarits d'auth Supabase, une langue par gabarit.

## Hors périmètre

- E-mails marketing, campagnes, listes de diffusion. Autre métier, autres
  obligations (consentement `MARKETING`, désinscription, CNIL).
- Facture PDF générée par nous : Stripe en héberge une, avec les mentions
  légales de la box (P2-006). En produire une seconde, c'est risquer qu'elles
  divergent.
- Le domaine et sa configuration DNS : **à faire, mais pas par du code.**

## Critères d'acceptation

- [ ] Un e-mail part en FR pour un membre en FR, en EN pour un membre en EN, et
      en `default_locale` de la box pour un membre sans préférence
- [ ] Un e-mail de box porte la couleur de la box ; un e-mail de plateforme porte
      celle de RIG
- [ ] `pnpm i18n:check` couvre les clés des gabarits et **échoue** si une
      traduction manque
- [ ] Aucun e-mail ne contient de jeton d'invitation en clair dans une URL
      journalisée (`.claude/rules/privacy.md`)
- [ ] `email_deliveries` ne contient **ni corps ni donnée de santé**
- [ ] Un échec d'envoi ne fait pas échouer la transaction métier : on encaisse
      même si l'e-mail de confirmation ne part pas
- [ ] Les envois sont visibles dans Mailpit en local, dans les deux langues

## Notes

**Le point qui décidera si les e-mails arrivent n'est pas dans le code.** SPF,
DKIM, DMARC et la réputation du domaine comptent plus que le gabarit. Prévoir un
envoi de test vers Gmail, Outlook et un webmail français avant de considérer le
ticket fait.

Et le dernier critère mérite d'être relu deux fois : un e-mail est un effet de
bord, jamais une condition de la transaction. Un `invoice.paid` traité qui
échoue à envoyer sa confirmation reste un `invoice.paid` traité.
