import { describe, expect, it } from 'vitest';
import { renderInvitationEmail } from './invitation-email';

describe('renderInvitationEmail', () => {
  it('rend sujet, texte et HTML en FR, avec adresse et URL', () => {
    const r = renderInvitationEmail('fr', {
      boxName: 'CrossFit Rueil',
      email: 'anna@import.example',
      inviteUrl: 'https://rack-app.fr/app',
    });
    expect(r.subject).toBe('Rejoins CrossFit Rueil sur Rack');
    // L'adresse invitée est **dans** le corps : c'est avec elle qu'on se connecte.
    expect(r.textContent).toContain('anna@import.example');
    expect(r.textContent).toContain('https://rack-app.fr/app');
    expect(r.htmlContent).toContain('<a href="https://rack-app.fr/app">');
  });

  it('rend en EN', () => {
    const r = renderInvitationEmail('en', {
      boxName: 'Box',
      email: 'a@b.example',
      inviteUrl: 'https://x.example',
    });
    expect(r.subject).toBe('Join Box on Rack');
    expect(r.textContent).toContain('a@b.example');
  });

  it('échappe le HTML du nom de box saisi par un tiers', () => {
    const r = renderInvitationEmail('fr', {
      boxName: '<script>alert(1)</script>',
      email: 'a@b.example',
      inviteUrl: 'https://x.example',
    });
    // Le HTML ne porte jamais la balise brute…
    expect(r.htmlContent).not.toContain('<script>');
    expect(r.htmlContent).toContain('&lt;script&gt;');
    // …mais le sujet est du texte pur, il garde le nom tel quel.
    expect(r.subject).toContain('<script>');
  });
});
