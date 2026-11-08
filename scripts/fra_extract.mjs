#!/usr/bin/env node
/**
 * Extract FairVote's sample Fair Representation Act (FRA) district maps.
 *
 * FairVote's state pages (fairvote.org/the-fair-representation-act-in-<state>/)
 * show their maps through Flourish embeds. Each multi-district state has a
 * Flourish table ("<ST> side by side maps") whose rows embed two Flourish
 * projection maps: the current single-member districts and the FRA
 * multi-member districts. Each embed page carries its GeoJSON in
 * `_Flourish_data`, with attribute names in `_Flourish_data_column_names`.
 *
 * States with five or fewer seats elect everyone at large under the FRA, so
 * their FRA "district" is the whole state (taken from data/us-states.geojson).
 *
 * Output (raw, unsimplified) goes to scripts/.cache/out/:
 *   fra_districts.raw.geojson, current_districts.raw.geojson, fra_states.json
 * Then simplify for the web, e.g.:
 *   node scripts/fra_simplify.mjs scripts/.cache/out/fra_districts.raw.geojson data/fra_districts.geojson 0.004
 *
 * Usage: node scripts/fra_extract.mjs [--refresh]
 * The data is FairVote's, published for educational purposes; attribute it.
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "scripts", ".cache");
const OUT = join(CACHE, "out");
const REFRESH = process.argv.includes("--refresh");
const UA = "arcgis-js-maps FRA extractor (educational demo)";

// 2020 apportionment (118th/119th Congress)
const STATES = {
  Alabama: ["AL", 7], Alaska: ["AK", 1], Arizona: ["AZ", 9], Arkansas: ["AR", 4],
  California: ["CA", 52], Colorado: ["CO", 8], Connecticut: ["CT", 5], Delaware: ["DE", 1],
  Florida: ["FL", 28], Georgia: ["GA", 14], Hawaii: ["HI", 2], Idaho: ["ID", 2],
  Illinois: ["IL", 17], Indiana: ["IN", 9], Iowa: ["IA", 4], Kansas: ["KS", 4],
  Kentucky: ["KY", 6], Louisiana: ["LA", 6], Maine: ["ME", 2], Maryland: ["MD", 8],
  Massachusetts: ["MA", 9], Michigan: ["MI", 13], Minnesota: ["MN", 8], Mississippi: ["MS", 4],
  Missouri: ["MO", 8], Montana: ["MT", 2], Nebraska: ["NE", 3], Nevada: ["NV", 4],
  "New Hampshire": ["NH", 2], "New Jersey": ["NJ", 12], "New Mexico": ["NM", 3], "New York": ["NY", 26],
  "North Carolina": ["NC", 14], "North Dakota": ["ND", 1], Ohio: ["OH", 15], Oklahoma: ["OK", 5],
  Oregon: ["OR", 6], Pennsylvania: ["PA", 17], "Rhode Island": ["RI", 2], "South Carolina": ["SC", 7],
  "South Dakota": ["SD", 1], Tennessee: ["TN", 9], Texas: ["TX", 38], Utah: ["UT", 4],
  Vermont: ["VT", 1], Virginia: ["VA", 11], Washington: ["WA", 10], "West Virginia": ["WV", 2],
  Wisconsin: ["WI", 8], Wyoming: ["WY", 1],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (name) => name.toLowerCase().replace(/\s+/g, "-");

async function cachedFetch(url, file) {
  const path = join(CACHE, file);
  if (!REFRESH) {
    try {
      await stat(path);
      return await readFile(path, "utf8");
    } catch {}
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const text = await res.text();
      await writeFile(path, text);
      await sleep(250);
      return text;
    }
    console.warn(`  ${res.status} ${url} (attempt ${attempt})`);
    await sleep(1000 * attempt);
  }
  throw new Error(`Failed to fetch ${url}`);
}

/** Read a `name = {...},` assignment from a Flourish embed page. */
function flourishVar(html, name) {
  const re = new RegExp(`${name}\\s*=\\s*`);
  const m = re.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const end = html.indexOf("\n", start);
  const raw = html.slice(start, end).trim().replace(/[,;]$/, "");
  return JSON.parse(raw);
}

const decodeEntities = (s) =>
  s.replace(/&#8217;|&rsquo;/g, "'").replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&nbsp;| /g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, "");

function pageText(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ");
  return decodeEntities(body.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
}

function vizIds(html) {
  return [...new Set([...html.matchAll(/visualisation\\*\/(\d+)/g)].map((m) => m[1]))];
}

async function embed(id) {
  const html = await cachedFetch(`https://flo.uri.sh/visualisation/${id}/embed`, `embed_${id}.html`);
  const title = (html.match(/<title>([^<]*)/) || [])[1]?.replace(/\s*\|\s*Flourish\s*$/, "") ?? "";
  const template = (html.match(/_Flourish_template_id\s*=\s*"?(\d+)/) || [])[1] ?? "";
  return { id, html, title, template };
}

/** Turn a Flourish choropleth embed into GeoJSON features with named properties. */
function choroplethFeatures(e) {
  const data = flourishVar(e.html, "_Flourish_data");
  const cols = flourishVar(e.html, "_Flourish_data_column_names");
  const rows = data?.choropleth ?? [];
  const meta = cols?.choropleth?.metadata ?? [];
  const nameCol = cols?.choropleth?.name || "name";
  const valueCols = cols?.choropleth?.value ?? [];
  return rows.map((r) => {
    const props = {};
    meta.forEach((col, i) => {
      if (col) props[col.trim().replace(/\s+/g, "_")] = r.metadata?.[i] ?? null;
    });
    props[nameCol.trim().replace(/\s+/g, "_")] = r.name;
    valueCols.forEach((col, i) => {
      if (col) props[col.trim().replace(/\s+/g, "_")] ??= r.value?.[i] ?? null;
    });
    let geometry = typeof r.geometry === "string" ? JSON.parse(r.geometry) : r.geometry;
    if (geometry?.type === "Feature") geometry = geometry.geometry;
    return { type: "Feature", properties: props, geometry };
  });
}

const kind = (features) => {
  const p = features[0]?.properties ?? {};
  if ("seats_in_district" in p || "number_of_seats" in p) return "fra";
  if ("party_projection" in p) return "current";
  return "other";
};

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function partisanship(text) {
  const m = text.match(/statewide partisanship is (\d+)% Democrat\s*\/\s*(\d+)% Republican/i);
  return m ? { dem_pct: +m[1], rep_pct: +m[2] } : null;
}

function projectionFromShare(dem, rep) {
  if (dem == null) return "Unknown";
  if (Math.abs(dem - rep) <= 6) return "Swing Seat";
  return dem > rep ? "Likely Democrat" : "Likely Republican";
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const states = JSON.parse(await readFile(join(ROOT, "data", "us-states.geojson"), "utf8"));
  const statePoly = Object.fromEntries(states.features.map((f) => [f.properties.NAME, f.geometry]));

  const fra = [];
  const current = [];
  const summary = [];

  for (const [name, [abbr, seats]] of Object.entries(STATES)) {
    const url = `https://fairvote.org/the-fair-representation-act-in-${slug(name)}/`;
    const html = await cachedFetch(url, `page_${slug(name)}.html`);
    const text = pageText(html);
    const part = partisanship(text);
    const conv = text.match(/from (\d+) single-winner districts? into (\d+) multi-winner districts?/i);

    // Expand side-by-side tables into their nested maps
    const queue = vizIds(html);
    const seen = new Set();
    const maps = [];
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const e = await embed(id);
      if (e.template === "3146" || /side by side/i.test(e.title)) {
        for (const m of e.html.matchAll(/flo\.uri\.sh\/visualisation\/(\d+)\/embed/g)) {
          if (m[1] !== id) queue.push(m[1]);
        }
      } else if (/"choropleth"\s*:\s*\[\s*\{/.test(e.html)) {
        maps.push(e);
      }
    }

    let fraCount = 0;
    let curCount = 0;
    for (const e of maps) {
      const feats = choroplethFeatures(e);
      const k = kind(feats);
      for (const f of feats) {
        Object.assign(f.properties, { state: name, state_abbr: abbr, source_viz_id: e.id, fairvote_url: url });
      }
      if (k === "fra") {
        for (const f of feats) {
          const p = f.properties;
          const seatsIn = num(p.seats_in_district ?? p.number_of_seats);
          const atLarge = feats.length === 1 ? 1 : 0;
          const [safeD, leanD, safeR, leanR] = [num(p.safe_d), num(p.lean_d), num(p.safe_r), num(p.lean_r)];
          // Some states omit dem_total/rep_total but publish the safe/lean split
          const demTotal = num(p.dem_total) ?? (safeD != null ? safeD + (leanD ?? 0) : null);
          const repTotal = num(p.rep_total) ?? (safeR != null ? safeR + (leanR ?? 0) : null);
          // Florida publishes a district Democratic vote share instead of a seat split
          const demVote = num(p.district_partisanship);
          f.properties = {
            state: name, state_abbr: abbr, dist_id: atLarge ? `${abbr}-AL` : (p.dist_id ?? `${abbr}-${p.district}`),
            seats: seatsIn, threshold: p.threshold_as_percent ?? p.threshold_to_elect ?? null,
            safe_d: safeD, lean_d: leanD, tossup: num(p.tossup),
            lean_r: leanR, safe_r: safeR, coalition_seats: num(p.coalition_seats),
            dem_total: demTotal, rep_total: repTotal,
            dem_vote_share: demVote != null ? demVote / 100 : null,
            racial_info: p.racial_info ?? null, at_large: atLarge,
            source_viz_id: e.id, fairvote_url: url,
          };
          fra.push(f);
          fraCount++;
        }
      } else if (k === "current") {
        for (const f of feats) {
          const p = f.properties;
          f.properties = {
            state: name, state_abbr: abbr, dist_id: p.dist_id,
            partisanship: p.partisanshipnew ?? null, projection: p.party_projection ?? null,
            dem_share: num(p.partisanship), derived: 0,
            source_viz_id: e.id, fairvote_url: url,
          };
          current.push(f);
          curCount++;
        }
      } else {
        console.warn(`  ${abbr}: unrecognized map ${e.id} "${e.title}"`);
      }
    }

    // At-large FRA district: the whole state
    if (fraCount === 0) {
      const geometry = statePoly[name];
      if (!geometry) throw new Error(`No state polygon for ${name}`);
      fra.push({
        type: "Feature",
        geometry,
        properties: {
          state: name, state_abbr: abbr, dist_id: `${abbr}-AL`, seats,
          threshold: `${(100 / (seats + 1)).toFixed(seats === 1 ? 0 : 1)}%`,
          safe_d: null, lean_d: null, tossup: null, lean_r: null, safe_r: null,
          coalition_seats: null, dem_total: null, rep_total: null,
          dem_vote_share: part ? part.dem_pct / 100 : null, racial_info: null, at_large: 1, source_viz_id: null, fairvote_url: url,
        },
      });
      fraCount = 1;
    }
    // Single-seat states: current district is the whole state too
    if (curCount === 0 && seats === 1) {
      current.push({
        type: "Feature",
        geometry: statePoly[name],
        properties: {
          state: name, state_abbr: abbr, dist_id: `${abbr}-AL`,
          partisanship: part ? `${part.dem_pct}% Democrat, ${part.rep_pct}% Republican` : null,
          projection: projectionFromShare(part?.dem_pct, part?.rep_pct),
          dem_share: part ? part.dem_pct / 100 : null, derived: 1,
          source_viz_id: null, fairvote_url: url,
        },
      });
      curCount = 1;
    }

    const fraSeats = fra.filter((f) => f.properties.state === name).reduce((s, f) => s + (f.properties.seats ?? 0), 0);
    summary.push({
      state: name, state_abbr: abbr, seats, fra_districts: fraCount, fra_seats: fraSeats,
      current_districts: curCount, partisanship: part,
      page_conversion: conv ? { from: +conv[1], to: +conv[2] } : null, fairvote_url: url,
    });
    const flag = fraSeats !== seats || curCount !== seats ? "  <-- check" : "";
    console.log(`${abbr}: seats ${seats} | FRA ${fraCount} districts / ${fraSeats} seats | current ${curCount}${flag}`);
  }

  const fc = (features) => ({ type: "FeatureCollection", features });
  await writeFile(join(OUT, "fra_districts.raw.geojson"), JSON.stringify(fc(fra)));
  await writeFile(join(OUT, "current_districts.raw.geojson"), JSON.stringify(fc(current)));
  await writeFile(join(OUT, "fra_states.json"), JSON.stringify(summary, null, 1));

  const tot = (k) => summary.reduce((s, r) => s + r[k], 0);
  console.log(`\nStates: ${summary.length}`);
  console.log(`FRA: ${fra.length} districts, ${tot("fra_seats")} seats (expect 435)`);
  console.log(`Current: ${current.length} districts (expect 435)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
