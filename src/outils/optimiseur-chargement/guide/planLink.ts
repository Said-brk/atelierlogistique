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
/** Adresse courte des liens v2 (QR code) ; la langue est dans la charge utile. */
export const GUIDE_PATH_QR = '/g';
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

// ---------------------------------------------------------------------------------------------
// Format v2 (QR code) — beaucoup plus compact que le v1 :
//   « 2 » + langue (F/E) + base32 (A-Z, 2-7) du binaire compressé deflate-raw.
//   Binaire = en-tête JSON {n, c, r, d, t, u?, N} + 0x00 + colonnes en varint :
//     type (référence + dimensions triées), orientation (0-5), arrêt, mur, puis x, y, z en écarts.
//   Base32 majuscules : le QR code passe en mode alphanumérique (5,5 bits/caractère au lieu de 8),
//   d'où un QR code bien moins dense, donc lisible par l'appareil photo.
// ---------------------------------------------------------------------------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32Encode(bytes: Uint8Array): string {
  let bits = 0, v = 0, out = '';
  for (const x of bytes) { v = ((v << 8) | x) & 0xffff; bits += 8; while (bits >= 5) { out += B32[(v >> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) out += B32[(v << (5 - bits)) & 31];
  return out;
}
function b32Decode(str: string): Uint8Array {
  const out: number[] = []; let bits = 0, v = 0;
  for (const ch of str.toUpperCase()) {
    const i = B32.indexOf(ch); if (i < 0) throw new Error('Lien de chargement invalide');
    v = ((v << 5) | i) & 0xffff; bits += 5;
    if (bits >= 8) { out.push((v >> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const zig = (n: number) => (n < 0 ? (-n * 2) - 1 : n * 2);
const unzig = (n: number) => (n & 1 ? -(n + 1) / 2 : n / 2);
function pushVarint(out: number[], n: number) { while (n > 127) { out.push((n & 127) | 128); n = Math.floor(n / 128); } out.push(n); }

export type GuideLang = 'fr' | 'en';

/** Construit la charge utile (format v2) à partir d'un résultat d'optimisation. */
export async function encodePlan(
  container: ContainerDefinition, placed: readonly PlacedItem[], unitIdOf: (p: PlacedItem) => string | null = () => null,
  lang: GuideLang = 'fr',
): Promise<string> {
  const ordered = [...placed].sort((a, b) => a.sequence - b.sequence);
  const refs: string[] = []; const refIdx = new Map<string, number>();
  const types: number[][] = []; const typeIdx = new Map<string, number>();
  const dest: Record<number, string> = {};
  const ids: string[] = []; let anyId = false;
  const col = { t: [] as number[], o: [] as number[], s: [] as number[], w: [] as number[], x: [] as number[], y: [] as number[], z: [] as number[] };
  for (const p of ordered) {
    if (!refIdx.has(p.reference)) { refIdx.set(p.reference, refs.length); refs.push(p.reference); }
    if (p.destination) dest[p.stop] = p.destination;
    const d = [cm(p.length), cm(p.width), cm(p.height)];
    const sorted = [...d].sort((a, b) => b - a);
    const key = `${refIdx.get(p.reference)}|${sorted.join('x')}`;
    if (!typeIdx.has(key)) { typeIdx.set(key, types.length); types.push([refIdx.get(p.reference)!, ...sorted]); }
    const o = PERMS.findIndex((pm) => sorted[pm[0]] === d[0] && sorted[pm[1]] === d[1] && sorted[pm[2]] === d[2]);
    col.t.push(typeIdx.get(key)!); col.o.push(Math.max(0, o)); col.s.push(p.stop ?? 1); col.w.push(p.wall ?? 0);
    col.x.push(cm(p.x)); col.y.push(cm(p.y)); col.z.push(cm(p.z));
    const id = unitIdOf(p); ids.push(id ?? ''); if (id) anyId = true;
  }
  const head: Record<string, unknown> = { n: container.label, c: [cm(container.length), cm(container.width), cm(container.height)], r: refs, d: dest, t: types, N: ordered.length };
  if (anyId) head.u = ids;
  const body: number[] = [];
  for (const k of ['t', 'o', 's', 'w'] as const) col[k].forEach((v) => pushVarint(body, v));
  for (const k of ['x', 'y', 'z'] as const) { let prev = 0; col[k].forEach((v) => { pushVarint(body, zig(v - prev)); prev = v; }); }
  const headBytes = new TextEncoder().encode(JSON.stringify(head));
  const raw = new Uint8Array(headBytes.length + 1 + body.length);
  raw.set(headBytes, 0); raw[headBytes.length] = 0; raw.set(body, headBytes.length + 1);
  const L = lang === 'en' ? 'E' : 'F';
  if (!canCompress()) return `j${b64urlEncode(new TextEncoder().encode(JSON.stringify(v1Json(container, ordered, unitIdOf))))}`;
  return `2${L}${b32Encode(await pipe(raw, new CompressionStream('deflate-raw')))}`;
}

// Ancien format (JSON) : gardé pour les navigateurs sans CompressionStream et les fiches déjà imprimées.
function v1Json(container: ContainerDefinition, ordered: readonly PlacedItem[], unitIdOf: (p: PlacedItem) => string | null) {
  const refs: string[] = []; const refIdx = new Map<string, number>(); const dest: Record<number, string> = {};
  const items = ordered.map((p) => {
    if (!refIdx.has(p.reference)) { refIdx.set(p.reference, refs.length); refs.push(p.reference); }
    if (p.destination) dest[p.stop] = p.destination;
    const row: (number | string)[] = [refIdx.get(p.reference)!, cm(p.x), cm(p.y), cm(p.z), cm(p.length), cm(p.width), cm(p.height), p.stop ?? 1, p.wall ?? 0];
    const id = unitIdOf(p); if (id) row.push(id);
    return row;
  });
  return { v: 1, n: container.label, c: [cm(container.length), cm(container.width), cm(container.height)], r: refs, d: dest, i: items };
}

/** Langue d'un lien (v2 : 2ᵉ caractère ; v1 : celle de l'adresse). */
export const payloadLang = (payload: string): GuideLang | null => (payload[0] === '2' ? (payload[1]?.toUpperCase() === 'E' ? 'en' : 'fr') : null);

function decodeV2(raw: Uint8Array): GuidePlan {
  const zero = raw.indexOf(0);
  const head = JSON.parse(new TextDecoder().decode(raw.slice(0, zero)));
  let pos = zero + 1;
  const read = () => { let n = 0, mul = 1, b; do { b = raw[pos++]; if (b === undefined) throw new Error('Lien de chargement invalide'); n += (b & 127) * mul; mul *= 128; } while (b & 128); return n; };
  const N: number = head.N;
  const cols: Record<string, number[]> = {};
  for (const k of ['t', 'o', 's', 'w']) cols[k] = Array.from({ length: N }, read);
  for (const k of ['x', 'y', 'z']) { let prev = 0; cols[k] = Array.from({ length: N }, () => (prev += unzig(read()))); }
  const mm = (v: number) => v * 10;
  return {
    label: String(head.n ?? 'Véhicule'),
    container: { length: mm(head.c[0]), width: mm(head.c[1]), height: mm(head.c[2]) },
    items: Array.from({ length: N }, (_, i) => {
      const [ri, a, b, c] = head.t[cols.t[i]]; const dims = [a, b, c]; const pm = PERMS[cols.o[i]] ?? PERMS[0];
      return {
        ref: head.r[ri] ?? '?', x: mm(cols.x[i]), y: mm(cols.y[i]), z: mm(cols.z[i]),
        l: mm(dims[pm[0]]), w: mm(dims[pm[1]]), h: mm(dims[pm[2]]), stop: cols.s[i], wall: cols.w[i],
        unitId: head.u?.[i] ? String(head.u[i]) : null, destination: head.d?.[cols.s[i]] ?? '',
      };
    }),
  };
}

export async function decodePlan(payload: string): Promise<GuidePlan> {
  const kind = payload[0];
  if (kind === '2') return decodeV2(await pipe(b32Decode(payload.slice(2)), new DecompressionStream('deflate-raw')));
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

/** Lien du guide (à copier, envoyer, ouvrir). */
export function guideUrl(origin: string, payload: string, lang: GuideLang = 'fr'): string {
  if (payload[0] === '2') return `${origin}${GUIDE_PATH_QR}#${payload}`;
  return `${origin}${lang === 'en' ? GUIDE_PATH_EN : GUIDE_PATH}#${payload}`;
}

/**
 * Texte à mettre dans le QR code : le lien tel quel, en minuscules. Certains appareils photo ne
 * reconnaissent pas une adresse en MAJUSCULES comme un lien : on ne la modifie plus.
 * Le gain de densité vient du découpage en segments (qr.ts) : la charge utile base32 après le #
 * est codée en mode alphanumérique, l'adresse en octets.
 */
export function qrTextOf(url: string): string {
  return url;
}
