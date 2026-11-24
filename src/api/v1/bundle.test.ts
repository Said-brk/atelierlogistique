// Le fichier de la fonction Vercel (api/_lib/v1.mjs) doit être à jour avec src/api/v1 et le moteur :
// sinon, lancer « node scripts/build-api.mjs ».
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { API_BUILD } from '../../../scripts/build-api.mjs';

describe('API : fichier assemblé', () => {
  it('api/_lib/v1.mjs est à jour', async () => {
    const r = await build({ ...API_BUILD, write: false, outfile: 'api/_lib/v1.mjs' });
    expect(r.outputFiles[0].text === readFileSync('api/_lib/v1.mjs', 'utf8'), 'Relancer : node scripts/build-api.mjs').toBe(true);
  }, 30000);
});
