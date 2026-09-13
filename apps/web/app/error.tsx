'use client';

/**
 * La même frontière qu'au niveau `[slug]`, à la racine (D-032) : une frontière
 * d'erreur vit **dans** le layout de son segment, donc celle de `[slug]` ne
 * voit pas les exceptions du layout de `[slug]` — qui fait deux `fetchMe()`.
 * Celle-ci attrape tout le reste : ce layout, l'accueil, les invitations, la
 * connexion. Sans elle, un `Gateway Timeout` hors des pages du back-office
 * redonnerait le 500 nu que D-032 vient de retirer.
 *
 * Sous le layout racine, donc sous `Providers` : `useI18n()` y est disponible.
 */
export { default } from './box/[slug]/error';
