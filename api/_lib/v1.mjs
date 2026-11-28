// Fichier généré par scripts/build-api.mjs à partir de src/api/v1 : ne pas modifier à la main.

// src/api/v1/vercel.ts
import { createClient } from "@supabase/supabase-js";

// src/shared/i18n/core.ts
var DEFAULT_LANG = "fr";
var dictionaries = { fr: {}, en: {} };
function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => vars[k] === void 0 || vars[k] === null ? m : String(vars[k]));
}
function translate(lang, key, vars) {
  const text = lang === "fr" ? key : dictionaries[lang][key] ?? key;
  return interpolate(text, vars);
}
var current = DEFAULT_LANG;
var t = (key, vars) => translate(current, key, vars);
var N_ = (key) => key;

// src/outils/optimiseur-chargement/constants/containers.ts
var CONTAINER_PRESETS = [
  { id: "semi", label: N_("Semi-remorque standard"), length: 13600, width: 2450, height: 2700, maxWeight: 24e3 },
  { id: "20ft", label: N_("Conteneur 20 pieds"), length: 5900, width: 2350, height: 2390, maxWeight: 28e3 },
  { id: "40ft", label: N_("Conteneur 40 pieds"), length: 12030, width: 2350, height: 2390, maxWeight: 26500 },
  { id: "40hc", label: N_("Conteneur 40 pieds High Cube"), length: 12030, width: 2350, height: 2690, maxWeight: 26500 }
];

// src/outils/optimiseur-chargement/constants/fleet.ts
var ROAD = [
  { id: "fourgon20", label: N_("Fourgon 20 m\xB3"), length: 4300, width: 2050, height: 2250, maxWeight: 1100 },
  { id: "porteur12", label: N_("Porteur 12 t"), length: 6200, width: 2450, height: 2400, maxWeight: 5500 },
  { id: "porteur19", label: N_("Porteur 19 t"), length: 7300, width: 2450, height: 2500, maxWeight: 9500 }
];
var preset = (id) => CONTAINER_PRESETS.find((c) => c.id === id);
var DEFAULT_FLEET = [
  { container: ROAD[0], cost: 250, enabled: true },
  { container: ROAD[1], cost: 380, enabled: false },
  { container: ROAD[2], cost: 480, enabled: true },
  { container: preset("semi"), cost: 650, enabled: true },
  { container: preset("20ft"), cost: 900, enabled: false },
  { container: preset("40ft"), cost: 1300, enabled: false },
  { container: preset("40hc"), cost: 1400, enabled: false }
];

// src/api/v1/schema.ts
var VEHICLES = [
  ...CONTAINER_PRESETS,
  ...DEFAULT_FLEET.map((v) => v.container).filter((c) => !CONTAINER_PRESETS.some((p) => p.id === c.id))
];
var DEFAULT_COST = Object.fromEntries(DEFAULT_FLEET.map((v) => [v.container.id, v.cost]));
var ROTATION = { free: "FULL", full: "FULL", horizontal: "HORIZONTAL", none: "NONE", upright: "HORIZONTAL" };
var STACKING = {
  free: { stackable: true, floorOnly: false },
  top_only: { stackable: false, floorOnly: false },
  floor: { stackable: true, floorOnly: true },
  floor_no_top: { stackable: false, floorOnly: true }
};
var TYPES = ["case", "pallet", "unit"];
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var str = (v, max = 120) => typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "";
var num = (v) => typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
function customVehicle(v, k, path, issues) {
  const [l, w, h] = ["length", "width", "height"].map((f) => num(v[f]));
  if (![l, w, h].every((x) => x > 0)) {
    issues.push({ path, message: "V\xE9hicule sur mesure : length, width et height (> 0) obligatoires." });
    return null;
  }
  const mw = v.max_weight == null ? null : num(v.max_weight);
  if (mw != null && !(mw > 0)) issues.push({ path: `${path}.max_weight`, message: "Charge utile > 0 (kg)." });
  return { id: str(v.id, 40) || "custom", label: str(v.label, 60) || "V\xE9hicule", length: Math.round(l * k), width: Math.round(w * k), height: Math.round(h * k), maxWeight: mw };
}
var STANDARD = { vehicles: VEHICLES, costs: DEFAULT_COST, defaultId: "semi" };
function vehicleOf(v, k, path, issues, cat) {
  if (typeof v === "string") {
    const found = cat.vehicles.find((c) => c.id === v);
    if (!found) issues.push({ path, message: `V\xE9hicule inconnu \xAB ${v} \xBB. Connus : ${cat.vehicles.map((c) => c.id).join(", ")}, ou dimensions sur mesure.` });
    return found ?? null;
  }
  if (isObj(v)) return customVehicle(v, k, path, issues);
  issues.push({ path, message: 'V\xE9hicule : identifiant (ex. "semi") ou objet { length, width, height, max_weight }.' });
  return null;
}
function parseShipment(body, catalog = null) {
  const cat = catalog ?? STANDARD;
  const issues = [];
  if (!isObj(body)) return { ok: false, issues: [{ path: "", message: "Corps JSON attendu (objet)." }] };
  const reference = str(body.reference, 80);
  if (!reference) issues.push({ path: "reference", message: "Obligatoire : r\xE9f\xE9rence du chargement dans votre WMS / ERP (n\xB0 d\u2019exp\xE9dition)." });
  else if (/^PL-/i.test(reference)) issues.push({ path: "reference", message: "Ne peut pas commencer par \xAB PL- \xBB (r\xE9serv\xE9 aux num\xE9ros Atelier Logistique)." });
  const units = body.units == null ? "cm" : str(body.units, 4).toLowerCase();
  if (!["cm", "mm", "m"].includes(units)) issues.push({ path: "units", message: 'Unit\xE9 des dimensions : "cm" (d\xE9faut), "mm" ou "m".' });
  const toCm = units === "mm" ? 0.1 : units === "m" ? 100 : 1;
  const toMm = toCm * 10;
  const mode = body.mode == null ? "draft" : str(body.mode, 10);
  if (mode !== "draft" && mode !== "auto") issues.push({ path: "mode", message: '"draft" (d\xE9faut : \xE0 v\xE9rifier dans l\u2019espace) ou "auto" (plan calcul\xE9 tout de suite).' });
  const delivery = body.delivery == null ? "strict" : str(body.delivery, 10).toLowerCase();
  if (delivery !== "strict" && delivery !== "soft") issues.push({ path: "delivery", message: '"strict" (d\xE9faut) ou "soft".' });
  let departureAt = null;
  if (body.departure_date != null && body.departure_date !== "") {
    const d = new Date(str(body.departure_date, 40));
    if (Number.isNaN(d.getTime())) issues.push({ path: "departure_date", message: "Date ISO attendue (ex. 2026-11-25)." });
    else departureAt = d.toISOString();
  }
  let input = { rows: [], vehicleMode: "single", deliveryMode: delivery === "soft" ? "SOFT" : "STRICT", excludedStops: [], containerId: "semi", custom: { label: "Mon contenant", length: 600, width: 240, height: 240, maxWeight: "" } };
  if (body.fleet != null) {
    if (!Array.isArray(body.fleet) || body.fleet.length === 0) issues.push({ path: "fleet", message: "Liste non vide de v\xE9hicules disponibles." });
    else {
      const fleet = body.fleet.slice(0, 10).map((f, i) => {
        const v = vehicleOf(isObj(f) && "vehicle" in f ? f.vehicle : f, toMm, `fleet[${i}]`, issues, cat);
        const cost = isObj(f) && f.cost != null ? num(f.cost) : cat.costs[v?.id ?? ""] ?? 500;
        if (!(cost >= 0)) issues.push({ path: `fleet[${i}].cost`, message: "Co\xFBt par voyage \u2265 0." });
        return v ? { container: v, cost, enabled: true } : null;
      }).filter((x) => !!x);
      input = { ...input, vehicleMode: "fleet", fleetVehicles: fleet };
    }
  } else {
    const v = vehicleOf(body.vehicle ?? cat.defaultId, toMm, "vehicle", issues, cat);
    if (v) {
      const known = cat.vehicles.find((c) => c.id === v.id && c.length === v.length);
      input = known && catalog ? { ...input, containerId: v.id, vehicle: known } : known && CONTAINER_PRESETS.some((c) => c.id === v.id) ? { ...input, containerId: v.id } : { ...input, containerId: "custom", custom: { label: v.label, length: v.length / 10, width: v.width / 10, height: v.height / 10, maxWeight: v.maxWeight ?? "" } };
    }
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) issues.push({ path: "lines", message: "Liste non vide de lignes (colis ou palettes)." });
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 2e3) : [];
  if (Array.isArray(body.lines) && body.lines.length > 2e3) issues.push({ path: "lines", message: "2 000 lignes au maximum par chargement." });
  const seen = /* @__PURE__ */ new Set();
  let total = 0;
  const rows = lines.map((l, i) => {
    const p = `lines[${i}]`;
    if (!isObj(l)) {
      issues.push({ path: p, message: "Objet attendu." });
      return null;
    }
    const type = l.type == null ? "case" : str(l.type, 10).toLowerCase();
    if (!TYPES.includes(type)) issues.push({ path: `${p}.type`, message: '"case" (colis, d\xE9faut), "pallet" ou "unit".' });
    const pallet = type === "pallet" || type === "unit";
    let id = str(l.id, 60) || `L${i + 1}`;
    if (seen.has(id)) {
      issues.push({ path: `${p}.id`, message: `Identifiant de ligne en double \xAB ${id} \xBB.` });
      id = `${id}#${i}`;
    }
    seen.add(id);
    const reference2 = str(l.reference, 80);
    if (!reference2) issues.push({ path: `${p}.reference`, message: "Obligatoire (r\xE9f\xE9rence article, SSCC, n\xB0 de palette\u2026)." });
    const quantity = l.quantity == null ? 1 : num(l.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1e4) issues.push({ path: `${p}.quantity`, message: "Entier entre 1 et 10 000." });
    const dims = ["length", "width", "height"].map((f) => {
      const v = num(l[f]);
      if (!(v > 0)) issues.push({ path: `${p}.${f}`, message: `Obligatoire, > 0 (${units}).` });
      return Math.round(v * toCm * 10) / 10;
    });
    const weight = l.weight == null ? 0 : num(l.weight);
    if (!(weight >= 0)) issues.push({ path: `${p}.weight`, message: "Poids unitaire \u2265 0 (kg)." });
    const rotation = l.rotation == null ? pallet ? "horizontal" : "free" : str(l.rotation, 12).toLowerCase();
    if (!ROTATION[rotation]) issues.push({ path: `${p}.rotation`, message: '"free", "horizontal" ou "none".' });
    const stacking = l.stacking == null ? pallet ? "floor" : "free" : str(l.stacking, 14).toLowerCase();
    if (!STACKING[stacking]) issues.push({ path: `${p}.stacking`, message: '"free", "top_only", "floor" ou "floor_no_top".' });
    const stop = l.stop == null ? 1 : num(l.stop);
    if (!Number.isInteger(stop) || stop < 1 || stop > 99) issues.push({ path: `${p}.stop`, message: "Ordre de livraison : entier de 1 (livr\xE9 en premier) \xE0 99." });
    if (Number.isInteger(quantity) && quantity > 0) total += quantity;
    return {
      id,
      reference: reference2,
      quantity,
      length: dims[0],
      width: dims[1],
      height: dims[2],
      weight,
      rotationMode: ROTATION[rotation] ?? "FULL",
      ...STACKING[stacking] ?? STACKING.free,
      stop,
      destination: str(l.destination, 80),
      type
    };
  }).filter((r) => !!r);
  if (total > 5e3) issues.push({ path: "lines", message: "5 000 colis / palettes au maximum par chargement." });
  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: {
      reference,
      label: str(body.label, 120) || null,
      departureAt,
      ...body.tour !== void 0 ? { tour: str(body.tour, 40) || null } : {},
      ...body.carrier !== void 0 ? { carrier: str(body.carrier, 40) || null } : {},
      mode,
      validate: body.validate === true,
      input: { ...input, rows },
      units: total
    }
  };
}

// src/outils/optimiseur-chargement/engine/balance.ts
var DEFAULT_LASHING = { mu: 0.3, stfDaN: 400, angleDeg: 90, forwardBlocked: true };

// src/outils/palettisation/engine/presets.ts
var PALLET_PRESETS = [
  { id: "eur", label: N_("EUR / EPAL 120\xD780"), length: 1200, width: 800, deckHeight: 144, tare: 25, maxTotalHeight: 1800, maxLoad: 1e3 },
  { id: "eur3", label: N_("EUR3 / ISO 120\xD7100"), length: 1200, width: 1e3, deckHeight: 144, tare: 30, maxTotalHeight: 1800, maxLoad: 1e3 },
  { id: "half", label: N_("Demi-palette 80\xD760"), length: 800, width: 600, deckHeight: 144, tare: 10, maxTotalHeight: 1200, maxLoad: 500 },
  { id: "gma", label: N_("US GMA 48\xD740 in"), length: 1219, width: 1016, deckHeight: 140, tare: 23, maxTotalHeight: 1800, maxLoad: 1e3 },
  { id: "asia", label: N_("Asie 110\xD7110"), length: 1100, width: 1100, deckHeight: 144, tare: 25, maxTotalHeight: 1800, maxLoad: 1e3 }
];
var DEFAULT_PALLET = PALLET_PRESETS[0];

// src/shared/references/defaults.ts
var n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
function toToolReferences(items) {
  const by = (k) => items.filter((i) => i.kind === k).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  const vehicles = by("vehicle").map((i) => {
    const d = i.data;
    const container = {
      id: i.code,
      label: i.label,
      length: n(d.length),
      width: n(d.width),
      height: n(d.height),
      maxWeight: d.maxWeight == null || d.maxWeight === "" ? null : n(d.maxWeight)
    };
    return {
      container,
      cost: n(d.cost),
      inFleet: !!d.inFleet,
      active: i.active,
      axle: d.axle ? { ...d.axle, kind: "TWO_SUPPORTS" } : null
    };
  });
  const pallets = by("pallet").map((i) => {
    const d = i.data;
    return {
      id: i.code,
      label: i.label,
      length: n(d.length),
      width: n(d.width),
      deckHeight: n(d.deckHeight),
      tare: n(d.tare),
      maxTotalHeight: n(d.maxTotalHeight),
      maxLoad: n(d.maxLoad),
      ...d.cost != null && d.cost !== "" ? { cost: n(d.cost) } : {},
      available: i.active
    };
  });
  const lashingItem = items.find((i) => i.kind === "setting" && i.code === "lashing");
  const lashing = { ...DEFAULT_LASHING, ...lashingItem?.data ?? {} };
  const tours = by("tour").filter((i) => i.active).map((i) => ({
    code: i.code,
    label: i.label,
    days: (Array.isArray(i.data.days) ? i.data.days : []).map(Number).filter((d) => d >= 1 && d <= 7).sort(),
    carrier: typeof i.data.carrier === "string" && i.data.carrier ? i.data.carrier : null
  }));
  const carriers = by("carrier").filter((i) => i.active).map((i) => ({ code: i.code, label: i.label, data: i.data }));
  const tourCodes = new Set(tours.map((t2) => t2.code));
  const agencies = by("agency").filter((i) => i.active).map((i) => {
    const d = i.data;
    return {
      code: i.code,
      label: i.label,
      city: d.city ?? "",
      tour: d.tour && tourCodes.has(d.tour) ? d.tour : null,
      order: n(d.order),
      zone: d.zone ? String(d.zone).trim() : null,
      postalCode: d.postalCode ? String(d.postalCode).trim() : null
    };
  });
  const cons = items.find((i) => i.kind === "setting" && i.code === "consolidation")?.data;
  return { vehicles, pallets, lashing, agencies, tours, carriers, consolidation: { mode: cons?.mode === "tour" ? "tour" : "free" } };
}

// src/shared/units/units.ts
var current2 = { units: "metric", currency: "EUR" };
var imperial = () => current2.units === "imperial";
var IN_PER_CM = 1 / 2.54;

// src/shared/carriers/tariff.ts
var usableTariff = (t2) => !!t2 && Array.isArray(t2.zones) && t2.zones.length > 0 && Array.isArray(t2.bands) && t2.bands.length > 0;
var R = {
  "ile-de-france": "75 77 78 91 92 93 94 95",
  "centre-val de loire": "18 28 36 37 41 45",
  "bourgogne-franche-comte": "21 25 39 58 70 71 89 90",
  normandie: "14 27 50 61 76",
  "hauts-de-france": "02 59 60 62 80",
  "grand est": "08 10 51 52 54 55 57 67 68 88",
  "pays de la loire": "44 49 53 72 85",
  bretagne: "22 29 35 56",
  "nouvelle-aquitaine": "16 17 19 23 24 33 40 47 64 79 86 87",
  occitanie: "09 11 12 30 31 32 34 46 48 65 66 81 82",
  "auvergne-rhone-alpes": "01 03 07 15 26 38 42 43 63 69 73 74",
  "provence-alpes-cote d'azur": "04 05 06 13 83 84",
  corse: "2A 2B"
};
var REGION_GROUPS = [
  ["\xCEle-de-France", "ile-de-france"],
  ["Hauts-de-France", "hauts-de-france"],
  ["Normandie", "normandie"],
  ["Grand Est", "grand est"],
  ["Centre-Val de Loire", "centre-val de loire"],
  ["Bourgogne-Franche-Comt\xE9", "bourgogne-franche-comte"],
  ["Pays de la Loire", "pays de la loire"],
  ["Bretagne", "bretagne"],
  ["Nouvelle-Aquitaine", "nouvelle-aquitaine"],
  ["Auvergne-Rh\xF4ne-Alpes", "auvergne-rhone-alpes"],
  ["Occitanie", "occitanie"],
  ["Provence-Alpes-C\xF4te d\u2019Azur", "provence-alpes-cote d'azur"],
  ["Corse", "corse"]
].map(([name, key]) => ({ name, depts: R[key].split(" ") })).concat([{ name: "Outre-mer", depts: ["971", "972", "973", "974", "976"] }]);
var ALL_DEPTS = REGION_GROUPS.flatMap((r) => r.depts);
var norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();
var REGIONS = new Map(Object.entries(R).map(([k, v]) => [norm(k), v.split(" ")]));
var REGION_NAMES = Object.keys(R);
function deptOf(postal) {
  const p = String(postal ?? "").replace(/\s/g, "").toUpperCase();
  if (/^2[AB]/.test(p)) return p.slice(0, 2);
  if (!/^\d{5}$/.test(p)) return null;
  if (p.startsWith("20")) return Number(p.slice(0, 3)) < 202 ? "2A" : "2B";
  if (p.startsWith("97") || p.startsWith("98")) return p.slice(0, 3);
  return p.slice(0, 2);
}
function tokensOf(match) {
  const out = [];
  for (const raw of String(match ?? "").split(/[,;\n]+/)) {
    const t2 = raw.trim();
    if (!t2) continue;
    const reg = REGIONS.get(norm(t2));
    if (reg) out.push(...reg);
    else out.push(...t2.split(/\s+/).filter(Boolean).map((x) => x.toUpperCase()));
  }
  return out;
}
function score(token, postal, dept) {
  if (token === "*") return 0.5;
  const range = /^(\d+)-(\d+)$/.exec(token);
  if (range) {
    const [a, b] = [range[1], range[2]];
    if (a.length !== b.length) return 0;
    const v = Number(postal.slice(0, a.length));
    return /^\d+$/.test(postal) && v >= Number(a) && v <= Number(b) ? a.length : 0;
  }
  if (/^2[AB]$/.test(token)) return dept === token ? 2 : 0;
  if (!/^\d+$/.test(token)) return 0;
  return postal.startsWith(token) ? token.length : 0;
}
function zoneIndex(t2, postal, forced) {
  const f = String(forced ?? "").trim().toUpperCase();
  if (f) {
    const i = t2.zones.findIndex((z) => z.code.trim().toUpperCase() === f);
    if (i >= 0) return i;
  }
  const p = String(postal ?? "").replace(/\s/g, "").toUpperCase();
  if (!p) return t2.zones.findIndex((z) => tokensOf(z.match).includes("*"));
  const dept = deptOf(p);
  let best = -1;
  let bestScore = 0;
  t2.zones.forEach((z, i) => {
    for (const tok of tokensOf(z.match)) {
      const s = score(tok, p, dept);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
  });
  return best;
}
function tariffPrice(t2, zone, qty, units, basis) {
  const band = t2.bands.findIndex((b) => b.upTo == null || qty <= Number(b.upTo) + 1e-9);
  if (band < 0) {
    const max = Math.max(...t2.bands.map((b) => Number(b.upTo) || 0));
    const u = basis === "weight" ? "kg" : basis === "pallet" ? t("palettes") : t("MPL");
    return { error: t("Au-del\xE0 de la grille ({max} {u} au plus).", { max, u }) };
  }
  const p = t2.bands[band].prices?.[zone];
  if (p == null || !Number.isFinite(Number(p))) return { error: t("Pas de tarif dans la grille pour la zone {zone}, tranche {n}.", { zone: t2.zones[zone]?.code ?? "?", n: band + 1 }) };
  const flat = !!t2.bands[band].flat;
  return { price: flat ? Number(p) : Number(p) * units, band, perUnit: flat ? null : Number(p) };
}

// src/shared/carriers/pricing.ts
var SCOPE_LABELS = { get agency() {
  return t("Agence");
}, get tour() {
  return t("Tourn\xE9e");
}, get zone() {
  return t("Zone");
} };
var num2 = (v, d = 0) => {
  const n2 = Number(v);
  return Number.isFinite(n2) ? n2 : d;
};
var r2 = (v) => Math.round(v * 100) / 100;
var ceilTo = (v, step) => Math.ceil(Math.round(v / step * 1e6) / 1e6) * step;
var up = (v) => String(v ?? "").trim().toUpperCase();
var lineOf = (l) => ({ scope: l.scope ?? "zone", key: up(l.key ?? l.zone) });
function destRate(grid, base, d) {
  for (const [scope, key] of [["agency", d.agency], ["tour", d.tour], ["zone", d.zone]]) {
    const r = key ? grid.get(`${scope}:${up(key)}`) : void 0;
    if (r != null) return { rate: r, via: `${SCOPE_LABELS[scope]} ${up(key)}` };
  }
  return base == null ? null : { rate: base, via: null };
}
function rateFor(c, dests = []) {
  const grid = /* @__PURE__ */ new Map();
  for (const l of c.zones ?? []) {
    const { scope, key } = lineOf(l);
    if (key && l.rate != null && Number.isFinite(Number(l.rate))) grid.set(`${scope}:${key}`, Number(l.rate));
  }
  const base = c.rate == null || c.rate === "" ? null : Number(c.rate);
  if (!grid.size) return base == null ? { error: t("Tarif manquant pour ce transporteur.") } : { rate: base, zone: null };
  let best = null;
  for (const d of dests) {
    const r = destRate(grid, base, d);
    if (!r) return { error: t("{agency} : ni agence, ni tourn\xE9e, ni zone dans la grille de ce transporteur.", { agency: d.agency }) };
    if (!best || r.rate > best.rate) best = { rate: r.rate, zone: r.via };
  }
  if (best) return best;
  return base == null ? { error: t("Destinations inconnues : choisissez les agences dans les lignes.") } : { rate: base, zone: null };
}
function fuelFor(c, month) {
  const table = Object.entries(c.fuelByMonth ?? {}).filter(([, v]) => v != null && Number.isFinite(Number(v))).sort(([a], [b]) => a.localeCompare(b));
  if (table.length && month) {
    const past = table.filter(([m]) => m <= month);
    if (past.length) {
      const [m, v] = past[past.length - 1];
      return { pct: Number(v), month: m };
    }
  }
  return { pct: num2(c.fuelPct), month: null };
}
function basisQty(basis, l, c) {
  if (basis === "weight") {
    const kg = Math.max(l.weightKg, l.volumeM3 * num2(c.kgPerM3, 0), l.ldm == null ? 0 : l.ldm * num2(c.kgPerLdm, 0));
    const kgR = Math.round(kg);
    return { qty: kgR, units: Math.ceil(kgR / 100), unit: "kg", by: kg === l.weightKg ? "real" : l.ldm != null && kg === l.ldm * num2(c.kgPerLdm, 0) ? "floor" : "volume" };
  }
  if (basis === "pallet") {
    const n2 = l.pallets == null ? l.units : l.pallets > 0 ? l.pallets : l.ldm ? Math.ceil(Math.round(l.ldm / 0.4 * 1e6) / 1e6) : 0;
    return { qty: n2, units: n2, unit: n2 > 1 ? t("palettes") : t("palette") };
  }
  if (l.ldm == null) return null;
  const q = r2(ceilTo(l.ldm, 0.1));
  return { qty: q, units: q, unit: t("MPL") };
}
function destLoads(facts, dests) {
  const tot = { weightKg: facts.weightKg, volumeM3: facts.volumeM3, ldm: facts.ldm, pallets: facts.pallets ?? null, units: facts.units };
  if (dests.length <= 1) return dests.map(() => tot);
  const sum = (k) => dests.reduce((a, d) => a + (d.load?.[k] ?? 0), 0);
  const S = { weightKg: sum("weightKg"), volumeM3: sum("volumeM3"), floorM2: sum("floorM2"), pallets: sum("pallets"), units: sum("units") };
  const share = (d, k) => S[k] > 0 ? (d.load?.[k] ?? 0) / S[k] : 1 / dests.length;
  return dests.map((d) => ({
    weightKg: tot.weightKg * share(d, "weightKg"),
    volumeM3: tot.volumeM3 * share(d, "volumeM3"),
    ldm: tot.ldm == null ? null : tot.ldm * share(d, "floorM2"),
    pallets: tot.pallets == null ? null : Math.round(tot.pallets * share(d, "pallets")),
    units: Math.round(tot.units * share(d, "units"))
  }));
}
function tariffQuote(facts, c, t2) {
  const basis = c.billing;
  const dests = facts.dests ?? [];
  if (!dests.length) return { error: t("Destinations inconnues : choisissez les agences dans les lignes.") };
  const zoneOf = (d) => zoneIndex(t2, d.postal, d.zone);
  for (const d of dests) {
    if (zoneOf(d) < 0) {
      return { error: d.postal ? t("{agency} ({cp}) : aucune zone de la grille ne couvre ce code postal.", { agency: d.agency || d.tour || "?", cp: d.postal }) : t("{agency} : code postal manquant sur l\u2019agence (Param\xE8tres \u203A Agences) pour trouver sa zone.", { agency: d.agency || d.tour || "?" }) };
    }
  }
  const minOf = (z) => {
    const m = t2.min?.[z];
    return m != null && Number.isFinite(Number(m)) ? Number(m) : num2(c.minCharge);
  };
  const byDest = [];
  let base = 0;
  let qty = 0;
  let unit = "";
  let taxable;
  if (t2.mode === "whole") {
    const b = basisQty(basis, { ...facts, pallets: facts.pallets ?? null }, c);
    if (!b) return { error: t("M\xE8tres plancher non calcul\xE9s : lancez le calcul du plan.") };
    let best = null;
    for (const d of dests) {
      const z = zoneOf(d);
      const p = tariffPrice(t2, z, b.qty, b.units, basis);
      if ("error" in p) return p;
      const m = minOf(z);
      const price = Math.max(p.price, m);
      if (!best || price > best.price) best = { z, price, min: m > p.price };
    }
    base = best.price;
    qty = b.qty;
    unit = b.unit;
    if (basis === "weight") taxable = { kg: b.qty, by: b.by };
    byDest.push({ agency: dests.length > 1 ? t("{n} destinations", { n: dests.length }) : dests[0].agency || dests[0].tour || "", zone: t2.zones[best.z].code, qty: b.qty, unit: b.unit, price: r2(best.price), minApplied: best.min });
  } else {
    const loads = destLoads(facts, dests);
    for (let i = 0; i < dests.length; i += 1) {
      const d = dests[i];
      const z = zoneOf(d);
      const b = basisQty(basis, loads[i], c);
      if (!b) return { error: t("M\xE8tres plancher non calcul\xE9s : lancez le calcul du plan.") };
      const p = tariffPrice(t2, z, b.qty, b.units, basis);
      if ("error" in p) return { error: `${d.agency || d.tour || ""} : ${p.error}` };
      const m = minOf(z);
      const price = Math.max(p.price, m);
      byDest.push({ agency: d.agency || d.tour || "", zone: t2.zones[z].code, qty: b.qty, unit: b.unit, price: r2(price), minApplied: m > p.price });
      base += price;
      qty += b.qty;
      unit = b.unit;
    }
    if (basis === "weight") taxable = { kg: qty, by: "real" };
  }
  const stopsFee = t2.mode === "whole" ? r2(Math.max(0, (facts.stops ?? 1) - 1) * num2(c.stopFee)) : 0;
  base = r2(base + stopsFee);
  const f = fuelFor(c, facts.month);
  const fuel = r2(base * f.pct / 100);
  const zones = [...new Set(byDest.map((x) => x.zone))];
  return {
    basis: c.billing,
    qty: r2(qty),
    unit,
    base,
    minApplied: byDest.some((x) => x.minApplied),
    fuel,
    amount: r2(base + fuel),
    taxable,
    zone: zones.length === 1 ? zones[0] : t("{n} zones", { n: zones.length }),
    stopsFee,
    fuelPct: f.pct,
    fuelMonth: f.month,
    byDest,
    mode: t2.mode
  };
}
function quote(facts, c) {
  if (c.billing !== "ftl" && usableTariff(c.tariff)) return tariffQuote(facts, c, c.tariff);
  let rate = 0;
  let zone = null;
  if (c.billing !== "ftl") {
    const rf = rateFor(c, facts.dests ?? (facts.zones ?? []).map((z) => ({ agency: z, tour: null, zone: z })));
    if ("error" in rf) return rf;
    ({ rate, zone } = rf);
  }
  let qty = 0;
  let unit = "";
  let base = 0;
  let taxable;
  let lines;
  switch (c.billing) {
    case "ldm": {
      if (facts.ldm == null) return { error: t("M\xE8tres plancher non calcul\xE9s : lancez le calcul du plan.") };
      qty = r2(ceilTo(facts.ldm, 0.1));
      unit = t("MPL");
      base = qty * rate;
      break;
    }
    case "pallet": {
      if (facts.pallets == null) {
        qty = facts.units;
        unit = qty > 1 ? t("palettes") : t("palette");
      } else if (facts.pallets > 0) {
        qty = facts.pallets;
        unit = qty > 1 ? t("palettes") : t("palette");
      } else {
        qty = facts.ldm ? Math.ceil(Math.round(facts.ldm / 0.4 * 1e6) / 1e6) : 0;
        unit = t("\xE9quiv. palettes");
      }
      base = qty * rate;
      break;
    }
    case "weight": {
      const real = facts.weightKg;
      const vol = facts.volumeM3 * num2(c.kgPerM3, 0);
      const floor = facts.ldm == null ? 0 : facts.ldm * num2(c.kgPerLdm, 0);
      const kg = Math.max(real, vol, floor);
      taxable = { kg: Math.round(kg), by: kg === real ? "real" : kg === floor ? "floor" : "volume" };
      qty = Math.ceil(Math.round(kg) / 100);
      unit = t("\xD7 100 kg");
      base = qty * rate;
      break;
    }
    case "ftl": {
      if (!facts.vehicles.length) return { error: t("Aucun v\xE9hicule : lancez le calcul du plan.") };
      lines = [];
      for (const v of facts.vehicles) {
        const p = c.prices?.[v.code];
        if (p == null || !Number.isFinite(Number(p))) return { error: t("Pas de forfait pour \xAB {v} \xBB chez ce transporteur.", { v: v.label }) };
        lines.push({ label: v.label, count: v.count, price: Number(p) });
      }
      qty = lines.reduce((s, l) => s + l.count, 0);
      unit = qty > 1 ? t("v\xE9hicules") : t("v\xE9hicule");
      base = lines.reduce((s, l) => s + l.count * l.price, 0);
      break;
    }
    default:
      return { error: t("Mode de facturation inconnu.") };
  }
  const stopsFee = r2(Math.max(0, (facts.stops ?? 1) - 1) * num2(c.stopFee));
  base += stopsFee;
  const min = num2(c.minCharge);
  const minApplied = min > 0 && base < min;
  const transport = minApplied ? min : base;
  const f = fuelFor(c, facts.month);
  const fuel = r2(transport * f.pct / 100);
  return {
    basis: c.billing,
    qty,
    unit,
    base: r2(base),
    minApplied,
    fuel,
    amount: r2(transport + fuel),
    taxable,
    lines,
    ...c.billing !== "ftl" ? { rate, zone } : {},
    stopsFee,
    fuelPct: f.pct,
    fuelMonth: f.month
  };
}
function factsOf(summary, extra = {}) {
  if (!summary) return null;
  return {
    ...extra,
    ldm: summary.ldm == null ? null : num2(summary.ldm),
    weightKg: num2(summary.weight),
    volumeM3: num2(summary.volume),
    units: num2(summary.packed),
    pallets: summary.pallets == null ? null : num2(summary.pallets),
    vehicles: Array.isArray(summary.vehicles) ? summary.vehicles : [],
    dests: extra.dests ?? [],
    stops: extra.stops ?? 1,
    month: extra.month ?? null
  };
}
function routeOf(rows, agencies) {
  const live = (rows ?? []).filter((r) => (r.quantity ?? 1) > 0);
  const codes = [...new Set(live.map((r) => String(r.destination ?? "").trim()).filter(Boolean))];
  const by = new Map(agencies.map((a) => [a.code.toUpperCase(), a]));
  const loads = /* @__PURE__ */ new Map();
  for (const r of live) {
    const k = String(r.destination ?? "").trim().toUpperCase();
    if (!k) continue;
    const q = r.quantity ?? 1;
    const L = num2(r.length);
    const W = num2(r.width);
    const H = num2(r.height);
    const l = loads.get(k) ?? { weightKg: 0, volumeM3: 0, floorM2: 0, pallets: 0, units: 0 };
    l.weightKg += q * num2(r.weight);
    l.volumeM3 += q * L * W * H / 1e6;
    l.floorM2 += q * L * W / 1e4;
    l.units += q;
    if (L * W / 1e4 >= 0.3) l.pallets += q;
    loads.set(k, l);
  }
  const dests = codes.map((c) => {
    const a = by.get(c.toUpperCase());
    return { agency: a?.code ?? c, tour: a?.tour ?? null, zone: a?.zone ?? null, postal: a?.postalCode ?? null, load: loads.get(c.toUpperCase()) };
  });
  return { dests, stops: Math.max(1, codes.length) };
}

// src/outils/optimiseur-chargement/constants/engine-config.ts
var MIN_SUPPORT_RATIO = 0.8;
var EPS = 1e-6;
var SCORING = {
  floorPenalty: 1,
  // privilégie les emplacements proches du sol (z faible)
  originDistancePenalty: 1,
  // privilégie la proximité de l'origine (x, y faibles)
  wastedSpacePenalty: 2,
  // pénalise l'espace perdu créé sous/autour de l'objet
  contactBonus: 1.5
  // récompense le contact avec parois et autres objets
};
var DELIVERY = {
  blockedPenalty: 10
};

// src/outils/optimiseur-chargement/engine/delivery.ts
var DEFAULT_STOP = 1;
function normalizeStop(stop) {
  const n2 = Math.round(Number(stop));
  return Number.isFinite(n2) && n2 >= 1 ? n2 : DEFAULT_STOP;
}
function overlapYZ(a, b) {
  return Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y) > EPS && Math.min(a.z + a.height, b.z + b.height) - Math.max(a.z, b.z) > EPS;
}
function overlapXY(a, b) {
  return Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y) > EPS;
}
function blocks(blocker, item) {
  const inFront = blocker.x >= item.x + item.length - EPS && overlapYZ(blocker, item);
  const onTop = blocker.z >= item.z + item.height - EPS && overlapXY(blocker, item);
  return inFront || onTop;
}
function countBlockers(box, later, laterMaxX) {
  if (later.length === 0) return 0;
  if (box.x >= laterMaxX - EPS) {
    return 0;
  }
  let n2 = 0;
  for (const p of later) if (blocks(p, box)) n2++;
  return n2;
}
function findBlockedItems(placed) {
  const out = [];
  for (const a of placed) {
    for (const b of placed) {
      if (b.stop > a.stop && blocks(b, a)) {
        out.push(a.id);
        break;
      }
    }
  }
  return out;
}
function summarizeStops(placed, unpacked) {
  const map = /* @__PURE__ */ new Map();
  const get = (stop, destination) => {
    let s = map.get(stop);
    if (!s) {
      s = { stop, destination, totalItems: 0, packedItems: 0, unpackedItems: 0, packedWeight: 0, packedVolume: 0 };
      map.set(stop, s);
    }
    if (!s.destination && destination) s.destination = destination;
    return s;
  };
  for (const p of placed) {
    const s = get(p.stop, p.destination);
    s.totalItems++;
    s.packedItems++;
    s.packedWeight += p.weight;
    s.packedVolume += p.length * p.width * p.height;
  }
  for (const u of unpacked) {
    const s = get(u.stop, u.destination);
    s.totalItems++;
    s.unpackedItems++;
  }
  return [...map.values()].sort((a, b) => a.stop - b.stop);
}

// src/outils/optimiseur-chargement/engine/collision.ts
function boxesIntersect(a, b) {
  return a.x + EPS < b.x + b.length && b.x + EPS < a.x + a.length && a.y + EPS < b.y + b.width && b.y + EPS < a.y + a.width && a.z + EPS < b.z + b.height && b.z + EPS < a.z + a.height;
}
function isWithinContainer(box, c) {
  return box.x >= -EPS && box.y >= -EPS && box.z >= -EPS && box.x + box.length <= c.length + EPS && box.y + box.width <= c.width + EPS && box.z + box.height <= c.height + EPS;
}
function collidesWithAny(box, others) {
  for (const other of others) {
    if (boxesIntersect(box, other)) return true;
  }
  return false;
}

// src/outils/optimiseur-chargement/engine/support.ts
function overlapAreaXY(a, b) {
  const dx = Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y);
  return dx > 0 && dy > 0 ? dx * dy : 0;
}
function supportRatio(box, placed) {
  if (box.z <= EPS) return 1;
  const baseArea = box.length * box.width;
  if (baseArea <= 0) return 0;
  let supported = 0;
  for (const p of placed) {
    if (Math.abs(p.z + p.height - box.z) <= EPS) {
      supported += overlapAreaXY(box, p);
    }
  }
  return Math.min(1, supported / baseArea);
}
function hasNonStackableBelow(box, placed) {
  for (const p of placed) {
    if (!p.stackable && Math.abs(p.z + p.height - box.z) <= EPS && overlapAreaXY(box, p) > EPS) {
      return true;
    }
  }
  return false;
}

// src/outils/optimiseur-chargement/engine/rotations.ts
function getOrientations(d, mode) {
  const { length: L, width: W, height: H } = d;
  let candidates;
  if (mode === "NONE") {
    candidates = [{ length: L, width: W, height: H }];
  } else if (mode === "HORIZONTAL") {
    candidates = [
      { length: L, width: W, height: H },
      { length: W, width: L, height: H }
    ];
  } else {
    candidates = [
      { length: L, width: W, height: H },
      { length: L, width: H, height: W },
      { length: W, width: L, height: H },
      { length: W, width: H, height: L },
      { length: H, width: L, height: W },
      { length: H, width: W, height: L }
    ];
  }
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const c of candidates) {
    const key = `${c.length}x${c.width}x${c.height}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
}
function rotationAngles(original, oriented) {
  if (oriented.height === original.height && oriented.length === original.width && oriented.width === original.length) {
    return { x: 0, y: 0, z: 90 };
  }
  if (oriented.height === original.width) {
    return { x: 90, y: 0, z: 0 };
  }
  if (oriented.height === original.length) {
    return { x: 0, y: 90, z: 0 };
  }
  return { x: 0, y: 0, z: 0 };
}

// src/outils/optimiseur-chargement/engine/scoring.ts
function overlapYZ2(a, b) {
  const dy = Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y);
  const dz = Math.min(a.z + a.height, b.z + b.height) - Math.max(a.z, b.z);
  return dy > 0 && dz > 0 ? dy * dz : 0;
}
function overlapXZ(a, b) {
  const dx = Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x);
  const dz = Math.min(a.z + a.height, b.z + b.height) - Math.max(a.z, b.z);
  return dx > 0 && dz > 0 ? dx * dz : 0;
}
function contactArea(box, container, placed) {
  const { x, y, z, length, width, height } = box;
  let area = 0;
  if (x <= EPS) area += width * height;
  if (Math.abs(x + length - container.length) <= EPS) area += width * height;
  if (y <= EPS) area += length * height;
  if (Math.abs(y + width - container.width) <= EPS) area += length * height;
  if (z <= EPS) area += length * width;
  for (const p of placed) {
    if (Math.abs(p.z + p.height - z) <= EPS) area += overlapAreaXY(box, p);
    if (Math.abs(p.x + p.length - x) <= EPS || Math.abs(x + length - p.x) <= EPS) area += overlapYZ2(box, p);
    if (Math.abs(p.y + p.width - y) <= EPS || Math.abs(y + width - p.y) <= EPS) area += overlapXZ(box, p);
  }
  return area;
}
function scorePlacement(box, container, placed, supportRatioValue, weights = SCORING) {
  const zTopNorm = (box.z + box.height) / container.height;
  const posNorm = (box.x + box.y) / (container.length + container.width);
  const surface = 2 * (box.length * box.width + box.length * box.height + box.width * box.height);
  const contactNorm = surface > 0 ? contactArea(box, container, placed) / surface : 0;
  return weights.floorPenalty * zTopNorm + weights.originDistancePenalty * posNorm + weights.wastedSpacePenalty * (1 - supportRatioValue) - weights.contactBonus * contactNorm;
}

// src/outils/optimiseur-chargement/engine/strategies.ts
var volume = (i) => i.dimensions.length * i.dimensions.width * i.dimensions.height;
var footprint = (i) => i.dimensions.length * i.dimensions.width;
var maxDimension = (i) => Math.max(i.dimensions.length, i.dimensions.width, i.dimensions.height);
var STRATEGIES = [
  { id: "volume-desc", compare: (a, b) => volume(b) - volume(a) },
  { id: "footprint-desc", compare: (a, b) => footprint(b) - footprint(a) },
  { id: "height-desc", compare: (a, b) => b.dimensions.height - a.dimensions.height },
  { id: "weight-desc", compare: (a, b) => b.weight - a.weight },
  { id: "maxdim-desc", compare: (a, b) => maxDimension(b) - maxDimension(a) }
];

// src/outils/optimiseur-chargement/engine/loading.ts
var positiveOrNull = (v) => {
  const n2 = Number(v);
  return v === null || v === void 0 || !Number.isFinite(n2) || n2 <= 0 ? null : n2;
};
function autoWallDepth(items) {
  let d = 0;
  for (const it of items) d = Math.max(d, it.dimensions.length, it.dimensions.width);
  return d;
}
function resolveLoading(opts, items) {
  const o = opts ?? {};
  const fixed = positiveOrNull(o.wallDepth);
  return {
    mode: o.mode === "WALLS" ? "WALLS" : "FREE",
    wallDepth: fixed ?? Math.max(autoWallDepth(items), 1),
    manualMaxHeight: positiveOrNull(o.manualMaxHeight),
    heavyMaxHeight: positiveOrNull(o.heavyMaxHeight),
    heavyThresholdKg: Number.isFinite(Number(o.heavyThresholdKg)) ? Number(o.heavyThresholdKg) : Infinity,
    mechanizedAboveKg: Number.isFinite(Number(o.mechanizedAboveKg)) ? Number(o.mechanizedAboveKg) : Infinity,
    scoring: { ...SCORING, ...o.scoring ?? {} }
  };
}
function heightCap(item, cfg, container) {
  if (item.weight > cfg.mechanizedAboveKg) return container.height;
  let cap = container.height;
  if (cfg.manualMaxHeight !== null) cap = Math.min(cap, cfg.manualMaxHeight);
  if (cfg.heavyMaxHeight !== null && item.weight > cfg.heavyThresholdKg) cap = Math.min(cap, cfg.heavyMaxHeight);
  return cap;
}
function overlapYZ3(a, b) {
  return Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y) > EPS && Math.min(a.z + a.height, b.z + b.height) - Math.max(a.z, b.z) > EPS;
}
function isInFront(p, box) {
  return p.x >= box.x + box.length - EPS && overlapYZ3(p, box);
}
function findLoadingViolations(placed) {
  const bySeq = [...placed].sort((a, b) => a.sequence - b.sequence);
  const out = [];
  for (let i = 0; i < bySeq.length; i++) {
    const it = bySeq[i];
    for (let j = 0; j < i; j++) {
      if (isInFront(bySeq[j], it)) {
        out.push(it.id);
        break;
      }
    }
  }
  return out;
}
function summarizeWalls(placed) {
  const map = /* @__PURE__ */ new Map();
  for (const p of placed) {
    if (p.wall <= 0) continue;
    let w = map.get(p.wall);
    if (!w) {
      w = { wall: p.wall, xStart: p.x, xEnd: p.x + p.length, items: 0, weight: 0 };
      map.set(p.wall, w);
    }
    w.items++;
    w.weight += p.weight;
    w.xStart = Math.min(w.xStart, p.x);
    w.xEnd = Math.max(w.xEnd, p.x + p.length);
  }
  return [...map.values()].sort((a, b) => a.wall - b.wall);
}

// src/outils/optimiseur-chargement/engine/optimizer.ts
function expandInstances(defs) {
  const out = [];
  for (const d of defs) {
    for (let i = 0; i < d.quantity; i++) {
      out.push({
        id: `${d.id}#${i}`,
        definitionId: d.id,
        reference: d.reference,
        dimensions: { length: d.length, width: d.width, height: d.height },
        weight: d.weight,
        rotationMode: d.rotationMode,
        stackable: d.stackable,
        floorOnly: !!d.floorOnly,
        stop: normalizeStop(d.stop),
        destination: (d.destination ?? "").trim()
      });
    }
  }
  return out;
}
var pointKey = (p) => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`;
function dedupe(points) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const p of points) {
    const k = pointKey(p);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}
var SpatialIndex = class {
  constructor(container) {
    this.map = /* @__PURE__ */ new Map();
    this.cell = Math.max(200, Math.round(container.length / 32));
  }
  range(box) {
    return [Math.floor(box.x / this.cell) - 1, Math.floor((box.x + box.length) / this.cell) + 1];
  }
  insert(item) {
    const [a, b] = this.range(item);
    for (let i = a; i <= b; i++) {
      let arr = this.map.get(i);
      if (!arr) {
        arr = [];
        this.map.set(i, arr);
      }
      arr.push(item);
    }
  }
  /** Existe-t-il un colis déjà chargé entre `box` et les portes ? (sortie dès le premier trouvé) */
  anyInFront(box, containerLength) {
    const a = Math.floor((box.x + box.length) / this.cell) - 1;
    const b = Math.floor(containerLength / this.cell) + 1;
    for (let i = a; i <= b; i++) {
      const arr = this.map.get(i);
      if (!arr) continue;
      for (const it of arr) if (isInFront(it, box)) return true;
    }
    return false;
  }
  query(box) {
    const [a, b] = this.range(box);
    const seen = /* @__PURE__ */ new Set();
    const res = [];
    for (let i = a; i <= b; i++) {
      const arr = this.map.get(i);
      if (arr) for (const it of arr) {
        if (!seen.has(it)) {
          seen.add(it);
          res.push(it);
        }
      }
    }
    return res;
  }
};
function coveredBy(c, p) {
  return c.x >= p.x - EPS && c.x < p.x + p.length - EPS && c.y >= p.y - EPS && c.y < p.y + p.width - EPS && c.z >= p.z - EPS && c.z < p.z + p.height - EPS;
}
function findBestPlacement(item, container, index, candidates, currentWeight, delivery, load) {
  if (container.maxWeight !== null && currentWeight + item.weight > container.maxWeight + EPS) {
    return null;
  }
  const orientations = getOrientations(item.dimensions, item.rotationMode);
  const cap = heightCap(item, load.cfg, container);
  let best = null;
  for (const pt of candidates) {
    for (const o of orientations) {
      const box = { x: pt.x, y: pt.y, z: pt.z, length: o.length, width: o.width, height: o.height };
      if (!isWithinContainer(box, container)) continue;
      if (item.floorOnly && box.z > EPS) continue;
      if (box.z + box.height > cap + EPS) continue;
      if (load.cfg.mode === "WALLS" && box.x + box.length > load.wallEnd + EPS) {
        const oversize = box.length > load.cfg.wallDepth + EPS && box.x >= load.wallStart - EPS;
        if (!oversize) continue;
      }
      const nearby = index.query(box);
      if (collidesWithAny(box, nearby)) continue;
      const sr = supportRatio(box, nearby);
      if (box.z > EPS) {
        if (hasNonStackableBelow(box, nearby)) continue;
        if (sr < MIN_SUPPORT_RATIO - EPS) continue;
      }
      if (load.cfg.mode === "WALLS" && box.x + box.length < load.maxX - EPS && index.anyInFront(box, container.length)) continue;
      let score2 = scorePlacement(box, container, nearby, sr, load.cfg.scoring);
      const blockers = countBlockers(box, delivery.later, delivery.laterMaxX);
      if (blockers > 0) {
        if (delivery.mode === "STRICT") continue;
        score2 += DELIVERY.blockedPenalty * blockers;
      }
      if (best === null || score2 < best.score) {
        best = {
          score: score2,
          point: pt,
          placed: {
            id: item.id,
            definitionId: item.definitionId,
            reference: item.reference,
            x: box.x,
            y: box.y,
            z: box.z,
            length: box.length,
            width: box.width,
            height: box.height,
            originalLength: item.dimensions.length,
            originalWidth: item.dimensions.width,
            originalHeight: item.dimensions.height,
            rotation: rotationAngles(item.dimensions, o),
            weight: item.weight,
            stackable: item.stackable,
            stop: item.stop,
            destination: item.destination,
            sequence: 0,
            wall: 0
          }
        };
      }
    }
  }
  return best ? { placed: best.placed, point: best.point } : null;
}
function packOnce(container, ordered, mode, cfg) {
  const placed = [];
  const index = new SpatialIndex(container);
  const unpacked = [];
  let weight = 0;
  let candidates = [{ x: 0, y: 0, z: 0 }];
  const delivery = { mode, later: [], laterMaxX: 0 };
  const load = {
    cfg,
    wallIndex: cfg.mode === "WALLS" ? 1 : 0,
    wallStart: 0,
    wallEnd: cfg.mode === "WALLS" ? Math.min(container.length, cfg.wallDepth) : container.length,
    maxX: 0
  };
  const tryPlace = (item) => {
    const found = findBestPlacement(item, container, index, candidates, weight, delivery, load);
    if (!found) return false;
    const p = found.placed;
    p.sequence = placed.length + 1;
    p.wall = load.wallIndex;
    placed.push(p);
    index.insert(p);
    weight += item.weight;
    load.maxX = Math.max(load.maxX, p.x + p.length);
    candidates = candidates.filter((c) => pointKey(c) !== pointKey(found.point) && !coveredBy(c, p));
    const generated = [
      { x: p.x + p.length, y: p.y, z: p.z },
      { x: p.x, y: p.y + p.width, z: p.z },
      { x: p.x, y: p.y, z: p.z + p.height }
    ];
    for (const c of generated) {
      if (c.x < container.length - EPS && c.y < container.width - EPS && c.z < container.height - EPS) {
        candidates.push(c);
      }
    }
    candidates = dedupe(candidates);
    return true;
  };
  const groups = [];
  for (const it of ordered) {
    const g = groups[groups.length - 1];
    if (g && g[0].stop === it.stop) g.push(it);
    else groups.push([it]);
  }
  for (const group of groups) {
    delivery.later = placed.filter((p) => p.stop > group[0].stop);
    delivery.laterMaxX = delivery.later.reduce((m, p) => Math.max(m, p.x + p.length), 0);
    if (cfg.mode === "FREE") {
      for (const item of group) if (!tryPlace(item)) unpacked.push(item);
      continue;
    }
    let remaining = group;
    while (remaining.length > 0) {
      let placedAny = false;
      const failed = /* @__PURE__ */ new Set();
      const next = [];
      for (const item of remaining) {
        if (failed.has(item.definitionId) || !tryPlace(item)) {
          failed.add(item.definitionId);
          next.push(item);
        } else {
          placedAny = true;
        }
      }
      remaining = next;
      if (!placedAny) {
        if (load.wallEnd >= container.length - EPS) break;
        load.wallIndex++;
        load.wallStart = load.wallEnd;
        load.wallEnd = Math.min(container.length, load.wallStart + cfg.wallDepth);
      }
    }
    unpacked.push(...remaining);
  }
  return buildResult(container, placed, unpacked, weight, mode, cfg.mode);
}
function buildResult(container, placed, unpacked, weight, mode, loadingMode) {
  const usedVolume = placed.reduce((s, p) => s + p.length * p.width * p.height, 0);
  const containerVolume = container.length * container.width * container.height;
  const hasWeightLimit = container.maxWeight !== null && container.maxWeight > 0;
  return {
    placedItems: placed,
    unpackedItems: unpacked,
    totalItems: placed.length + unpacked.length,
    packedItems: placed.length,
    unpackedCount: unpacked.length,
    usedVolume,
    containerVolume,
    volumeUtilization: containerVolume > 0 ? usedVolume / containerVolume : 0,
    usedWeight: weight,
    maxWeight: container.maxWeight,
    weightUtilization: hasWeightLimit ? weight / container.maxWeight : null,
    computationTimeMs: 0,
    stops: summarizeStops(placed, unpacked),
    blockedItemIds: findBlockedItems(placed),
    deliveryMode: mode,
    loadingMode,
    walls: summarizeWalls(placed),
    loadingViolationIds: findLoadingViolations(placed)
  };
}
function maxHeightUsed(r) {
  let m = 0;
  for (const p of r.placedItems) m = Math.max(m, p.z + p.height);
  return m;
}
function compareOptimizationResults(a, b) {
  if (a.packedItems !== b.packedItems) return b.packedItems - a.packedItems;
  const ba = a.blockedItemIds?.length ?? 0;
  const bb = b.blockedItemIds?.length ?? 0;
  if (ba !== bb) return ba - bb;
  if (a.usedVolume !== b.usedVolume) return b.usedVolume - a.usedVolume;
  if (a.usedWeight !== b.usedWeight) return b.usedWeight - a.usedWeight;
  return maxHeightUsed(a) - maxHeightUsed(b);
}
function optimize(container, definitions, options = {}) {
  const now2 = () => typeof performance !== "undefined" ? performance.now() : Date.now();
  const start = now2();
  const instances = expandInstances(definitions);
  const mode = options.deliveryMode === "SOFT" ? "SOFT" : "STRICT";
  const cfg = resolveLoading(options.loading, instances);
  const strategies = instances.length > 400 ? STRATEGIES.slice(0, 2) : STRATEGIES;
  const budgetMs = 6e3;
  let best = null;
  for (const strategy of strategies) {
    const ordered = [...instances].sort((a, b) => b.stop - a.stop || strategy.compare(a, b));
    const result = packOnce(container, ordered, mode, cfg);
    if (best === null || compareOptimizationResults(result, best) < 0) best = result;
    if (now2() - start > budgetMs) break;
  }
  if (best === null) best = buildResult(container, [], [], 0, mode, cfg.mode);
  best.computationTimeMs = Math.round(now2() - start);
  return best;
}
function optimizeWithInsights(container, definitions, options = {}) {
  const r = optimize(container, definitions, options);
  const l = options.loading;
  const limited = !!l && ((Number(l.manualMaxHeight) || 0) > 0 || (Number(l.heavyMaxHeight) || 0) > 0);
  r.heightLimitCost = null;
  if (limited && r.unpackedCount > 0) {
    const unlimited = optimize(container, definitions, { ...options, loading: { ...l, manualMaxHeight: null, heavyMaxHeight: null } });
    if (unlimited.packedItems > r.packedItems) {
      r.heightLimitCost = { packedItems: unlimited.packedItems, volumeUtilization: unlimited.volumeUtilization };
    }
    r.computationTimeMs += unlimited.computationTimeMs;
  }
  return r;
}

// src/outils/optimiseur-chargement/engine/fleet.ts
var EXACT_BUDGET_MS = 2500;
var now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
var volOf = (d) => d.length * d.width * d.height * d.quantity;
var weightOf = (d) => d.weight * d.quantity;
var capVol = (c) => c.length * c.width * c.height;
function fitsDims(d, c) {
  return getOrientations({ length: d.length, width: d.width, height: d.height }, d.rotationMode).some((o) => o.length <= c.length && o.width <= c.width && o.height <= c.height);
}
var fitsVehicle = (d, c) => fitsDims(d, c) && (c.maxWeight == null || d.weight <= c.maxWeight);
function tryLoad(defs, c, ctx, key) {
  const k = `${c.id}|${key}`;
  if (ctx.cache.has(k)) return ctx.cache.get(k);
  let res = null;
  const vol = defs.reduce((s, d) => s + volOf(d), 0);
  const w = defs.reduce((s, d) => s + weightOf(d), 0);
  if (vol <= capVol(c) && (c.maxWeight == null || w <= c.maxWeight) && defs.every((d) => fitsVehicle(d, c))) {
    const r = optimize(c, defs, ctx.opts);
    if (r.unpackedCount === 0) res = r;
  }
  ctx.cache.set(k, res);
  return res;
}
function summarize(defs, v, r, split) {
  const stops = [...new Set(defs.map((d) => d.stop ?? 1))].sort((a, b) => a - b);
  const destinations = [...new Set(defs.map((d) => d.destination ?? "").filter(Boolean))];
  return {
    vehicleId: v.container.id,
    container: v.container,
    cost: v.cost,
    stops,
    destinations,
    definitions: defs,
    units: defs.reduce((s, d) => s + d.quantity, 0),
    weight: Math.round(r.usedWeight),
    volumeUtilization: r.volumeUtilization,
    weightUtilization: r.weightUtilization,
    split
  };
}
function definitionsOfPlaced(defs, r) {
  const counts = /* @__PURE__ */ new Map();
  for (const p of r.placedItems) counts.set(p.definitionId, (counts.get(p.definitionId) ?? 0) + 1);
  const packed = [];
  const rest = [];
  for (const d of defs) {
    const q = Math.min(d.quantity, counts.get(d.id) ?? 0);
    if (q > 0) packed.push({ ...d, quantity: q });
    if (d.quantity - q > 0) rest.push({ ...d, quantity: d.quantity - q });
  }
  return { packed, rest };
}
function solve(groups, vehicles, ctx) {
  const trucks = [];
  let fixedCost = 0;
  const segments = [];
  for (const g of groups) {
    const alone = vehicles.some((v) => tryLoad(g.defs, v.container, ctx, `s${g.stop}`));
    if (alone) {
      segments.push(g);
      continue;
    }
    let rest = g.defs;
    let guard = 0;
    while (rest.length > 0 && guard++ < 200) {
      if (vehicles.some((v) => tryLoad(rest, v.container, ctx, `s${g.stop}r${guard}`))) break;
      let best = null;
      for (const v of vehicles) {
        const r = optimize(v.container, rest, ctx.opts);
        if (r.packedItems === 0) continue;
        const split = definitionsOfPlaced(rest, r);
        const loaded = split.packed.reduce((s, d) => s + volOf(d), 0);
        const score2 = loaded / Math.max(1, v.cost);
        if (!best || score2 > best.score) best = { v, ...split, r, score: score2 };
      }
      if (!best) return { trucks: [], cost: Infinity, ok: false };
      trucks.push(summarize(best.packed, best.v, best.r, true));
      fixedCost += best.v.cost;
      rest = best.rest;
    }
    if (rest.length > 0) segments.push({ stop: g.stop, defs: rest, partial: true });
  }
  const part = partitionSegments(segments, vehicles, ctx);
  if (!part) return { trucks: [], cost: Infinity, ok: false };
  return { trucks: [...trucks, ...part.trucks].sort((a, b) => (a.stops[0] ?? 0) - (b.stops[0] ?? 0)), cost: fixedCost + part.cost, ok: true };
}
var segKey = (segs) => segs.map((s) => `${s.stop}:${s.defs.map((d) => `${d.id}x${d.quantity}`).join(",")}`).sort().join("|");
var gapsOf = (segs) => {
  const st = [...new Set(segs.map((s) => s.stop))].sort((a, b) => a - b);
  let g = 0;
  for (let i = 1; i < st.length; i++) g += st[i] - st[i - 1] - 1;
  return g;
};
var better = (a, b) => {
  if (!b) return a;
  if (!a) return b;
  if (Math.abs(a.cost - b.cost) > 1e-9) return a.cost < b.cost ? a : b;
  if (a.count !== b.count) return a.count < b.count ? a : b;
  return a.gaps <= b.gaps ? a : b;
};
function cheapestFor(segs, vehicles, ctx) {
  const defs = segs.flatMap((s) => s.defs);
  const key = segKey(segs);
  let best = null;
  for (const v of [...vehicles].sort((a, b) => a.cost - b.cost)) {
    if (best && v.cost > best.v.cost) break;
    const r = tryLoad(defs, v.container, ctx, key);
    if (r) best = { v, r };
  }
  return best;
}
function partitionSegments(segments, vehicles, ctx) {
  const n2 = segments.length;
  if (n2 === 0) return { trucks: [], cost: 0, count: 0, gaps: 0 };
  const truckOf = (segs, v, r) => summarize(segs.flatMap((s) => s.defs), v, r, segs.some((s) => s.partial));
  const maxW = Math.max(...vehicles.map((v) => v.container.maxWeight ?? Infinity));
  const maxV = Math.max(...vehicles.map((v) => capVol(v.container)));
  const w = segments.map((s) => s.defs.reduce((a, d) => a + weightOf(d), 0));
  const vol = segments.map((s) => s.defs.reduce((a, d) => a + volOf(d), 0));
  let result = better(contiguous(segments, vehicles, ctx, truckOf), firstFit(segments, vehicles, ctx, truckOf, w));
  const deadline = now() + ctx.budgetMs;
  if (n2 <= 10) try {
    const memo = /* @__PURE__ */ new Map();
    const groupCache = /* @__PURE__ */ new Map();
    const segsOf = (mask) => segments.filter((_, i) => mask & 1 << i);
    const group = (mask) => {
      if (!groupCache.has(mask)) {
        if (now() > deadline) throw new Error("budget");
        let sw = 0, sv = 0;
        for (let i = 0; i < n2; i++) if (mask & 1 << i) {
          sw += w[i];
          sv += vol[i];
        }
        groupCache.set(mask, sw <= maxW && sv <= maxV ? cheapestFor(segsOf(mask), vehicles, ctx) : null);
      }
      return groupCache.get(mask);
    };
    const solveMask = (rest) => {
      if (rest === 0) return { trucks: [], cost: 0, count: 0, gaps: 0 };
      if (memo.has(rest)) return memo.get(rest);
      const low = rest & -rest;
      const others = rest & ~low;
      let best = null;
      for (let sub = others; ; sub = sub - 1 & others) {
        const mask = low | sub;
        const g = group(mask);
        if (g) {
          const tail = solveMask(rest & ~mask);
          if (tail) {
            const segs = segsOf(mask);
            best = better(best, { trucks: [truckOf(segs, g.v, g.r), ...tail.trucks], cost: tail.cost + g.v.cost, count: tail.count + 1, gaps: tail.gaps + gapsOf(segs) });
          }
        }
        if (sub === 0) break;
      }
      memo.set(rest, best);
      return best;
    };
    result = better(result, solveMask((1 << n2) - 1));
  } catch {
  }
  return result;
}
function contiguous(segments, vehicles, ctx, truckOf) {
  const n2 = segments.length;
  const best = Array.from({ length: n2 + 1 }, () => null);
  best[0] = { trucks: [], cost: 0, count: 0, gaps: 0 };
  for (let j = 1; j <= n2; j++) {
    for (let i = j; i >= 1; i--) {
      if (!best[i - 1]) continue;
      const segs = segments.slice(i - 1, j);
      const g = cheapestFor(segs, vehicles, ctx);
      if (!g) break;
      const prev = best[i - 1];
      best[j] = better(best[j], { trucks: [...prev.trucks, truckOf(segs, g.v, g.r)], cost: prev.cost + g.v.cost, count: prev.count + 1, gaps: prev.gaps });
    }
  }
  return best[n2];
}
function firstFit(segments, vehicles, ctx, truckOf, w) {
  const order = segments.map((_, i) => i).sort((a, b) => w[b] - w[a]);
  const bins = [];
  for (const i of order) {
    const seg = segments[i];
    const open = bins.find((b) => cheapestFor([...b, seg], vehicles, ctx));
    if (open) open.push(seg);
    else if (cheapestFor([seg], vehicles, ctx)) bins.push([seg]);
    else return null;
  }
  const trucks = bins.map((b) => {
    const g = cheapestFor(b, vehicles, ctx);
    return { t: truckOf(b, g.v, g.r), cost: g.v.cost, gaps: gapsOf(b) };
  });
  return { trucks: trucks.map((x) => x.t), cost: trucks.reduce((s, x) => s + x.cost, 0), count: trucks.length, gaps: trucks.reduce((s, x) => s + x.gaps, 0) };
}
function planFleet(definitions, vehicles, options = {}) {
  const t0 = now();
  const usable = vehicles.filter((v) => v.container.length > 0 && v.container.width > 0 && v.container.height > 0);
  const ctx = { opts: options, cache: /* @__PURE__ */ new Map(), budgetMs: EXACT_BUDGET_MS };
  const unplaced = [];
  const valid = [];
  for (const d of definitions) {
    if (d.quantity <= 0) continue;
    if (usable.some((v) => fitsVehicle(d, v.container))) valid.push(d);
    else unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: N_("trop grand ou trop lourd pour les v\xE9hicules propos\xE9s") });
  }
  const byStop = /* @__PURE__ */ new Map();
  for (const d of valid) {
    const s = d.stop ?? 1;
    if (!byStop.has(s)) byStop.set(s, []);
    byStop.get(s).push(d);
  }
  const groups = [...byStop.keys()].sort((a, b) => a - b).map((stop) => ({ stop, defs: byStop.get(stop) }));
  const main = groups.length ? solve(groups, usable, ctx) : { trucks: [], cost: 0, ok: true };
  if (!main.ok) {
    for (const d of valid) unplaced.push({ definitionId: d.id, reference: d.reference, quantity: d.quantity, reason: N_("aucune combinaison de v\xE9hicules ne permet de tout charger") });
  }
  const alternatives = [];
  if (main.ok && usable.length > 1 && groups.length) {
    ctx.budgetMs = EXACT_BUDGET_MS / 4;
    for (const v of usable) {
      const s = solve(groups, [v], ctx);
      if (s.ok) alternatives.push({ vehicleId: v.container.id, label: v.container.label, count: s.trucks.length, cost: s.cost });
    }
    alternatives.sort((a, b) => a.cost - b.cost);
  }
  const trucks = main.ok ? main.trucks.map((t2, i) => ({ ...t2, index: i + 1 })) : [];
  return { trucks, totalCost: main.ok ? main.cost : 0, alternatives, unplaced, computationTimeMs: Math.round(now() - t0) };
}

// src/outils/optimiseur-chargement/guide/planLink.ts
var cm = (mm) => Math.round(mm / 10);
function b64urlEncode(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str2) {
  const s = atob(str2.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str2.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
var canCompress = () => typeof CompressionStream !== "undefined";
var B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32Encode(bytes) {
  let bits = 0, v = 0, out = "";
  for (const x of bytes) {
    v = (v << 8 | x) & 65535;
    bits += 8;
    while (bits >= 5) {
      out += B32[v >> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits) out += B32[v << 5 - bits & 31];
  return out;
}
function b32Decode(str2) {
  const out = [];
  let bits = 0, v = 0;
  for (const ch of str2.toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("Lien de chargement invalide");
    v = (v << 5 | i) & 65535;
    bits += 5;
    if (bits >= 8) {
      out.push(v >> bits - 8 & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}
var PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
var zig = (n2) => n2 < 0 ? -n2 * 2 - 1 : n2 * 2;
var unzig = (n2) => n2 & 1 ? -(n2 + 1) / 2 : n2 / 2;
function pushVarint(out, n2) {
  while (n2 > 127) {
    out.push(n2 & 127 | 128);
    n2 = Math.floor(n2 / 128);
  }
  out.push(n2);
}
async function encodePlan(container, placed, unitIdOf = () => null, lang = "fr") {
  const ordered = [...placed].sort((a, b) => a.sequence - b.sequence);
  const refs = [];
  const refIdx = /* @__PURE__ */ new Map();
  const types = [];
  const typeIdx = /* @__PURE__ */ new Map();
  const dest = {};
  const ids = [];
  let anyId = false;
  const col = { t: [], o: [], s: [], w: [], x: [], y: [], z: [] };
  for (const p of ordered) {
    if (!refIdx.has(p.reference)) {
      refIdx.set(p.reference, refs.length);
      refs.push(p.reference);
    }
    if (p.destination) dest[p.stop] = p.destination;
    const d = [cm(p.length), cm(p.width), cm(p.height)];
    const sorted = [...d].sort((a, b) => b - a);
    const key = `${refIdx.get(p.reference)}|${sorted.join("x")}`;
    if (!typeIdx.has(key)) {
      typeIdx.set(key, types.length);
      types.push([refIdx.get(p.reference), ...sorted]);
    }
    const o = PERMS.findIndex((pm) => sorted[pm[0]] === d[0] && sorted[pm[1]] === d[1] && sorted[pm[2]] === d[2]);
    col.t.push(typeIdx.get(key));
    col.o.push(Math.max(0, o));
    col.s.push(p.stop ?? 1);
    col.w.push(p.wall ?? 0);
    col.x.push(cm(p.x));
    col.y.push(cm(p.y));
    col.z.push(cm(p.z));
    const id = unitIdOf(p);
    ids.push(id ?? "");
    if (id) anyId = true;
  }
  const head = { n: container.label, c: [cm(container.length), cm(container.width), cm(container.height)], r: refs, d: dest, t: types, N: ordered.length };
  if (anyId) head.u = ids;
  if (imperial()) head.U = 1;
  const body = [];
  for (const k of ["t", "o", "s", "w"]) col[k].forEach((v) => pushVarint(body, v));
  for (const k of ["x", "y", "z"]) {
    let prev = 0;
    col[k].forEach((v) => {
      pushVarint(body, zig(v - prev));
      prev = v;
    });
  }
  const headBytes = new TextEncoder().encode(JSON.stringify(head));
  const raw = new Uint8Array(headBytes.length + 1 + body.length);
  raw.set(headBytes, 0);
  raw[headBytes.length] = 0;
  raw.set(body, headBytes.length + 1);
  const L = lang === "en" ? "E" : "F";
  if (!canCompress()) return `j${b64urlEncode(new TextEncoder().encode(JSON.stringify(v1Json(container, ordered, unitIdOf))))}`;
  return `2${L}${b32Encode(await pipe(raw, new CompressionStream("deflate-raw")))}`;
}
function v1Json(container, ordered, unitIdOf) {
  const refs = [];
  const refIdx = /* @__PURE__ */ new Map();
  const dest = {};
  const items = ordered.map((p) => {
    if (!refIdx.has(p.reference)) {
      refIdx.set(p.reference, refs.length);
      refs.push(p.reference);
    }
    if (p.destination) dest[p.stop] = p.destination;
    const row = [refIdx.get(p.reference), cm(p.x), cm(p.y), cm(p.z), cm(p.length), cm(p.width), cm(p.height), p.stop ?? 1, p.wall ?? 0];
    const id = unitIdOf(p);
    if (id) row.push(id);
    return row;
  });
  return { v: 1, n: container.label, c: [cm(container.length), cm(container.width), cm(container.height)], r: refs, d: dest, i: items };
}
function decodeV2(raw) {
  const zero = raw.indexOf(0);
  const head = JSON.parse(new TextDecoder().decode(raw.slice(0, zero)));
  let pos = zero + 1;
  const read = () => {
    let n2 = 0, mul = 1, b;
    do {
      b = raw[pos++];
      if (b === void 0) throw new Error("Lien de chargement invalide");
      n2 += (b & 127) * mul;
      mul *= 128;
    } while (b & 128);
    return n2;
  };
  const N = head.N;
  const cols = {};
  for (const k of ["t", "o", "s", "w"]) cols[k] = Array.from({ length: N }, read);
  for (const k of ["x", "y", "z"]) {
    let prev = 0;
    cols[k] = Array.from({ length: N }, () => prev += unzig(read()));
  }
  const mm = (v) => v * 10;
  return {
    label: String(head.n ?? "V\xE9hicule"),
    imperial: head.U === 1,
    container: { length: mm(head.c[0]), width: mm(head.c[1]), height: mm(head.c[2]) },
    items: Array.from({ length: N }, (_, i) => {
      const [ri, a, b, c] = head.t[cols.t[i]];
      const dims = [a, b, c];
      const pm = PERMS[cols.o[i]] ?? PERMS[0];
      return {
        ref: head.r[ri] ?? "?",
        x: mm(cols.x[i]),
        y: mm(cols.y[i]),
        z: mm(cols.z[i]),
        l: mm(dims[pm[0]]),
        w: mm(dims[pm[1]]),
        h: mm(dims[pm[2]]),
        stop: cols.s[i],
        wall: cols.w[i],
        unitId: head.u?.[i] ? String(head.u[i]) : null,
        destination: head.d?.[cols.s[i]] ?? ""
      };
    })
  };
}
async function decodePlan(payload) {
  const kind = payload[0];
  if (kind === "2") return decodeV2(await pipe(b32Decode(payload.slice(2)), new DecompressionStream("deflate-raw")));
  const bytes = b64urlDecode(payload.slice(1));
  const raw = kind === "z" ? await pipe(bytes, new DecompressionStream("deflate-raw")) : bytes;
  const d = JSON.parse(new TextDecoder().decode(raw));
  if (d?.v !== 1 || !Array.isArray(d.i)) throw new Error("Lien de chargement invalide");
  const mm = (v) => v * 10;
  return {
    label: String(d.n ?? "V\xE9hicule"),
    container: { length: mm(d.c[0]), width: mm(d.c[1]), height: mm(d.c[2]) },
    items: d.i.map((r) => ({
      ref: d.r[r[0]] ?? "?",
      x: mm(r[1]),
      y: mm(r[2]),
      z: mm(r[3]),
      l: mm(r[4]),
      w: mm(r[5]),
      h: mm(r[6]),
      stop: r[7],
      wall: r[8],
      unitId: r[9] != null ? String(r[9]) : null,
      destination: d.d?.[r[7]] ?? ""
    }))
  };
}

// src/outils/optimiseur-chargement/import/colisSchema.ts
var COLIS_SCHEMA = {
  id: "atelier-logistique/colis",
  version: 1,
  label: N_("Colis \xE0 charger"),
  groupKey: ["reference", "length", "width", "height", "weight", "rotation", "stacking", "stop", "destination", "support"],
  quantityField: "quantity",
  unitField: "unitId",
  fields: [
    {
      id: "reference",
      label: N_("R\xE9f\xE9rence"),
      type: "text",
      required: true,
      aliases: ["reference", "ref", "sku", "code article", "article", "code", "item", "item number", "produit", "designation", "libelle", "nom", "description", "product"],
      help: N_("Code article, SSCC ou libell\xE9 du support.")
    },
    {
      id: "quantity",
      label: N_("Quantit\xE9"),
      type: "integer",
      defaultValue: 1,
      aliases: ["quantite", "qte", "qty", "quantity", "nb", "nombre", "nb colis", "nb supports", "nb um", "qte", "pieces", "count"]
    },
    {
      id: "length",
      label: N_("Longueur"),
      type: "number",
      required: true,
      unitKind: "length",
      get defaultUnit() {
        return imperial() ? "in" : "cm";
      },
      aliases: ["longueur", "long", "length", "lg", "l"]
    },
    {
      id: "width",
      label: N_("Largeur"),
      type: "number",
      required: true,
      unitKind: "length",
      get defaultUnit() {
        return imperial() ? "in" : "cm";
      },
      aliases: ["largeur", "larg", "width", "lar", "w"]
    },
    {
      id: "height",
      label: N_("Hauteur"),
      type: "number",
      required: true,
      unitKind: "length",
      get defaultUnit() {
        return imperial() ? "in" : "cm";
      },
      aliases: ["hauteur", "haut", "height", "ht", "h"]
    },
    {
      id: "weight",
      label: N_("Poids"),
      type: "number",
      unitKind: "mass",
      get defaultUnit() {
        return imperial() ? "lb" : "kg";
      },
      defaultValue: 0,
      aliases: ["poids", "poids brut", "masse", "weight", "gross weight", "pds", "kg"]
    },
    // Sans colonne Rotation, un fichier importé garde les colis debout (« Horizontale ») :
    // une palette couchée sur le plan est inexploitable au quai.
    {
      id: "rotation",
      label: N_("Rotation"),
      type: "enum",
      defaultValue: "Horizontale",
      aliases: ["rotation", "rot", "orientation", "sens"],
      help: N_("Libre, Horizontale (reste debout, pivote au sol) ou Interdite.")
    },
    {
      id: "stacking",
      label: N_("Empilage"),
      type: "enum",
      aliases: ["empilage", "gerbage", "superposition", "empilable", "gerbable", "stackable", "stacking rule"]
    },
    {
      id: "stop",
      label: N_("Arr\xEAt"),
      type: "text",
      aliases: ["arret", "ordre de livraison", "stop", "sequence", "ordre", "tournee", "rang", "drop"]
    },
    {
      id: "destination",
      label: N_("Destination"),
      type: "text",
      aliases: ["destination", "client", "destinataire", "livre a", "ship to", "ville", "adresse", "customer", "consignee", "city", "address"]
    },
    {
      id: "unitId",
      label: N_("N\xB0 support (SSCC)"),
      type: "text",
      aliases: ["sscc", "n support", "no support", "numero support", "id colis", "numero colis", "n colis", "lpn", "license plate", "hu", "n um", "etiquette", "unit id", "pallet id", "pallet no", "handling unit"],
      help: N_("Identifiant de chaque palette / colis : repris dans l\u2019export de s\xE9quence pour votre WMS.")
    },
    {
      id: "support",
      label: N_("Support impos\xE9"),
      type: "text",
      aliases: ["support", "type de support", "type palette", "type de palette", "format palette", "pallet type", "forced pallet"],
      help: N_("Palettisation : palette exig\xE9e pour cette ligne (EUR, EUR3, 120x100\u2026). Vide = choix automatique.")
    }
  ]
};
var STANDARD_HEADERS = [
  N_("R\xE9f\xE9rence"),
  N_("Quantit\xE9"),
  N_("Longueur (cm)"),
  N_("Largeur (cm)"),
  N_("Hauteur (cm)"),
  N_("Poids (kg)"),
  N_("Rotation"),
  N_("Empilage"),
  N_("Arr\xEAt"),
  N_("Destination")
];
var STANDARD_SAMPLE = [
  ["CARTON-A", 40, 60, 40, 40, 12, N_("Libre"), N_("Libre"), 1, N_("Client A")],
  ["PALETTE-EURO", 4, 120, 80, 140, 450, N_("Horizontale"), N_("Au sol, rien dessus"), 2, N_("Client B")]
];

// src/outils/optimiseur-chargement/uiHelpers.js
var cmToMm = (cm2) => Math.round(Number(cm2) * 10);
var ROTATION_OPTIONS = [
  { value: "FULL", label: N_("Libre") },
  { value: "HORIZONTAL", label: N_("Horizontale") },
  { value: "NONE", label: N_("Interdite") }
];
var STACKING_OPTIONS = [
  { value: "FREE", label: N_("Libre"), stackable: true, floorOnly: false, hint: N_("Peut aller sur un autre colis et en recevoir dessus.") },
  { value: "TOP_ONLY", label: N_("Dessus uniquement"), stackable: false, floorOnly: false, hint: N_("Rien par-dessus (fragile), mais peut \xEAtre pos\xE9 sur un autre colis.") },
  { value: "FLOOR", label: N_("Au sol"), stackable: true, floorOnly: true, hint: N_("Reste au sol, peut recevoir des colis dessus.") },
  { value: "FLOOR_NO_TOP", label: N_("Au sol, rien dessus"), stackable: false, floorOnly: true, hint: N_("Reste au sol et ne re\xE7oit rien dessus.") }
];
var DELIVERY_MODES = [
  { value: "STRICT", label: N_("Strict"), hint: N_("Chaque arr\xEAt est accessible sans d\xE9placer un colis d\u2019un arr\xEAt suivant. Ce qui ne respecte pas la r\xE8gle reste \xE0 quai.") },
  { value: "SOFT", label: N_("Souple"), hint: N_("Charge au maximum ; les colis qui devront \xEAtre manipul\xE9s \xE0 la livraison sont signal\xE9s.") }
];
function rowsToDefinitions(rows) {
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference.trim(),
    quantity: r.quantity,
    length: cmToMm(r.length),
    width: cmToMm(r.width),
    height: cmToMm(r.height),
    weight: r.weight,
    rotationMode: r.rotationMode,
    stackable: r.stackable !== false,
    floorOnly: !!r.floorOnly,
    stop: r.stop ?? 1,
    destination: (r.destination ?? "").trim()
  }));
}

// src/outils/optimiseur-chargement/engine/floorMeters.ts
var REFERENCE_WIDTH_MM = 2400;
var FLOOR_TOLERANCE_MM = 5;
function floorMeters(placed, container) {
  let area = 0;
  let occupied = 0;
  let floorItems = 0;
  for (const p of placed) {
    occupied = Math.max(occupied, p.x + p.length);
    if (p.z <= FLOOR_TOLERANCE_MM) {
      area += p.length * p.width;
      floorItems++;
    }
  }
  const floorArea = area / 1e6;
  return {
    floorArea,
    ldm: floorArea / (REFERENCE_WIDTH_MM / 1e3),
    occupiedLength: occupied / 1e3,
    containerLength: container.length / 1e3,
    floorItems,
    stackedItems: placed.length - floorItems
  };
}
var PALLET_MIN_AREA_MM2 = 3e5;
function goodsFacts(items) {
  let volume2 = 0;
  let pallets = 0;
  for (const it of items) {
    const q = it.quantity ?? 1;
    volume2 += it.length * it.width * it.height * q / 1e9;
    if (it.length * it.width >= PALLET_MIN_AREA_MM2 || it.floorOnly) pallets += q;
  }
  return { volume: Math.round(volume2 * 1e3) / 1e3, pallets };
}
function vehiclesOf(list) {
  const m = /* @__PURE__ */ new Map();
  for (const c of list) {
    const k = c.id ?? c.label;
    const v = m.get(k) ?? { code: k, label: c.label, count: 0 };
    v.count += 1;
    m.set(k, v);
  }
  return [...m.values()];
}

// src/api/v1/compute.ts
var LOADING = { mode: "WALLS" };
var labelOf = (c) => c.label;
function containerOf(input) {
  if (input.vehicle && input.vehicle.id === input.containerId) return input.vehicle;
  const preset2 = CONTAINER_PRESETS.find((c2) => c2.id === input.containerId);
  if (input.containerId !== "custom" && preset2) return preset2;
  const c = input.custom;
  return {
    id: "custom",
    label: c.label || "V\xE9hicule",
    length: Math.round(Number(c.length) * 10),
    width: Math.round(Number(c.width) * 10),
    height: Math.round(Number(c.height) * 10),
    maxWeight: c.maxWeight === "" ? null : Number(c.maxWeight)
  };
}
async function computePlan(input) {
  const defs = rowsToDefinitions(input.rows);
  const opts = { deliveryMode: input.deliveryMode, loading: LOADING };
  if (input.vehicleMode === "fleet") {
    const vehicles = (input.fleetVehicles ?? []).filter((v) => v.enabled).map((v) => ({ container: v.container, cost: v.cost }));
    const fleet = planFleet(defs, vehicles, opts);
    const guides = [];
    let ldm = 0;
    for (const t2 of fleet.trucks) {
      const r = optimizeWithInsights(t2.container, t2.definitions, opts);
      ldm += floorMeters(r.placedItems, t2.container).ldm;
      const label = `${t2.index}. ${labelOf(t2.container)}`;
      guides.push({ index: t2.index, label, units: r.placedItems.length, guide: await encodePlan({ ...t2.container, label }, r.placedItems) });
    }
    const n2 = fleet.trucks.length;
    const byVehicle = Object.entries(fleet.trucks.reduce((m, t2) => {
      m[t2.container.label] = (m[t2.container.label] ?? 0) + 1;
      return m;
    }, {}));
    const summary = n2 ? {
      vehicle: byVehicle.map(([l, k]) => `${k} \xD7 ${l}`).join(" + "),
      fleet: n2,
      packed: fleet.trucks.reduce((s, t2) => s + t2.units, 0),
      unpacked: fleet.unplaced.reduce((s, u) => s + u.quantity, 0),
      fill: fleet.trucks.reduce((s, t2) => s + t2.volumeUtilization, 0) / n2,
      weight: fleet.trucks.reduce((s, t2) => s + t2.weight, 0),
      edited: false,
      ldm: Math.round(ldm * 100) / 100,
      ...goodsFacts(fleet.trucks.flatMap((t2) => t2.definitions)),
      vehicles: vehiclesOf(fleet.trucks.map((t2) => ({ id: t2.container.id, label: t2.container.label })))
    } : { vehicle: "\u2014", fleet: 0, packed: 0, unpacked: fleet.unplaced.reduce((s, u) => s + u.quantity, 0), fill: 0, weight: 0, edited: false };
    return { summary, plan: { fleet, guides } };
  }
  const container = containerOf(input);
  const base = optimizeWithInsights(container, defs, opts);
  const guide = await encodePlan(container, base.placedItems);
  return {
    summary: {
      vehicle: container.label,
      packed: base.packedItems,
      unpacked: base.unpackedCount,
      fill: base.volumeUtilization,
      weight: base.usedWeight,
      edited: false,
      ldm: Math.round(floorMeters(base.placedItems, container).ldm * 100) / 100,
      ...goodsFacts(base.placedItems),
      vehicles: [{ code: container.id, label: container.label, count: 1 }]
    },
    plan: { base, manual: null, guide }
  };
}

// src/outils/optimiseur-chargement/manual/editPlan.ts
var EPS2 = 0.5;
var overlap1 = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
var footprint2 = (a, b) => Math.max(0, overlap1(a.x, a.x + a.length, b.x, b.x + b.length)) * Math.max(0, overlap1(a.y, a.y + a.width, b.y, b.y + b.width));
function supportsOf(item, placed) {
  return placed.filter((o) => o.id !== item.id && Math.abs(o.z + o.height - item.z) <= EPS2 && footprint2(item, o) > 0);
}
var wallOf = (walls, p) => {
  const cx = p.x + p.length / 2;
  return walls.find((w) => cx >= w.xStart && cx < w.xEnd)?.wall ?? p.wall;
};
function applyManualPlan(base, placed, staged, touched = /* @__PURE__ */ new Set()) {
  const walls = base.walls ?? [];
  const items = placed.map((p) => ({ ...p, wall: walls.length ? wallOf(walls, p) : p.wall }));
  const rank = /* @__PURE__ */ new Map();
  items.forEach((p) => {
    if (!touched.has(p.id)) rank.set(p.id, p.sequence);
  });
  [...items].filter((p) => touched.has(p.id)).sort((a, b) => a.z - b.z || a.x - b.x).forEach((p) => {
    let r = 0;
    for (const o of supportsOf(p, items)) r = Math.max(r, rank.get(o.id) ?? 0);
    for (const o of items) if (!touched.has(o.id) && o.wall === p.wall && o.x <= p.x) r = Math.max(r, o.sequence);
    rank.set(p.id, r + 0.5);
  });
  const ordered = [...items].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)).map((p, i) => ({ ...p, sequence: i + 1 }));
  const vol = (p) => p.length * p.width * p.height;
  const usedVolume = ordered.reduce((s, p) => s + vol(p), 0);
  const usedWeight = ordered.reduce((s, p) => s + p.weight, 0);
  const stagedIds = new Set(staged.map((s) => s.id));
  const stops = base.stops.map((s) => {
    const inStop = ordered.filter((p) => (p.stop ?? 1) === s.stop);
    const out = staged.filter((p) => (p.stop ?? 1) === s.stop).length;
    return { ...s, packedItems: inStop.length, unpackedItems: s.unpackedItems + out, packedWeight: inStop.reduce((a, p) => a + p.weight, 0), packedVolume: inStop.reduce((a, p) => a + vol(p), 0) };
  });
  return {
    ...base,
    placedItems: ordered,
    packedItems: ordered.length,
    unpackedCount: base.unpackedCount + staged.length,
    usedVolume,
    volumeUtilization: base.containerVolume ? usedVolume / base.containerVolume : 0,
    usedWeight,
    weightUtilization: base.maxWeight ? usedWeight / base.maxWeight : null,
    stops,
    walls: walls.map((w) => {
      const inWall = ordered.filter((p) => p.wall === w.wall);
      return { ...w, items: inWall.length, weight: inWall.reduce((a, p) => a + p.weight, 0) };
    }),
    blockedItemIds: (base.blockedItemIds ?? []).filter((id) => !stagedIds.has(id)),
    loadingViolationIds: (base.loadingViolationIds ?? []).filter((id) => !stagedIds.has(id))
  };
}

// src/api/v1/present.ts
var pct = (v) => typeof v === "number" ? Math.round(v * 1e3) / 10 : null;
function summaryOf(s) {
  const m = s.result?.summary;
  if (!m) return null;
  return { vehicles: m.fleet ?? 1, vehicle: m.vehicle ?? null, units_loaded: m.packed ?? 0, units_not_loaded: m.unpacked ?? 0, fill_rate_pct: pct(m.fill), weight_kg: Math.round(m.weight ?? 0), edited_by_hand: !!m.edited };
}
function listItemOf(s, site) {
  return {
    code: s.code,
    reference: s.external_id,
    label: s.label,
    status: s.status,
    ...s.merged_into ? { merged_into: s.merged_into } : {},
    version: s.version,
    source: s.source,
    departure_date: s.departure_at,
    tour: s.tour ?? null,
    carrier: s.carrier ?? null,
    carrier_cost: s.carrier_cost == null ? null : Number(s.carrier_cost),
    created_at: s.created_at,
    updated_at: s.updated_at,
    summary: summaryOf(s),
    links: { app: `${site}/app/chargements/${s.code}` }
  };
}
var itemOf = (p, lineIds) => ({
  sequence: p.sequence,
  line_id: lineIds.has(p.definitionId) ? p.definitionId : null,
  reference: p.reference,
  stop: p.stop,
  destination: p.destination || null,
  x: p.x,
  y: p.y,
  z: p.z,
  length: p.length,
  width: p.width,
  height: p.height,
  rotated: p.length !== p.originalLength || p.width !== p.originalWidth || p.height !== p.originalHeight,
  weight_kg: p.weight
});
async function planOf(s, dockUrl) {
  const plan = s.result?.plan;
  if (!plan) return null;
  const rows = s.input?.rows ?? [];
  const lineIds = new Set(rows.map((r) => r.id));
  if (plan.base) {
    const base = plan.base;
    const m = plan.manual;
    const r = m ? applyManualPlan(base, m.placed, m.staged, new Set(m.touched)) : base;
    const c = containerOf(s.input);
    const unplaced = /* @__PURE__ */ new Map();
    for (const u of r.unpackedItems) {
      const e = unplaced.get(u.definitionId) ?? { line_id: lineIds.has(u.definitionId) ? u.definitionId : null, reference: u.reference, quantity: 0 };
      e.quantity++;
      unplaced.set(u.definitionId, e);
    }
    return {
      vehicles: [{
        index: 1,
        vehicle: { id: c.id, label: c.label, length: c.length, width: c.width, height: c.height, max_weight_kg: c.maxWeight ?? null },
        fill_rate_pct: pct(r.volumeUtilization),
        weight_kg: Math.round(r.usedWeight),
        dock_url: dockUrl,
        items: [...r.placedItems].sort((a, b) => a.sequence - b.sequence).map((p) => itemOf(p, lineIds))
      }],
      not_loaded: [...unplaced.values()]
    };
  }
  if (plan.fleet) {
    const fleet = plan.fleet;
    const guides = plan.guides ?? [];
    const vehicles = [];
    for (const t2 of fleet.trucks) {
      const g = guides.find((x) => x.index === t2.index);
      const decoded = g ? await decodePlan(g.guide).catch(() => null) : null;
      vehicles.push({
        index: t2.index,
        vehicle: { id: t2.container.id, label: t2.container.label, length: t2.container.length, width: t2.container.width, height: t2.container.height, max_weight_kg: t2.container.maxWeight ?? null },
        cost: t2.cost,
        stops: t2.stops,
        fill_rate_pct: pct(t2.volumeUtilization),
        weight_kg: t2.weight,
        units: t2.units,
        dock_url: dockUrl ? `${dockUrl}?camion=${t2.index}` : null,
        // Flotte : positions issues du guide cariste (arrondies au cm), par ordre de chargement.
        items: decoded ? decoded.items.map((it, i) => ({ sequence: i + 1, line_id: null, reference: it.ref, stop: it.stop, destination: it.destination || null, x: it.x, y: it.y, z: it.z, length: it.l, width: it.w, height: it.h, rotated: null, weight_kg: null })) : []
      });
    }
    return {
      vehicles,
      total_cost: fleet.trucks.reduce((s2, t2) => s2 + (t2.cost ?? 0), 0),
      not_loaded: fleet.unplaced.map((u) => ({ line_id: lineIds.has(u.definitionId) ? u.definitionId : null, reference: u.reference, quantity: u.quantity, reason: u.reason }))
    };
  }
  return null;
}
async function shipmentOf(s, site) {
  const plan = s.result?.plan;
  const hasGuide = !!(plan?.guide || plan?.guides?.length);
  const dock = hasGuide && s.status !== "cancelled" ? `${site}/q/${s.share_token}` : null;
  const detailed = await planOf(s, dock);
  return { ...listItemOf(s, site), validated_at: s.validated_at ?? null, loaded_at: s.loaded_at ?? null, links: { app: `${site}/app/chargements/${s.code}`, dock }, plan: detailed };
}

// src/api/v1/handler.ts
async function catalogOf(db, org) {
  const items = db.references ? await db.references(org).catch(() => []) : [];
  const vehicles = toToolReferences(items).vehicles.filter((v) => v.active);
  if (!vehicles.length) return null;
  return {
    vehicles: vehicles.map((v) => v.container),
    costs: Object.fromEntries(vehicles.map((v) => [v.container.id, v.cost])),
    defaultId: (vehicles.find((v) => v.container.id === "semi") ?? vehicles[0]).container.id
  };
}
async function carrierCostOf(db, org, carrier, tour, result, rows, departure) {
  if (!carrier || !result?.summary) return void 0;
  const refs = toToolReferences(db.references ? await db.references(org).catch(() => []) : []);
  const c = refs.carriers.find((x) => x.code === carrier);
  if (!c) return { carrier_cost: null, carrier_quote: { carrier, error: `Transporteur ${carrier} inconnu (Param\xE8tres \u203A Transporteurs).` } };
  const route = routeOf(rows, refs.agencies);
  const dests = route.dests.map((d) => d.tour || !tour ? d : { ...d, tour });
  const f = factsOf(result.summary, { ...route, dests, month: (departure ?? (/* @__PURE__ */ new Date()).toISOString()).slice(0, 7) });
  if (!f) return void 0;
  const q = { carrier: c.code, label: c.label, ...quote(f, c.data) };
  return { carrier_cost: "error" in q ? null : q.amount, carrier_quote: q };
}
var STATUSES = ["new", "in_progress", "validated", "sent", "partially_loaded", "loaded", "cancelled"];
var err = (status, code, message, details) => ({ status, body: { error: { code, message, ...details ? { details } : {} } } });
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function apiKeyOf(h) {
  const auth = h.authorization ?? h.Authorization;
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return (h["x-api-key"] ?? "").trim() || null;
}
async function handle(req, db, site = "https://atelierlogistique.com") {
  const t0 = Date.now();
  const path = req.path.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  if (path === "/health" && req.method === "GET") return { status: 200, body: { ok: true, version: "v1" } };
  const key = apiKeyOf(req.headers);
  if (!key) return err(401, "unauthorized", "Cl\xE9 d\u2019API manquante : en-t\xEAte \xAB Authorization: Bearer al_live_\u2026 \xBB.");
  const k = await db.keyByHash(await sha256Hex(key));
  if (!k || k.revoked_at) return err(401, "unauthorized", "Cl\xE9 d\u2019API invalide ou r\xE9voqu\xE9e.");
  const org = k.org_id;
  let res;
  let items = 0;
  try {
    if (parts[0] !== "shipments") res = err(404, "not_found", `Route inconnue : ${req.method} /v1${path}`);
    else if (parts.length === 1 && req.method === "POST") {
      const parsed = parseShipment(req.body, await catalogOf(db, org));
      if (!parsed.ok) res = err(422, "invalid_request", "Chargement invalide : voir details.", parsed.issues);
      else {
        const v = parsed.value;
        items = v.units;
        const existing = await db.findShipment(org, v.reference);
        if (existing?.merged_into) {
          res = err(409, "merged", `Le chargement ${existing.code} (\xAB ${v.reference} \xBB) a \xE9t\xE9 regroup\xE9 dans ${existing.merged_into} : modifiez ${existing.merged_into} dans l\u2019espace, ou envoyez une nouvelle r\xE9f\xE9rence.`);
        } else if (existing && ["validated", "sent", "partially_loaded", "loaded"].includes(existing.status)) {
          res = err(409, "already_validated", `Le chargement ${existing.code} (\xAB ${v.reference} \xBB) est d\xE9j\xE0 ${existing.status === "sent" ? "envoy\xE9 au quai" : existing.status === "loaded" ? "charg\xE9" : existing.status === "partially_loaded" ? "charg\xE9 en partie" : "valid\xE9"} : rouvrez-le dans l\u2019espace ou envoyez une nouvelle r\xE9f\xE9rence.`);
        } else {
          const result = v.mode === "auto" ? await computePlan(v.input) : null;
          const status = v.mode === "auto" ? v.validate ? "validated" : "in_progress" : "new";
          const carrier = v.carrier !== void 0 ? v.carrier : existing?.carrier;
          const cost = await carrierCostOf(db, org, carrier, v.tour !== void 0 ? v.tour : existing?.tour, result, v.input.rows, v.departureAt);
          const fields = {
            label: v.label,
            departure_at: v.departureAt,
            ...v.tour !== void 0 ? { tour: v.tour } : {},
            ...v.carrier !== void 0 ? { carrier: v.carrier } : {},
            ...cost ?? {},
            input: v.input,
            result,
            status,
            source: "api"
          };
          const row = existing ? await db.updateShipment(existing.id, fields) : await db.insertShipment({ ...fields, org_id: org, external_id: v.reference });
          res = { status: existing ? 200 : 201, body: await shipmentOf(row, site) };
        }
      }
    } else if (parts.length === 1 && req.method === "GET") {
      const status = req.query.get("status")?.split(",").map((s) => s.trim()).filter(Boolean);
      const bad = status?.find((s) => !STATUSES.includes(s));
      const since = req.query.get("updated_since") ?? void 0;
      const limit = Math.min(200, Math.max(1, Number(req.query.get("limit") ?? 50) || 50));
      if (bad) res = err(422, "invalid_request", `Statut inconnu \xAB ${bad} \xBB : ${STATUSES.join(", ")}.`);
      else if (since && Number.isNaN(new Date(since).getTime())) res = err(422, "invalid_request", "updated_since : date ISO attendue.");
      else {
        const rows = await db.listShipments(org, { status, updatedSince: since ? new Date(since).toISOString() : void 0, limit });
        res = { status: 200, body: { data: rows.map((r) => listItemOf(r, site)), count: rows.length } };
      }
    } else if (parts.length >= 2) {
      const ref = decodeURIComponent(parts[1]);
      const s = await db.findShipment(org, ref);
      if (!s) res = err(404, "not_found", `Aucun chargement \xAB ${ref} \xBB (n\xB0 PL-\u2026 ou r\xE9f\xE9rence WMS).`);
      else if (parts.length === 2 && req.method === "GET") res = { status: 200, body: await shipmentOf(s, site) };
      else if (parts.length === 3 && parts[2] === "cancel" && req.method === "POST") {
        if (s.status === "loaded" || s.status === "partially_loaded") {
          res = err(409, "already_loaded", `Le chargement ${s.code} est d\xE9j\xE0 ${s.status === "loaded" ? "charg\xE9" : "charg\xE9 en partie"} : annulation impossible.`);
        } else {
          const row = s.status === "cancelled" ? s : await db.updateShipment(s.id, { status: "cancelled" });
          res = { status: 200, body: await shipmentOf(row, site) };
        }
      } else res = err(405, "method_not_allowed", `${req.method} non pris en charge sur cette route.`);
    } else res = err(405, "method_not_allowed", `${req.method} non pris en charge sur cette route.`);
  } catch (e) {
    res = err(500, "server_error", "Erreur interne. R\xE9essayez ; si elle persiste : contact@atelierlogistique.com.", { message: e.message });
  }
  await Promise.allSettled([
    db.touchKey(k.id),
    db.logUsage({ org_id: org, api_key_id: k.id, endpoint: `${req.method} /v1/${parts[0] ?? ""}${parts.length > 1 ? "/{ref}" : ""}${parts[2] ? `/${parts[2]}` : ""}`, http_status: res.status, items, duration_ms: Date.now() - t0 })
  ]);
  return res;
}

// src/api/v1/vercel.ts
var SHIPMENT_FIELDS = "*";
var LIST_FIELDS = "id, org_id, code, external_id, label, status, version, source, departure_at, tour, carrier, carrier_cost, created_at, updated_at, validated_at, share_token, summary:result->summary";
var client = null;
function sb() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration du serveur incompl\xE8te (SUPABASE_SERVICE_ROLE_KEY).");
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
var must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
var supabaseDb = {
  keyByHash: async (hash) => must(await sb().from("api_keys").select("id, org_id, revoked_at, scopes").eq("key_hash", hash).maybeSingle()),
  touchKey: async (id) => {
    await sb().from("api_keys").update({ last_used_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
  },
  logUsage: async (e) => {
    await sb().from("usage_events").insert(e);
  },
  findShipment: async (org, ref) => {
    const q = sb().from("shipments").select(SHIPMENT_FIELDS).eq("org_id", org);
    return must(await (/^PL-/i.test(ref) ? q.eq("code", ref.toUpperCase()) : q.eq("external_id", ref)).maybeSingle());
  },
  insertShipment: async (row) => must(await sb().from("shipments").insert(row).select(SHIPMENT_FIELDS).single()),
  updateShipment: async (id, patch) => must(await sb().from("shipments").update(patch).eq("id", id).select(SHIPMENT_FIELDS).single()),
  listShipments: async (org, q) => {
    let query = sb().from("shipments").select(LIST_FIELDS).eq("org_id", org).order("updated_at", { ascending: false }).limit(q.limit);
    if (q.status?.length) query = query.in("status", q.status);
    if (q.updatedSince) query = query.gt("updated_at", q.updatedSince);
    const rows = must(await query);
    return rows.map(({ summary, ...r }) => ({ ...r, input: null, result: summary ? { summary } : null }));
  },
  references: async (org) => must(await sb().from("reference_items").select("kind, code, label, data, active, sort").eq("org_id", org))
};
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, X-API-Key, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const url = new URL(req.url ?? "/", "https://x");
  const route = url.searchParams.get("route") ?? "";
  url.searchParams.delete("route");
  let body = null;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? null;
  } catch {
    res.status(400).json({ error: { code: "invalid_json", message: "Corps de requ\xEAte : JSON invalide." } });
    return;
  }
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]));
  try {
    const r = await handle({ method: req.method ?? "GET", path: `/${route}`, query: url.searchParams, headers, body }, supabaseDb, process.env.SITE_URL ?? "https://atelierlogistique.com");
    res.status(r.status).json(r.body);
  } catch (e) {
    res.status(500).json({ error: { code: "server_error", message: e.message } });
  }
}
export {
  handler as default,
  supabaseDb
};
