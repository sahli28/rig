/**
 * `me()` — tout l'état de session en un aller-retour (spec §7.6a).
 *
 * La fonction SQL rend du `jsonb`, donc `Json` côté types générés : rien n'y
 * décrit la forme. Le schéma Zod ci-dessous est ce qui la décrit, et il la
 * **vérifie** à chaque appel — une migration qui renommerait un champ casse ici,
 * avec un message qui nomme le champ, plutôt que trois écrans plus loin sur un
 * `undefined`.
 */

import { z } from 'zod';
import type { RackClient } from './client';
import { Constants } from './types.gen';

/**
 * Horodatages : validés comme chaînes, pas comme dates ISO. Postgres rend six
 * décimales de seconde, et se battre avec la précision d'un validateur ne
 * protège de rien — la valeur repart telle quelle vers `formatDate`.
 */
const Timestamp = z.string().min(1);

/**
 * Repris des types générés, pas recopiés : un rôle ajouté en base apparaît ici
 * à la régénération, et un schéma qui recopierait la liste à la main
 * rejetterait le nouveau rôle sans qu'aucun test ne le voie venir.
 */
export const MEMBERSHIP_ROLES = Constants.public.Enums.membership_role;
export const MEMBERSHIP_STATUSES = Constants.public.Enums.membership_status;

export const MembershipSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  tenant_name: z.string(),
  tenant_slug: z.string(),
  role: z.enum(MEMBERSHIP_ROLES),
  status: z.enum(MEMBERSHIP_STATUSES),
  joined_at: Timestamp,
});

/** Thème de la box active. Alimente les tokens de `@rack/ui/theme`, sans exception. */
export const TenantThemeSchema = z.object({
  app_name: z.string(),
  logo_url: z.string().nullable(),
  primary: z.string(),
  radius: z.number(),
  font: z.string(),
});

/** Règles de réservation, en minutes et en jours. Le client les affiche, la base les applique. */
export const BookingRulesSchema = z.object({
  open_days_before: z.number().int(),
  close_minutes_before: z.number().int(),
  cancel_window_minutes: z.number().int(),
  max_upcoming_bookings: z.number().int(),
});

export const CurrentTenantSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  /** Fuseau de la box : toute règle métier locale s'y calcule (CLAUDE.md, règle 9). */
  timezone: z.string(),
  currency: z.string(),
  /** Langue employée tant que la personne n'en a pas choisi une (P1-001b). */
  default_locale: z.string(),
  role: z.enum(MEMBERSHIP_ROLES),
  theme: TenantThemeSchema,
  booking_rules: BookingRulesSchema,
});

export const MeUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  locale: z.string(),
  avatar_url: z.string().nullable(),
});

/** Actions restant à accomplir avant que l'app soit pleinement utilisable. */
export const REQUIRED_ACTIONS = ['COMPLETE_PROFILE', 'ACCEPT_CONSENTS'] as const;
export type RequiredAction = (typeof REQUIRED_ACTIONS)[number];

export const MeSchema = z.object({
  user: MeUserSchema,
  memberships: z.array(MembershipSchema),
  /**
   * Nul tant qu'aucune box n'est demandée, et nul aussi si la box demandée
   * n'est pas une des siennes. `me()` ne devine jamais la box active : un repli
   * silencieux afficherait les données de la box A dans l'écran de la box B.
   */
  current_tenant: CurrentTenantSchema.nullable(),
  /**
   * Tolérant aux valeurs inconnues, à dessein. Une action ajoutée en base et
   * pas encore gérée ici doit être ignorée, pas faire échouer tout `me()` —
   * ce qui laisserait l'app sur un écran blanc au démarrage.
   */
  required_actions: z.array(z.string()),
});

export type Me = z.infer<typeof MeSchema>;
export type Membership = z.infer<typeof MembershipSchema>;
export type CurrentTenant = z.infer<typeof CurrentTenantSchema>;
export type TenantTheme = z.infer<typeof TenantThemeSchema>;
export type BookingRules = z.infer<typeof BookingRulesSchema>;

export function hasRequiredAction(me: Me, action: RequiredAction): boolean {
  return me.required_actions.includes(action);
}

/**
 * Retrouve une appartenance par le `slug` de sa box.
 *
 * Le web porte la box active dans l'URL (`/box/[slug]/…`), et il faut en tirer un
 * `tenant_id`. La résolution se fait **parmi ses propres appartenances**, jamais
 * par `tenant_public_profile()` : celui-ci résoudrait n'importe quelle box
 * active, y compris une où l'appelant n'a rien, et il faudrait rattraper le cas
 * plus loin. Ici, « box inconnue » et « accès refusé » sont indiscernables par
 * construction — ce qui est le comportement voulu.
 */
export function findMembershipBySlug(me: Me, slug: string): Membership | null {
  return me.memberships.find((m) => m.tenant_slug === slug) ?? null;
}

/**
 * Choisit la box à activer. Le choix appartient au client — `me()` refuse de le
 * faire, et c'est ce refus qui donne son sens à cette fonction.
 *
 * L'ordre est : la box mémorisée si elle est toujours une des siennes, sinon la
 * box unique s'il n'y en a qu'une, sinon **rien**. Le dernier cas est celui qui
 * compte : avec deux boxes et aucune préférence, choisir « la plus ancienne »
 * afficherait les données de l'une sous le nom de l'autre. Un `null` oblige
 * l'écran à demander, ce qui est la seule réponse honnête.
 */
export function chooseActiveTenant(
  memberships: readonly Membership[],
  persistedTenantId?: string | null,
): string | null {
  const remembered = memberships.find((m) => m.tenant_id === persistedTenantId);
  if (remembered) return remembered.tenant_id;

  return memberships.length === 1 ? (memberships[0]?.tenant_id ?? null) : null;
}

/**
 * Appelle `me()`. `tenantId` désigne la box à activer ; sans lui, la réponse
 * porte les appartenances mais pas de box active.
 *
 * L'erreur PostgREST est relancée telle quelle : elle porte le code applicatif
 * dans `details`, que `errorMessageKeyOf` sait traduire.
 */
export async function fetchMe(client: RackClient, tenantId?: string | null): Promise<Me> {
  const { data, error } = await client.rpc('me', tenantId ? { p_tenant_id: tenantId } : {});
  if (error) throw error;
  return MeSchema.parse(data);
}
