import { describe, expect, it } from 'vitest';
import { createGrid, setTile, getTile, isWalkable, inBounds, distCheb, distManhattan, posEq } from './grid';

describe('grid', () => {
  it('creates wall-filled grid by default', () => {
    const g = createGrid(4, 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(getTile(g, { x, y })).toBe('wall');
      }
    }
  });

  it('sets and reads tiles', () => {
    const g = createGrid(4, 4);
    setTile(g, { x: 1, y: 2 }, 'floor');
    expect(getTile(g, { x: 1, y: 2 })).toBe('floor');
    expect(isWalkable(g, { x: 1, y: 2 })).toBe(true);
  });

  it('walls are not walkable', () => {
    const g = createGrid(3, 3);
    expect(isWalkable(g, { x: 0, y: 0 })).toBe(false);
  });

  it('stairs are walkable', () => {
    const g = createGrid(3, 3);
    setTile(g, { x: 1, y: 1 }, 'stairs-down');
    expect(isWalkable(g, { x: 1, y: 1 })).toBe(true);
  });

  it('out-of-bounds returns wall', () => {
    const g = createGrid(3, 3);
    expect(inBounds(g, { x: -1, y: 0 })).toBe(false);
    expect(getTile(g, { x: -1, y: 0 })).toBe('wall');
  });

  it('distCheb / distManhattan', () => {
    expect(distCheb({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
    expect(distManhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
  });

  it('posEq', () => {
    expect(posEq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(posEq({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
  });
});
