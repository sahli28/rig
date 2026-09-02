/**
 * Du fichier de la box aux lignes que la base accepte.
 *
 * Deux étapes, toutes deux pures et donc testables : deviner à quoi
 * correspondent les colonnes, puis trier les lignes en **ce qui sera créé**,
 * **ce qui sera ignoré** et **ce qui bloque tout**.
 *
 * La prévisualisation de l'écran n'est rien d'autre que le retour d'
 * `analyzeRows()` : ce qu'elle affiche est exactement ce que la base fera.
 */

import { z } from 'zod';

/** Les champs qu'une ligne peut porter. `email` est le seul obligatoire. */
export const IMPORT_FIELDS = ['email', 'first_name', 'last_name', 'role'] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** En-têtes reconnus, en français et en anglais, accents et casse ignorés. */
const ENTETES: Record<ImportField, readonly string[]> = {
  email: ['email', 'e-mail', 'mail', 'adresse email', 'adresse e-mail', 'courriel'],
  first_name: ['prenom', 'first name', 'firstname', 'given name'],
  last_name: ['nom', 'nom de famille', 'last name', 'lastname', 'surname', 'family name'],
  role: ['role', 'rôle', 'statut', 'fonction'],
};

/** Sans accents, sans casse, sans espaces superflus. */
function normalise(entete: string): string {
  return entete.trim().toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Propose une correspondance colonne → champ.
 *
 * Ce n'est qu'une proposition : l'écran la montre et la laisse corriger. Un
 * mapping deviné qu'on ne peut pas corriger est pire que pas de mapping du tout,
 * parce qu'il est invisible.
 *
 * Le premier en-tête qui correspond gagne : un fichier avec `nom` **et**
 * `nom de famille` mappe le premier, et la box corrige si ce n'est pas celui
 * qu'elle voulait.
 */
export function guessMapping(headers: readonly string[]): Partial<Record<ImportField, string>> {
  const mapping: Partial<Record<ImportField, string>> = {};

  for (const field of IMPORT_FIELDS) {
    const attendus = ENTETES[field];
    const trouve = headers.find((header) => attendus.includes(normalise(header)));
    if (trouve !== undefined) mapping[field] = trouve;
  }

  return mapping;
}

/**
 * Une ligne prête pour `import_members()`.
 *
 * L'adresse est normalisée **ici aussi** — la fonction SQL le refait, et c'est
 * voulu : la prévisualisation doit détecter les doublons sur la même règle que
 * la base, sinon l'écran promet un décompte que l'import ne tiendra pas.
 */
export const ImportRowSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  first_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
  role: z.enum(['MEMBER', 'COACH', 'MANAGER', 'OWNER']).optional(),
});

export type ImportRow = z.infer<typeof ImportRowSchema>;

/** Pourquoi une ligne ne sera pas importée. */
export type RowVerdict =
  | { kind: 'valid'; row: ImportRow }
  | { kind: 'invalid'; reason: 'email' | 'role' }
  | { kind: 'duplicate_in_file' }
  | { kind: 'already_member' }
  | { kind: 'already_invited' };

export type AnalyzedRow = { line: number; raw: Record<string, string>; verdict: RowVerdict };

export type ImportAnalysis = {
  rows: AnalyzedRow[];
  valid: ImportRow[];
  counts: {
    total: number;
    valid: number;
    invalid: number;
    duplicateInFile: number;
    alreadyMember: number;
    alreadyInvited: number;
  };
};

/**
 * Trie les lignes du fichier.
 *
 * `existingEmails` et `pendingEmails` viennent de la box (annuaire et
 * invitations en attente) : ce sont eux qui permettent d'annoncer « déjà
 * membre » et « déjà invitée » **avant** l'écriture, comme le demande le ticket.
 *
 * Une ligne invalide n'est pas ignorée : elle **bloque** tout l'import, côté
 * base comme ici. Une ligne en double, elle, est simplement écartée — réimporter
 * est le cas normal d'un import.
 */
export function analyzeRows(
  brutes: readonly Record<string, string>[],
  contexte: { existingEmails?: readonly string[]; pendingEmails?: readonly string[] } = {},
): ImportAnalysis {
  const membres = new Set((contexte.existingEmails ?? []).map((e) => e.trim().toLowerCase()));
  const invitees = new Set((contexte.pendingEmails ?? []).map((e) => e.trim().toLowerCase()));
  const vues = new Set<string>();

  const rows: AnalyzedRow[] = brutes.map((raw, index) => {
    const line = index + 2; // +1 pour l'en-tête, +1 pour compter à partir de 1
    const parsed = ImportRowSchema.safeParse(raw);

    if (!parsed.success) {
      const surLeRole = parsed.error.issues.some((issue) => issue.path[0] === 'role');
      return { line, raw, verdict: { kind: 'invalid', reason: surLeRole ? 'role' : 'email' } };
    }

    const email = parsed.data.email;

    if (vues.has(email)) return { line, raw, verdict: { kind: 'duplicate_in_file' } };
    vues.add(email);

    if (membres.has(email)) return { line, raw, verdict: { kind: 'already_member' } };
    if (invitees.has(email)) return { line, raw, verdict: { kind: 'already_invited' } };

    return { line, raw, verdict: { kind: 'valid', row: parsed.data } };
  });

  const compte = (kind: RowVerdict['kind']) =>
    rows.filter((row) => row.verdict.kind === kind).length;

  return {
    rows,
    valid: rows.flatMap((row) => (row.verdict.kind === 'valid' ? [row.verdict.row] : [])),
    counts: {
      total: rows.length,
      valid: compte('valid'),
      invalid: compte('invalid'),
      duplicateInFile: compte('duplicate_in_file'),
      alreadyMember: compte('already_member'),
      alreadyInvited: compte('already_invited'),
    },
  };
}

/**
 * Applique une correspondance aux lignes brutes de l'analyseur.
 *
 * Les colonnes non mappées sont **écartées** : un fichier d'export porte souvent
 * un numéro de licence, une date de naissance, un montant d'abonnement. Rien de
 * tout cela n'a de destination ici, et l'envoyer au serveur serait transmettre
 * des données personnelles dont on n'a que faire.
 */
export function applyMapping(
  lignes: readonly Record<string, string>[],
  mapping: Partial<Record<ImportField, string>>,
): Record<string, string>[] {
  return lignes.map((ligne) => {
    const sortie: Record<string, string> = {};
    for (const field of IMPORT_FIELDS) {
      const colonne = mapping[field];
      if (colonne !== undefined && ligne[colonne] !== undefined) {
        sortie[field] = ligne[colonne];
      }
    }
    return sortie;
  });
}
