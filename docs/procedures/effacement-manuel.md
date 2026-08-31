# Traiter une demande d'effacement à la main

**Valable jusqu'à la livraison de P2-002** (droits RGPD en self-service).

Reporter l'outillage ne reporte pas l'obligation : une personne peut exercer son
droit à l'effacement dès le premier jour du pilote, et le délai de réponse est
d'**un mois**. Cette procédure est la condition de ce report.

## Avant de commencer

Vérifier l'identité du demandeur. Une demande arrivant de l'adresse e-mail du
compte suffit ; dans le doute, demander une confirmation depuis l'app.

## 1. Est-elle propriétaire unique d'une box active ?

```sql
select t.name, t.slug
from public.memberships m
join public.tenants t on t.id = m.tenant_id
where m.user_id = :user_id
  and m.role = 'OWNER' and m.status = 'ACTIVE'
  and t.status = 'ACTIVE' and t.deleted_at is null
  and (select count(*) from public.memberships m2
       where m2.tenant_id = m.tenant_id
         and m2.role = 'OWNER' and m2.status = 'ACTIVE') = 1;
```

Si la requête renvoie des lignes, **le trigger `forbid_orphaning_tenant` bloquera
la suppression** — et c'est voulu : une box sans propriétaire n'est administrable
par personne, y compris pour ses autres membres.

Répondre en proposant les deux issues, sans les présenter comme un refus :
transmettre la propriété (`set_member_role` sur un autre membre, puis
`leave_tenant`), ou fermer la box (`status = 'CLOSED'`, `deleted_at = now()`).
Le délai d'un mois court toujours : traiter cet échange en priorité.

## 2. Exporter avant d'effacer

La personne a droit à ses données. Extraire au minimum : `users`, ses
`memberships`, ses `consents`, ses `devices`. Envoyer en JSON par un canal sûr.

## 3. Anonymiser, ne pas supprimer

**Ne pas faire `delete from auth.users`.** La cascade emporterait les
appartenances et les appareils, alors que certaines données doivent survivre
sous forme anonymisée :

- les **écritures comptables** — obligation de conservation de 10 ans ;
- les **consentements** — la box doit pouvoir prouver son accountability. C'est
  pourquoi `consents` n'a volontairement plus de clé étrangère vers `users`.

Anonymiser plutôt :

```sql
update public.users
set email = concat('anonyme+', id, '@supprime.invalid'),
    first_name = null, last_name = null, birthdate = null,
    gender = null, avatar_url = null,
    deleted_at = now()
where id = :user_id;

-- rompre le lien nominatif des consentements, garder la preuve
update public.consents
set user_id = '00000000-0000-0000-0000-000000000000', ip = null, user_agent = null
where user_id = :user_id;

delete from public.devices where user_id = :user_id;
```

Puis révoquer les sessions côté GoTrue et bloquer la reconnexion.

⚠️ `public.users.email` est gelé par le trigger `forbid_email_change` : cette mise
à jour doit être faite **avec un rôle privilégié**, ou après avoir aussi mis à jour
`auth.users.email` (que `sync_user_email` propage).

## 4. Tracer

Consigner la demande, sa date, l'identité vérifiée et la date de traitement — dans
le registre des traitements, pas dans `audit_logs` (qui est scopé à une box).

## Ce que cette procédure prouve

Qu'il faut livrer **P2-002**. Chacune de ces étapes est une occasion de se tromper
sous pression, dans un délai légal, sur les données d'une vraie personne.
