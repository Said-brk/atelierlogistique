// Lien du « guide cariste » : le plan de chargement est entièrement contenu dans l'URL
// (après le #, jamais envoyé au serveur). Pas de compte, pas de base de données :
// le cariste scanne le QR code et suit le plan sur son téléphone.
//
// Format v1 (JSON compact, compressé deflate-raw, base64url) :
//   { v:1, n:libellé, c:[L,l,H] cm, r:[références], d:{arrêt:destination}, i:[[réf, x,y,z, l,w,h, arrêt, mur, id?]…] }
// Positions en cm (x depuis la cabine, y depuis la gauche, z depuis le plancher), ordre = séquence de chargement.

import type { ContainerDefinition, PlacedItem } from '../engine/types';

export const GUIDE_PATH = '/chargement';
/** Guide en anglais (même page, interface anglaise). */
export const GUIDE_PATH_EN = '/en/loading';
/** Au-delà, le QR code devient trop dense pour être scanné de façon fiable : on propose le lien seul. */
export const QR_MAX_URL = 2200;

export interface GuideItem {
  ref: string; x: number; y: number; z: number; l: number; w: number; h: number; // mm
  stop: number; wall: number; unitId: string | null; destination: string;
}
export interface GuidePlan { label: string; container: { length: number; width: number; height: number }; items: GuideItem[]; }

const cm = (mm: number) => Math.round(mm / 10);

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str: string): Uint8Array {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const canCompress = () => typeof CompressionStream !== 'undefined';

/** Construit la charge utile du lien à partir d'un résultat d'optimisation. */
export async function encodePlan(
  container: ContainerDefinition, placed: readonly PlacedItem[], unitIdOf: (p: PlacedItem) => string | null = () => null,
): Promise<string> {
  const ordered = [...placed].sort((a, b) => a.sequence - b.sequence);
  const refs: string[] = [];
  const refIdx = new Map<string, number>();
  const dest: Record<number, string> = {};
  const items = ordered.map((p) => {
    if (!refIdx.has(p.reference)) { refIdx.set(p.reference, refs.length); refs.push(p.reference); }
    if (p.destination) dest[p.stop] = p.destination;
    const row: (number | string)[] = [refIdx.get(p.reference)!, cm(p.x), cm(p.y), cm(p.z), cm(p.length), cm(p.width), cm(p.height), p.stop ?? 1, p.wall ?? 0];
    const id = unitIdOf(p);
    if (id) row.push(id);
    return row;
  });
  const json = JSON.stringify({ v: 1, n: container.label, c: [cm(container.length), cm(container.width), cm(container.height)], r: refs, d: dest, i: items });
  const raw = new TextEncoder().encode(json);
  // Préfixe : « z » = compressé, « j » = JSON brut (navigateur sans CompressionStream).
  return canCompress() ? `z${b64urlEncode(await pipe(raw, new CompressionStream('deflate-raw')))}` : `j${b64urlEncode(raw)}`;
}

export async function decodePlan(payload: string): Promise<GuidePlan> {
  const kind = payload[0];
  const bytes = b64urlDecode(payload.slice(1));
  const raw = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  const d = JSON.parse(new TextDecoder().decode(raw));
  if (d?.v !== 1 || !Array.isArray(d.i)) throw new Error('Lien de chargement invalide');
  const mm = (v: number) => v * 10;
  return {
    label: String(d.n ?? 'Véhicule'),
    container: { length: mm(d.c[0]), width: mm(d.c[1]), height: mm(d.c[2]) },
    items: d.i.map((r: (number | string)[]) => ({
      ref: d.r[r[0] as number] ?? '?', x: mm(r[1] as number), y: mm(r[2] as number), z: mm(r[3] as number),
      l: mm(r[4] as number), w: mm(r[5] as number), h: mm(r[6] as number), stop: r[7] as number, wall: r[8] as number,
      unitId: r[9] != null ? String(r[9]) : null, destination: d.d?.[r[7] as number] ?? '',
    })),
  };
}

export function guideUrl(origin: string, payload: string, lang: 'fr' | 'en' = 'fr'): string {
  return `${origin}${lang === 'en' ? GUIDE_PATH_EN : GUIDE_PATH}#${payload}`;
}
