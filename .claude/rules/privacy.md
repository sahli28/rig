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
- Tout consentement est écrit dans `consents` avec sa version de politique et son horodatage.
  Un consentement se retire aussi simplement qu'il se donne.
- Une suppression de compte anonymise réellement à J+30 et conserve les écritures
  comptables sous forme anonymisée (obligation de conservation 10 ans).
- Scrubbing PII activé dans Sentry ; vérifier avant chaque release que rien de nominatif
  ne remonte.
