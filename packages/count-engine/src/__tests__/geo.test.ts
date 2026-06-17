import { describe, it, expect } from 'vitest';
import { mercatorToLonLat, lonLatToMercator, parsePoint3857, toPoint3857Wkt } from '../index';

describe('mercatorToLonLat', () => {
  it('origin → (0, 0)', () => {
    const { lon, lat } = mercatorToLonLat(0, 0);
    expect(lon).toBeCloseTo(0, 6);
    expect(lat).toBeCloseTo(0, 6);
  });

  it('(3489000, 6757000) → ~31.34E, ~51.76N', () => {
    const { lon, lat } = mercatorToLonLat(3489000, 6757000);
    expect(lon).toBeCloseTo(31.34, 1);
    expect(lat).toBeCloseTo(51.76, 1);
  });
});

describe('lonLatToMercator round-trip', () => {
  it('forward then inverse recovers lon/lat', () => {
    for (const [lon, lat] of [[31.34, 50.4], [-0.13, 51.5], [139.7, 35.7], [0, 0]]) {
      const { x, y } = lonLatToMercator(lon, lat);
      const back = mercatorToLonLat(x, y);
      expect(back.lon).toBeCloseTo(lon, 4);
      expect(back.lat).toBeCloseTo(lat, 4);
    }
  });

  it('toPoint3857Wkt emits a parseable POINT near origin', () => {
    const wkt = toPoint3857Wkt(0, 0);
    expect(wkt).toMatch(/^POINT\(/);
    const back = parsePoint3857(wkt)!;
    expect(back.lon).toBeCloseTo(0, 3);
    expect(back.lat).toBeCloseTo(0, 3);
  });
});

describe('parsePoint3857', () => {
  it('parses POINT(x y)', () => {
    const r = parsePoint3857('POINT(0 0)');
    expect(r).not.toBeNull();
    expect(r!.lon).toBeCloseTo(0, 6);
  });

  it('parses bare "x y"', () => {
    const r = parsePoint3857('3489000 6757000');
    expect(r).not.toBeNull();
    expect(r!.lat).toBeCloseTo(51.76, 1);
  });

  it('returns null on garbage', () => {
    expect(parsePoint3857('not a point')).toBeNull();
    expect(parsePoint3857('')).toBeNull();
  });
});
