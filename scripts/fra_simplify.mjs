#!/usr/bin/env node
/**
 * Dependency-free, topology-preserving simplification for the FRA district files.
 *
 * 1. Snap vertices to a fine grid so borders drawn twice share exact coordinates.
 * 2. Mark junctions: vertices whose set of neighbouring vertices (over all
 *    rings) is not exactly two, i.e. where three or more districts meet or a
 *    shared border ends. Rings without a junction get a deterministic anchor.
 * 3. Split every ring into arcs between junctions and simplify each arc once
 *    (Douglas-Peucker, in a canonical direction) so both sides of a shared
 *    border get the same line - no gaps or slivers.
 *
 * Usage: node scripts/fra_simplify.mjs <in.geojson> <out.geojson> [toleranceDegrees=0.003]
 */
import { readFile, writeFile } from "node:fs/promises";

const [, , input, output, tolArg] = process.argv;
if (!input || !output) {
  console.error("Usage: node scripts/fra_simplify.mjs <in.geojson> <out.geojson> [toleranceDegrees]");
  process.exit(1);
}
const TOL = Number(tolArg ?? 0.003);
const SNAP = 1e-5;
const DECIMALS = 4;

const key = (p) => `${p[0]},${p[1]}`;
const snap = ([x, y]) => [Math.round(x / SNAP) * SNAP, Math.round(y / SNAP) * SNAP].map((v) => +v.toFixed(5));
const out = ([x, y]) => [+x.toFixed(DECIMALS), +y.toFixed(DECIMALS)];

function cleanRing(ring) {
  const pts = [];
  for (const c of ring) {
    const p = snap(c);
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  if (pts.length > 1 && key(pts[0]) === key(pts.at(-1))) pts.pop();
  return pts; // open ring
}

function douglasPeucker(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ax, ay] = pts[s];
    const [bx, by] = pts[e];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i];
      let d2;
      if (len2 === 0) d2 = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d2 > maxD) { maxD = d2; idx = i; }
    }
    if (maxD > tol2) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const fc = JSON.parse(await readFile(input, "utf8"));

// Collect every polygon as a list of open, snapped rings
const polysOf = (g) => (g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : []);
const features = fc.features.map((f) => ({ f, polys: polysOf(f.geometry).map((rings) => rings.map(cleanRing)) }));

// Neighbour sets
const neighbours = new Map();
const addN = (a, b) => {
  const ka = key(a);
  if (!neighbours.has(ka)) neighbours.set(ka, new Set());
  neighbours.get(ka).add(key(b));
};
for (const { polys } of features)
  for (const rings of polys)
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        addN(r[i], r[(i + 1) % r.length]);
        addN(r[i], r[(i - 1 + r.length) % r.length]);
      }
const isJunction = (p) => neighbours.get(key(p))?.size !== 2;

const arcCache = new Map();
function simplifyArc(arc) {
  const fwd = key(arc[0]) + "|" + key(arc.at(-1)) <= key(arc.at(-1)) + "|" + key(arc[0]);
  const canon = fwd ? arc : [...arc].reverse();
  const ck = canon.map(key).join(";");
  let res = arcCache.get(ck);
  if (!res) {
    res = douglasPeucker(canon, TOL);
    arcCache.set(ck, res);
  }
  return fwd ? res : [...res].reverse();
}

function simplifyRing(r) {
  if (r.length < 3) return null;
  let start = r.findIndex(isJunction);
  if (start < 0) {
    // no junction: anchor on the lexicographically smallest vertex
    start = 0;
    for (let i = 1; i < r.length; i++) if (key(r[i]) < key(r[start])) start = i;
  }
  const rot = [...r.slice(start), ...r.slice(0, start), r[start]];
  const junctionIdx = [0];
  for (let i = 1; i < rot.length - 1; i++) if (isJunction(rot[i])) junctionIdx.push(i);
  junctionIdx.push(rot.length - 1);
  const pts = [];
  for (let j = 0; j < junctionIdx.length - 1; j++) {
    const arc = simplifyArc(rot.slice(junctionIdx[j], junctionIdx[j + 1] + 1));
    pts.push(...(j === 0 ? arc : arc.slice(1)));
  }
  const ring = pts.map(out).filter((p, i, a) => i === 0 || key(p) !== key(a[i - 1]));
  if (ring.length < 4) return null; // needs 3 distinct + closing point
  if (key(ring[0]) !== key(ring.at(-1))) ring.push(ring[0]);
  return ring.length >= 4 ? ring : null;
}

let before = 0;
let after = 0;
let fallback = 0;
fc.features = features.map(({ f, polys }, i) => {
  const newPolys = [];
  for (const rings of polys) {
    before += rings.reduce((s, r) => s + r.length, 0);
    const outer = simplifyRing(rings[0]);
    if (!outer) continue;
    const holes = rings.slice(1).map(simplifyRing).filter(Boolean);
    newPolys.push([outer, ...holes]);
    after += [outer, ...holes].reduce((s, r) => s + r.length, 0);
  }
  let geometry;
  if (!newPolys.length) {
    fallback++;
    geometry = f.geometry;
  } else {
    geometry = newPolys.length === 1 ? { type: "Polygon", coordinates: newPolys[0] } : { type: "MultiPolygon", coordinates: newPolys };
  }
  return { type: "Feature", id: i + 1, properties: f.properties, geometry };
});

const json = JSON.stringify(fc);
await writeFile(output, json);
console.log(`${input} -> ${output}: ${fc.features.length} features, vertices ${before} -> ${after}, ` +
  `${(json.length / 1e6).toFixed(2)} MB, arcs ${arcCache.size}, ${fallback} kept unsimplified (tol ${TOL}°)`);
