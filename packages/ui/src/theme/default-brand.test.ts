import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from './tokens';

/**
 * Le test que l'angle mort du 3 septembre 2026 réclamait.
 *
 * `DEFAULT_BRAND.primary` valait `#E4572E`, **la couleur de CrossFit Rueil dans
 * le seed**. Les deux étant indiscernables, aucun contrôle visuel du
 * white-label ne prouvait rien : « c'est orange » restait vrai que le thème du
 * tenant ait été résolu ou non. Un écran qui n'avait jamais résolu de box avait
 * exactement l'allure d'un écran qui l'avait fait.
 *
 * Ce n'était pas un défaut de code — le code faisait ce qu'on lui demandait —
 * mais un défaut de **fixtures**. Un test unitaire de rendu ne l'aurait pas vu
 * davantage ; il fallait comparer deux fichiers que personne ne lit ensemble.
 * C'est ce que fait celui-ci.
 */

function repoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../../${relative}`, import.meta.url)), 'utf8');
}

/**
 * Les commentaires SQL retirés.
 *
 * Sans quoi ce test se mordrait la queue : le seed **explique** désormais
 * pourquoi la couleur de la plateforme ne doit pas y figurer, et il la nomme
 * pour le dire. Un test qui lit la prose refuse la phrase qui le justifie —
 * constaté à l'écriture, en une exécution.
 */
function withoutSqlComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

/** Toutes les couleurs hexadécimales d'un fichier, en minuscules. */
function hexColors(source: string): string[] {
  return (source.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((hex) => hex.toLowerCase());
}

describe('DEFAULT_BRAND — la marque de la plateforme reste reconnaissable', () => {
  const platform = DEFAULT_BRAND.primary.toLowerCase();

  it('n’est la couleur d’aucune box du seed', () => {
    const seed = withoutSqlComments(repoFile('supabase/seed.sql'));
    expect(
      hexColors(seed),
      'La marque de la plateforme partage sa couleur avec une box du seed : ' +
        'un contrôle visuel ne pourra plus distinguer « thème résolu » de « thème par défaut ».',
    ).not.toContain(platform);
  });

  it('n’est pas non plus le défaut d’une box neuve', () => {
    // Troisième état, troisième couleur. « La plateforme faute de box » et
    // « cette box, pas encore configurée » disent deux choses différentes ;
    // les confondre remettrait le même angle mort un cran plus loin.
    const defaults = readdirSync(
      fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url)),
    )
      .filter((file) => file.endsWith('.sql'))
      .flatMap((file) => [
        ...withoutSqlComments(repoFile(`supabase/migrations/${file}`)).matchAll(
          /primary_color[^;]*?default\s+'(#[0-9a-fA-F]{6})'/gi,
        ),
      ])
      .map((match) => match[1]?.toLowerCase());

    expect(
      defaults.length,
      'aucun défaut de `primary_color` trouvé — le test ne mesure rien',
    ).toBeGreaterThan(0);
    expect(defaults).not.toContain(platform);
  });

  it('est un neutre, pas une couleur de marque', () => {
    // Une plateforme qui s'affiche en couleur vive laisse croire qu'une box a
    // été résolue. Le neutre dit « je ne sais pas de quelle box il s'agit ».
    //
    // Mesuré par l'**écart** entre canaux sur 255, pas par la saturation HSV :
    // celle-ci divise par le canal le plus fort, donc elle explose sur les
    // teintes sombres. `#1F2933` y sort à 0,39 — autant qu'un bleu franc —
    // alors que ses canaux ne s'écartent que de 20 points sur 255. La première
    // version de ce test a recalé une couleur parfaitement neutre pour cette
    // seule raison. Sur cette échelle : graphite 0,08, ardoise 0,12,
    // orange de Rueil 0,71, bleu de Nanterre 0,39.
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(platform.slice(i, i + 2), 16));
    const ecart = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    expect(ecart, `${platform} est trop coloré pour un neutre`).toBeLessThan(0.2);
  });
});
