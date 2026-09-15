import styles from './politique.module.css';

/**
 * Le texte français validé par la commanditaire le 15 septembre 2026.
 *
 * C'est un **modèle** : les champs entre crochets `[…]` sont complétés par la
 * box et l'éditeur avant l'import réel des membres, et le texte attend une
 * relecture juriste (prérequis daté de `P1-016`). Toute modification de fond
 * change la date : `POLICY_VERSION` dans `packages/core`, la migration qui
 * aligne `current_policy_version()`, et ce texte, dans le même commit — le
 * test le rappelle si l'un des trois reste en arrière.
 *
 * Le document vit en JSX plutôt qu'en Markdown : pas de dépendance de rendu,
 * et le même circuit de relecture que le reste du code.
 */
export function PolicyFr() {
  return (
    <>
      <p>
        Ce document décrit le traitement des données des membres via l&apos;application Rack. Il ne
        remplace ni les CGU, ni les CGV de la box, ni le contrat de sous-traitance (DPA) entre la
        box et l&apos;éditeur.
      </p>

      <h2>1. Qui traite vos données</h2>
      <p>Deux acteurs interviennent, avec des rôles distincts au sens du RGPD :</p>
      <ul>
        <li>
          <strong>La box — [Nom de la box], [forme juridique], [adresse], [SIREN]</strong> — est{' '}
          <strong>responsable de traitement</strong> de vos données de membre. C&apos;est elle qui
          décide pourquoi et comment vos données sont utilisées pour gérer votre pratique
          (réservations, présence, abonnement). Contact :{' '}
          <strong>[e-mail de contact de la box]</strong>.
        </li>
        <li>
          <strong>L&apos;éditeur — Rack, [forme juridique à venir], [adresse]</strong> — fournit
          l&apos;application à la box et agit comme <strong>sous-traitant</strong> : il traite les
          données <strong>sur instruction de la box</strong>, encadré par un contrat de
          sous-traitance (art. 28 RGPD). Rack n&apos;exploite pas vos données pour son propre
          compte.
        </li>
        <li>
          Vos <strong>records personnels</strong> (PR, historique de performance) et votre{' '}
          <strong>compte</strong> (une identité, un e-mail, réutilisable entre plusieurs box) sont,
          eux, gérés par <strong>Rack en tant que responsable</strong>, car ils vous suivent au-delà
          d&apos;une box.
        </li>
      </ul>
      <p>
        Un <strong>délégué à la protection des données (DPO)</strong>, s&apos;il est désigné, est
        joignable à : <strong>[e-mail DPO, ou « non désigné »]</strong>.
      </p>

      <h2>2. Quelles données, pour quoi faire, et sur quelle base</h2>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Données</th>
              <th>Pourquoi</th>
              <th>Base légale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Identité</strong> : prénom, nom, e-mail, téléphone (optionnel), date de
                naissance, sexe
              </td>
              <td>Créer votre compte, gérer votre adhésion, vous contacter</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>
                <strong>Réservations et présence</strong> : cours réservés, annulations, liste
                d&apos;attente, check-ins
              </td>
              <td>Faire fonctionner la réservation et le pointage</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>
                <strong>Performance</strong> : scores, records (PR), splits, temps
              </td>
              <td>Suivre votre progression, alimenter les classements</td>
              <td>
                Suivi coach : exécution du contrat · Classement public :{' '}
                <strong>consentement</strong> (révocable)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Santé</strong> : blessures, restrictions médicales, certificat, notes de
                coach à caractère médical
              </td>
              <td>Adapter les séances à vos contraintes physiques en toute sécurité</td>
              <td>
                <strong>Consentement explicite</strong> (donnée sensible, art. 9 RGPD)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Photos</strong> : avatar, photos d&apos;événement
              </td>
              <td>Personnaliser votre profil, la vie de la box</td>
              <td>
                <strong>Consentement</strong> (révocable)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Données techniques</strong> : logs, adresse IP, identifiant d&apos;appareil
              </td>
              <td>Sécurité, prévention des abus, bon fonctionnement</td>
              <td>Intérêt légitime</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className={styles.callout}>
        <p>
          <strong>Le champ « blessure / restriction » est une donnée de santé.</strong> Il
          n&apos;est renseigné qu&apos;avec votre consentement explicite, stocké chiffré, accessible
          aux seuls coachs de votre box, jamais transmis à une box partenaire, jamais utilisé pour
          des statistiques.
        </p>
      </div>
      <p>
        <strong>Paiement.</strong> L&apos;application{' '}
        <strong>ne collecte ni ne traite aucune donnée de paiement</strong> (numéro de carte,
        coordonnées bancaires). Le règlement de votre adhésion s&apos;effectue directement auprès de
        la box, en dehors de l&apos;application.
      </p>
      <p>
        Le sexe et la date de naissance sont <strong>facultatifs</strong> pour utiliser
        l&apos;application, mais nécessaires pour figurer dans un classement par catégorie — cela
        vous est indiqué au moment du choix.
      </p>

      <h2>3. Combien de temps vos données sont conservées</h2>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Durée de conservation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Identité, adhésion</td>
              <td>
                Durée du contrat, puis <strong>3 ans</strong> (prospection), puis suppression ou
                anonymisation
              </td>
            </tr>
            <tr>
              <td>Réservations et présence</td>
              <td>
                <strong>3 ans</strong>, puis anonymisation
              </td>
            </tr>
            <tr>
              <td>Performance (scores, PR)</td>
              <td>Durée de votre compte ; exportable et supprimable à tout moment</td>
            </tr>
            <tr>
              <td>Données de santé</td>
              <td>
                Durée du contrat ; supprimées à la fin de l&apos;adhésion ou au retrait du
                consentement
              </td>
            </tr>
            <tr>
              <td>Photos</td>
              <td>Jusqu&apos;à leur retrait</td>
            </tr>
            <tr>
              <td>Traces techniques</td>
              <td>
                <strong>6 mois</strong> (12 mois pour les logs de sécurité)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        À la suppression de votre compte, vos données personnelles sont{' '}
        <strong>anonymisées sous 30 jours</strong> ; seules les écritures comptables sont
        conservées, anonymisées, pour la durée légale.
      </p>

      <h2>4. Qui d&apos;autre voit vos données</h2>
      <p>
        <strong>Au sein de votre box :</strong> les responsables et gestionnaires (identité
        comprise, pour l&apos;administration), les coachs (pour les cours qu&apos;ils animent —
        prénom, nom, et vos éventuelles restrictions consenties). Les autres membres d&apos;un même
        cours ne voient que <strong>votre prénom et l&apos;initiale de votre nom</strong>, et
        uniquement si vous ne vous y êtes pas opposé.
      </p>
      <p>
        <strong>Prestataires techniques (sous-traitants ultérieurs de Rack)</strong>, chacun encadré
        contractuellement :
      </p>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Prestataire</th>
              <th>Rôle</th>
              <th>Localisation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Base de données, authentification</td>
              <td>
                <strong>Union européenne</strong> (Paris/Francfort)
              </td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Hébergement de l&apos;interface web</td>
              <td>États-Unis (exécution forçable en UE ; encadré par le Data Privacy Framework)</td>
            </tr>
            <tr>
              <td>Brevo</td>
              <td>E-mails (liens de connexion, invitations)</td>
              <td>Union européenne</td>
            </tr>
            <tr>
              <td>Expo</td>
              <td>Notifications push</td>
              <td>États-Unis (Data Privacy Framework)</td>
            </tr>
            <tr>
              <td>Sentry / PostHog</td>
              <td>Erreurs, mesure d&apos;usage (données anonymisées)</td>
              <td>UE / États-Unis selon configuration</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Vos données <strong>ne sont jamais vendues</strong>, ni utilisées à des fins publicitaires.
      </p>

      <h2>5. Transferts hors Union européenne</h2>
      <p>
        Certains prestataires ci-dessus sont établis aux États-Unis. Ces transferts sont encadrés
        par les mécanismes prévus par le RGPD (<strong>Data Privacy Framework</strong> et/ou clauses
        contractuelles types). Les données les plus sensibles (santé, notes de coach) sont hébergées
        et traitées <strong>en Union européenne</strong>.
      </p>

      <h2>6. Vos droits</h2>
      <p>Vous disposez, à tout moment, des droits suivants sur vos données :</p>
      <ul>
        <li>
          <strong>Accès et portabilité</strong> : obtenir une copie de vos données (export JSON +
          CSV, directement depuis l&apos;application) ;
        </li>
        <li>
          <strong>Rectification</strong> : corriger vos informations depuis votre profil ;
        </li>
        <li>
          <strong>Effacement</strong> : supprimer votre compte (anonymisation sous 30 jours) ;
        </li>
        <li>
          <strong>Opposition et limitation</strong> : refuser certains traitements (classement,
          partage entre box, marketing) via des réglages granulaires ;
        </li>
        <li>
          <strong>Retrait du consentement</strong> : aussi simple que de le donner — un
          interrupteur, pas un e-mail — pour la santé, les photos, le classement public, les
          notifications marketing.
        </li>
      </ul>
      <p>
        Pour exercer ces droits : <strong>[e-mail de contact de la box]</strong> (responsable de
        traitement).
      </p>
      <p>
        Vous pouvez également introduire une réclamation auprès de la{' '}
        <strong>
          CNIL (
          <a href="https://www.cnil.fr" rel="noreferrer noopener">
            www.cnil.fr
          </a>
          )
        </strong>{' '}
        si vous estimez que vos droits ne sont pas respectés.
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Vos données sont protégées par : le chiffrement en transit (TLS) et au repos, un{' '}
        <strong>chiffrement supplémentaire au niveau colonne</strong> pour les données de santé et
        les notes de coach, une <strong>isolation stricte entre box</strong> (aucune box
        n&apos;accède aux données d&apos;une autre), une authentification à durée de vie courte, et
        une journalisation des accès sensibles. L&apos;application ne traite aucune donnée de
        paiement : le règlement se fait directement auprès de la box, en dehors de
        l&apos;application.
      </p>

      <h2>8. Mineurs</h2>
      <p>
        L&apos;application n&apos;est pas destinée aux enfants de moins de 15 ans sans
        l&apos;autorisation du titulaire de l&apos;autorité parentale (seuil français, art. 8 RGPD).
        Un membre mineur déclenche un flux d&apos;autorisation parentale au moment de
        l&apos;inscription.
      </p>

      <h2>9. Cookies et traceurs (interface web)</h2>
      <p>
        L&apos;interface web n&apos;utilise que les cookies <strong>strictement nécessaires</strong>{' '}
        à son fonctionnement (session). Aucun traceur de mesure d&apos;audience n&apos;est déposé
        sans votre consentement. Le bandeau de gestion des cookies vous permet de refuser aussi
        simplement que d&apos;accepter.
      </p>

      <h2>10. Évolutions de cette politique</h2>
      <p>
        Cette politique peut évoluer. Toute modification substantielle vous est signalée dans
        l&apos;application, et la <strong>version</strong> ainsi que la <strong>date</strong> en
        tête de ce document sont mises à jour. Votre consentement est alors, le cas échéant, à
        nouveau recueilli.
      </p>
    </>
  );
}
