/* v9.34: location of an activity (building › floor › room › area).
   1. WBS path first (each level read top to bottom); 2. activity codes fill only what the WBS does not give
   (and may add detail that fits, e.g. WBS "Basement" + code B01); 3. if they disagree, the WBS wins. */
const rpLocOn = () => !/^(no|off|false|0)$/i.test(String(S.cfg.rpShowLoc == null ? 'yes' : S.cfg.rpShowLoc));
const LOC_ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
const LOC_TRADE = /^(floors?|walls?|ceilings?|first fix|second fix|final fix|finishes|finishing)\b/i;
const LOC_NOT = /materials?|cladding|skirting|doors?\s*$|works?\b|systems?\b|install|submission|approval|furniture|lamps|artworks?|partitions?|equipment|items|handrail|package|procurement|testing|commission|design|drawings?|minibar|night\s?stands?|curtains?|mirrors?|seatings?|tables?|desks?|wardrobes?|vanit|niche|headboards?|rugs?|mats?|lightings?|fixtures?|accessories/i;
const LOC_ROOM = /\b(rooms?|suites?|corridors?|lobb(?:y|ies)|boh|kitchens?|ballroom|fitness|gym|dining|kids club|lounge|pre-?function|stair\w*|toilets?|washrooms?|restaurants?|pool|spa|reception|offices?|plant|parking|car park|retail|shops?|laundry|terrace|mosque|prayer|majlis|hall|apartments?|units?|flats?|villa type|guard house|substation|pump|tank|riser|shaft|electrical room|mech room)\b/i;
const LOC_AREA = /\b(dry|wet|open|external|internal|common|outdoor|indoor)\s+areas?\b/i;
const LOC_BLD = /\b(tower|building|block|bldg|cluster|plot|zone|villa|phase)\s*[-#]?\s*[A-Z0-9]{1,4}\b/i;
const locArea = s => String(s).replace(/areas$/i, 'Area').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const locTitle = s => /[a-z]/.test(s) ? s : s.replace(/[A-Z][A-Z0-9]*/g, w => w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase());
const locClean = s => locTitle(String(s).replace(/\(\s*\d+\s*(?:No'?s?\.?)?\s*\)/gi, '').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/(\S)&/g, '$1 &').replace(/&(\S)/g, '& $1').replace(/\s{2,}/g, ' ').trim());
function locFloor(n) {
  const s = String(n).trim(), l = s.toLowerCase(); let m;
  if (LOC_TRADE.test(s)) return null;
  if ((m = l.match(/\bl\s?0?(\d{1,2})\s*(?:-|–|to)\s*l\s?0?(\d{1,2})\b/))) return 'L' + m[1].padStart(2, '0') + '–L' + m[2].padStart(2, '0');
  if (/\bbasement\b/.test(l) || /^b\s?0?\d$/.test(l)) { m = l.match(/\b(?:basement|b)\s*[-#]?\s*0?(\d)\b/); return m ? 'B0' + m[1] : 'Basement'; }
  if (/\bground\s*floor\b|^gf$|^0gf$|\(gf\)/.test(l)) return 'GF';
  if (/\broof\b/.test(l)) return 'Roof';
  if (/\bmezz/.test(l)) return 'Mezz';
  if (/\bpodium\b/.test(l) && !LOC_ROOM.test(l.replace('podium', ''))) return null;
  if ((m = l.match(/\((l\d{1,2})\)|\b(?:level|lvl|floor)\s*[-#]?\s*0?(\d{1,2})\b|\bl\s?0?(\d{1,2})\b/))) { const g = (m[1] || m[2] || m[3]).replace(/^l/, ''); return 'L' + g.padStart(2, '0'); }
  if ((m = l.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:floor|level)\b/))) return 'L' + m[1].padStart(2, '0');
  if ((m = l.match(new RegExp('\\b(' + Object.keys(LOC_ORD).join('|') + ')\\s+floor\\b')))) return 'L' + String(LOC_ORD[m[1]]).padStart(2, '0');
  if ((m = l.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|to)\s*(\d{1,2})(?:st|nd|rd|th)/))) return 'L' + m[1].padStart(2, '0') + '–L' + m[2].padStart(2, '0');
  return null; }
function locFromWbs(path) {
  const o = { b: null, f: null, r: null, a: null };
  (path || []).forEach(n0 => { const n = String(n0 || '').trim(); if (!n) return;
    const f = locFloor(n); if (f) o.f = f;
    const bm = n.match(LOC_BLD); if (bm && !o.b) o.b = locClean(bm[0]);
    if (/\bpodium\b/i.test(n)) { if (!o.b) o.b = 'Podium'; if (!LOC_ROOM.test(n)) return; }
    const el = n.match(/\b(north|south|east|west|front|rear|side)(?:\s*[-&]?\s*(?:north|south|east|west))?\s+elevations?\b/i); if (el) { o.r = locTitle(el[0]); return; }
    const am = n.match(LOC_AREA); if (am && !LOC_NOT.test(n)) { o.a = locArea(am[0]); return; }
    if (LOC_TRADE.test(n) || LOC_NOT.test(n)) return;
    if (LOC_ROOM.test(n)) { const inner = n.match(/\(([^)]*)\)/); let r = inner && LOC_ROOM.test(inner[1]) ? inner[1] : n.replace(/\(([^)]*)\)/g, (x, y) => /^\s*\d+\s*(No'?s?)?\s*$/i.test(y) ? '' : x);
      r = r.replace(/\s*[-–]\s*(?:L\d.*|\d+(?:st|nd|rd|th).*)$/i, ''); if (locFloor(r) && !/room|suite|corridor|lobb/i.test(r)) return; o.r = locClean(r).replace(/\b(\w+) Rooms$/, '$1 Room'); } });
  return o; }
const locCodeKind = name => { const n = String(name || ''); if (/\b(building|block|tower|bldg|plot|villa|zone|cluster)\b/i.test(n)) return 'b'; if (/\b(floor|level|storey|story)\b/i.test(n)) return 'f'; if (/\b(rooms?|space|location)\b/i.test(n)) return 'r'; if (/\barea\b|categor/i.test(n)) return 'a'; return null; };
/* same word with a typing slip (WBS "Twim Room" vs code "Twin Room"): the code's spelling is used, the meaning stays the WBS's */
const locNear = (a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); if (a === b || Math.abs(a.length - b.length) > 2 || a.slice(0, 3) !== b.slice(0, 3)) return false; let d = 0; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) d++; return d > 0 && d <= 2; };
const locFloorCode = c => { const v = locFloor(c.short) || locFloor(c.name); return v; };
function rpLoc(t) {
  if (!t) return null; if (t._loc !== undefined) return t._loc;
  const R = S.rp, M = R && R.B && R.B.M; const W = M && M.wbs; const w = W && W[t.wbs];
  const o = locFromWbs(w && w.path ? w.path.slice(1) : String(t.wbsPath || '').split(' / '));
  for (const [ty, c] of Object.entries(t.codes || {})) { const k = locCodeKind(ty); if (!k || !c) continue;
    if (k === 'f') { const v = locFloorCode(c); if (!v) continue; if (!o.f) o.f = v; else if (o.f === 'Basement' && /^B0\d$/.test(v)) o.f = v; }
    else if (k === 'b') { if (!o.b && c.name) o.b = locClean(c.name); }
    else if (k === 'r') { const v = String(c.name || c.short || ''); if (LOC_AREA.test(v)) { if (!o.a) o.a = locArea(v.match(LOC_AREA)[0]); } else if (v && !locFloor(v)) { const cv = locClean(v); if (!o.r) o.r = '\u0000' + cv; else if (locNear(o.r, cv)) o.r = cv; } }
    else if (k === 'a') { const v = String(c.name || c.short || ''); if (!o.a && LOC_AREA.test(v)) o.a = locArea(v.match(LOC_AREA)[0]); } }
  if (o.r && o.r[0] === '\u0000') o.r = o.f || o.b ? o.r.slice(1) : null;
  if (o.a && !o.f && !o.b && !o.r) o.a = null;
  const parts = [o.b, o.f, o.r, o.a].filter(Boolean);
  return (t._loc = parts.length ? { ...o, parts } : null); }
const rpLocTxt = t => { const l = rpLocOn() && rpLoc(t); return l ? l.parts.join(' › ') : ''; };
/* the common location of several activities: one floor, or the spread (L09–L11 · 3 floors) */
const LOC_FK = f => { const m = String(f).match(/^B0(\d)/); if (m) return -m[1]; if (f === 'Basement') return -0.5; if (f === 'GF') return 0; if (f === 'Mezz') return 0.5; if (f === 'Roof') return 999; const n = String(f).match(/^L(\d+)/); return n ? +n[1] : 500; };
function rpLocAgg(ts) {
  if (!rpLocOn()) return ''; const L = ts.map(rpLoc).filter(Boolean); if (!L.length) return '';
  const one = k => { const v = new Set(L.map(x => x[k]).filter(Boolean)); return v.size === 1 && L.every(x => x[k]) ? [...v][0] : null; };
  const fl = [...new Set(L.map(x => x.f).filter(Boolean))].sort((a, b) => LOC_FK(a) - LOC_FK(b));
  const f = fl.length === 1 ? fl[0] : fl.length > 1 ? fl[0].split('–')[0] + '–' + fl[fl.length - 1].split('–').pop() + ' · ' + fl.length + ' floors' : null;
  const r = one('r'), a = one('a'), b = one('b');
  return [b, f, r, r ? a : (a || null)].filter(Boolean).join(' › '); }
/* SVG line: 📍 L07 › Twin Room › Dry Area (separators grey) */
const rpLocSvg = (txt, x, y, w, fs) => { if (!txt) return ''; const f = rpFit('📍 ' + txt, w, fs || 9, false); return `<text x="${x}" y="${y}" font-size="${fs || 9}" fill="#2b3a52"><title>Location: ${esc(txt)}</title>${esc(f).replace(/ › /g, ' <tspan fill="#9aa5b5">›</tspan> ')}</text>`; };
