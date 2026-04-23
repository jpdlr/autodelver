import { describe, expect, it } from 'vitest';
import { createGrid, setTile } from './grid';
import { findPath } from './pathfind';

describe('findPath', () => {
  it('finds direct path in open grid', () => {
    const g = createGrid(10, 10);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) setTile(g, { x, y }, 'floor');
    const path = findPath(g, { x: 0, y: 0 }, { x: 5, y: 5 });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 5, y: 5 });
  });

  it('routes around walls', () => {
    const g = createGrid(5, 5);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) setTile(g, { x, y }, 'floor');
    setTile(g, { x: 2, y: 0 }, 'wall');
    setTile(g, { x: 2, y: 1 }, 'wall');
    setTile(g, { x: 2, y: 2 }, 'wall');
    setTile(g, { x: 2, y: 3 }, 'wall');
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    // Path must pass through y>=4 at some point
    expect(path!.some((p) => p.y >= 4)).toBe(true);
  });

  it('returns null when unreachable', () => {
    const g = createGrid(5, 5);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) setTile(g, { x, y }, 'floor');
    for (let y = 0; y < 5; y++) setTile(g, { x: 2, y }, 'wall');
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(path).toBeNull();
  });

  it('start === goal returns single-step path', () => {
    const g = createGrid(3, 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) setTile(g, { x, y }, 'floor');
    const path = findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 });
    expect(path).toEqual([{ x: 1, y: 1 }]);
  });
});
