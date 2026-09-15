import styles from './politique.module.css';

/**
 * The English counterpart of `policy-fr.tsx` — same sections, same version:
 * the two bodies change together, under the same `POLICY_VERSION`. The French
 * text is the one the commanditaire validated; this translation follows it.
 */
export function PolicyEn() {
  return (
    <>
      <p>
        This document describes how member data is processed through the Rack application. It
        replaces neither the terms of service, nor the box&apos;s terms of sale, nor the data
        processing agreement (DPA) between the box and the publisher.
      </p>

      <h2>1. Who processes your data</h2>
      <p>Two parties are involved, with distinct roles under the GDPR:</p>
      <ul>
        <li>
          <strong>The box — [Box name], [legal form], [address], [company number]</strong> — is the{' '}
          <strong>data controller</strong> for your member data. It decides why and how your data is
          used to manage your training (bookings, attendance, membership). Contact:{' '}
          <strong>[box contact e-mail]</strong>.
        </li>
        <li>
          <strong>The publisher — Rack, [legal form to come], [address]</strong> — provides the
          application to the box and acts as a <strong>processor</strong>: it processes data{' '}
          <strong>on the box&apos;s instructions</strong>, under a data processing agreement (art.
          28 GDPR). Rack does not use your data for its own purposes.
        </li>
        <li>
          Your <strong>personal records</strong> (PRs, performance history) and your{' '}
          <strong>account</strong> (one identity, one e-mail, reusable across several boxes) are
          managed by <strong>Rack as controller</strong>, because they follow you beyond a single
          box.
        </li>
      </ul>
      <p>
        A <strong>data protection officer (DPO)</strong>, if appointed, can be reached at:{' '}
        <strong>[DPO e-mail, or “not appointed”]</strong>.
      </p>

      <h2>2. What data, what for, and on what basis</h2>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Purpose</th>
              <th>Legal basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Identity</strong>: first name, last name, e-mail, phone (optional), date of
                birth, sex
              </td>
              <td>Create your account, manage your membership, contact you</td>
              <td>Performance of the contract</td>
            </tr>
            <tr>
              <td>
                <strong>Bookings and attendance</strong>: booked classes, cancellations, waitlist,
                check-ins
              </td>
              <td>Make booking and check-in work</td>
              <td>Performance of the contract</td>
            </tr>
            <tr>
              <td>
                <strong>Performance</strong>: scores, records (PRs), splits, times
              </td>
              <td>Track your progress, feed the leaderboards</td>
              <td>
                Coach follow-up: performance of the contract · Public leaderboard:{' '}
                <strong>consent</strong> (revocable)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Health</strong>: injuries, medical restrictions, certificate, coach notes of
                a medical nature
              </td>
              <td>Adapt sessions to your physical constraints, safely</td>
              <td>
                <strong>Explicit consent</strong> (sensitive data, art. 9 GDPR)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Photos</strong>: avatar, event photos
              </td>
              <td>Personalise your profile, the life of the box</td>
              <td>
                <strong>Consent</strong> (revocable)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Technical data</strong>: logs, IP address, device identifier
              </td>
              <td>Security, abuse prevention, proper operation</td>
              <td>Legitimate interest</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className={styles.callout}>
        <p>
          <strong>The “injury / restriction” field is health data.</strong> It is only filled in
          with your explicit consent, stored encrypted, accessible to the coaches of your box only,
          never shared with a partner box, never used for statistics.
        </p>
      </div>
      <p>
        <strong>Payment.</strong> The application{' '}
        <strong>neither collects nor processes any payment data</strong> (card number, bank
        details). Your membership is paid directly to the box, outside the application.
      </p>
      <p>
        Sex and date of birth are <strong>optional</strong> for using the application, but required
        to appear in a leaderboard by category — this is indicated at the moment of the choice.
      </p>

      <h2>3. How long your data is kept</h2>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Retention period</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Identity, membership</td>
              <td>
                Duration of the contract, then <strong>3 years</strong> (prospecting), then deletion
                or anonymisation
              </td>
            </tr>
            <tr>
              <td>Bookings and attendance</td>
              <td>
                <strong>3 years</strong>, then anonymisation
              </td>
            </tr>
            <tr>
              <td>Performance (scores, PRs)</td>
              <td>Lifetime of your account; exportable and deletable at any time</td>
            </tr>
            <tr>
              <td>Health data</td>
              <td>
                Duration of the contract; deleted at the end of the membership or when consent is
                withdrawn
              </td>
            </tr>
            <tr>
              <td>Photos</td>
              <td>Until you remove them</td>
            </tr>
            <tr>
              <td>Technical traces</td>
              <td>
                <strong>6 months</strong> (12 months for security logs)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        When your account is deleted, your personal data is{' '}
        <strong>anonymised within 30 days</strong>; only accounting entries are kept, anonymised,
        for the legally required period.
      </p>

      <h2>4. Who else sees your data</h2>
      <p>
        <strong>Within your box:</strong> owners and managers (identity included, for
        administration), coaches (for the classes they run — first name, last name, and any
        restrictions you have consented to share). Other members of the same class only see{' '}
        <strong>your first name and the initial of your last name</strong>, and only if you have not
        objected.
      </p>
      <p>
        <strong>Technical providers (Rack&apos;s sub-processors)</strong>, each bound by contract:
      </p>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Role</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Database, authentication</td>
              <td>
                <strong>European Union</strong> (Paris/Frankfurt)
              </td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Web interface hosting</td>
              <td>
                United States (EU execution enforceable; covered by the Data Privacy Framework)
              </td>
            </tr>
            <tr>
              <td>Brevo</td>
              <td>E-mails (sign-in links, invitations)</td>
              <td>European Union</td>
            </tr>
            <tr>
              <td>Expo</td>
              <td>Push notifications</td>
              <td>United States (Data Privacy Framework)</td>
            </tr>
            <tr>
              <td>Sentry / PostHog</td>
              <td>Errors, usage measurement (anonymised data)</td>
              <td>EU / United States depending on configuration</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Your data is <strong>never sold</strong>, and never used for advertising.
      </p>

      <h2>5. Transfers outside the European Union</h2>
      <p>
        Some of the providers above are based in the United States. These transfers are governed by
        the mechanisms provided for by the GDPR (<strong>Data Privacy Framework</strong> and/or
        standard contractual clauses). The most sensitive data (health, coach notes) is hosted and
        processed <strong>in the European Union</strong>.
      </p>

      <h2>6. Your rights</h2>
      <p>At any time, you have the following rights over your data:</p>
      <ul>
        <li>
          <strong>Access and portability</strong>: obtain a copy of your data (JSON + CSV export,
          directly from the application);
        </li>
        <li>
          <strong>Rectification</strong>: correct your information from your profile;
        </li>
        <li>
          <strong>Erasure</strong>: delete your account (anonymisation within 30 days);
        </li>
        <li>
          <strong>Objection and restriction</strong>: refuse certain processing (leaderboard,
          sharing between boxes, marketing) through granular settings;
        </li>
        <li>
          <strong>Withdrawal of consent</strong>: as simple as giving it — a switch, not an e-mail —
          for health, photos, the public leaderboard, marketing notifications.
        </li>
      </ul>
      <p>
        To exercise these rights: <strong>[box contact e-mail]</strong> (data controller).
      </p>
      <p>
        You may also lodge a complaint with the <strong>CNIL</strong>, the French supervisory
        authority (
        <a href="https://www.cnil.fr" rel="noreferrer noopener">
          www.cnil.fr
        </a>
        ), if you believe your rights are not being respected.
      </p>

      <h2>7. Security</h2>
      <p>
        Your data is protected by: encryption in transit (TLS) and at rest, an{' '}
        <strong>additional column-level encryption</strong> for health data and coach notes,{' '}
        <strong>strict isolation between boxes</strong> (no box can access another box&apos;s data),
        short-lived authentication, and logging of sensitive access. The application processes no
        payment data: payment is made directly to the box, outside the application.
      </p>

      <h2>8. Minors</h2>
      <p>
        The application is not intended for children under 15 without the authorisation of the
        holder of parental authority (French threshold, art. 8 GDPR). A minor member triggers a
        parental authorisation flow at sign-up.
      </p>

      <h2>9. Cookies and trackers (web interface)</h2>
      <p>
        The web interface only uses cookies that are <strong>strictly necessary</strong> for its
        operation (session). No audience measurement tracker is set without your consent. The cookie
        banner lets you refuse as simply as you accept.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        This policy may change. Any substantial change is signalled to you in the application, and
        the <strong>version</strong> and <strong>date</strong> at the top of this document are
        updated. Where required, your consent is then collected again.
      </p>
    </>
  );
}
