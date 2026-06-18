import { describe, it, expect } from 'vitest';
import {
  worldUnitsPerPixel,
  eps,
  zoomBand,
  gridCell,
  tileSizeMeters,
  snapBboxToTileGrid,
  EARTH_CIRCUMFERENCE_M,
} from '../index';

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

describe('tileSizeMeters', () => {
  it('halves each zoom level', () => {
    expect(tileSizeMeters(1)).toBeCloseTo(tileSizeMeters(0) / 2, 6);
    expect(tileSizeMeters(10)).toBeCloseTo(tileSizeMeters(9) / 2, 6);
  });
});

describe('snapBboxToTileGrid', () => {
  it('expands bbox outward to tile boundaries', () => {
    const cell = tileSizeMeters(4);
    const bbox: [number, number, number, number] = [
      cell * 1.2,
      cell * 2.3,
      cell * 3.7,
      cell * 4.8,
    ];
    const snapped = snapBboxToTileGrid(bbox, 4);
    expect(snapped[0]).toBe(cell);
    expect(snapped[1]).toBe(cell * 2);
    expect(snapped[2]).toBe(cell * 4);
    expect(snapped[3]).toBe(cell * 5);
    expect(snapped[0]).toBeLessThanOrEqual(bbox[0]);
    expect(snapped[1]).toBeLessThanOrEqual(bbox[1]);
    expect(snapped[2]).toBeGreaterThanOrEqual(bbox[2]);
    expect(snapped[3]).toBeGreaterThanOrEqual(bbox[3]);
  });

  it('is idempotent on aligned bboxes', () => {
    const cell = tileSizeMeters(6);
    const aligned: [number, number, number, number] = [0, cell, cell * 3, cell * 4];
    expect(snapBboxToTileGrid(aligned, 6)).toEqual(aligned);
  });
});
