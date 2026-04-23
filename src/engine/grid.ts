import type { Grid, Pos, TileKind } from './types';

export const TILE: Record<TileKind, number> = {
  wall: 0,
  floor: 1,
  door: 2,
  'stairs-down': 3,
};

const TILE_LOOKUP: TileKind[] = ['wall', 'floor', 'door', 'stairs-down'];

export function createGrid(width: number, height: number, fill: TileKind = 'wall'): Grid {
  const tiles = new Uint8Array(width * height);
  tiles.fill(TILE[fill]);
  return { width, height, tiles };
}

export function cloneGrid(g: Grid): Grid {
  return { width: g.width, height: g.height, tiles: new Uint8Array(g.tiles) };
}

export function inBounds(g: Grid, pos: Pos): boolean {
  return pos.x >= 0 && pos.x < g.width && pos.y >= 0 && pos.y < g.height;
}

export function getTile(g: Grid, pos: Pos): TileKind {
  if (!inBounds(g, pos)) return 'wall';
  return TILE_LOOKUP[g.tiles[pos.y * g.width + pos.x]];
}

export function setTile(g: Grid, pos: Pos, t: TileKind): void {
  if (!inBounds(g, pos)) return;
  g.tiles[pos.y * g.width + pos.x] = TILE[t];
}

export function isWalkable(g: Grid, pos: Pos): boolean {
  const t = getTile(g, pos);
  return t === 'floor' || t === 'door' || t === 'stairs-down';
}

export function posEq(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function distCheb(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function distManhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function neighbours(pos: Pos): Pos[] {
  return [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 },
  ];
}
