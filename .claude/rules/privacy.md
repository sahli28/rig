---
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.sql'
---

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
- Tout consentement est écrit dans `consents` avec sa version de politique et son horodatage.
  Un consentement se retire aussi simplement qu'il se donne.
- Une suppression de compte anonymise réellement à J+30 et conserve les écritures
  comptables sous forme anonymisée (obligation de conservation 10 ans).
- Scrubbing PII activé dans Sentry ; vérifier avant chaque release que rien de nominatif
  ne remonte.
