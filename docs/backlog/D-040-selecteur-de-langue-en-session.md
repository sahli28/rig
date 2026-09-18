# `D-040` — Un sélecteur de langue en session (back-office)

**Phase** `dette` · **Estimation** `0,5` j·h · **Dépend de** `D-004` (rangs de langue), `P2-022` · **Spec** §12, §19 · **Origine** test réel du back-office, 18 septembre 2026

## Objectif

Le staff bascule le back-office **FR ⇄ EN en session**, sans toucher aux réglages
de son navigateur ni à son profil — le choix l'emporte et se mémorise.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Résolution de langue actuelle | `apps/web/app/box/[slug]/box-i18n.tsx` + `layout.tsx` (rangs D-004 : **navigateur > `users.locale`**) | ⚠️ **la cause du problème** : aucun rang « choix explicite en session », et le `default_locale` de la box **ne pilote pas l'UI** — changer la langue de la box ne change rien à l'écran |
| `default_locale` de la box | `tenant_settings`, écrit par Réglages → Identité | ⚠️ ne sert **qu'aux e-mails d'invitation** (`membres/actions.ts:180`) — le libellé « langue par défaut » laisse croire qu'il pilote l'UI, à clarifier |
| Le stockage de préférence | `apps/web/lib/use-locale-storage.ts` (`useLocaleStorage`) + `I18nProvider` (`storage`) | ✅ existe — un choix écrit là devient le rang le plus fort |
| Les deux locales | `LOCALES`, `fr.json`/`en.json` (parité vérifiée) | ✅ existent |

## Périmètre

- Un contrôle **FR / EN** dans le back-office (en-tête de la coquille ou Réglages)
  qui écrit le choix dans `useLocaleStorage` (rang fort) et rebascule l'UI
  **immédiatement**, mémorisé par utilisateur.
- Clarifier le libellé du réglage box « langue par défaut » → il concerne les
  **membres / e-mails**, pas l'UI du staff.

## Hors périmètre

- Faire piloter l'UI par le `default_locale` de la box — **décision de design
  séparée** (rang box vs navigateur vs choix). Le sélecteur explicite est le
  geste sûr ; la question du rang se tranche à part.
- Un sélecteur côté membre mobile — à ouvrir si l'usage le demande.

## Critères d'acceptation

- [ ] Un bouton FR/EN bascule l'UI du back-office **sans recharger** ni toucher au
      navigateur ; le choix **survit au rechargement**
- [ ] Débloque la vérification du rendu **EN** de `P2-022`
- [ ] `/check` vert

## Notes

Trouvé en test le 18 sept. 2026 : la langue par défaut de la box passée en EN ne
changeait pas l'UI (elle suit navigateur > `users.locale`), et même le navigateur
en anglais ne suffisait pas. L'agent avait cru à tort que le back-office suivait
la langue de la box.
