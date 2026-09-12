/**
 * L'e-mail d'invitation du pilote — rendu **pur**, testable sans HTTP (P1-018).
 *
 * Volontairement pauvre : pas de gabarit thémé, pas de marque de la box en
 * couleurs — ça, c'est `P2-015` (`sendEmail(template, locale, data)`). Ici, une
 * instruction : « connecte-toi avec cette adresse ». L'effectif importé rejoint
 * par **appariement d'e-mail** (`accept_pending_invitation`), pas par un jeton,
 * donc l'URL est celle de l'app — un point d'entrée, pas un lien nominatif.
 *
 * Le rendu vient des mêmes `fr.json`/`en.json` que l'app (une seule source de
 * vérité, règle 8). `boxName` et `email` sont **échappés** avant d'entrer dans le
 * HTML : le nom de la box est saisi par un tiers, jamais de confiance aveugle.
 */

import { translate } from '../i18n/translate';
import type { Locale } from '../i18n/types';

export interface InvitationEmailInput {
  /** Nom de la box, saisi par un tiers — échappé avant tout HTML. */
  boxName: string;
  /** L'adresse invitée : c'est **avec elle** que la personne se connecte. */
  email: string;
  /** Le point d'entrée de l'app (non nominatif). */
  inviteUrl: string;
}

export interface RenderedEmail {
  subject: string;
  htmlContent: string;
  textContent: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/**
 * Rend l'e-mail d'invitation dans la langue de la box. Brevo exige `htmlContent` ;
 * on fournit aussi `textContent` (repli des clients sans HTML).
 */
export function renderInvitationEmail(locale: Locale, input: InvitationEmailInput): RenderedEmail {
  const subject = translate(locale, 'email.invitation_subject', { boxName: input.boxName });
  const intro = translate(locale, 'email.invitation_intro', { boxName: input.boxName });
  const instruction = translate(locale, 'email.invitation_instruction', { email: input.email });
  const cta = translate(locale, 'email.invitation_cta');

  const textContent = `${intro}\n\n${instruction}\n${input.inviteUrl}`;

  const htmlContent =
    `<p>${escapeHtml(intro)}</p>` +
    `<p>${escapeHtml(instruction)}</p>` +
    `<p><a href="${escapeHtml(input.inviteUrl)}">${escapeHtml(cta)}</a></p>`;

  return { subject, htmlContent, textContent };
}
