import type { Grid, Pos } from './types';
import { createGrid, setTile, inBounds } from './grid';
import { type Rng, rngInt } from './rng';

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

function roomCenter(r: Room): Pos {
  return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
}

function carveRoom(g: Grid, r: Room): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (inBounds(g, { x, y })) setTile(g, { x, y }, 'floor');
    }
  }
}

function carveCorridor(g: Grid, a: Pos, b: Pos, rng: Rng): void {
  let cur = { ...a };
  const horizFirst = rng() < 0.5;
  const steps: Array<'h' | 'v'> = horizFirst ? ['h', 'v'] : ['v', 'h'];
  for (const dir of steps) {
    if (dir === 'h') {
      while (cur.x !== b.x) {
        setTile(g, cur, 'floor');
        cur.x += cur.x < b.x ? 1 : -1;
      }
    } else {
      while (cur.y !== b.y) {
        setTile(g, cur, 'floor');
        cur.y += cur.y < b.y ? 1 : -1;
      }
    }
    setTile(g, cur, 'floor');
  }
}

export interface DungeonConfig {
  width: number;
  height: number;
  minRoomSize: number;
  maxRoomSize: number;
  roomAttempts: number;
}

const DEFAULT_CFG: DungeonConfig = {
  width: 48,
  height: 28,
  minRoomSize: 5,
  maxRoomSize: 9,
  roomAttempts: 16,
};

export interface DungeonResult {
  grid: Grid;
  rooms: Room[];
  entrance: Pos;
  stairs: Pos;
}

export function generateDungeon(rng: Rng, cfg: Partial<DungeonConfig> = {}): DungeonResult {
  const c = { ...DEFAULT_CFG, ...cfg };
  const grid = createGrid(c.width, c.height, 'wall');
  const rooms: Room[] = [];

  for (let i = 0; i < c.roomAttempts; i++) {
    const w = rngInt(rng, c.minRoomSize, c.maxRoomSize + 1);
    const h = rngInt(rng, c.minRoomSize, c.maxRoomSize + 1);
    const x = rngInt(rng, 1, c.width - w - 1);
    const y = rngInt(rng, 1, c.height - h - 1);
    const candidate: Room = { x, y, w, h };

    const overlap = rooms.some(
      (r) =>
        candidate.x < r.x + r.w + 1 &&
        candidate.x + candidate.w + 1 > r.x &&
        candidate.y < r.y + r.h + 1 &&
        candidate.y + candidate.h + 1 > r.y,
    );
    if (overlap) continue;

    carveRoom(grid, candidate);
    if (rooms.length > 0) {
      const prev = rooms[rooms.length - 1];
      carveCorridor(grid, roomCenter(prev), roomCenter(candidate), rng);
    }
    rooms.push(candidate);
  }

  if (rooms.length < 2) {
    // Fallback: one big room
    const fallback: Room = {
      x: 2,
      y: 2,
      w: c.width - 4,
      h: c.height - 4,
    };
    carveRoom(grid, fallback);
    rooms.push(fallback);
  }

  const entrance = roomCenter(rooms[0]);
  const stairsRoom = rooms[rooms.length - 1];
  const stairs = roomCenter(stairsRoom);
  setTile(grid, stairs, 'stairs-down');

  return { grid, rooms, entrance, stairs };
}

export function pickSpawnsInRooms(
  rooms: Room[],
  rng: Rng,
  count: number,
  exclude: Pos[] = [],
): Pos[] {
  const picks: Pos[] = [];
  const excludeKeys = new Set(exclude.map((p) => `${p.x},${p.y}`));
  const candidates: Pos[] = [];
  // Skip first room (entrance), spread through the rest
  for (let i = 1; i < rooms.length; i++) {
    const r = rooms[i];
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const key = `${x},${y}`;
        if (!excludeKeys.has(key)) candidates.push({ x, y });
      }
    }
  }
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const idx = rngInt(rng, 0, candidates.length);
    picks.push(candidates.splice(idx, 1)[0]);
  }
  return picks;
}
