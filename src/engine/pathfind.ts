import type { Grid, Pos } from './types';
import { inBounds, isWalkable, posEq, neighbours, distManhattan } from './grid';

/**
 * A* pathfinding on a 4-connected grid.
 * Returns path from start→goal (inclusive) or null if unreachable.
 * Deterministic: tie-breaking by consistent ordering, no PRNG use.
 */
export function findPath(
  grid: Grid,
  start: Pos,
  goal: Pos,
  blocked: Set<string> = new Set(),
  maxExpansions = 2000,
): Pos[] | null {
  if (posEq(start, goal)) return [start];
  if (!inBounds(grid, goal) || !isWalkable(grid, goal)) return null;

  const key = (p: Pos) => `${p.x},${p.y}`;
  const open: Array<{ pos: Pos; g: number; f: number }> = [
    { pos: start, g: 0, f: distManhattan(start, goal) },
  ];
  const cameFrom = new Map<string, Pos>();
  const gScore = new Map<string, number>([[key(start), 0]]);
  const closed = new Set<string>();

  let expansions = 0;
  while (open.length > 0 && expansions < maxExpansions) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const curKey = key(current.pos);

    if (posEq(current.pos, goal)) {
      const path: Pos[] = [current.pos];
      let c: Pos | undefined = current.pos;
      while (c && !posEq(c, start)) {
        c = cameFrom.get(key(c));
        if (c) path.push(c);
      }
      return path.reverse();
    }

    closed.add(curKey);
    expansions++;

    for (const n of neighbours(current.pos)) {
      const nKey = key(n);
      if (closed.has(nKey)) continue;
      if (!inBounds(grid, n) || !isWalkable(grid, n)) continue;
      if (blocked.has(nKey) && !posEq(n, goal)) continue;

      const tentativeG = current.g + 1;
      const prev = gScore.get(nKey);
      if (prev !== undefined && tentativeG >= prev) continue;

      cameFrom.set(nKey, current.pos);
      gScore.set(nKey, tentativeG);
      const f = tentativeG + distManhattan(n, goal);
      open.push({ pos: n, g: tentativeG, f });
    }
  }
  return null;
}
