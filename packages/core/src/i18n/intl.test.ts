import { afterEach, describe, expect, it } from 'vitest';
import { pluralCategory, relativeDayKey } from './intl';
import { translate } from './translate';
import { formatDate, formatMoney, formatRelativeDate, formatTime } from './format';

/**
 * **Le filet qui manquait le 4 septembre 2026.**
 *
 * Le planning a planté sur appareil — « undefined cannot be used as a
 * constructor » — parce qu'`Intl.PluralRules` n'existe pas sous Hermes. Aucun
 * de nos tests ne pouvait le voir : Vitest tourne sous Node et le harnais web
 * dans un navigateur, deux moteurs qui ont un `Intl` complet.
 *
 * On ne peut pas exécuter Hermes ici — `hermesc` est un compilateur, il refuse
 * explicitement d'exécuter (« hermesc does not support -exec »). Ce qu'on peut
 * faire, et qui attrape exactement la même classe de défaut : **retirer les
 * globales que Hermes n'a pas, et vérifier que le code s'en passe.**
 *
 * Ce n'est pas la même chose que tester sous Hermes — c'est une simulation de
 * capacité, pas une simulation de moteur. Mais la propriété qui compte n'est pas
 * « Hermes a-t-il telle fonction », qui varie d'une version à l'autre : c'est
 * **notre code en dépend-il**. Celle-là se teste ici, et elle se teste
 * définitivement.
 */

const REEL = globalThis.Intl;

afterEach(() => {
  globalThis.Intl = REEL;
});

/** Ce que Hermes offre : `Intl`, sans `PluralRules` ni `RelativeTimeFormat`. */
function commeHermes(): void {
  const amputé = Object.create(Object.getPrototypeOf(REEL) as object) as typeof Intl;
  for (const clé of Object.getOwnPropertyNames(REEL) as Array<keyof typeof Intl>) {
    if (clé === 'PluralRules' || clé === 'RelativeTimeFormat') continue;
    Object.defineProperty(amputé, clé, {
      value: REEL[clé],
      enumerable: true,
      configurable: true,
    });
  }
  globalThis.Intl = amputé;
}

describe('sous un moteur sans `Intl.PluralRules` ni `Intl.RelativeTimeFormat`', () => {
  it('la simulation reproduit bien le manque', () => {
    // Sans ce contrôle, un test qui passe ne prouverait rien : il pourrait
    // passer parce que la simulation ne simule pas.
    commeHermes();
    expect(Intl.PluralRules).toBeUndefined();
    expect(Intl.RelativeTimeFormat).toBeUndefined();
    expect(Intl.DateTimeFormat).toBeTypeOf('function');
  });

  it('une clé au pluriel se rend — c’est l’appel exact qui a planté', () => {
    commeHermes();
    // `planning.seats_left`, sur l'écran du planning, ligne 240. Le message
    // d'origine était « undefined cannot be used as a constructor ».
    expect(translate('fr', 'planning.seats_left', { count: 16 })).toBe('16 places restantes');
    expect(translate('fr', 'planning.seats_left', { count: 1 })).toBe('1 place restante');
    expect(translate('en', 'planning.seats_left', { count: 16 })).toBe('16 seats left');
  });

  it('une date relative se rend — la seconde bombe, jamais déclenchée', () => {
    commeHermes();
    const now = new Date('2026-09-04T10:00:00Z');
    const demain = new Date('2026-09-05T16:30:00Z');
    expect(formatRelativeDate(demain, { locale: 'fr', timeZone: 'Europe/Paris', now })).toBe(
      'demain à 18:30',
    );
  });

  it('les heures, les dates et les montants continuent de se rendre', () => {
    // Ceux-ci **dépendent** encore du moteur, et c'est assumé : `DateTimeFormat`
    // est prouvé sur appareil par la trace du 4 septembre, qui a planté après
    // avoir affiché « vendredi 4 septembre 2026 » et « 18:30 – 19:30 ».
    commeHermes();
    const instant = '2026-09-04T16:30:00Z';
    expect(formatTime(instant, { locale: 'fr', timeZone: 'Europe/Paris' })).toBe('18:30');
    expect(formatDate(instant, { locale: 'fr', timeZone: 'Europe/Paris' })).toBe('04/09/2026');
    expect(formatMoney(8900, { locale: 'fr' })).toContain('89,00');
  });
});

describe('pluralCategory — la table qui remplace `Intl.PluralRules`', () => {
  it('suit CLDR pour le français : 0 et 1 au singulier', () => {
    // C'est la différence qui compte entre les deux langues, et celle qu'un
    // développeur anglophone écrit de travers : « 0 place restante », pas
    // « 0 places restantes ».
    expect(pluralCategory('fr', 0)).toBe('one');
    expect(pluralCategory('fr', 1)).toBe('one');
    expect(pluralCategory('fr', 2)).toBe('other');
    expect(pluralCategory('fr', 16)).toBe('other');
  });

  it('suit CLDR pour l’anglais : seul 1 est au singulier', () => {
    expect(pluralCategory('en', 0)).toBe('other');
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 2)).toBe('other');
  });

  it('rend le même verdict qu’`Intl.PluralRules`, là où `Intl` existe', () => {
    // **Le test qui rend la table honnête.** Sous Node, la référence est
    // disponible : on s'y compare plutôt que de se croire. Le jour où la table
    // et CLDR divergent, c'est ici que ça se voit — pas sur un téléphone.
    for (const locale of ['fr', 'en'] as const) {
      const reference = new REEL.PluralRules(locale === 'fr' ? 'fr-FR' : 'en-GB');
      for (const n of [0, 1, 2, 3, 11, 16, 21, 100]) {
        expect(pluralCategory(locale, n), `${locale} / ${n}`).toBe(reference.select(n));
      }
    }
  });
});

describe('relativeDayKey — les cinq jours qu’on nomme', () => {
  it('nomme de l’avant-veille au surlendemain', () => {
    expect(relativeDayKey(-2)).toBe('datetime.day_before_yesterday');
    expect(relativeDayKey(-1)).toBe('datetime.yesterday');
    expect(relativeDayKey(0)).toBe('datetime.today');
    expect(relativeDayKey(1)).toBe('datetime.tomorrow');
    expect(relativeDayKey(2)).toBe('datetime.day_after_tomorrow');
  });

  it('rend `null` au-delà, pour que l’appelant date', () => {
    // §12.3 : au-delà de deux jours, une date absolue. « dans 9 jours » n'aide
    // personne à savoir quel jour poser sa journée.
    expect(relativeDayKey(3)).toBeNull();
    expect(relativeDayKey(-3)).toBeNull();
  });
});
