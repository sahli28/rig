-- Une box neuve ne démarre plus sur la couleur d'exemple de la spécification.
--
-- `themes.primary_color` avait pour défaut `#E4572E` — qui est **aussi**
-- `DEFAULT_BRAND.primary` dans `packages/ui/src/theme/tokens.ts`. Deux concepts
-- distincts partageaient le même littéral :
--
--   * `DEFAULT_BRAND` : la couleur de **Rack**, celle qu'on affiche quand aucune
--     box n'est encore résolue — ouverture à froid, slug inconnu, page publique
--     sans invitation ;
--   * ce défaut de colonne : le point de départ d'une **box neuve**, avant
--     qu'elle ait choisi le sien.
--
-- Tant qu'ils sont confondus, on ne peut pas savoir, en regardant un écran, si
-- on voit « la plateforme faute de box » ou « cette box, au défaut ». Ils ont
-- donc désormais deux noms et deux valeurs, même si le premier ne bouge pas.
--
-- **Un gris ardoise, et pas une teinte dérivée du slug.** Une couleur calculée
-- serait assez spécifique pour avoir l'air choisie, et « pourquoi ma box est
-- turquoise ? » n'a pas de bonne réponse. Un neutre dit « pas encore
-- configuré » — ce qui est exact, et ce qui appelle l'action.
--
-- `create_tenant()` n'est pas touchée : elle insère `(tenant_id, app_name)` et
-- laisse le défaut de colonne faire son travail. Le test le vérifie plutôt que
-- de le supposer.

alter table public.themes alter column primary_color set default '#4A5568';

comment on column public.themes.primary_color is
  'Couleur de la box, telle qu''elle l''a saisie — la correction de contraste se fait à l''affichage (ensureContrast), jamais ici. Le défaut est un neutre « pas encore configuré », distinct de DEFAULT_BRAND.primary qui est la couleur de la plateforme.';
