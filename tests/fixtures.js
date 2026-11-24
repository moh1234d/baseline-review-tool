/* Small synthetic XER files for the UI tests: one calendar, a WBS, a finish milestone fed by three chains.
   mk({dd, tasks:[{code, name, wbs, status, es, ef, dur, tf}], links:[[from, to, type, lagDays]]}) -> XER text */
const H = d => d + ' 08:00', E8 = d => d + ' 16:00';
function mk(o) {
  const L = [];
  const tbl = (name, f, rows) => { L.push('%T\t' + name); L.push('%F\t' + f.join('\t')); rows.forEach(r => L.push('%R\t' + f.map(k => r[k] == null ? '' : r[k]).join('\t'))); };
  L.push('ERMHDR\t20.12\t' + o.dd + '\tProject\tadmin\tadmin\tdbxDatabaseNoName\tProject Management\tSAR');
  tbl('PROJECT', ['proj_id', 'proj_short_name', 'last_recalc_date', 'plan_start_date', 'scd_end_date', 'clndr_id'], [{ proj_id: 1, proj_short_name: o.name || 'TEST', last_recalc_date: H(o.dd), plan_start_date: H('2026-01-05'), scd_end_date: E8('2026-12-31'), clndr_id: 1 }]);
  tbl('CALENDAR', ['clndr_id', 'default_flag', 'clndr_name', 'proj_id', 'clndr_type', 'day_hr_cnt', 'week_hr_cnt', 'clndr_data'], [{ clndr_id: 1, default_flag: 'Y', clndr_name: '7D - 8h', proj_id: 1, clndr_type: 'CA_Project', day_hr_cnt: 8, week_hr_cnt: 56, clndr_data: '' }]);
  const wbs = [{ wbs_id: 10, proj_id: 1, proj_node_flag: 'Y', parent_wbs_id: '', wbs_short_name: 'TEST', wbs_name: 'Test project', seq_num: 0 }];
  const W = {}; let wid = 11; (o.tasks || []).forEach(t => { const k = t.wbs || 'Works'; if (!W[k]) { W[k] = wid++; wbs.push({ wbs_id: W[k], proj_id: 1, proj_node_flag: 'N', parent_wbs_id: 10, wbs_short_name: 'W' + W[k], wbs_name: k, seq_num: W[k] }); } });
  tbl('PROJWBS', ['wbs_id', 'proj_id', 'proj_node_flag', 'parent_wbs_id', 'wbs_short_name', 'wbs_name', 'seq_num'], wbs);
  const ids = {}; let id = 100;
  const rows = o.tasks.map(t => { ids[t.code] = id++; const done = t.status === 'TK_Complete', act = t.status === 'TK_Active';
    return { task_id: ids[t.code], proj_id: 1, wbs_id: W[t.wbs || 'Works'], clndr_id: 1, task_code: t.code, task_name: t.name || t.code, status_code: t.status || 'TK_NotStart', task_type: t.type || 'TT_Task',
      target_drtn_hr_cnt: (t.dur || 0) * 8, remain_drtn_hr_cnt: done ? 0 : (t.rem != null ? t.rem : t.dur || 0) * 8, total_float_hr_cnt: (t.tf || 0) * 8,
      act_start_date: done || act ? H(t.es) : '', act_end_date: done ? E8(t.ef) : '', early_start_date: H(t.es), early_end_date: E8(t.ef), late_start_date: H(t.es), late_end_date: E8(t.ef),
      target_start_date: H(t.es), target_end_date: E8(t.ef), complete_pct_type: 'CP_Drtn', phys_complete_pct: done ? 100 : 0 }; });
  tbl('TASK', ['task_id', 'proj_id', 'wbs_id', 'clndr_id', 'task_code', 'task_name', 'status_code', 'task_type', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'total_float_hr_cnt', 'act_start_date', 'act_end_date', 'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date', 'target_start_date', 'target_end_date', 'complete_pct_type', 'phys_complete_pct'], rows);
  let pid = 1;
  tbl('TASKPRED', ['task_pred_id', 'task_id', 'pred_task_id', 'proj_id', 'pred_proj_id', 'pred_type', 'lag_hr_cnt'], (o.links || []).map(([a, b, ty, lag]) => ({ task_pred_id: pid++, task_id: ids[b], pred_task_id: ids[a], proj_id: 1, pred_proj_id: 1, pred_type: 'PR_' + (ty || 'FS'), lag_hr_cnt: (lag || 0) * 8 })));
  tbl('SCHEDOPTIONS', ['schedoptions_id', 'proj_id', 'sched_retained_logic', 'sched_progress_override'], [{ schedoptions_id: 1, proj_id: 1, sched_retained_logic: 'Y', sched_progress_override: 'N' }]);
  L.push('%E'); return L.join('\r\n') + '\r\n';
}
const day = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
/* three chains into the finish milestone FIN; `omit` leaves activities out (a baseline that lacks them); `shift` moves the update's dates */
function project(o) {
  o = o || {}; const s0 = '2026-02-01', dd = o.dd || '2026-03-01', sh = o.shift || 0, T = [], Lk = [];
  const px = o.prefix || '', wx = o.wbsPrefix || ''; const chain = (p0, n, len, start, wbs0, trades) => { const p = px + p0, wbs = wx + wbs0; let d = start; for (let i = 1; i <= n; i++) { const code = p + i; if (!(o.omit || []).includes(p0 + i)) { const es = day(d, i > 1 ? 1 : 0), ef = day(es, len - 1); T.push({ code, name: trades[i - 1] + ' - ' + wbs, wbs, es, ef, dur: len, tf: o.tf || 0 }); if (i > 1 && !(o.omit || []).includes(p0 + (i - 1))) Lk.push([p + (i - 1), code]); if (i === n) Lk.push([code, px + 'FIN']); } d = day(d, len + (i > 1 ? 1 : 0)); } };
  chain('A', 6, 14 + sh, s0, 'Level 01 Guest Rooms', ['Blockwork', 'Plastering', 'Gypsum Ceiling', 'Painting', 'Flooring', 'Joinery']);
  chain('B', 5, 15 + sh, s0, 'Level 02 Corridors', ['HVAC Ducting', 'Sprinkler Piping', 'Cable Tray', 'Wiring', 'Lighting Fixtures']);
  chain('C', 5, 13 + sh, s0, 'Basement 1 Plant Room', ['Pump Skids', 'Chillers', 'Switchgear', 'Panel Termination', 'Testing and Commissioning']);
  const last = T.reduce((m, t) => t.ef > m ? t.ef : m, s0);
  T.push({ code: px + 'FIN', name: 'Project Completion', wbs: wx + 'Milestones', type: 'TT_FinMile', es: day(last, 1), ef: day(last, 1), dur: 0 });
  T.forEach(t => { if (t.code === px + 'FIN') return; if (t.ef < dd) t.status = 'TK_Complete'; else if (t.es < dd) { t.status = 'TK_Active'; t.rem = Math.max(1, Math.round((Date.parse(t.ef) - Date.parse(dd)) / 864e5)); } });
  return mk({ dd, name: o.name, tasks: T, links: Lk });
}
module.exports = { mk, project };
