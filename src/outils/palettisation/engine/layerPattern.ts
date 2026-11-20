// Plan de couche : nombre maximal de colis identiques a×b sur un plateau L×W.
// Découpe guillotine récursive combinant les deux orientations à plat
// (motifs « en bloc » et « croisés »). Unités libres (mm dans le moteur).

export interface LayerBox { x: number; y: number; w: number; d: number; }
export interface LayerPattern { count: number; boxes: LayerBox[]; }

function homogeneousFill(L: number, W: number, a: number, b: number): LayerPattern {
  const nx = Math.floor(L / a + 1e-9);
  const ny = Math.floor(W / b + 1e-9);
  const boxes: LayerBox[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) boxes.push({ x: i * a, y: j * b, w: a, d: b });
  return { count: nx * ny, boxes };
}

/** Positions de coupe : multiples des côtés du colis, sur la première moitié (symétrie). */
function cutPositions(len: number, a: number, b: number): number[] {
  const set = new Set<number>();
  const CAP = 60;
  for (let k = 1; k * a < len && k <= CAP; k++) set.add(+(k * a).toFixed(3));
  for (let k = 1; k * b < len && k <= CAP; k++) set.add(+(k * b).toFixed(3));
  return [...set].filter((x) => x > 0 && x <= len / 2 + 1e-6);
}

/**
 * Meilleur plan de couche. `allowTurn` = le colis peut pivoter de 90° au sol.
 * Le résultat n'est jamais inférieur au meilleur remplissage homogène.
 */
export function bestLayerPattern(L: number, W: number, a: number, b: number, allowTurn = true): LayerPattern {
  if (a <= 0 || b <= 0 || L <= 0 || W <= 0) return { count: 0, boxes: [] };
  if (!allowTurn) return homogeneousFill(L, W, a, b);
  const memo = new Map<string, LayerPattern>();
  const budget = { nodes: 20000 };

  const solve = (pl: number, pw: number): LayerPattern => {
    if (pl <= 0 || pw <= 0) return { count: 0, boxes: [] };
    const key = `${pl.toFixed(2)}|${pw.toFixed(2)}`;
    const cached = memo.get(key);
    if (cached) return cached;
    let best = homogeneousFill(pl, pw, a, b);
    const alt = homogeneousFill(pl, pw, b, a);
    if (alt.count > best.count) best = alt;
    if (budget.nodes > 0 && best.count > 0 && a + b < pl + pw) {
      budget.nodes--;
      for (const xc of cutPositions(pl, a, b)) {
        const l = solve(xc, pw);
        const r = solve(pl - xc, pw);
        if (l.count + r.count > best.count) {
          best = { count: l.count + r.count, boxes: l.boxes.concat(r.boxes.map((bx) => ({ ...bx, x: bx.x + xc }))) };
        }
      }
      for (const yc of cutPositions(pw, a, b)) {
        const lo = solve(pl, yc);
        const hi = solve(pl, pw - yc);
        if (lo.count + hi.count > best.count) {
          best = { count: lo.count + hi.count, boxes: lo.boxes.concat(hi.boxes.map((bx) => ({ ...bx, y: bx.y + yc }))) };
        }
      }
    }
    memo.set(key, best);
    return best;
  };
  return solve(L, W);
}

/** Centre le plan sur le plateau (charge centrée = palette stable, filmage régulier). */
export function centerPattern(p: LayerPattern, L: number, W: number): LayerPattern {
  if (p.count === 0) return p;
  const maxX = Math.max(...p.boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...p.boxes.map((b) => b.y + b.d));
  const dx = (L - maxX) / 2;
  const dy = (W - maxY) / 2;
  return { count: p.count, boxes: p.boxes.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })) };
}

/**
 * Couche retournée de 180° : alternée avec la couche d'origine, elle décale les
 * joints quand le plan est croisé (meilleure tenue de la palette).
 */
export function rotatePattern180(p: LayerPattern, L: number, W: number): LayerPattern {
  return { count: p.count, boxes: p.boxes.map((b) => ({ ...b, x: L - b.x - b.w, y: W - b.y - b.d })) };
}
