import { describe, it, expect } from 'vitest';
import { browserLang, accountLang } from './userLang';

describe('langue utilisateur', () => {
  it('navigateur : français sinon anglais', () => {
    expect(browserLang({ language: 'fr-FR' })).toBe('fr');
    expect(browserLang({ language: 'fr-MA' })).toBe('fr');
    expect(browserLang({ language: 'en-GB' })).toBe('en');
    expect(browserLang({ language: 'de-DE' })).toBe('en');
    expect(browserLang({})).toBe('fr');
  });
  it('compte : seule une langue connue est retenue', () => {
    expect(accountLang({ user_metadata: { lang: 'en' } })).toBe('en');
    expect(accountLang({ user_metadata: { lang: 'xx' } })).toBe(null);
    expect(accountLang(null)).toBe(null);
  });
});
