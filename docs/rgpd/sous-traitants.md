# Liste des sous-traitants ultérieurs

**Spec §15.1 (point 3) et §1714.** L'éditeur du service, sous-traitant de la box au sens
de l'art. 28 RGPD, tient la **liste de ses sous-traitants ultérieurs**, avec leur
localisation, et s'engage à **notifier la box avant tout ajout**. Ce fichier est cette
liste.

> **État de complétude — à lire avant de s'y fier.** Les localisations ci-dessous sont
> établies d'après les **pages « data processing » / sécurité publiées** par chaque
> prestataire (sources citées). **La référence contractuelle — le DPA de chaque
> prestataire — reste à télécharger et archiver**, et c'est cet archivage qui rend la
> liste **produisible à une box**. En l'état, elle est **opérationnelle en interne, pas
> encore contractuellement complète.** Ne pas la remettre à une box sans les DPA archivés.

> **Ce que ce fichier est, et ce qu'il n'est pas.** C'est la *liste des sous-traitants*
> (art. 28 §2, spec §1714). Le **registre des traitements** complet (art. 30), le **DPA**
> signé avec la box, et la **politique de confidentialité** des membres sont les trois
> autres pièces RGPD de `P1-016` — plus larges que ce volet e-mail (politique : `D-023` /
> `current_policy_version()`). Ce fichier a été **amorcé par le volet domaine/SMTP de
> `P1-016`**, qui y ajoute Brevo.

## Sous-traitants en place

| Sous-traitant | Traitement | Données | Localisation | Transfert / réf. |
| --- | --- | --- | --- | --- |
| **Brevo** (Brevo SAS) | E-mail : magic link, invitations | e-mail, prénom, contenu du message | **UE** : société française (CNIL) ; traitement et stockage en France/Allemagne (OVH), sauvegardes Google Cloud Belgique | dans l'UE, **pas de CST** ; **DPA Brevo à archiver** |
| **Supabase** | Base de données + Auth | l'essentiel des données membres | **UE** : projet `eu-west-3` (Paris) — vérifié (`deploiement-heberge.md`, ADR 0001) | dans l'UE ; **DPA Supabase à archiver** |
| **Vercel** (Vercel Inc.) | Hébergement back-office web (Next.js SSR) | requêtes de session transitoires ; pas de stockage durable de données membres | **US** : plan de contrôle, comptes et support aux **US** ; les **fonctions sont forçables en région UE** (`cdg1`/`fra1`), cache éphémère | hors UE — **Data Privacy Framework / CST** ; **action** : forcer la région UE, voir `deploiement-heberge.md` ; **DPA Vercel à archiver** |
| **Expo** (650 Industries) | Build mobile + routage push (→ APNs/FCM) | jeton push ; **la charge de notification est supprimée après transfert**, aucune PII, aucune donnée de santé (`CLAUDE.md` règle 11) | **US** : conforme RGPD/DPF, ne connaît pas l'identité des membres | hors UE — **DPF / CST** ; **DPA Expo à archiver** |
| **Apple** (Apple Inc.) | Livraison push iOS (APNs) + distribution du build pilote (TestFlight) | jeton APNs, contenu de la notification | **US** | hors UE — **DPF / addendum data-processing Apple à archiver** |

## Sous-traitants prévus, pas encore actifs

Nommés pour mémoire — **pas** encore des sous-traitants (non utilisés au pilote) ; à faire
entrer ici, **avec notification préalable à la box**, le jour où ils traitent des données
réelles :

- **Stripe** (+ Connect) — paiement. Hors app au pilote (`P2-001`).
- **Sentry** — erreurs/perf, scrubbing PII. Non câblé (`.claude/rules/privacy.md`).
- **PostHog Cloud EU** — analytics produit (spec §8). Non câblé.

## Règle de tenue

- **Notifier la box avant d'ajouter** un sous-traitant (art. 28 §2) ; un ajout se
  matérialise ici, daté.
- Une localisation **hors UE** (Vercel, Expo, Apple) exige un mécanisme de transfert
  documenté (**Data Privacy Framework** ou **clauses contractuelles types**), archivé avec
  le DPA du prestataire.
- Le partage inter-box reste borné à prénom + initiale + box + photo consentie
  (`.claude/rules/privacy.md`) ; aucun sous-traitant ne reçoit plus que son traitement
  n'exige.
