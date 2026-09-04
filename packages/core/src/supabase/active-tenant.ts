/**
 * Le filtre de box active — la règle la plus facile à oublier de tout P1.
 *
 * La RLS garantit qu'une requête ne sort pas des boxes **de l'utilisateur**.
 * Elle ne garantit pas qu'elle reste dans **la box active**. Un membre inscrit
 * dans deux boxes est un cas nominal (ADR 0002) : sans `.eq('tenant_id', …)`,
 * les cours de la box A s'affichent dans l'interface de la box B.
 *
 * Ce n'est pas une fuite inter-utilisateur, donc **aucun test pgTAP ne
 * l'attrapera** — tous les tests d'isolation resteront verts pendant que
 * l'écran ment. D'où ce helper : le filtre cesse d'être une discipline à chaque
 * appel pour devenir le seul chemin d'accès aux tables de box.
 *
 * `.claude/rules/api.md` porte la même règle pour la future couche API.
 */

import type { RackClient } from './client';
import type { Database } from './types.gen';

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];

/**
 * Les tables portant un `tenant_id`. Le type se déduit du schéma généré : une
 * table sans `tenant_id` est refusée au typecheck, et une nouvelle table de box
 * devient éligible sans qu'on ait à tenir une liste à la main.
 */
export type TenantScopedTable = {
  [K in keyof Tables]: 'tenant_id' extends keyof Tables[K]['Row'] ? K : never;
}[keyof Tables];

/** Idem pour les vues — `member_admin_directory` et celles qui suivront. */
export type TenantScopedView = {
  [K in keyof Views]: 'tenant_id' extends keyof Views[K]['Row'] ? K : never;
}[keyof Views];

/**
 * Ce qui se **lit** avec un filtre de box : tables et vues.
 *
 * La distinction n'est pas cosmétique. Une vue ne s'écrit pas — `insert` et
 * `update` restent sur `TenantScopedTable`, si bien qu'une écriture visant une
 * vue échoue au typecheck plutôt qu'en base.
 */
export type TenantScopedRelation = TenantScopedTable | TenantScopedView;

/**
 * Ce qu'un appelant fournit à `insert` : la ligne **sans** son `tenant_id`.
 *
 * Il reste accepté — un objet relu depuis la base en porte un — mais il n'est
 * plus exigé, et il est de toute façon écrasé. Le demander revenait à faire
 * écrire par chaque appelant la valeur dont ce helper existe pour le dispenser.
 */
export type TenantInsert<T extends TenantScopedTable> = Omit<Tables[T]['Insert'], 'tenant_id'> & {
  tenant_id?: string;
};

/**
 * Lie un client à une box. Toute lecture ou écriture d'une table de box passe
 * par l'objet rendu ; `client.from(…)` en direct est à considérer comme un
 * oubli de filtre jusqu'à preuve du contraire.
 *
 * Pas de `delete` : les entités métier se retirent par `deleted_at`
 * (CLAUDE.md, règle 10).
 */
/**
 * Applique le filtre de box. Le transtypage est confiné à cette fonction :
 * dans un corps générique, TypeScript ne peut pas vérifier que `tenant_id` est
 * une colonne de `T`, alors que `TenantScopedTable` vient précisément de le
 * garantir. Le type rendu, lui, reste celui du constructeur de requête.
 */
function whereTenant<B>(builder: B, tenantId: string): B {
  return (builder as unknown as { eq(column: string, value: string): B }).eq('tenant_id', tenantId);
}

export function tenantScope(client: RackClient, tenantId: string) {
  return {
    tenantId,

    /**
     * `select` filtré sur la box active, **toutes colonnes**.
     *
     * Pas de liste de colonnes : la rendre générique pour que PostgREST sache
     * typer les lignes fait exploser `tsc` — il instancie l'analyseur de
     * colonnes pour chaque table de l'union, et le typecheck meurt en
     * « heap out of memory ». Mesuré, pas supposé.
     *
     * Ce que ça coûte : quelques colonnes de trop sur des tables de réglages.
     * Ce que ça évite : des lignes typées `GenericStringError` et un
     * transtypage à chaque écran. Le jour où une table portera une colonne
     * lourde ou sensible, la réponse sera une **vue**, pas une projection
     * passée en chaîne.
     */
    select<T extends TenantScopedTable>(table: T) {
      return whereTenant(client.from(table).select('*'), tenantId);
    },

    /**
     * Idem pour une vue. Méthode distincte, et non une union avec `select` :
     * `client.from()` porte deux surcharges — tables d'un côté, vues de l'autre —
     * qu'une union ne satisfait ni l'une ni l'autre. Les fusionner coûterait un
     * transtypage qui écraserait le type des lignes rendues.
     *
     * L'asymétrie n'est pas qu'un contournement : une vue ne s'écrit pas, et
     * c'est précisément pourquoi elle n'a ni `insert` ni `update` ici.
     */
    selectView<V extends TenantScopedView>(view: V, columns = '*') {
      return whereTenant(client.from(view).select(columns), tenantId);
    },

    /**
     * La box elle-même. `tenants` n'a pas de colonne `tenant_id` — sa clé
     * primaire *est* l'identifiant — mais elle relève exactement du même piège :
     * `select()` sans filtre rend **toutes** les boxes de la personne, et
     * l'écran de la box A afficherait le nom de la box B.
     *
     * Sœur de `select()`, avec le seul filtre qui ait un sens ici.
     */
    currentTenant() {
      return client.from('tenants').select('*').eq('id', tenantId).maybeSingle();
    },

    /**
     * Écrit la box active. Sœur de `currentTenant()`, et elle manquait :
     * l'écran de réglages, premier à modifier une box, a dû passer par
     * `client.from('tenants')` en direct — que la règle ESLint a arrêté, ce
     * qui est exactement son rôle.
     *
     * `id` est retiré du patch, pour la même raison que `tenant_id` l'est de
     * `update()` : filtrer dit quelles lignes sont modifiables, ça n'empêche
     * pas d'en réécrire la clé.
     */
    updateCurrentTenant(patch: Tables['tenants']['Update']) {
      const { id: _immuable, ...safe } = patch;
      return client.from('tenants').update(safe).eq('id', tenantId);
    },

    /**
     * `insert` avec le `tenant_id` **imposé**, pas seulement suggéré : la valeur
     * de l'appelant est écrasée, pour qu'une ligne ne puisse pas atterrir dans
     * une autre box par recopie d'un objet.
     */
    insert<T extends TenantScopedTable>(table: T, values: TenantInsert<T> | TenantInsert<T>[]) {
      const rows = (Array.isArray(values) ? values : [values]).map((row) => ({
        ...row,
        tenant_id: tenantId,
      }));
      const query = client.from(table);
      return query.insert(rows as Parameters<typeof query.insert>[0]);
    },

    /**
     * `update` borné à la box active — et **`tenant_id` retiré du patch**, pas
     * seulement filtré. Filtrer dit quelles lignes sont modifiables ; ça
     * n'empêche pas d'en réécrire le `tenant_id` et donc de déplacer la ligne
     * dans une autre box.
     *
     * La RLS ne rattrape pas ce cas : son `with check` exige que le `tenant_id`
     * visé appartienne à `current_tenant_ids()`, ce qui est vrai pour un membre
     * inscrit dans deux boxes — le cas nominal de l'ADR 0002, celui-là même
     * pour lequel ce helper existe.
     *
     * Symétrique d'`insert`, qui impose le `tenant_id` au lieu de le retirer :
     * dans les deux cas, la box de destination n'est pas négociable.
     */
    update<T extends TenantScopedTable>(table: T, patch: Tables[T]['Update']) {
      const { tenant_id: _immuable, ...safe } = patch as Record<string, unknown>;
      const query = client.from(table);
      return whereTenant(query.update(safe as Parameters<typeof query.update>[0]), tenantId);
    },
  };
}

export type TenantScope = ReturnType<typeof tenantScope>;
