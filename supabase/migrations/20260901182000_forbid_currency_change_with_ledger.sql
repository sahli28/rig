-- La devise se fige dès la première écriture comptable.
--
-- L'écran de réglages (P1-001b) rend `tenants.currency` éditable pour la
-- première fois. Or `ledger_entries` porte `amount_cents` **et** `currency` :
-- changer la devise de la box après coup ne convertit rien, ça **réinterprète
-- le passé**. 12 000 centimes encaissés en euros deviendraient 120 £, et la
-- somme d'un ledger append-only — dont le principe est qu'on n'y revient
-- jamais — cesserait d'avoir un sens.
--
-- Règle des sœurs, appliquée au moment où la garde se pose : l'écran refusera,
-- et la base refuse aussi. Un contrôle porté par un seul écran n'est pas un
-- invariant ; celui-ci est sur la table, donc il couvre aussi les chemins qu'on
-- écrira plus tard.
--
-- Ce que le trigger **ne** fait **pas** : empêcher de choisir sa devise avant
-- le premier encaissement. Une box qui se trompe à l'inscription se corrige
-- tant qu'elle n'a rien vendu.
create or replace function public.forbid_currency_change_with_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency = old.currency then
    return new;
  end if;

  if exists (select 1 from public.ledger_entries where tenant_id = old.id) then
    perform public.app_error(
      'CURRENCY_LOCKED',
      'La devise ne peut plus changer : des écritures comptables existent.',
      '23514'
    );
  end if;

  return new;
end;
$$;

comment on function public.forbid_currency_change_with_ledger() is
  'Fige tenants.currency dès qu''une écriture existe dans ledger_entries. Changer la devise après coup réinterprète des montants déjà encaissés.';

-- `security definer` : la lecture de `ledger_entries` depuis le trigger ne doit
-- pas dépendre de la policy de l'appelant. Un OWNER la lit, mais si demain un
-- autre chemin met à jour `tenants` sous une identité qui ne la lit pas, la
-- garde deviendrait silencieusement inopérante — elle verrait « aucune écriture »
-- et laisserait passer.
create trigger tenants_currency_locked
  before update of currency on public.tenants
  for each row execute function public.forbid_currency_change_with_ledger();
