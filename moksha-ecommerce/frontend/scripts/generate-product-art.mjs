/**
 * Generates the catalogue's product artwork as SVG files into `public/products/`.
 *
 *     node scripts/generate-product-art.mjs
 *
 * **Why illustrated rather than photographed.** The obvious alternative is to
 * hotlink stock photos. That was the first attempt and it was worse in three
 * ways: the demo gains a hard dependency on a third-party image host (which
 * rate-limits, and blocks hotlinking), the images load slowly over a cold
 * connection at exactly the moment a reviewer first opens the site, and — the
 * one that actually decided it — searching a stock library for twelve specific
 * haircare products returns twelve photos of *approximately* the right thing.
 * A wide-tooth comb illustrated by a perfume bottle is worse than no photo.
 *
 * These render from the same token palette as the rest of the interface, so the
 * catalogue reads as one brand rather than as twelve unrelated photographs.
 * They are a few hundred bytes each, need no CDN, and cannot 404.
 *
 * Committed to the repository as generated output. The script exists so they
 * are reproducible and reviewable, not so they are rebuilt on every install.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../public/products");

/** Ground tints, drawn from the same warm neutral family as `--paper`. */
const GROUNDS = {
  cleanse: ["#EDF1EE", "#DCE6E0"],
  condition: ["#F0EEE8", "#E3DED2"],
  treatment: ["#EFEAE3", "#E2D8C9"],
  style: ["#ECEEF0", "#DCE1E6"],
  protect: ["#F1EDE9", "#E5DCD4"],
  accessory: ["#EDEBE7", "#DFDBD3"],
};

const INK = "#1f5a45";
const LABEL = "#faf8f5";

/** A tall pump bottle — shampoo, conditioner. */
function bottle(fill, accent) {
  return `
    <rect x="300" y="300" width="200" height="480" rx="26" fill="${fill}"/>
    <rect x="300" y="300" width="200" height="480" rx="26" fill="url(#sheen)"/>
    <rect x="352" y="236" width="96" height="70" rx="12" fill="${accent}"/>
    <rect x="368" y="196" width="64" height="48" rx="10" fill="${accent}"/>
    <rect x="330" y="470" width="140" height="150" rx="8" fill="${LABEL}" opacity="0.94"/>
    <rect x="352" y="502" width="96" height="6" rx="3" fill="${INK}" opacity="0.75"/>
    <rect x="352" y="522" width="70" height="5" rx="2.5" fill="${INK}" opacity="0.35"/>
    <rect x="352" y="576" width="40" height="5" rx="2.5" fill="${INK}" opacity="0.25"/>`;
}

/** A squat jar — masks and treatments. */
function jar(fill, accent) {
  return `
    <rect x="268" y="392" width="264" height="330" rx="34" fill="${fill}"/>
    <rect x="268" y="392" width="264" height="330" rx="34" fill="url(#sheen)"/>
    <rect x="256" y="316" width="288" height="88" rx="20" fill="${accent}"/>
    <rect x="300" y="500" width="200" height="150" rx="8" fill="${LABEL}" opacity="0.94"/>
    <rect x="330" y="536" width="140" height="7" rx="3.5" fill="${INK}" opacity="0.75"/>
    <rect x="330" y="560" width="96" height="5" rx="2.5" fill="${INK}" opacity="0.35"/>
    <rect x="330" y="606" width="52" height="5" rx="2.5" fill="${INK}" opacity="0.25"/>`;
}

/** A dropper bottle — oils and serums. */
function dropper(fill, accent) {
  return `
    <rect x="322" y="382" width="156" height="380" rx="22" fill="${fill}"/>
    <rect x="322" y="382" width="156" height="380" rx="22" fill="url(#sheen)"/>
    <rect x="360" y="326" width="80" height="62" rx="10" fill="${accent}"/>
    <rect x="378" y="212" width="44" height="120" rx="22" fill="${accent}" opacity="0.55"/>
    <circle cx="400" cy="200" r="30" fill="${accent}"/>
    <rect x="346" y="520" width="108" height="130" rx="6" fill="${LABEL}" opacity="0.94"/>
    <rect x="368" y="550" width="64" height="6" rx="3" fill="${INK}" opacity="0.75"/>
    <rect x="368" y="572" width="44" height="5" rx="2.5" fill="${INK}" opacity="0.3"/>`;
}

/** A spray bottle — mists and thermal protection. */
function spray(fill, accent) {
  return `
    <rect x="316" y="340" width="168" height="422" rx="20" fill="${fill}"/>
    <rect x="316" y="340" width="168" height="422" rx="20" fill="url(#sheen)"/>
    <rect x="366" y="286" width="68" height="58" rx="8" fill="${accent}"/>
    <path d="M366 286 h68 v-34 h-30 l-14 -22 h-24 z" fill="${accent}"/>
    <circle cx="500" cy="238" r="5" fill="${accent}" opacity="0.5"/>
    <circle cx="534" cy="216" r="3.5" fill="${accent}" opacity="0.38"/>
    <circle cx="524" cy="262" r="3" fill="${accent}" opacity="0.3"/>
    <rect x="344" y="486" width="112" height="150" rx="6" fill="${LABEL}" opacity="0.94"/>
    <rect x="366" y="518" width="68" height="6" rx="3" fill="${INK}" opacity="0.75"/>
    <rect x="366" y="540" width="46" height="5" rx="2.5" fill="${INK}" opacity="0.3"/>`;
}

/** A squeeze tube — gels and creams. */
function tube(fill, accent) {
  return `
    <path d="M330 336 h140 l16 400 a20 20 0 0 1 -20 22 h-132 a20 20 0 0 1 -20 -22 z" fill="${fill}"/>
    <path d="M330 336 h140 l16 400 a20 20 0 0 1 -20 22 h-132 a20 20 0 0 1 -20 -22 z" fill="url(#sheen)"/>
    <rect x="352" y="272" width="96" height="66" rx="8" fill="${accent}"/>
    <path d="M330 336 h140 l4 -22 h-148 z" fill="${INK}" opacity="0.12"/>
    <rect x="336" y="470" width="128" height="160" rx="6" fill="${LABEL}" opacity="0.94"/>
    <rect x="360" y="504" width="80" height="6" rx="3" fill="${INK}" opacity="0.75"/>
    <rect x="360" y="526" width="54" height="5" rx="2.5" fill="${INK}" opacity="0.3"/>`;
}

/** A wide-tooth comb. */
function comb(fill, accent) {
  const teeth = Array.from({ length: 11 }, (_, i) => {
    const x = 250 + i * 30;
    return `<rect x="${x}" y="430" width="14" height="230" rx="7" fill="${accent}"/>`;
  }).join("");
  return `
    <rect x="236" y="356" width="328" height="86" rx="20" fill="${fill}"/>
    <rect x="236" y="356" width="328" height="86" rx="20" fill="url(#sheen)"/>
    ${teeth}
    <rect x="286" y="386" width="120" height="7" rx="3.5" fill="${INK}" opacity="0.3"/>`;
}

/** A folded satin wrap. */
function wrap(fill, accent) {
  return `
    <path d="M232 452 q168 -104 336 0 q-24 232 -168 292 q-144 -60 -168 -292z" fill="${fill}"/>
    <path d="M232 452 q168 -104 336 0 q-24 232 -168 292 q-144 -60 -168 -292z" fill="url(#sheen)"/>
    <path d="M232 452 q168 -104 336 0 q-84 46 -168 46 q-84 0 -168 -46z" fill="${accent}" opacity="0.55"/>
    <path d="M400 498 q0 148 0 246" stroke="${INK}" stroke-opacity="0.14" stroke-width="4" fill="none"/>
    <path d="M320 486 q26 138 80 258" stroke="${INK}" stroke-opacity="0.1" stroke-width="3" fill="none"/>
    <path d="M480 486 q-26 138 -80 258" stroke="${INK}" stroke-opacity="0.1" stroke-width="3" fill="none"/>`;
}

const SHAPES = { bottle, jar, dropper, spray, tube, comb, wrap };

// The five Hydra Curls products are deliberately absent: they use the real photography from the
// Assignment 1 landing page (`public/products/hydra-curls-*.webp`), so generating placeholder art
// for them would write files nothing references. Everything below is a product with no photograph.
const PRODUCTS = [
  { slug: "deep-repair-hair-mask", shape: "jar", category: "treatment", fill: "#8C6F52", accent: "#6B5540" },
  { slug: "curl-defining-gel", shape: "tube", category: "style", fill: "#5F7E93", accent: "#43606F" },
  { slug: "lightweight-leave-in", shape: "tube", category: "style", fill: "#D9CFC0", accent: "#B0A18C" },
  { slug: "argan-hair-oil", shape: "dropper", category: "treatment", fill: "#B98A3E", accent: "#8A6529" },
  { slug: "scalp-scrub-exfoliant", shape: "jar", category: "cleanse", fill: "#6E8F86", accent: "#4E6D65" },
  { slug: "heat-shield-spray", shape: "spray", category: "protect", fill: "#A8564A", accent: "#7F3D34" },
  { slug: "satin-hair-wrap", shape: "wrap", category: "accessory", fill: "#7C6E86", accent: "#5C5165" },
  { slug: "wide-tooth-detangling-comb", shape: "comb", category: "accessory", fill: "#9A7B57", accent: "#7A6044" },
  { slug: "curl-refresh-mist", shape: "spray", category: "style", fill: "#8FA8B8", accent: "#6A8496" },
  { slug: "silk-press-serum", shape: "dropper", category: "style", fill: "#B0787E", accent: "#8A585E" },
];

function render({ slug, shape, category, fill, accent }) {
  const [from, to] = GROUNDS[category] ?? GROUNDS.style;

  // 800x1000 to match the 4/5 aspect the card reserves. Matching exactly is
  // what keeps the grid from reflowing as images decode.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000" role="img" aria-label="${slug}">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.20"/>
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="drop" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#1a1917" flood-opacity="0.16"/>
    </filter>
  </defs>

  <rect width="800" height="1000" fill="url(#ground)"/>
  <rect width="800" height="1000" fill="url(#halo)"/>

  <!-- The contact shadow. Without one the product floats, which is the single
       thing that most makes a flat illustration look unfinished. -->
  <ellipse cx="400" cy="792" rx="150" ry="20" fill="#1a1917" opacity="0.12"/>

  <g filter="url(#drop)">
    ${SHAPES[shape](fill, accent)}
  </g>
</svg>
`;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const product of PRODUCTS) {
  const file = resolve(OUT_DIR, `${product.slug}.svg`);
  writeFileSync(file, render(product), "utf8");
  console.log(`wrote ${product.slug}.svg`);
}

console.log(`\n${PRODUCTS.length} files in ${OUT_DIR}`);
