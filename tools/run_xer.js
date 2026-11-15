/* Runs the tool's engine on an XER in Node (no browser) and writes a JSON summary.
   Usage: node tools/run_xer.js path/to/file.xer [out.json]
   Same engine files and default settings as Quick review. Nothing is uploaded. */
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src') + '/';
const files = ['engine1','engine2','engine3','engine4','engine5','engine6','engine7','xerfields','engine8','engine9','engine10','engine11','engine12','engine13','engine14','engine15'];
const E = new Function('window', 'document', 'localStorage', files.map(f => fs.readFileSync(dir + f + '.js', 'utf8')).join('\n') + '\nreturn E;')({}, {}, {});
const xer = process.argv[2], out = process.argv[3] || 'xer_summary.json';
if (!xer) { console.error('usage: node tools/run_xer.js file.xer [out.json]'); process.exit(1); }
const t0 = Date.now(), M = E.buildModel(E.parseXER(fs.readFileSync(xer, 'latin1'))), tLoad = Date.now() - t0;
const cfg = Object.assign(E.defaultCfg(), {}); cfg.wbsMap = E.suggestWbsMap(M); cfg.rsrc = E.suggestResources(M);
E.applyCategories(M, cfg.wbsMap); cfg.approvalIds = E.suggestApprovals(M, cfg.approvalExclude);
const t1 = Date.now(), run = E.run(M, cfg), tChecks = Date.now() - t1;
const t2 = Date.now(), st = E.structure(M, cfg), tStruct = Date.now() - t2;
const cnt = a => { const m = new Map(); for (const x of a) m.set(x, (m.get(x) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
let seq = null; try { seq = E.seqCheck(st, cfg); } catch (e) { seq = { error: String(e.message) }; }
const summary = {
  engine_version: E.VERSION || null, file: path.basename(xer), timing_ms: { load: tLoad, checks: tChecks, structure: tStruct },
  project: { name: M.proj && M.proj.proj_short_name, data_date: E.fmtDate(M.dataDate), activities: M.tasks.length, calendars: Object.keys(M.cal || {}).length },
  checks: run.results.map(r => ({ id: r.id, title: r.title, tier: r.tier, status: r.status, count: r.count, summary: r.summary })),
  structure: {
    code_map: st.codeMap, detection_sources: st.srcCount,
    values: Object.fromEntries(Object.entries(st.vals).map(([k, v]) => [k, v.slice(0, 40).map(x => [x.v, x.n])])),
    stages: st.stages.map(s => [s.v, s.n]), stages_by_task_count: cnt(st.rows.map(o => o.stage)).slice(0, 10)
  },
  sequence_rules: seq && seq.rules ? seq.rules.filter(r => r.on).map(r => ({ id: r.rule.id, title: r.rule.title, groups: r.groups, findings: r.items.length, examples: r.items.slice(0, 3) })) : seq,
  floor_direction: seq && seq.e1 ? seq.e1.map(x => ({ step: x.step, group: x.k, group_kind: x.kind, floors: x.floors, direction: x.dir, consistency: +x.tau.toFixed(2), warn: x.warn })) : null
};
fs.writeFileSync(out, JSON.stringify(summary, null, 1)); console.log('written', out, '| activities', M.tasks.length, '| load', tLoad, 'ms | checks', tChecks, 'ms | structure', tStruct, 'ms');
