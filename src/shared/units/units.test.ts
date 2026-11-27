import { describe, it, expect, afterEach } from 'vitest';
import { setUnits, prefsOf, defaultUnits, cmToDim, dimToCm, fmtWeight, fmtVolume, fmtMoney, currencySymbol, fmtLength } from './units';
import { setCurrentLang } from '../i18n/core';

afterEach(() => { setUnits({ units: 'metric', currency: 'EUR' }); setCurrentLang('fr'); });

describe('devise et unités', () => {
  it('défauts selon la langue', () => {
    expect(defaultUnits('en')).toEqual({ units: 'imperial', currency: 'USD' });
    expect(defaultUnits('fr')).toEqual({ units: 'metric', currency: 'EUR' });
    expect(prefsOf({ units: 'metric', currency: 'GBP' }, 'en')).toEqual({ units: 'metric', currency: 'GBP' });
    expect(prefsOf({}, 'en')).toEqual({ units: 'imperial', currency: 'USD' });
    expect(prefsOf({ units: 'xx', currency: 'euro' }, 'fr')).toEqual({ units: 'metric', currency: 'EUR' });
  });
  it('métrique : rien ne change', () => {
    expect(cmToDim(120)).toBe(120);
    expect(fmtWeight(520)).toBe('520 kg');
    expect(fmtVolume(31.62)).toBe('31,6 m³');
  });
  it('US : pouces, livres, pieds cubes, pieds', () => {
    setCurrentLang('en');
    setUnits({ units: 'imperial', currency: 'USD' });
    expect(cmToDim(120)).toBe(47.24);
    expect(dimToCm(48)).toBeCloseTo(121.92, 2);
    expect(fmtWeight(1000)).toBe('2,205 lb');
    expect(fmtVolume(1)).toBe('35.3 ft³');
    expect(fmtLength(13.6, 1)).toBe('44.6 ft');
    expect(fmtMoney(1234.5)).toBe('$1,234.5');
    expect(currencySymbol()).toBe('$');
  });
  it('devise en français', () => {
    setUnits({ units: 'metric', currency: 'EUR' });
    expect(fmtMoney(685.4)).toBe('685,4 €');
    expect(currencySymbol('GBP')).toBe('£');
  });
});

describe('saisie de nombres', () => {
  it('formats français et US', async () => {
    const { parseNumber } = await import('./units');
    expect(parseNumber('1 234,50 €')).toBe(1234.5);
    expect(parseNumber('$1,234.50')).toBe(1234.5);
    expect(parseNumber('685,4')).toBe(685.4);
    expect(parseNumber('')).toBe(null);
  });
});
