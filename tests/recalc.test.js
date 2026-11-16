const fs=require('fs');const dir=require('path').join(__dirname,'..','src')+'/';
const files=['engine1','engine2','engine3','engine4','engine5','engine6','engine7','xerfields','engine8','engine9','engine10','engine11','engine12','engine13','engine14','engine15','engine16'];
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
{const a=mk('A',{es:D('2026-01-05'),ef:D('2026-01-09')}),b=mk('B',{es:D('2026-01-14'),ef:D('2026-01-16')});link(a,b,'FS',2);
 const M={cal:{c:cal},tasks:[a,b]};eq('relationship gap: lag counted in working days',E.dlDrivers(M,b)[0].gap,0);b.es=D('2026-01-16');eq('relationship gap: two days late',E.dlDrivers(M,b)[0].gap,2);}
{ // update checks
 const DD=D('2026-01-12'),mkB=(id,o)=>mk(id,Object.assign({type:'TT_Task'},o));
 const a1=mkB('X',{ef:D('2026-01-09'),te:D('2026-01-09')}),a2=mkB('Y',{ef:D('2026-01-12'),te:D('2026-01-12')}),a3=mkB('Z',{ef:D('2026-02-20'),te:D('2026-02-20')});
 const b1=mkB('X',{status:'TK_Complete',ef:D('2026-01-09')}),b2=mkB('Y',{status:'TK_NotStart',ef:D('2026-01-16')}),b3=mkB('Z',{status:'TK_Active',es:D('2026-01-05'),ef:D('2026-02-27'),tfCal:-7}),p=mkB('P',{status:'TK_NotStart',ef:D('2026-01-30')}),w=mkB('W',{status:'TK_Active',ef:D('2026-01-30')}),v=mkB('V',{status:'TK_Complete',as:DD+3,ef:DD+4});
 link(p,b3);
 const A={tasks:[a1,a2,a3],dataDate:D('2026-01-05'),cal:{c:cal}},B={tasks:[b1,b2,b3,p,w,v],dataDate:DD,cal:{c:cal}};
 const raw=new Map([['W',{complete_pct_type:'CP_Phys',phys_complete_pct:'50',target_drtn_hr_cnt:'80',remain_drtn_hr_cnt:'70'}]]);
 const R={sections:[]},sec=(k,t,d)=>{const x={key:k,facts:[],blocks:[],count:0};R.sections.push(x);return x},blk=(s,t,c,r)=>{s.blocks.push({rows:r})};
 E.updateChecks(R,{A,B,sec,blk,T:(v,t)=>({v,t}),num:(x)=>String(x),r1:x=>Math.round(x*10)/10,dd:x=>String(x),isCrit:()=>false,both:[[a1,b1],[a2,b2],[a3,b3]],rawB:raw,opt:{cfg:{}}});
 eq('BEI: one of two planned activities complete',R.upd.bei,0.5);eq('missed activities',R.upd.missed,1);eq('out-of-sequence: started before predecessor finished',R.upd.oos,1);eq('physical percent vs remaining',R.upd.pct,1);eq('actual after the data date',R.upd.fut,1);
 eq('CPLI below 1 when float is negative',R.upd.cpli<1,true);}

{ // v7.9 expected finish
 const mkE=()=>mk('E',{durWd:20,ee:D('2026-01-12')});
 eq('expected finish: option on shortens finish',fmt(run([mkE()],{sched_use_expect_end_flag:'Y'}).ef.get('E')),'2026-01-12');
 eq('expected finish: option off uses remaining duration',fmt(run([mkE()],{sched_use_expect_end_flag:'N'}).ef.get('E')),'2026-01-30');
 eq('expected finish: setting forced on',fmt(E.recalc({dataDate:D('2026-01-05'),cal:{c:cal},tasks:[mkE()],so:{}},{expectFinish:'on'}).ef.get('E')),'2026-01-12');
}

{ // v8.0 delay train: origin = first activity that added the delay, traced through completed work
 const mkM=(sl)=>{const a=mk('A',{status:'TK_Complete',es:D('2026-01-05'),ef:D('2026-01-09'),as:D('2026-01-05'),durWd:5}),b=mk('B',{status:sl?'TK_Complete':'TK_Complete',es:D('2026-01-12'),ef:D(sl?'2026-01-30':'2026-01-16'),as:D('2026-01-12'),durWd:5}),
  c=mk('C',{es:D(sl?'2026-02-02':'2026-01-19'),ef:D(sl?'2026-02-06':'2026-01-23'),durWd:5,remWd:5}),f=mk('F',{isMile:true,isFinMile:true,type:'TT_FinMile',es:D(sl?'2026-02-06':'2026-01-23'),ef:D(sl?'2026-02-06':'2026-01-23'),durWd:0});
  link(a,b);link(b,c);link(c,f);return {tasks:[a,b,c,f],cal:{c:cal},wbs:{},dataDate:D('2026-02-02')};};
 const Tr=E.delayTrain(mkM(false),mkM(true),{targetCode:'F'});
 eq('train: origin is the activity that overran',Tr.origin.code,'B');eq('train: delay it added (calendar days)',Tr.origin.own,14);eq('train: finish slip',Tr.target.slip,14);
 const t=mk('R',{durWd:20,remWd:5});eq('recalc uses stored remaining duration without the raw rows',fmt(E.recalc({dataDate:D('2026-01-05'),cal:{c:cal},tasks:[t],so:{}},{}).ef.get('R')),'2026-01-09');
}
console.log(n+' checks passed');
