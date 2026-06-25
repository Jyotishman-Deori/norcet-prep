// =====================================================================
// src/lib/drill-packs.js — portable, uploadable content for the drills.
// A "pack" is plain JSON the author exports and any user imports — the same
// idea as question sets, but for the interactive drills. Packs live in the
// synced profile blob (data.drillPacks) and are MERGED into each drill's seed
// pool at runtime, so installing a pack just adds more content (never breaks
// the built-ins). All pure — no I/O, no React. Light per-kind validation
// rejects malformed uploads with a helpful message.
//
//   pack = { id, kind, name, version, author?, enabled, items:[...] }
// =====================================================================

export const PACK_KINDS = {
  'ibq':         { label: 'Spot the Structure (IBQ)', screen: 'ibq' },
  'crash-cart':  { label: 'Crash Cart',               screen: 'crash-cart' },
  'tie-breaker': { label: 'Tie-Breaker',              screen: 'tie-breaker' },
  'sorter':      { label: 'The Sorter',               screen: 'sorter' },
  'ecg-rhythms': { label: 'ICU Monitor (ECG rhythms)', screen: 'icu-monitor' },
};

const ECG_WAVEFORMS = ['sinus', 'afib', 'flutter', 'vt', 'vf', 'asystole', 'wenckebach', 'mobitz2', 'pvc', 'bigeminy', 'paced', 'chb', 'torsades'];

export const newPackId = () => `pk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isArr = (v) => Array.isArray(v) && v.length > 0;

// Validate ONE item for a kind. Returns null when valid, else an error string.
function validateItem(kind, it, i) {
  const at = `item ${i + 1}`;
  if (!it || typeof it !== 'object') return `${at}: not an object`;
  switch (kind) {
    case 'ibq': {
      if (!isStr(it.viewBox)) return `${at}: missing "viewBox"`;
      if (!isArr(it.art)) return `${at}: missing "art" shapes`;
      if (!isArr(it.hotspots)) return `${at}: missing "hotspots"`;
      if (!isArr(it.prompts)) return `${at}: missing "prompts"`;
      const ids = new Set(it.hotspots.map((h) => h && h.id));
      for (const p of it.prompts) if (!ids.has(p && p.answer)) return `${at}: prompt answer "${p && p.answer}" is not a hotspot id`;
      return null;
    }
    case 'crash-cart': {
      if (!isStr(it.scenario)) return `${at}: missing "scenario"`;
      if (!isArr(it.options)) return `${at}: missing "options"`;
      if (!it.options.every((o) => o && isStr(o.name))) return `${at}: each option needs a "name"`;
      if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= it.options.length) return `${at}: "answer" out of range`;
      if (!isStr(it.rationale)) return `${at}: missing "rationale"`;
      return null;
    }
    case 'tie-breaker': {
      if (!isStr(it.scenario) || !isStr(it.a) || !isStr(it.b)) return `${at}: needs "scenario", "a", "b"`;
      if (it.answer !== 'a' && it.answer !== 'b') return `${at}: "answer" must be "a" or "b"`;
      if (!isStr(it.why)) return `${at}: missing "why"`;
      return null;
    }
    case 'sorter': {
      if (!isArr(it.bins)) return `${at}: missing "bins"`;
      if (!isArr(it.items)) return `${at}: missing "items"`;
      const binIds = new Set(it.bins.map((b) => b && b.id));
      for (const x of it.items) if (!binIds.has(x && x.bin)) return `${at}: item bin "${x && x.bin}" is not a declared bin`;
      return null;
    }
    case 'ecg-rhythms': {
      if (!ECG_WAVEFORMS.includes(it.kind)) return `${at}: "kind" must be one of ${ECG_WAVEFORMS.join(', ')}`;
      if (!isStr(it.name)) return `${at}: missing "name"`;
      if (!isArr(it.options)) return `${at}: missing "options"`;
      if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= it.options.length) return `${at}: "answer" out of range`;
      if (!isStr(it.rationale)) return `${at}: missing "rationale"`;
      return null;
    }
    default:
      return `unknown kind "${kind}"`;
  }
}

// Parse + validate a raw pack (object or JSON string).
// Returns { ok, pack, error, count }.
export function validatePack(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch (e) { return { ok: false, error: 'Not valid JSON — check for a stray comma or quote.' }; }
  }
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'Empty or invalid pack.' };
  if (!PACK_KINDS[obj.kind]) return { ok: false, error: `"kind" must be one of: ${Object.keys(PACK_KINDS).join(', ')}.` };
  if (!isStr(obj.name)) return { ok: false, error: 'Pack needs a "name".' };
  if (!isArr(obj.items)) return { ok: false, error: 'Pack has no "items".' };

  // give every item a stable id if missing
  const items = obj.items.map((it, i) => ({ id: (it && it.id) || `${obj.kind}-${i}-${Math.random().toString(36).slice(2, 6)}`, ...it }));
  for (let i = 0; i < items.length; i++) {
    const err = validateItem(obj.kind, items[i], i);
    if (err) return { ok: false, error: err };
  }
  const pack = {
    id: isStr(obj.id) ? obj.id : newPackId(),
    kind: obj.kind,
    name: obj.name.slice(0, 80),
    version: Number.isFinite(obj.version) ? obj.version : 1,
    author: isStr(obj.author) ? obj.author.slice(0, 60) : '',
    enabled: true,
    items,
  };
  return { ok: true, pack, count: items.length };
}

export function normalizePacks(data) {
  const list = data && Array.isArray(data.drillPacks) ? data.drillPacks : [];
  return list.filter((p) => p && PACK_KINDS[p.kind] && Array.isArray(p.items));
}

// Seed pool + every ENABLED pack's items for this kind. De-duped by id, seed
// wins (a pack can add new content but never silently overrides a built-in).
export function mergePackItems(kind, seedItems, data) {
  const packs = normalizePacks(data).filter((p) => p.kind === kind && p.enabled !== false);
  if (packs.length === 0) return seedItems;
  const seen = new Set(seedItems.map((s) => s && s.id));
  const extra = [];
  for (const p of packs) for (const it of p.items) {
    if (it && it.id && !seen.has(it.id)) { seen.add(it.id); extra.push(it); }
  }
  return extra.length ? [...seedItems, ...extra] : seedItems;
}

export function countPacksByKind(data) {
  const out = {};
  for (const p of normalizePacks(data)) if (p.enabled !== false) out[p.kind] = (out[p.kind] || 0) + p.items.length;
  return out;
}

// Pretty JSON for download/sharing (strips the runtime `enabled` flag).
export function exportPackJson(pack) {
  const { enabled, ...rest } = pack || {};
  return JSON.stringify(rest, null, 2);
}

// A tiny valid example per kind to seed the authoring textarea.
export function sampleTemplate(kind) {
  const base = { kind, name: `My ${PACK_KINDS[kind].label} pack`, version: 1, author: '' };
  const items = {
    'tie-breaker': [{ id: 'ex1', principle: 'ABC', scenario: 'Describe the situation here.', a: 'First option', b: 'Second option', answer: 'a', why: 'Explain why option A is the priority.' }],
    'crash-cart': [{ id: 'ex1', tag: 'ACLS · Example', vitals: 'HR 40 · BP 80/50', scenario: 'Describe the crashing patient.', prompt: 'Which drug now?', options: [{ name: 'Right drug', dose: '1 mg IV' }, { name: 'Wrong drug', dose: '5 mg IV' }], answer: 0, severity: 'critical', rationale: 'Explain the correct choice.' }],
    'sorter': [{ id: 'ex1', title: 'Example set', instruction: 'Sort each item.', bins: [{ id: 'a', label: 'Bin A', color: '#2563EB', hint: 'hint' }, { id: 'b', label: 'Bin B', color: '#DC2626', hint: 'hint' }], items: [{ id: 'x1', text: 'Item one', emoji: '🧪', bin: 'a', why: 'Belongs in A because…' }] }],
    'ecg-rhythms': [{ id: 'ex1', kind: 'sinus', nBeats: 5, hasP: true, name: 'Example Rhythm', hr: 75, spo2: 98, bp: '120/80', severity: 'stable', audio: 'pulse', trace: '#46F08A', options: ['Example Rhythm', 'Other', 'Another'], answer: 0, rationale: 'Why it looks like this.', action: 'What to do.' }],
    'ibq': [{ id: 'ex1', title: 'Example diagram', viewBox: '0 0 200 120', art: [{ type: 'rect', x: 20, y: 20, width: 160, height: 80, rx: 8, fill: '#F1F5F9', stroke: '#0F3D3A', strokeWidth: 2 }], hotspots: [{ id: 'h1', label: 'Spot', shape: 'circle', cx: 100, cy: 60, r: 18 }], prompts: [{ id: 'p1', ask: 'Tap the spot', answer: 'h1', exp: 'Because…' }] }],
  };
  return JSON.stringify({ ...base, items: items[kind] || [] }, null, 2);
}
