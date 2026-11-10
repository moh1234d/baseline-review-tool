const fs=require('fs');const dir=require('path').join(__dirname,'..','src')+'/';
const files=['engine1','engine2','engine3','engine4','engine5','engine6','engine7','xerfields','engine8','engine9','engine10','engine11','engine12','engine13','engine14'];
const code=files.map(f=>fs.readFileSync(dir+f+'.js','utf8')).join('\n')+'\nreturn E;';
const E=new Function('window','document','localStorage',code)({},{},{});
// day numbers: 2026-01-05 is Monday. day = epoch days
const D=s=>Math.round(Date.parse(s+'T00:00:00Z')/86400000);
const cal={ex:new Map(),dow:{1:false,2:true,3:true,4:true,5:true,6:true,7:false},dayHr:8,wdw:5};
const mk=(id,o)=>Object.assign({id,code:id,clndr:'c',status:'TK_NotStart',es:null,ef:null,pre:[],succ:[],isMile:false,isFinMile:false,type:'TT_Task',durWd:5},o);
const link=(a,b,type,lag)=>{const l={from:a,to:b,type:type||'FS',lagWd:lag||0};b.pre.push(l);a.succ.push(l);return l};
const run=(tasks,so)=>E.recalc({dataDate:D('2026-01-05'),cal:{c:cal},tasks,so:so||{}},{});
const fmt=d=>new Date(d*86400000).toISOString().slice(0,10);
const assert=require('assert');let n=0;const eq=(name,got,want)=>{assert.strictEqual(got,want,name);n++;};
{const a=mk('M0',{isMile:true,type:'TT_Mile',durWd:0}),t=mk('A',{durWd:20}),m=mk('M1',{isMile:true,isFinMile:true,type:'TT_FinMile',durWd:0}),b=mk('B',{durWd:5});
 link(a,t);link(t,m);link(m,b);const r=run([a,t,m,b]);eq('start milestone: successor same day',fmt(r.es.get('A')),'2026-01-05');eq('finish milestone takes predecessor finish day',fmt(r.ef.get('M1')),'2026-01-30');eq('successor of finish milestone starts next working day',fmt(r.es.get('B')),'2026-02-02');}
{const p=mk('P',{durWd:20}),a=mk('A',{status:'TK_Active',es:D('2026-01-01'),durWd:5});link(p,a,'FF',0);eq('in progress FF: retained logic',fmt(run([p,a]).ef.get('A')),'2026-01-30');eq('in progress FF: progress override',fmt(run([p,a],{sched_retained_logic:'N'}).ef.get('A')),'2026-01-09');}
{const p=mk('P',{durWd:10}),a=mk('A',{status:'TK_Active',es:D('2026-01-01'),durWd:5});link(p,a,'FS',0);eq('in progress FS: retained logic',fmt(run([p,a]).ef.get('A')),'2026-01-23');}
{const a=mk('A',{durWd:10}),b=mk('B',{durWd:10}),l=mk('L',{type:'TT_LOE',durWd:200});link(a,b);eq('level of effort does not hold the finish',fmt(run([a,b,l]).finish),'2026-01-30');}
{const a=mk('A',{durWd:5,cstrType:'CS_MSOB',cstrDate:D('2026-02-10')});eq('start on or before is not a floor',fmt(run([a]).es.get('A')),'2026-01-05');
 const b=mk('B',{durWd:5,cstrType:'CS_MSOA',cstrDate:D('2026-02-10')});eq('start on or after is a floor',fmt(run([b]).es.get('B')),'2026-02-10');}
console.log(n+' checks passed');
