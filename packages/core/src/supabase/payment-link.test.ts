import { describe, expect, it } from 'vitest';
import { PaymentLinkPatchSchema } from './box-settings';

/**
 * La moitié « saisie » du critère P2-019 : le formulaire refuse ce que la base
 * refuserait (CHECK `tenant_settings_payment_link_https`), mais avec un message.
 * Le lien est opaque — on ne valide que le transport (https), jamais le contenu.
 */
describe('PaymentLinkPatchSchema', () => {
  const parse = (payment_link_url: string | null) =>
    PaymentLinkPatchSchema.safeParse({ payment_link_url });

  it('accepte un lien https', () => {
    expect(parse('https://buy.stripe.com/xyz').success).toBe(true);
  });

  it('accepte null — le lien retiré, le bouton disparaît', () => {
    expect(parse(null).success).toBe(true);
  });

  it('refuse http', () => {
    expect(parse('http://buy.stripe.com/xyz').success).toBe(false);
  });

  it("refuse un schéma d'URL détourné", () => {
    expect(parse('javascript:alert(1)').success).toBe(false);
  });

  it('refuse du texte qui n’est pas une URL', () => {
    expect(parse('buy.stripe.com/xyz').success).toBe(false);
  });

  it('refuse une URL démesurée', () => {
    expect(parse(`https://buy.stripe.com/${'x'.repeat(2100)}`).success).toBe(false);
  });
});
