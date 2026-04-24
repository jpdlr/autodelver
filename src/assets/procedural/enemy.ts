import type { EnemyArchetype } from '../../engine/types';
import { sfc32, rngInt, rngPick } from '../../engine/rng';

/**
 * Procedural enemy SVG generator.
 * Each enemy has an archetype (base silhouette) and a seed (unique details).
 * Deeper floors produce "corrupted" variants with more eyes/limbs/glitch.
 */
export interface GenerateOpts {
  archetype: EnemyArchetype;
  seed: number;
  depth: number;
  size: number;
}

export function generateEnemySvg(opts: GenerateOpts): string {
  const rng = sfc32(`${opts.archetype}:${opts.seed}`);
  const corruption = Math.min(1, opts.depth * 0.04);
  const eyes = 1 + rngInt(rng, 0, 3) + (rng() < corruption ? rngInt(rng, 0, 3) : 0);
  const limbs = rngPick(rng, [2, 2, 4, 4, 6, 8]);

  const body = bodyPath(opts.archetype, rng, corruption);
  const eyeDots = Array.from({ length: eyes }).map(() => {
    const cx = 4 + rng() * 8;
    const cy = 5 + rng() * 5;
    const r = 0.8 + rng() * 0.5;
    return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="#fff"/><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(r * 0.45).toFixed(2)}" fill="#0a0a0a"/>`;
  }).join('');

  const limbMarks = Array.from({ length: limbs }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / limbs + rng() * 0.3;
    const r1 = 4.5;
    const r2 = 6 + rng() * 1.2;
    const cx = 8;
    const cy = 9;
    const x1 = cx + Math.cos(angle) * r1;
    const y1 = cy + Math.sin(angle) * r1;
    const x2 = cx + Math.cos(angle) * r2;
    const y2 = cy + Math.sin(angle) * r2;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/>`;
  }).join('');

  // Glitch artifacts at high corruption
  let glitch = '';
  if (rng() < corruption) {
    const gx = rngInt(rng, 2, 14);
    const gy = rngInt(rng, 2, 14);
    glitch = `<rect x="${gx}" y="${gy}" width="${1 + rngInt(rng, 0, 3)}" height="1" fill="#d05e4a" opacity="0.7"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${opts.size}" height="${opts.size}">
    ${limbMarks}
    <path d="${body}" fill="currentColor" stroke="rgba(0,0,0,0.25)" stroke-width="0.3"/>
    ${eyeDots}
    ${glitch}
  </svg>`;
}

function bodyPath(archetype: EnemyArchetype, rng: () => number, corruption: number): string {
  const wobble = (base: number) => (base + (rng() - 0.5) * corruption * 1.5).toFixed(2);
  switch (archetype) {
    case 'slime':
      return `M 3 ${wobble(11)} C 3 ${wobble(6)}, 13 ${wobble(6)}, 13 ${wobble(11)} C 13 ${wobble(14)}, 3 ${wobble(14)}, 3 ${wobble(11)} Z`;
    case 'goblin':
      return `M 4 ${wobble(4)} L ${wobble(8)} ${wobble(2)} L 12 ${wobble(4)} L 13 ${wobble(12)} L 8 ${wobble(14)} L 3 ${wobble(12)} Z`;
    case 'wraith':
      return `M 4 ${wobble(3)} L 12 ${wobble(3)} L ${wobble(14)} 8 L ${wobble(13)} ${wobble(13)} L ${wobble(10)} ${wobble(12)} L 8 ${wobble(14)} L ${wobble(6)} ${wobble(12)} L ${wobble(3)} ${wobble(13)} L ${wobble(2)} 8 Z`;
    case 'brute':
      // Squat hulking silhouette with broad shoulders.
      return `M ${wobble(2)} ${wobble(6)} L ${wobble(4)} ${wobble(3)} L ${wobble(12)} ${wobble(3)} L ${wobble(14)} ${wobble(6)} L ${wobble(14)} ${wobble(13)} L ${wobble(10)} ${wobble(14)} L ${wobble(6)} ${wobble(14)} L ${wobble(2)} ${wobble(13)} Z`;
    case 'lich':
      // Tall, narrow, crowned — tapered head, flaring robe.
      return `M ${wobble(7)} ${wobble(2)} L ${wobble(9)} ${wobble(2)} L ${wobble(11)} ${wobble(5)} L ${wobble(13)} ${wobble(10)} L ${wobble(14)} ${wobble(14)} L ${wobble(8)} ${wobble(13)} L ${wobble(2)} ${wobble(14)} L ${wobble(3)} ${wobble(10)} L ${wobble(5)} ${wobble(5)} Z`;
  }
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
