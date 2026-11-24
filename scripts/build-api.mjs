// Assemble l'API (src/api/v1, TypeScript + moteur de calcul) en un seul fichier pour la fonction Vercel.
// node scripts/build-api.mjs → api/_lib/v1.mjs (fichier versionné : un test vérifie qu'il est à jour).
import { build } from 'esbuild';

export const API_BUILD = {
  entryPoints: ['src/api/v1/vercel.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node20',
  external: ['@supabase/supabase-js'], legalComments: 'none', logLevel: 'warning',
  banner: { js: '// Fichier généré par scripts/build-api.mjs à partir de src/api/v1 : ne pas modifier à la main.' },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await build({ ...API_BUILD, outfile: 'api/_lib/v1.mjs' });
  console.log('API assemblée : api/_lib/v1.mjs');
}
