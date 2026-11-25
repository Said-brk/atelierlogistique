import { describe, it, expect } from 'vitest';
import { controlRows, carrierStats, parseInvoiceCsv, matchInvoice } from './control';

const base = { label: null, external_id: null, departure_at: '2026-11-10', tour: null, status: 'loaded', invoice_ref: null, invoiced_qty: null };
const list = [
  { ...base, id: '1', code: 'CH-1', carrier: 'GEO', carrier_cost: 1000, carrier_quote: { basis: 'ldm' }, invoiced_amount: 1100, invoiced_qty: 7, summary: { ldm: 6.4, packed: 16, weight: 7000, fill: 0.5 } },
  { ...base, id: '2', code: 'CH-2', carrier: 'GEO', carrier_cost: 500, carrier_quote: { basis: 'ldm' }, invoiced_amount: 505, summary: { ldm: 3, packed: 8, weight: 3000, fill: 0.7 } },
  { ...base, id: '3', code: 'CH-3', carrier: 'GEO', carrier_cost: 400, carrier_quote: null, invoiced_amount: null, summary: { ldm: 2, packed: 4, weight: 1000, fill: 0.3 } },
] as any;

describe('contrôle transport', () => {
  it('écart et tolérance', () => {
    const r = controlRows(list, 3);
    expect(r.map((x) => x.flag)).toEqual(['over', 'ok', 'missing']);
    expect(r[0].gap).toBe(100); expect(r[0].gapPct).toBeCloseTo(10);
  });
  it('synthèse par transporteur', () => {
    const [g] = carrierStats(controlRows(list, 3));
    expect(g.shipments).toBe(3); expect(g.invoicedCount).toBe(2);
    expect(g.invoiced).toBe(1605); expect(g.gap).toBe(105); expect(g.gapPct).toBeCloseTo(7);
    expect(g.flagged).toBe(1); expect(g.ldmBilled).toBe(7);
    expect(g.costPerLdm).toBeCloseTo(1605 / 9.4, 1);
  });
  it('import CSV : en-têtes variés, virgule décimale, rapprochement code / réf. WMS', () => {
    const { lines, errors } = parseInvoiceCsv('N° expédition;Montant HT;MPL;N° facture\nCH-1;1 100,50;7;F-001\nEXP9;250;;F-001\nXX;abc;;');
    expect(errors).toHaveLength(1);
    expect(lines[0]).toMatchObject({ ref: 'CH-1', amount: 1100.5, qty: 7, invoice: 'F-001' });
    const m = matchInvoice(lines, [{ id: '1', code: 'CH-1', external_id: null }, { id: '9', code: 'CH-9', external_id: 'exp9' }]);
    expect(m.matched.map((x) => x.shipment.id)).toEqual(['1', '9']);
    expect(parseInvoiceCsv('a,b\n1,2').errors[0]).toMatch(/introuvables/);
  });
});
