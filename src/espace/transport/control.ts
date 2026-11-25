// Contrôle transport : coût théorique (grille du transporteur) vs montant facturé, par chargement et par transporteur.
// Pur (sans base ni React) : testé dans control.test.ts.

export interface ControlShipment {
  id: string; code: string; label: string | null; external_id: string | null;
  departure_at: string | null; created_at?: string; tour: string | null; status: string;
  carrier: string | null; carrier_cost: number | string | null;
  carrier_quote: { basis?: string; qty?: number; unit?: string; error?: string } | null;
  invoiced_amount: number | string | null; invoiced_qty: number | string | null; invoice_ref: string | null;
  summary: { ldm?: number | null; packed?: number; weight?: number; fill?: number; fleet?: number } | null;
}

export interface ControlRow extends ControlShipment {
  theoretical: number | null;
  invoiced: number | null;
  gap: number | null;
  gapPct: number | null;
  /** Écart au-delà de la tolérance (au-dessus = surfacturation, en dessous = à vérifier aussi). */
  flag: 'ok' | 'over' | 'under' | 'missing' | 'no_quote';
  ldm: number | null;
  qtyBilled: number | null;
}

export interface CarrierStats {
  carrier: string;
  shipments: number;
  invoicedCount: number;
  ldm: number;
  ldmBilled: number | null;
  pallets: number;
  weight: number;
  theoretical: number;
  invoiced: number;
  /** Écart sur les seuls chargements facturés. */
  gap: number;
  gapPct: number | null;
  flagged: number;
  costPerLdm: number | null;
  costPerPallet: number | null;
  fill: number | null;
}

const n = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export function controlRows(list: ControlShipment[], tolerancePct = 3): ControlRow[] {
  return list.map((s) => {
    const theoretical = n(s.carrier_cost);
    const invoiced = n(s.invoiced_amount);
    const gap = theoretical != null && invoiced != null ? r2(invoiced - theoretical) : null;
    const gapPct = gap != null && theoretical ? (gap / theoretical) * 100 : null;
    const flag: ControlRow['flag'] = theoretical == null ? 'no_quote'
      : invoiced == null ? 'missing'
        : gapPct != null && gapPct > tolerancePct ? 'over'
          : gapPct != null && gapPct < -tolerancePct ? 'under' : 'ok';
    return { ...s, theoretical, invoiced, gap, gapPct, flag, ldm: n(s.summary?.ldm), qtyBilled: n(s.invoiced_qty) };
  });
}

export function carrierStats(rows: ControlRow[]): CarrierStats[] {
  const by = new Map<string, ControlRow[]>();
  for (const r of rows) { const k = r.carrier ?? '—'; by.set(k, [...(by.get(k) ?? []), r]); }
  return [...by.entries()].map(([carrier, rs]) => {
    const billed = rs.filter((r) => r.invoiced != null);
    const both = billed.filter((r) => r.theoretical != null);
    const sum = (a: ControlRow[], f: (r: ControlRow) => number | null) => a.reduce((t, r) => t + (f(r) ?? 0), 0);
    const ldm = sum(rs, (r) => r.ldm);
    const pallets = sum(rs, (r) => n(r.summary?.packed));
    const theoreticalBoth = sum(both, (r) => r.theoretical);
    const gap = r2(sum(both, (r) => r.gap));
    const ldmBilledRows = billed.filter((r) => r.carrier_quote?.basis === 'ldm' && r.qtyBilled != null);
    const invoiced = r2(sum(billed, (r) => r.invoiced));
    const ldmOfBilled = sum(billed, (r) => r.ldm);
    const palletsOfBilled = sum(billed, (r) => n(r.summary?.packed));
    const fills = rs.map((r) => n(r.summary?.fill)).filter((x): x is number => x != null);
    return {
      carrier, shipments: rs.length, invoicedCount: billed.length,
      ldm: r2(ldm), ldmBilled: ldmBilledRows.length ? r2(sum(ldmBilledRows, (r) => r.qtyBilled)) : null,
      pallets, weight: Math.round(sum(rs, (r) => n(r.summary?.weight))),
      theoretical: r2(sum(rs, (r) => r.theoretical)), invoiced, gap,
      gapPct: theoreticalBoth ? (gap / theoreticalBoth) * 100 : null,
      flagged: rs.filter((r) => r.flag === 'over' || r.flag === 'under').length,
      costPerLdm: invoiced && ldmOfBilled ? r2(invoiced / ldmOfBilled) : null,
      costPerPallet: invoiced && palletsOfBilled ? r2(invoiced / palletsOfBilled) : null,
      fill: fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : null,
    };
  }).sort((a, b) => b.invoiced - a.invoiced || b.theoretical - a.theoretical);
}

// ---------------------------------------------------------------- Import de factures (CSV / copier-coller Excel)
export interface InvoiceLine { ref: string; amount: number; qty: number | null; invoice: string | null; line: number }

const norm = (h: string) => h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const COLS: Record<'ref' | 'amount' | 'qty' | 'invoice', RegExp> = {
  ref: /^(ref|reference|code|chargement|expedition|n\W{0,3}expedition|commande|external|wms|erp|bl|recepisse|n\W{0,3}recepisse)/,
  amount: /^(montant|amount|total|prix|ht|cout|net)/,
  qty: /^(qte|quantite|qty|mpl|ldm|metres? plancher|palettes?|unites?)/,
  invoice: /^(facture|invoice|n\W{0,3}facture|no\W{0,3}facture)/,
};
const toNum = (s: string) => {
  const t = s.replace(/[€\s ]/g, '');
  const v = t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,(?=\d{3}\b)/g, '');
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/** Lignes d'une facture transport : séparateur ; , ou tabulation, en-tête reconnu (référence, montant, quantité, n° facture). */
export function parseInvoiceCsv(text: string): { lines: InvoiceLine[]; errors: string[] } {
  const raw = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!raw.length) return { lines: [], errors: ['Fichier vide'] };
  const sep = raw[0].includes('\t') ? '\t' : raw[0].split(';').length >= raw[0].split(',').length ? ';' : ',';
  const split = (l: string) => l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
  const head = split(raw[0]).map(norm);
  const idx = Object.fromEntries((Object.keys(COLS) as (keyof typeof COLS)[]).map((k) => [k, head.findIndex((h) => COLS[k].test(h))])) as Record<keyof typeof COLS, number>;
  if (idx.ref < 0 || idx.amount < 0) return { lines: [], errors: ['Colonnes « Référence » et « Montant » introuvables dans l’en-tête.'] };
  const lines: InvoiceLine[] = []; const errors: string[] = [];
  raw.slice(1).forEach((l, i) => {
    const c = split(l);
    const ref = c[idx.ref] ?? ''; const amount = toNum(c[idx.amount] ?? '');
    if (!ref) return;
    if (amount == null) { errors.push(`Ligne ${i + 2} : montant illisible (${c[idx.amount] ?? ''})`); return; }
    lines.push({ ref, amount, qty: idx.qty >= 0 ? toNum(c[idx.qty] ?? '') : null, invoice: idx.invoice >= 0 ? (c[idx.invoice] || null) : null, line: i + 2 });
  });
  return { lines, errors };
}

/** Rapproche les lignes de facture des chargements (code CH-… ou référence WMS / ERP). */
export function matchInvoice(lines: InvoiceLine[], list: Pick<ControlShipment, 'id' | 'code' | 'external_id'>[]) {
  const key = (s: string) => s.trim().toUpperCase();
  const byKey = new Map<string, Pick<ControlShipment, 'id' | 'code' | 'external_id'>>();
  for (const s of list) { byKey.set(key(s.code), s); if (s.external_id) byKey.set(key(s.external_id), s); }
  const matched: { line: InvoiceLine; shipment: Pick<ControlShipment, 'id' | 'code' | 'external_id'> }[] = [];
  const unmatched: InvoiceLine[] = [];
  for (const l of lines) { const s = byKey.get(key(l.ref)); if (s) matched.push({ line: l, shipment: s }); else unmatched.push(l); }
  return { matched, unmatched };
}
