import { describe, it, expect } from 'vitest';
import { scrubUrl } from './analytics';

describe('scrubUrl', () => {
  it('retire query et hash', () => {
    expect(scrubUrl('https://atelierlogistique.com/connexion?code=abc#access_token=x'))
      .toBe('https://atelierlogistique.com/connexion');
  });
  it('masque les identifiants de documents', () => {
    expect(scrubUrl('https://atelierlogistique.com/app/chargements/CH-0042'))
      .toBe('https://atelierlogistique.com/app/chargements/[id]');
    expect(scrubUrl('https://atelierlogistique.com/app/palettisations/P1/plan'))
      .toBe('https://atelierlogistique.com/app/palettisations/[id]/plan');
  });
  it('laisse les pages publiques intactes', () => {
    expect(scrubUrl('https://atelierlogistique.com/chargement-palettisation'))
      .toBe('https://atelierlogistique.com/chargement-palettisation');
  });
});
