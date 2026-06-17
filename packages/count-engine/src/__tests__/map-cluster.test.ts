import { describe, it, expect } from 'vitest';
import { worldUnitsPerPixel, eps, zoomBand, gridCell, EARTH_CIRCUMFERENCE_M } from '../index';

describe('worldUnitsPerPixel', () => {
  it('z=0 → circumference / 512', () => {
    expect(worldUnitsPerPixel(0)).toBeCloseTo(EARTH_CIRCUMFERENCE_M / 512, 6);
  });
  it('halves each zoom level', () => {
    expect(worldUnitsPerPixel(1)).toBeCloseTo(worldUnitsPerPixel(0) / 2, 6);
    expect(worldUnitsPerPixel(10)).toBeCloseTo(worldUnitsPerPixel(9) / 2, 6);
  });
});

describe('eps', () => {
  it('scales with pixel radius', () => {
    expect(eps(10, 60)).toBeCloseTo(60 * worldUnitsPerPixel(10), 6);
    expect(eps(10, 120)).toBeCloseTo(2 * eps(10, 60), 6);
  });
  it('default radius is 60px', () => {
    expect(eps(12)).toBeCloseTo(60 * worldUnitsPerPixel(12), 6);
  });
});

describe('zoomBand', () => {
  it('z<8 grid, 8–14 dbscan, z>14 raw', () => {
    expect(zoomBand(0)).toBe('grid');
    expect(zoomBand(7)).toBe('grid');
    expect(zoomBand(8)).toBe('dbscan');
    expect(zoomBand(14)).toBe('dbscan');
    expect(zoomBand(15)).toBe('raw');
  });
});

describe('gridCell', () => {
  it('is coarser than eps', () => {
    expect(gridCell(5)).toBeGreaterThan(eps(5));
  });
});
