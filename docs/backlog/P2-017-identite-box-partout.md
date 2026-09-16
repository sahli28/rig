# `P2-017` — Identité de la box partout, zéro « Rack »

**Phase** `P2` · **Estimation** `2` j·h · **Dépend de** `P1-001e` (thème de la box) · **Spec** §11.2 (white-label N0), §6.1 · **Origine** demande commanditaire, 16 septembre 2026

## Objectif

Un membre n'aperçoit jamais le mot « Rack » ni une couleur qui n'est pas celle
de sa box — du splash à la carte de membre. L'app porte le nom, le logo et la
couleur de la box, partout où un membre regarde.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Thème par box (`logo_url`, `primary`, `on_primary`, `surface`, `radius`, `font`, `app_name`) résolu au démarrage | `useTheme()` (P1-001e) | ✅ existe — la galerie mobile le prouve, correction de contraste automatique comprise |
| Splash / écran de bienvenue aux couleurs de la box | parcours d'invitation (P1) | ⚠️ **à auditer** : le tenant est résolu avant l'auth (RM1.1), l'écran doit déjà être thémé |
| E-mails (invitation, magic link) | Brevo, gabarits hébergés (P1-017) | ⚠️ **à vérifier** : au N0, objet et corps portent au moins le nom de la box (l'expéditeur technique peut rester le domaine Rack — la box est le vendeur, pas Rack) |
| Nom / icône du binaire iOS/Android | `app.json` / build | ❌ **hors périmètre assumé** : une seule app, le binaire reste « Rack ». L'app dédiée par box est le N2 (§2.4), hors MVP. Ce ticket ne touche qu'à ce qui est *dans* l'app |

## Périmètre

- Audit écran par écran côté membre (invitation → accueil → réservation → carte
  → WOD → score) : aucune chaîne « Rack », aucune couleur en dur, nom et logo de
  la box présents au splash, à la carte membre, dans les en-têtes.
- Fermeture des fuites trouvées.
- Objet et corps des e-mails transactionnels portent le nom de la box.

## Hors périmètre

- Nom et icône du binaire par box (N2, app dédiée) — §2.4, hors MVP.
- La **direction visuelle** / « un autre thème » — c'est la première étape de
  `P2-021`, partagée avec `P2-022`. Ce ticket vérifie l'usage du thème existant,
  il n'en invente pas un nouveau.
- White-label N1 (domaine perso, e-mails 100 % marque box) — différé avec
  l'entité.

## Critères d'acceptation

- [ ] Un parcours membre complet ne montre jamais « Rack » ni une couleur hors
      thème
- [ ] Une recherche de couleurs en dur dans les composants membre revient vide
      (règle des tokens, §12.1)
- [~] Rendu visuel sur iPhone à confirmer à la passe `P2-021` (même chemin de
      preuve d'appareil)

## Notes

Ticket d'hygiène, pas de construction : le thème existe déjà (P1-001e), on
vérifie qu'il est *utilisé partout*.
