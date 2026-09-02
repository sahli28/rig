---
paths:
  - 'supabase/**'
  - '**/api/**/*.ts'
  - 'packages/core/src/**/*.ts'
  - '**/*user*.ts'
  - '**/*member*.ts'
  - '**/*consent*.ts'
  - '**/*profile*.tsx'
---

<!--
Ce fichier matchait auparavant `**/*.ts`, `**/*.tsx` et `**/*.sql`, c'est-à-dire
tout le dépôt : il était chargé en permanence, et le path-scoping ne servait à
rien. Il cible désormais les chemins qui manipulent réellement des données
personnelles. L'essentiel non négociable — aucune donnée de santé dans un log,
une trace ou un payload — reste dans `CLAUDE.md` (règle 11), donc chargé à
chaque session.
-->

# Règles données personnelles (RGPD)

- **Jamais de donnée de santé dans un log, une trace Sentry, un événement analytics
  ou un payload partagé avec une box partenaire.** Cela couvre : blessure, restriction
  médicale, certificat, note de coach à contenu médical.
- Les notes de coach et le champ santé sont chiffrés au niveau colonne (`pgcrypto`)
  et lisibles uniquement par les coachs de la box concernée.
- Aucune donnée carte bancaire ne transite par le code : uniquement Stripe Payment Sheet
  (mobile) et Stripe Elements (web). Stocker au plus : `stripe_customer_id`,
  `payment_method_id`, marque, 4 derniers chiffres, expiration.
- Le partage inter-box est limité à : prénom, initiale du nom, box d'origine,
  photo si consentie. Toute autre colonne dans un payload cross-box est un bug.
- **La minimisation vaut aussi à l'intérieur d'une box.** Les membres d'une même
  box ne s'exposent pas mutuellement `public.users` : un coach a besoin d'un
  prénom et d'une initiale pour sa feuille de présence, pas de l'adresse e-mail,
  de la date de naissance ni du sexe de chaque adhérent. Les pairs passent donc
  par une **vue restreinte**, jamais par un accès direct à la table.
  C'est pour cette raison que la policy de `users` est `id = auth.uid()` et le
  restera : le `Class Roster` (P1-003, P1-008) et `Members List` (P1-001)
  devront construire cette vue, pas élargir la policy.
- **`member_admin_directory` (D-001) est l'annuaire *administratif*, pas la vue
  des pairs.** Réservée à `OWNER` et `MANAGER`, e-mail compris : la box est
  responsable de traitement de ses membres. Un `COACH` n'y a pas accès, un
  `MEMBER` non plus. La vue des pairs reste à construire en P1-003, et sa forme
  juste est « les gens que je croise » — les inscrits d'un cours — pas
  l'annuaire complet de la box. L'app ne montre pas ce que la salle montre :
  elle transforme « les gens que je croise le mardi » en une liste consultable
  de chez soi de qui s'entraîne quand. Ce n'est pas le même objet, et un
  contrôle par la personne concernée est justifié.
- **Le journal d'audit et la comptabilité ne sont pas publics dans leur box.**
  `audit_logs` est réservé à `OWNER`, `ledger_entries` à `OWNER` et `MANAGER`
  (spec §5.2). Les `diff jsonb` du journal portent les changements de rôle et
  les exclusions ; la somme des écritures est le chiffre d'affaires.
- **Un jeton d'invitation ne se réaffiche pas, il se régénère** (D-005). La base
  n'en garde que l'empreinte SHA-256 ; le clair n'existe qu'une fois, dans le
  retour de `create_invitation()`. Vaut aussi pour le QR mural d'affiliation :
  réimprimer une affiche, c'est émettre un nouveau QR et jeter les anciennes.
  Un dump livrerait sinon la possibilité de rejoindre n'importe quelle box à
  distance — ce que l'affiche physique, elle, n'autorise pas.
- **Un fichier importé ne quitte jamais le navigateur.** Le CSV d'effectif est
  décodé, analysé et mappé côté client ; seules les lignes retenues, **et les
  colonnes qu'on importe**, partent au serveur. Un export de logiciel de gestion
  porte des numéros de licence, des dates de naissance, des montants : rien de
  tout cela n'a de destination ici.
  Conséquence à ne pas défaire : le fichier n'est **jamais** stocké, journalisé,
  ni déposé dans un répertoire temporaire. Le jour où quelqu'un proposera « de
  téléverser le fichier dans Storage pour pouvoir rejouer un import », c'est
  cette propriété qu'il annulera.
- **Le journal d'un import porte des nombres, pas des adresses** — et une seule
  entrée pour tout le lot. `audit_logs` est append-only : ce qui y entre par
  erreur n'en sort plus.
- Tout consentement est écrit dans `consents` avec sa version de politique et son horodatage.
  Un consentement se retire aussi simplement qu'il se donne.
- Une suppression de compte anonymise réellement à J+30 et conserve les écritures
  comptables sous forme anonymisée (obligation de conservation 10 ans).
- Scrubbing PII activé dans Sentry ; vérifier avant chaque release que rien de nominatif
  ne remonte.
