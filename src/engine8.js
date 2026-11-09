/* ===== ENGINE 8: Baseline builder (BOQ -> mapping sheet, progress & cost resources, XER) ===== */
E.BB_STAGES = [
  { k: 'E', code: 'ENG', name: 'Engineering', verb: 'Engineering', dur: 20 },
  { k: 'P', code: 'PRC', name: 'Procurement', verb: 'Procure', dur: 60 },
  { k: 'C', code: 'CON', name: 'Construction', verb: 'Construct', dur: 30 },
  { k: 'T', code: 'TCH', name: 'Testing, commissioning & handover', verb: 'Test, commission & hand over', dur: 10 }
];
E.BB_PRESETS = {
  def: { name: 'Project default', split: null },
  earth: { name: 'Earthworks (no testing stage)', split: { E: 0, P: 10, C: 90, T: 0 } },
  roads: { name: 'Roads & paving (tests sit in construction)', split: { E: 0, P: 10, C: 90, T: 0 } },
  util: { name: 'Utilities & drainage (with pressure / leak tests)', split: { E: 0, P: 20, C: 70, T: 10 } },
  struct: { name: 'Structure / concrete / steel', split: { E: 3, P: 27, C: 65, T: 5 } },
  mep: { name: 'MEP / systems (supply & install)', split: { E: 7, P: 45, C: 38, T: 10 } },
  equip: { name: 'Equipment (supply, install, commission)', split: { E: 5, P: 65, C: 15, T: 15 } },
  supply: { name: 'Supply only', split: { E: 5, P: 90, C: 0, T: 5 } },
  design: { name: 'Design / services (engineering only)', split: { E: 100, P: 0, C: 0, T: 0 } },
  prelim: { name: 'Preliminaries / general items', split: { E: 0, P: 0, C: 100, T: 0 } }
};
E.BB_RULES = [
  [/prelim|general item|general requirement|mobili[sz]ation|site (office|establishment)|insurance|bond/i, 'General', 'prelim'],
  [/design|engineering service|drawing|survey|study|as[- ]built/i, 'Design & services', 'design'],
  [/excavat|earthwork|backfill|fill\b|grading|compaction|soil|dewater|demolition|clearing/i, 'Earthworks', 'earth'],
  [/asphalt|pavement|kerb|curb|road|sub-?base|base course|paving|interlock/i, 'Roads & paving', 'roads'],
  [/pipe|sewer|drain|manhole|storm|water main|culvert|irrigation/i, 'Utilities & drainage', 'util'],
  [/concrete|rebar|reinforc|formwork|steel|structur|foundation|pile|slab|column|beam/i, 'Concrete & structure', 'struct'],
  [/masonry|block|plaster|paint|tile|ceiling|door|window|glaz|floor|finish|waterproof|insulation/i, 'Architectural & finishes', 'struct'],
  [/transformer|switchgear|panel|generator|pump|chiller|ahu|fcu|lift|elevator|boiler|ups\b|rmu/i, 'Equipment', 'equip'],
  [/cable|conduit|lighting|luminaire|socket|earthing|duct|hvac|fire|plumbing|sanitary|mechanical|electrical|mep|bms|elv|cctv|alarm/i, 'MEP & systems', 'mep'],
  [/supply (of|only)|furnish only/i, 'Supply', 'supply']
];
E.bbGuess = function (text) {
  for (const [rx, disc, preset] of E.BB_RULES) if (rx.test(text)) return { disc, preset };
  return { disc: 'Other', preset: 'def' };
};
const bbNum = v => { if (v === null || v === undefined || v === '') return NaN; if (typeof v === 'number') return v; const s = String(v).replace(/[,\s]/g, '').replace(/^\((.*)\)$/, '-$1'); return /^-?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN; };

/* Read BOQ rows, keeping the section headings so the bill hierarchy survives. */
E.bbRead = function (rows, col) {
  const items = [], heads = []; let total = 0, bill = '', sect = '', skipped = 0, declared = null; const skippedRows = [];
  for (let i = col.header + 1; i < rows.length; i++) {
    const r = rows[i] || []; const item = String(r[col.item] == null ? '' : r[col.item]).trim(), desc = String(col.desc >= 0 && r[col.desc] != null ? r[col.desc] : '').trim();
    const amt = bbNum(r[col.amount]), qty = col.qty >= 0 ? bbNum(r[col.qty]) : NaN, rate = col.rate >= 0 ? bbNum(r[col.rate]) : NaN;
    if (!item && !desc) continue;
    if (/\b(grand\s*total|total|sub-?total|carried|brought)\b/i.test(desc + ' ' + item) && !isNaN(amt)) { if (/grand/i.test(desc + item)) declared = amt; skipped++; skippedRows.push({ row: i + 1, item, desc, amount: amt, why: 'Total or sub-total line (not scheduled)' }); continue; }
    if (isNaN(amt) || amt === 0) {
      if (isNaN(qty) && (item || desc)) { const lvl = item ? item.split('.').filter(Boolean).length : 1; const name = (item ? item + ' ' : '') + desc; if (lvl <= 1) { bill = name.trim(); sect = ''; } else sect = name.trim(); heads.push(name); }
      else { skipped++; skippedRows.push({ row: i + 1, item, desc, amount: isNaN(amt) ? null : amt, why: 'Has a quantity but no amount, or the amount is zero: NOT scheduled. Check it is not a missing price.' }); }
      continue;
    }
    items.push({ n: items.length, item: item || ('#' + (items.length + 1)), desc, unit: col.unit >= 0 ? String(r[col.unit] || '') : '', qty: isNaN(qty) ? 0 : qty, rate: isNaN(rate) ? 0 : rate, amount: amt, bill: (col.part >= 0 && r[col.part]) ? String(r[col.part]) : (bill || 'BOQ'), area: (col.area >= 0 && r[col.area]) ? String(r[col.area]).trim() : '', sect }); total += amt;
  }
  return { items, total, skipped, skippedRows, declared, heads: heads.length };
};

/* Heuristic reader for PDF text lines: item no, description, unit, qty, rate, amount. */
E.bbReadPdfLines = function (text) {
  const items = [], rows = []; let bill = '';
  for (const raw of text.split(/\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim(); if (!line) continue;
    const m = line.match(/^(\d+(?:\.\d+)*[a-z]?)\s+(.*?)\s+([A-Za-z][A-Za-z0-9.²³\/]{0,7})\s+([\d,]*\.?\d+)\s+([\d,]*\.?\d+)\s+([\d,]*\.?\d+)$/);
    if (m) { rows.push([m[1], m[2], m[3], m[4], m[5], m[6], bill]); continue; }
    const h = line.match(/^(\d+)\s+([A-Za-z].*)$/); if (h && !/\d{2,}[\d,.]*$/.test(line)) bill = line;
  }
  return [['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount', 'Part']].concat(rows);
};

E.bbSplitOf = function (B, it) {
  if (B.over[it.n]) return B.over[it.n];
  const bl = B.bills[it.bill]; if (bl) { if (bl.split) return bl.split; const p = E.BB_PRESETS[bl.preset]; if (p && p.split) return p.split; }
  return B.def;
};
E.bbSum = s => (+s.E || 0) + (+s.P || 0) + (+s.C || 0) + (+s.T || 0);

/* ---------- calendar ---------- */
E.BB_DAYN = { 1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat' };
E.BB_WEEK = [7, 1, 2, 3, 4, 5, 6]; // week as the project works it: Saturday first
E.bbCalName = function (days, hrs) {
  const idx = E.BB_WEEK.map((d, i) => days.includes(d) ? i : -1).filter(i => i >= 0);
  const contig = idx.length && idx[idx.length - 1] - idx[0] + 1 === idx.length;
  const lab = contig ? E.BB_DAYN[E.BB_WEEK[idx[0]]] + (idx.length > 1 ? '–' + E.BB_DAYN[E.BB_WEEK[idx[idx.length - 1]]] : '') : idx.map(i => E.BB_DAYN[E.BB_WEEK[i]]).join(',');
  return 'Baseline Builder ' + days.length + 'x' + hrs + ' (' + lab + ')';
};
/* holidays: one date or 'date to date' per line; returns { days: [unix day numbers], bad: [lines] } */
E.bbHolidays = function (txt) {
  const out = new Set(), bad = []; const D = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim()); if (!m) return NaN; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); const d = new Date(t); return d.getUTCMonth() === +m[2] - 1 ? t / 864e5 : NaN; };
  String(txt || '').split(/[\n;,]+/).map(x => x.trim()).filter(Boolean).forEach(l => { const p = l.split(/\s+to\s+/i); const a = D(p[0]), b = p.length > 1 ? D(p[1]) : a; if (isNaN(a) || isNaN(b) || b < a || b - a > 400 || p.length > 2) bad.push(l); else for (let d = a; d <= b; d++) out.add(d); });
  return { days: [...out].sort((x, y) => x - y), bad };
};
E.bbCalData = function (days, hrs, hol) {
  const s = 8, f = s + hrs; const hh = n => String(n).padStart(2, '0') + ':00';
  const day = d => days.includes(d) ? '(0||' + d + '()(' + '(0||0(f|' + hh(f) + '|s|' + hh(s) + ')())))' : '(0||' + d + '()())';
  return '(0||CalendarData()((0||DaysOfWeek()(' + [1, 2, 3, 4, 5, 6, 7].map(day).join('') + '))(0||VIEW(ShowTotal|Y)())(0||Exceptions()' + (hol && hol.length ? '(' + hol.map((d, i) => '(0||' + i + '(d|' + (d + 25569) + ')())').join('') + ')' : '()') + ')))';
};
E.bbCalCheck = function (days, hrs, data) {
  const c = E.parseCalendar(data), want = [1, 2, 3, 4, 5, 6, 7].filter(d => days.includes(d)), got = [1, 2, 3, 4, 5, 6, 7].filter(d => c.dow[d]);
  return want.join() === got.join();
};

/* ---------- XER writer (field lists and table order copied from a real P6 20.12 export) ---------- */
E.BB_RSID = { PROG: 'PROG', COST: 'BOQ-COST' };
E.bbGuid = function (seed) {
  let h = 2166136261 >>> 0; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const b = []; let x = h || 1; for (let i = 0; i < 16; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; b.push(x & 255); }
  return btoa(String.fromCharCode.apply(null, b)).replace(/=+$/, '');
};
E.bbXER = function (B, R) {
  const set = B.set, hrs = 8, days = set.days && set.days.length ? set.days : [7, 1, 2, 3, 4, 5], F = E.BB_XF, L = [], cur = set.currency || 'SAR';
  const pad = n => String(n).padStart(2, '0'), fmt = (d, h) => { const x = new Date(d); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()) + ' ' + pad(h) + ':00'; };
  const now = (set.start || '2026-11-01') + ' 00:00'; /* fixed stamp from the project start: same input gives the same file */
  const dstr = (dayNo, h) => dayNo == null ? '' : fmt(dayNo * 864e5, h), num = v => String(Math.round(v * 1e6) / 1e6);
  const clean = v => v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' ').replace(/[\u2013\u2014\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2192/g, '->');
  const T = (name, rows) => { const f = F[name]; L.push('%T\t' + name); L.push('%F\t' + f.join('\t')); rows.forEach(o => L.push('%R\t' + f.map(k => clean(o[k])).join('\t'))); };
  const C = R.cpm, proj = 1, cl = 1, startH = 8, endH = 8 + hrs, ps = (set.start || '2026-11-01') + ' 00:00', pEnd = C ? dstr(C.finishDate, endH) : '', cal = E.bbCalData(days, hrs, E.bbHolidays(set.holText).days.filter(d => days.includes(new Date(d * 864e5).getUTCDay() + 1))).replace(/\(f\|(\d\d:\d\d)\|s\|(\d\d:\d\d)\)/g, '(s|$2|f|$1)');
  L.push(['ERMHDR', '20.12', now.slice(0, 10), 'Project', 'ADMIN', 'admin', 'dbxDatabaseNoName', 'Project Management', cur].join('\t'));
  T('CURRTYPE', [{ curr_id: 1, decimal_digit_cnt: 2, curr_symbol: cur, decimal_symbol: '.', digit_group_symbol: ',', pos_curr_fmt_type: '#1.1', neg_curr_fmt_type: '(#1.1)', curr_type: cur, curr_short_name: cur, group_digit_cnt: 3, base_exch_rate: 1 }]);
  T('FINTMPL', [{ fintmpl_id: 1, fintmpl_name: 'Ending Saturday', default_flag: 'Y' }]);
  T('OBS', [{ obs_id: 1, seq_num: 0, obs_name: 'Enterprise', obs_descr: '' }]);
  T('PROJECT', [{ proj_id: proj, fy_start_month_num: 1, rsrc_self_add_flag: 'Y', allow_complete_flag: 'Y', rsrc_multi_assign_flag: 'Y', checkout_flag: 'N', project_flag: 'Y', step_complete_flag: 'N', cost_qty_recalc_flag: 'N', batch_sum_flag: 'Y', name_sep_char: '.', def_complete_pct_type: 'CP_Drtn', proj_short_name: set.prefix, clndr_id: cl, task_code_base: 1000, task_code_step: 10, priority_num: 10, wbs_max_sum_level: 2, strgy_priority_num: 500, critical_drtn_hr_cnt: 0, def_cost_per_qty: '0.0000', last_recalc_date: ps, plan_start_date: ps.slice(0, 11) + pad(startH) + ':00', plan_end_date: pEnd, scd_end_date: pEnd, add_date: now, def_duration_type: 'DT_FixedDUR2', task_code_prefix: 'A', guid: E.bbGuid('proj' + set.prefix), def_qty_type: 'QT_Hour', add_by_name: 'ADMIN', def_rate_type: 'COST_PER_QTY', add_act_remain_flag: 'N', act_this_per_link_flag: 'Y', def_task_type: 'TT_Task', act_pct_link_flag: 'Y', critical_path_type: 'CT_TotFloat', task_code_prefix_flag: 'Y', def_rollup_dates_flag: 'Y', use_project_baseline_flag: 'Y', rem_target_link_flag: 'Y', reset_planned_flag: 'N', allow_neg_act_flag: 'N', sum_assign_level: 'SL_Taskrsrc', fintmpl_id: 1, loaded_scope_level: 7, export_flag: 'Y' }]);
  T('CALENDAR', [{ clndr_id: cl, default_flag: 'N', clndr_name: E.bbCalName(days, hrs), last_chng_date: now.slice(0, 10) + ' 00:00', clndr_type: 'CA_Base', day_hr_cnt: hrs, week_hr_cnt: hrs * days.length, month_hr_cnt: Math.round(hrs * days.length * 52 / 12), year_hr_cnt: hrs * days.length * 52, rsrc_private: 'N', clndr_data: cal }]);
  T('SCHEDOPTIONS', [{ schedoptions_id: 1, proj_id: proj, sched_outer_depend_type: 'SD_Both', sched_open_critical_flag: 'N', sched_lag_early_start_flag: 'Y', sched_retained_logic: 'Y', sched_setplantoforecast: 'N', sched_float_type: 'FT_FF', sched_calendar_on_relationship_lag: 'rcal_Predecessor', sched_use_expect_end_flag: 'Y', sched_progress_override: 'N', level_float_thrs_cnt: 0, level_outer_assign_flag: 'N', level_outer_assign_priority: 5, level_over_alloc_pct: 25, level_within_float_flag: 'N', level_keep_sched_date_flag: 'Y', level_all_rsrc_flag: 'Y', sched_use_project_end_date_for_float: 'Y', enable_multiple_longest_path_calc: 'N', limit_multiple_longest_path_calc: 'Y', max_multiple_longest_path: 10, use_total_float_multiple_longest_paths: 'Y', LevelPriorityList: 'priority_type,ASC_BY_FIELD/ASC' }]);
  T('PROJWBS', R.wbs.map((w, i) => ({ wbs_id: w.id, proj_id: proj, obs_id: 1, seq_num: w.parent ? i : 100, est_wt: 1, proj_node_flag: w.parent ? 'N' : 'Y', sum_data_flag: 'N', status_code: 'WS_Open', wbs_short_name: w.code, wbs_name: w.name, parent_wbs_id: w.parent || '', ev_user_pct: w.parent ? 0 : '', ev_etc_user_value: w.parent ? 0 : '', orig_cost: '0.0000', indep_remain_total_cost: '0.0000', ev_compute_type: 'EC_Cmp_pct', ev_etc_compute_type: 'EE_Rem_hr', guid: E.bbGuid('wbs' + w.id + w.code) })));
  const rs = [[1, 'Progress (weight)', E.BB_RSID.PROG, +set.price], [2, 'BOQ Cost (quantity only)', E.BB_RSID.COST, 0]];
  T('RSRC', rs.map(r => ({ rsrc_id: r[0], clndr_id: cl, guid: E.bbGuid('rs' + r[2]), rsrc_seq_num: r[0], rsrc_name: r[1], rsrc_short_name: r[2], def_qty_per_hr: 1, cost_qty_type: 'QT_Hour', active_flag: 'Y', auto_compute_act_flag: 'Y', def_cost_qty_link_flag: 'Y', ot_flag: 'N', curr_id: 1, rsrc_type: 'RT_Mat' })));
  T('RSRCRATE', rs.map(r => ({ rsrc_rate_id: r[0], rsrc_id: r[0], max_qty_per_hr: 1, cost_per_qty: num(r[3]), start_date: '2020-01-01 00:00', cost_per_qty2: num(r[3]), cost_per_qty3: 0, cost_per_qty4: 0, cost_per_qty5: 0 })));
  const ttype = a => a.mile === 'start' ? 'TT_Mile' : a.mile === 'finish' ? 'TT_FinMile' : 'TT_Task';
  const dts = a => { const c = a.cpm; if (!c) return { s: '', f: '' }; return { s: dstr(c.sd, startH), f: dstr(c.fd, endH) }; };
  T('TASK', R.acts.map(a => { const d = dts(a), ms = !!a.mile; return { task_id: a.id, proj_id: proj, wbs_id: a.wbs, clndr_id: cl, phys_complete_pct: 0, rev_fdbk_flag: 'N', est_wt: 0, lock_plan_flag: 'N', auto_compute_act_flag: 'N', complete_pct_type: a.hasRes ? 'CP_Units' : 'CP_Drtn', task_type: ttype(a), duration_type: a.hasRes ? 'DT_FixedDUR2' : 'DT_FixedDrtn', status_code: 'TK_NotStart', task_code: a.code, task_name: a.name, total_float_hr_cnt: a.cpm ? a.cpm.tf * hrs : 0, free_float_hr_cnt: 0, remain_drtn_hr_cnt: a.dur * hrs, act_work_qty: 0, remain_work_qty: 0, target_work_qty: 0, target_drtn_hr_cnt: a.dur * hrs, target_equip_qty: 0, act_equip_qty: 0, remain_equip_qty: 0, early_start_date: d.s, early_end_date: d.f, restart_date: d.s, reend_date: d.f, target_start_date: d.s, target_end_date: d.f, priority_type: 'PT_Normal', guid: E.bbGuid('t' + a.code), driving_path_flag: 'N', act_this_per_work_qty: 0, act_this_per_equip_qty: 0, create_date: now, update_date: now, create_user: 'ADMIN', update_user: 'ADMIN' }; }));
  const PT = { FS: 'PR_FS', SS: 'PR_SS', FF: 'PR_FF', SF: 'PR_SF' }, byId = new Map(R.acts.map(a => [a.id, a]));
  T('TASKPRED', R.links.map((l, i) => ({ task_pred_id: i + 1, task_id: l.succ, pred_task_id: l.pred, proj_id: proj, pred_proj_id: proj, pred_type: PT[l.type] || 'PR_FS', lag_hr_cnt: l.lag * hrs })));
  T('TASKRSRC', R.assigns.map(x => { const d = dts(byId.get(x.act)); return { taskrsrc_id: x.id, task_id: x.act, proj_id: proj, cost_qty_link_flag: 'Y', rsrc_id: x.rs === 'PROG' ? 1 : 2, remain_qty: num(x.qty), target_qty: num(x.qty), target_lag_drtn_hr_cnt: 0, act_ot_qty: 0, act_reg_qty: 0, relag_drtn_hr_cnt: 0, cost_per_qty: num(x.price), target_cost: num(x.cost), act_reg_cost: '0.0000', act_ot_cost: '0.0000', remain_cost: num(x.cost), restart_date: d.s, reend_date: d.f, target_start_date: d.s, target_end_date: d.f, rollup_dates_flag: 'Y', ts_pend_act_end_flag: 'N', guid: E.bbGuid('tr' + x.id), rate_type: 'COST_PER_QTY', act_this_per_cost: '0.0000', act_this_per_qty: 0, rsrc_type: 'RT_Mat', cost_per_qty_source_type: 'ST_Rsrc', create_user: 'ADMIN', create_date: now }; }));
  L.push('%E');
  return L.join('\r\n') + '\r\n';
};

E.hash = function (str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('00000000' + h.toString(16)).slice(-8).toUpperCase(); };
