// Procedural SVG asset generator — inspired by daemon-delve.
// Produces 64x64 hand-drawn-style sprites with a cohesive palette,
// ink outlines, ground shadows, and flat fills. Outputs files into
// public/assets/generated/ and a single TS module at src/ui/sprites.ts
// that exports the raw SVG strings for inline use.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public", "assets", "generated");
const tsOutFile = join(root, "src", "ui", "sprites.ts");

const palette = {
  ink: "#20242a",
  line: "#343a42",
  softLine: "#6e7784",
  paper: "#f4f1e9",
  stone: "#b9b3a7",
  stoneDark: "#777067",
  steel: "#87909a",
  steelDark: "#5d6670",
  gold: "#d6a843",
  ember: "#c9653b",
  blood: "#9e3d43",
  moss: "#5f8f73",
  mint: "#8ec9a6",
  teal: "#4d9aa0",
  slate: "#2f4858",
  blue: "#5f84b8",
  violet: "#8a6fb0",
  plum: "#5e496c",
  bone: "#ded6c4",
  shadow: "#00000024",
};

const svg = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img">
  <rect width="64" height="64" fill="none"/>
  <g shape-rendering="geometricPrecision" stroke-linecap="round" stroke-linejoin="round">
${body}
  </g>
</svg>
`;

const shadow = () => `    <ellipse cx="32" cy="54" rx="16" ry="5" fill="${palette.shadow}" stroke="none"/>`;
const stroke = `stroke="${palette.line}" stroke-width="2.4"`;
const strokeThin = `stroke="${palette.line}" stroke-width="1.6"`;

// Hero body template: robe/armor silhouette + helm/hood + weapon slot + accent sigil
const hero = ({ armor, accent, helm, weapon, mark }) => svg(`
${shadow()}
    <path d="M19 30c0-10 5-18 13-18s13 8 13 18v10c0 8-5 13-13 13s-13-5-13-13z" fill="${armor}" ${stroke}/>
    <path d="M21 30h24v9c0 6-5 10-12 10s-12-4-12-10z" fill="${palette.paper}" opacity=".15" stroke="none"/>
    <path d="M21 27c2-8 6-13 11-13s9 5 11 13H21z" fill="${helm}" ${stroke}/>
    <circle cx="27" cy="32" r="1.8" fill="${palette.ink}"/>
    <circle cx="37" cy="32" r="1.8" fill="${palette.ink}"/>
    <path d="M28 37h8" ${strokeThin} fill="none"/>
${weapon}
    <path d="${mark}" fill="${accent}" stroke="${palette.line}" stroke-width="1.2"/>
`);

const enemy = ({ body, fill, eyes = [27, 32, 37, 32], mouth = "M26 40c4 3 8 3 12 0", extra = "" }) => svg(`
${shadow()}
    <path d="${body}" fill="${fill}" ${stroke}/>
${extra}
    <circle cx="${eyes[0]}" cy="${eyes[1]}" r="2" fill="${palette.paper}"/>
    <circle cx="${eyes[2]}" cy="${eyes[3]}" r="2" fill="${palette.paper}"/>
    <circle cx="${eyes[0]}" cy="${eyes[1] + 0.3}" r="0.8" fill="${palette.ink}"/>
    <circle cx="${eyes[2]}" cy="${eyes[3] + 0.3}" r="0.8" fill="${palette.ink}"/>
    <path d="${mouth}" ${strokeThin} fill="none"/>
`);

const tile = ({ base, detail }) => svg(`
    <rect x="6" y="6" width="52" height="52" rx="6" fill="${base}" ${stroke}/>
${detail}
`);

const item = ({ body }) => svg(`
${shadow()}
${body}
`);

const assets = [
  // ------ HEROES ------
  {
    type: "heroes",
    id: "grimm-warrior",
    name: "Grimm",
    tags: ["hero", "warrior", "tank"],
    svg: hero({
      armor: palette.slate,
      accent: palette.gold,
      helm: palette.steelDark,
      weapon: `    <path d="M49 18l3 3-18 18-3-3z" fill="${palette.steel}" ${stroke}/>
    <path d="M47 24l-6-6" stroke="${palette.line}" stroke-width="2.2"/>
    <path d="M11 40l-4 3 3 4 4-3z" fill="${palette.steel}" ${stroke}/>`,
      mark: "M30 21l2-4 2 4-2 3z",
    }),
  },
  {
    type: "heroes",
    id: "vex-ranger",
    name: "Vex",
    tags: ["hero", "ranger", "dps"],
    svg: hero({
      armor: palette.moss,
      accent: palette.mint,
      helm: palette.plum,
      weapon: `    <path d="M50 14c-4 6-4 22 0 34" fill="none" stroke="${palette.line}" stroke-width="2.4"/>
    <path d="M50 14l0 34" stroke="${palette.bone}" stroke-width="1"/>
    <path d="M50 30l6 0M44 30l-4 0" ${strokeThin} fill="none"/>`,
      mark: "M28 20h8l-4 5z",
    }),
  },
  {
    type: "heroes",
    id: "mira-cleric",
    name: "Mira",
    tags: ["hero", "cleric", "support"],
    svg: hero({
      armor: palette.violet,
      accent: palette.bone,
      helm: palette.plum,
      weapon: `    <path d="M49 15v28" stroke="${palette.steelDark}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="49" cy="13" r="4" fill="${palette.gold}" ${strokeThin}/>
    <path d="M46 13h6M49 10v6" stroke="${palette.ink}" stroke-width="1.2"/>`,
      mark: "M29 20h6v6h-6z",
    }),
  },

  // ------ ENEMIES ------
  {
    type: "enemies",
    id: "slime",
    name: "Slime",
    tags: ["enemy", "blob"],
    svg: enemy({
      body: "M12 44c0-12 8-20 20-20s20 8 20 20c0 4-2 6-6 6H18c-4 0-6-2-6-6z",
      fill: palette.moss,
      eyes: [26, 38, 38, 38],
      mouth: "M27 44c3 2 7 2 10 0",
    }),
  },
  {
    type: "enemies",
    id: "skitter",
    name: "Skitter",
    tags: ["enemy", "bug"],
    svg: enemy({
      body: "M14 38c4-12 10-18 18-18s14 6 18 18c-5 8-11 12-18 12s-13-4-18-12z",
      fill: palette.ember,
      eyes: [27, 34, 37, 34],
      extra: `    <path d="M18 32L8 26M46 32l10-6M20 44l-10 5M44 44l10 5" ${strokeThin} fill="none"/>`,
    }),
  },
  {
    type: "enemies",
    id: "brute",
    name: "Brute",
    tags: ["enemy", "frontline"],
    svg: enemy({
      body: "M16 34c0-12 7-21 16-21s16 9 16 21c0 11-7 18-16 18s-16-7-16-18z",
      fill: palette.blood,
      eyes: [27, 30, 37, 30],
      extra: `    <path d="M22 17l-3-6M42 17l3-6" ${strokeThin} fill="none"/>`,
    }),
  },
  {
    type: "enemies",
    id: "wraith",
    name: "Wraith",
    tags: ["enemy", "caster"],
    svg: enemy({
      body: "M18 16c4-4 9-6 14-6s10 2 14 6l-2 30-4-4-3 6-3-6-2 6-3-6-3 6-4-6-2 4z",
      fill: palette.plum,
      eyes: [27, 24, 37, 24],
      mouth: "M28 32c3 2 5 2 8 0",
    }),
  },
  {
    type: "enemies",
    id: "lich",
    name: "Lich",
    tags: ["enemy", "undead"],
    svg: enemy({
      body: "M14 22c0-8 8-14 18-14s18 6 18 14l-3 24c-4 4-9 6-15 6s-11-2-15-6z",
      fill: palette.stoneDark,
      eyes: [27, 24, 37, 24],
      mouth: "M26 36l3 3 3-3 3 3 3-3",
      extra: `    <path d="M22 12l-3-6M42 12l3-6M32 6v-4" ${strokeThin} fill="none"/>`,
    }),
  },

  // ------ TILES ------
  {
    type: "tiles",
    id: "floor",
    name: "Floor",
    tags: ["tile"],
    svg: tile({
      base: palette.stone,
      detail: `    <path d="M7 24h50M24 7v50M42 7v50M7 42h50" stroke="${palette.stoneDark}" stroke-width="1.2" fill="none" opacity=".5"/>`,
    }),
  },
  {
    type: "tiles",
    id: "wall",
    name: "Wall",
    tags: ["tile"],
    svg: tile({
      base: palette.stoneDark,
      detail: `    <path d="M8 19h48M8 35h48M8 51h48M22 7v12M42 19v16M26 35v16" stroke="${palette.stone}" stroke-width="1.5" fill="none" opacity=".7"/>`,
    }),
  },
  {
    type: "tiles",
    id: "stairs",
    name: "Stairs",
    tags: ["tile", "descent"],
    svg: tile({
      base: palette.plum,
      detail: `    <path d="M14 46h36v6H14z" fill="${palette.ink}" ${strokeThin}/>
    <path d="M20 40h30v6H20z" fill="${palette.stoneDark}" ${strokeThin}/>
    <path d="M26 34h24v6H26z" fill="${palette.stone}" ${strokeThin}/>
    <path d="M32 28h18v6H32z" fill="${palette.bone}" ${strokeThin}/>
    <path d="M38 22h12v6H38z" fill="${palette.paper}" ${strokeThin}/>`,
    }),
  },
  {
    type: "tiles",
    id: "shrine",
    name: "Shrine",
    tags: ["tile", "rest"],
    svg: tile({
      base: palette.stone,
      detail: `    <path d="M20 47h24M24 47V28l8-12 8 12v19" fill="${palette.bone}" ${strokeThin}/>
    <path d="M32 25v14M25 32h14" ${strokeThin} fill="none"/>`,
    }),
  },

  // ------ ITEMS (for atmosphere layer) ------
  {
    type: "items",
    id: "sword",
    name: "Sword",
    tags: ["weapon"],
    svg: item({
      body: `    <path d="M32 8l4 32-4 8-4-8z" fill="${palette.steel}" ${stroke}/>
    <path d="M22 38h20" stroke="${palette.gold}" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 44h4v8h-4z" fill="${palette.plum}" ${strokeThin}/>`,
    }),
  },
  {
    type: "items",
    id: "bow",
    name: "Bow",
    tags: ["weapon"],
    svg: item({
      body: `    <path d="M18 12C34 20 34 44 18 52" fill="none" stroke="${palette.line}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M18 12L18 52" stroke="${palette.bone}" stroke-width="1"/>
    <path d="M34 32l12 0" stroke="${palette.line}" stroke-width="2" stroke-linecap="round"/>
    <path d="M42 28l6 4-6 4" fill="${palette.ember}" ${strokeThin}/>`,
    }),
  },
  {
    type: "items",
    id: "staff",
    name: "Staff",
    tags: ["weapon"],
    svg: item({
      body: `    <path d="M32 16v36" stroke="${palette.steelDark}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="14" r="6" fill="${palette.gold}" ${stroke}/>
    <path d="M28 14h8M32 10v8" stroke="${palette.ink}" stroke-width="1.4"/>`,
    }),
  },
  {
    type: "items",
    id: "potion",
    name: "Potion",
    tags: ["consumable"],
    svg: item({
      body: `    <path d="M26 12h12v8M26 20c-4 4-6 10-6 16s4 12 12 12 12-6 12-12-2-12-6-16" fill="${palette.mint}" ${stroke}/>
    <path d="M22 14h20" stroke="${palette.line}" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="32" cy="38" rx="6" ry="4" fill="${palette.paper}" opacity=".4"/>`,
    }),
  },
  {
    type: "items",
    id: "gem",
    name: "Gem",
    tags: ["loot"],
    svg: item({
      body: `    <path d="M20 26l12-14 12 14L32 52z" fill="${palette.teal}" ${stroke}/>
    <path d="M20 26h24M26 26l6-14M38 26l-6-14M26 26l6 12M38 26l-6 12" stroke="${palette.line}" stroke-width="1.2" fill="none" opacity=".7"/>`,
    }),
  },
  {
    type: "items",
    id: "skull",
    name: "Skull",
    tags: ["macabre"],
    svg: item({
      body: `    <path d="M16 26c0-10 7-16 16-16s16 6 16 16v10c0 4-3 6-6 6l-2 6h-16l-2-6c-3 0-6-2-6-6z" fill="${palette.bone}" ${stroke}/>
    <circle cx="25" cy="30" r="3" fill="${palette.ink}"/>
    <circle cx="39" cy="30" r="3" fill="${palette.ink}"/>
    <path d="M29 40l3-3 3 3" stroke="${palette.line}" stroke-width="1.6" fill="none"/>
    <path d="M26 48h12" stroke="${palette.line}" stroke-width="1.4"/>`,
    }),
  },
  {
    type: "items",
    id: "scroll",
    name: "Scroll",
    tags: ["lore"],
    svg: item({
      body: `    <rect x="12" y="18" width="40" height="28" rx="2" fill="${palette.paper}" ${stroke}/>
    <path d="M10 18c4 0 4 4 4 14s0 14-4 14c6-2 6-10 6-14s0-12-6-14z" fill="${palette.bone}" ${strokeThin}/>
    <path d="M54 18c-4 0-4 4-4 14s0 14 4 14c-6-2-6-10-6-14s0-12 6-14z" fill="${palette.bone}" ${strokeThin}/>
    <path d="M18 26h28M18 32h22M18 38h26" stroke="${palette.softLine}" stroke-width="1.2" fill="none"/>`,
    }),
  },
  {
    type: "items",
    id: "key",
    name: "Key",
    tags: ["unlock"],
    svg: item({
      body: `    <circle cx="22" cy="32" r="10" fill="none" ${stroke}/>
    <circle cx="22" cy="32" r="3" fill="${palette.ink}"/>
    <path d="M32 32h22M48 32v6M52 32v4" stroke="${palette.line}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    }),
  },
  {
    type: "items",
    id: "coin",
    name: "Coin",
    tags: ["loot"],
    svg: item({
      body: `    <circle cx="32" cy="32" r="16" fill="${palette.gold}" ${stroke}/>
    <circle cx="32" cy="32" r="11" fill="none" stroke="${palette.line}" stroke-width="1"/>
    <path d="M28 24l4 16 4-16" stroke="${palette.line}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    }),
  },
];

for (const a of assets) {
  const dir = join(publicDir, a.type);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${a.id}.svg`), a.svg, "utf8");
}

const manifest = {
  name: "AutoDelver Procedural Asset Set",
  version: 1,
  generatedBy: "tools/generate-assets.mjs",
  palette,
  assets: assets.map(({ svg: _s, ...rest }) => ({
    ...rest,
    file: `${rest.type}/${rest.id}.svg`,
    path: `/assets/generated/${rest.type}/${rest.id}.svg`,
  })),
};
writeFileSync(join(publicDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const tsBody = `// GENERATED by tools/generate-assets.mjs — do not edit by hand.
// Run \`node tools/generate-assets.mjs\` to regenerate.

export const palette = ${JSON.stringify(palette, null, 2)} as const;

export type SpriteId =
${assets.map((a) => `  | '${a.id}'`).join("\n")};

export type SpriteEntry = {
  id: SpriteId;
  type: string;
  name: string;
  tags: readonly string[];
  url: string;
  svg: string;
};

export const sprites: Record<SpriteId, SpriteEntry> = {
${assets
  .map(
    (a) => `  '${a.id}': {
    id: '${a.id}',
    type: '${a.type}',
    name: ${JSON.stringify(a.name)},
    tags: ${JSON.stringify(a.tags)} as const,
    url: '/assets/generated/${a.type}/${a.id}.svg',
    svg: ${JSON.stringify(a.svg)},
  },`
  )
  .join("\n")}
};

export function spriteById(id: SpriteId): SpriteEntry {
  return sprites[id];
}
`;

mkdirSync(dirname(tsOutFile), { recursive: true });
writeFileSync(tsOutFile, tsBody, "utf8");

console.log(`Generated ${assets.length} assets → ${publicDir}`);
console.log(`Wrote TS module → ${tsOutFile}`);
