/* ---------------- Schedule quality: DCMA 14-point, AACE-based enhanced checks, or a bespoke set ---------------- */
const DQ={res:null,sel:null,ctx:null};
const Q={cfg:null,prev:null,prevKey:null,prevBusy:null,edit:null}; try{ Q.cfg=JSON.parse(localStorage.getItem('pacer.qcfg')||'null'); }catch(_){}
const QH=new Set(['CS_MSO','CS_MEO','CS_MSOB','CS_MEOB','CS_MANDSTART','CS_MANDFIN']), QS=new Set(['CS_MSOA','CS_MEOA']);
// Check library. k: pct | count | ratio | bool. dir: le (lower is better) | ge (higher is better). p: an adjustable parameter.
const QLIB={
  logic:{t:'Logic (open ends)',refs:{dcma:'DCMA 1',aace:'RP 78R-13 · 53R-06'},k:'pct',dir:'le',desc:'Incomplete activities missing a predecessor or a successor. A start milestone may have no predecessor and a finish milestone no successor.',
    run:X=>{ const bad=[]; X.inc.forEach(a=>{ const np=!a.preds.length&&a.type!=='TT_Mile', ns=!a.succs.length&&a.type!=='TT_FinMile'; if(np||ns) bad.push(X.it(a,np&&ns?'No predecessor or successor':np?'No predecessor':'No successor')); }); return {v:X.pct(bad.length,X.inc.length),sub:`${bad.length} of ${X.inc.length} incomplete activities`,items:bad}; }},
  dangling:{t:'Dangling logic',refs:{aace:'RP 78R-13 · 49R-06'},k:'pct',dir:'le',desc:'Incomplete activities whose start is not driven by a start-type link (only FF or SF predecessors), or whose finish drives nothing (only SS or SF successors). Dangling ends let durations change without moving the path.',
    run:X=>{ const bad=[]; X.inc.forEach(a=>{ const ds=a.type!=='TT_Mile'&&a.preds.length&&!a.preds.some(p=>p.type==='FS'||p.type==='SS'), df=a.type!=='TT_FinMile'&&a.succs.length&&!a.succs.some(s=>s.type==='FS'||s.type==='FF');
      if(ds||df) bad.push(X.it(a,ds&&df?'Start and finish dangling':ds?'Start not driven (only FF/SF in)':'Finish drives nothing (only SS/SF out)')); }); return {v:X.pct(bad.length,X.inc.length),sub:`${bad.length} of ${X.inc.length} incomplete activities`,items:bad}; }},
  leads:{t:'Leads',refs:{dcma:'DCMA 2',aace:'RP 78R-13'},k:'count',dir:'le',desc:'Relationships with a negative lag on incomplete work. Leads hide logic and should be replaced by an activity.',
    run:X=>{ const bad=X.rels.filter(x=>x.p.lag<0).map(x=>X.it(x.a,X.rn(x))); return {v:bad.length,sub:`${X.fp(X.pct(bad.length,X.rels.length))} of ${X.rels.length} relationships`,items:bad}; }},
  lags:{t:'Lags',refs:{dcma:'DCMA 3',aace:'RP 78R-13'},k:'pct',dir:'le',desc:'Relationships with a positive lag on incomplete work.',
    run:X=>{ const bad=X.rels.filter(x=>x.p.lag>0).map(x=>X.it(x.a,X.rn(x))); return {v:X.pct(bad.length,X.rels.length),sub:`${bad.length} of ${X.rels.length} relationships`,items:bad}; }},
  biglag:{t:'Long lags',refs:{aace:'RP 78R-13'},k:'count',dir:'le',p:{l:'Lag longer than',u:'days',d:10},desc:'Relationships on incomplete work with a lag longer than the set number of working days. Long lags usually stand in for work, waiting time or a missing activity.',
    run:(X,p)=>{ const bad=X.rels.filter(x=>x.p.lag>p).sort((x,y)=>y.p.lag-x.p.lag).map(x=>X.it(x.a,X.rn(x))); return {v:bad.length,sub:`over ${p} days · ${X.rels.length} relationships checked`,items:bad}; }},
  fs:{t:'Relationship types',refs:{dcma:'DCMA 4',aace:'RP 78R-13'},k:'pct',dir:'ge',desc:'Share of finish-to-start relationships. The list shows the SS, FF and SF links.',
    run:X=>{ const bad=X.rels.filter(x=>x.p.type!=='FS').map(x=>X.it(x.a,X.rn(x))); return {v:X.rels.length?100-X.pct(bad.length,X.rels.length):100,sub:`${bad.length} non-FS of ${X.rels.length}`,items:bad}; }},
  hard:{t:'Hard constraints',refs:{dcma:'DCMA 5',aace:'RP 78R-13 · 53R-06'},k:'pct',dir:'le',desc:'Incomplete activities with a constraint that stops logic driving dates: Start On, Finish On, Start On or Before, Finish On or Before, Mandatory Start, Mandatory Finish.',
    run:X=>{ const bad=X.inc.filter(a=>QH.has(a.raw.cstr_type)||QH.has(a.raw.cstr_type2)).map(a=>X.it(a,[[a.raw.cstr_type,a.raw.cstr_date],[a.raw.cstr_type2,a.raw.cstr_date2]].filter(c=>QH.has(c[0])).map(c=>ENUM[c[0]]+(c[1]?' '+fmtD(pd(c[1])):'')).join(', ')));
      return {v:X.pct(bad.length,X.inc.length),sub:`${bad.length} of ${X.inc.length} incomplete activities`,items:bad}; }},
  soft:{t:'Soft constraints',refs:{aace:'RP 78R-13'},k:'pct',dir:'le',desc:'Incomplete activities with a Start On or After or Finish On or After constraint. These are legitimate for access dates and interfaces, but a high share means dates are being held rather than driven by logic.',
    run:X=>{ const bad=X.inc.filter(a=>QS.has(a.raw.cstr_type)||QS.has(a.raw.cstr_type2)).map(a=>X.it(a,ENUM[QS.has(a.raw.cstr_type)?a.raw.cstr_type:a.raw.cstr_type2]+(a.raw.cstr_date?' '+fmtD(pd(a.raw.cstr_date)):''))); return {v:X.pct(bad.length,X.inc.length),sub:`${bad.length} of ${X.inc.length} incomplete activities`,items:bad}; }},
  hifloat:{t:'High float',refs:{dcma:'DCMA 6',aace:'RP 78R-13'},k:'pct',dir:'le',p:{l:'Total float over',u:'days',d:44},desc:'Incomplete activities with more total float than the set number of working days, which usually points to missing successors.',
    run:(X,p)=>{ const bad=X.inc.filter(a=>a.tf!=null&&a.tf>p).sort((x,y)=>y.tf-x.tf).map(a=>X.it(a,`Total float ${Math.round(a.tf)}d`)); return {v:X.pct(bad.length,X.inc.length),sub:`${bad.length} of ${X.inc.length} over ${p}d`,items:bad}; }},
  negfloat:{t:'Negative float',refs:{dcma:'DCMA 7',aace:'RP 49R-06 · 53R-06'},k:'pct',dir:'le',desc:'Incomplete activities with total float below zero, meaning the forecast misses a constraint or deadline.',
    run:X=>{ const bad=X.inc.filter(a=>a.tf!=null&&a.tf<-0.01).sort((x,y)=>x.tf-y.tf).map(a=>X.it(a,`Total float ${Math.round(a.tf)}d`)); return {v:X.pct(bad.length,X.inc.length),sub:`${bad.length} of ${X.inc.length} incomplete activities`,items:bad}; }},
  nearcrit:{t:'Near-critical density',refs:{aace:'RP 49R-06 · 92R-17'},k:'pct',dir:'le',p:{l:'Float up to',u:'days',d:10},desc:'Share of incomplete activities that are critical or near-critical (total float at or below the set number of working days). A dense near-critical network means many paths can take over, so the finish is fragile.',
    run:(X,p)=>{ const bad=X.inc.filter(a=>a.tf!=null&&a.tf<=p).sort((x,y)=>x.tf-y.tf).map(a=>X.it(a,`Total float ${Math.round(a.tf)}d`)); return {v:X.pct(bad.length,X.inc.length),sub:`${bad.length} of ${X.inc.length} at ≤ ${p}d float`,items:bad}; }},
  hidur:{t:'High duration',refs:{dcma:'DCMA 8',aace:'RP 78R-13'},k:'pct',dir:'le',p:{l:'Original duration over',u:'days',d:44},desc:'Incomplete tasks with an original duration over the set number of working days. Long tasks are hard to status and should be broken down.',
    run:(X,p)=>{ const bad=[]; X.incT.forEach(a=>{ const d=X.hrs(a,'target_drtn_hr_cnt'); if(d!=null&&d>p) bad.push([a,d]); }); bad.sort((x,y)=>y[1]-x[1]); return {v:X.pct(bad.length,X.incT.length),sub:`${bad.length} of ${X.incT.length} incomplete tasks`,items:bad.map(([a,d])=>X.it(a,`Original duration ${Math.round(d)}d`))}; }},
  invalid:{t:'Invalid dates',refs:{dcma:'DCMA 9',aace:'RP 53R-06 · 90R-17'},k:'count',dir:'le',desc:'Actual dates later than the data date, or forecast dates on unfinished work earlier than it.',
    run:X=>{ if(X.ddt==null) return {na:'No data date in the XER'}; const bad=[]; X.acts.forEach(a=>{ const r=a.raw, as=pd(r.act_start_date), af=pd(r.act_end_date), es=pd(r.early_start_date)??pd(r.restart_date), ef=pd(r.early_end_date)??pd(r.reend_date); let n=null;
        if(as!=null&&X.day(as)>X.ddDay) n='Actual start '+fmtD(as)+' is after the data date'; else if(af!=null&&X.day(af)>X.ddDay) n='Actual finish '+fmtD(af)+' is after the data date';
        else if(a.status==='TK_NotStart'&&es!=null&&X.day(es)<X.ddDay) n='Forecast start '+fmtD(es)+' is before the data date'; else if(a.status!=='TK_Complete'&&ef!=null&&X.day(ef)<X.ddDay) n='Forecast finish '+fmtD(ef)+' is before the data date';
        if(n) bad.push(X.it(a,n)); }); return {v:bad.length,sub:`${X.fp(X.pct(bad.length,X.acts.length))} of ${X.acts.length} activities`,items:bad}; }},
  oos:{t:'Out-of-sequence progress',refs:{aace:'RP 53R-06 · 90R-17'},k:'count',dir:'le',desc:'Work that has progressed against its logic: a successor started before a finish-to-start predecessor finished, or before a start-to-start predecessor started. Out-of-sequence progress distorts the critical path until the logic is corrected.',
    run:X=>{ const bad=[]; X.acts.forEach(a=>{ if(a.status==='TK_NotStart') return; a.preds.forEach(p=>{ const q=p.a, st=q.status; if((p.type==='FS'&&st!=='TK_Complete')||(p.type==='SS'&&st==='TK_NotStart')) bad.push(X.it(a,`Started before ${q.code} ${p.type==='FS'?'finished':'started'} (${p.type})`)); }); });
      const started=X.acts.filter(a=>a.status!=='TK_NotStart').length; return {v:bad.length,sub:`${started} started activities checked`,items:bad}; }},
  progint:{t:'Progress integrity',refs:{aace:'RP 53R-06 · 90R-17'},k:'count',dir:'le',desc:'Status that contradicts itself: not-started work with % complete or an actual start, in-progress work with no actual start, or complete work with remaining duration.',
    run:X=>{ const bad=[]; X.acts.forEach(a=>{ const r=a.raw, as=r.act_start_date, rd=+r.remain_drtn_hr_cnt||0; let n=null;
        if(a.status==='TK_NotStart'&&((+r.phys_complete_pct||0)>0||as)) n=as?'Not started but has an actual start':`Not started but ${Math.round(+r.phys_complete_pct)}% complete`;
        else if(a.status==='TK_Active'&&!as) n='In progress with no actual start'; else if(a.status==='TK_Complete'&&rd>0) n=`Complete with ${Math.round(rd/(a.dh||8))}d remaining`; if(n) bad.push(X.it(a,n)); });
      return {v:bad.length,sub:`${X.acts.length} activities checked`,items:bad}; }},
  rdod:{t:'Remaining over original',refs:{aace:'RP 53R-06'},k:'pct',dir:'le',desc:'In-progress tasks whose remaining duration is longer than their whole original duration. It often means the work has stalled or the estimate needs revisiting.',
    run:X=>{ const ip=X.incT.filter(a=>a.status==='TK_Active'), bad=[]; ip.forEach(a=>{ const od=X.hrs(a,'target_drtn_hr_cnt'), rd=X.hrs(a,'remain_drtn_hr_cnt'); if(od!=null&&rd!=null&&rd>od) bad.push(X.it(a,`Remaining ${Math.round(rd)}d · original ${Math.round(od)}d`)); });
      if(!ip.length) return {na:'No tasks in progress'}; return {v:X.pct(bad.length,ip.length),sub:`${bad.length} of ${ip.length} in-progress tasks`,items:bad}; }},
  rsrc:{t:'Resources',refs:{dcma:'DCMA 10',aace:'RP 78R-13'},k:'pct',dir:'le',desc:'Incomplete tasks with a duration but no resource assignment. DCMA expects every task to be resource or cost loaded.',
    run:X=>{ if(!X.set.hasRsrc) return {na:'No resource assignments in these files'}; const bad=X.incT.filter(a=>(X.hrs(a,'target_drtn_hr_cnt')||0)>0&&!a.rsrc).map(a=>X.it(a,'No resource assigned')); return {v:X.pct(bad.length,X.incT.length),sub:`${bad.length} of ${X.incT.length} incomplete tasks`,items:bad}; }},
  missed:{t:'Missed tasks',refs:{dcma:'DCMA 11',aace:'RP 53R-06'},k:'pct',dir:'le',desc:'Activities whose baseline finish is on or before the data date but that finished after their baseline finish, or have not finished.',
    run:X=>{ if(!X.due) return {na:X.isL?'Load a baseline to run this check':'Runs on the live schedule only'}; const bad=X.due.filter(a=>a.status!=='TK_Complete'||X.day(a.f)>X.day(a.R.bf)).map(a=>X.it(a,a.status!=='TK_Complete'?`Not finished · BL finish ${fmtD(a.R.bf)}`:`Finished ${fmtD(a.f)} · BL ${fmtD(a.R.bf)}`));
      return {v:X.pct(bad.length,X.due.length),sub:`${bad.length} of ${X.due.length} due by data date`,items:bad}; }},
  cpt:{t:'Critical path test',refs:{dcma:'DCMA 12',aace:'RP 49R-06'},k:'bool',dir:'ge',desc:'Traces the driving relationships back from the latest-finishing activity. The trace should reach work in progress or starting at the data date with no breaks. This approximates the DCMA delay test and the AACE longest-path method.',
    run:X=>{ const end=X.end; if(!end||X.ddt==null) return {na:!end?'No incomplete activities':'No data date in the XER'}; const path=[end], seen=new Set([end]); let cur=end;
      for(let g=0;g<5000;g++){ let best=null,bg=Infinity; cur.preds.forEach(p=>{ const q=p.a; if(q.status==='TK_Complete'||seen.has(q)||q.s==null) return; const L=p.lag*DAY; const gap=p.type==='SS'?cur.s-(q.s+L):p.type==='FF'?cur.f-(q.f+L):p.type==='SF'?cur.f-(q.s+L):cur.s-(q.f+L); if(gap<bg){ bg=gap; best=q; } });
        if(!best||bg>4*DAY) break; path.push(best); seen.add(best); cur=best; }
      const first=path[path.length-1], ok=first.status==='TK_Active'||(first.s!=null&&X.day(first.s)<=X.ddDay+5);
      return {v:ok?1:0,sub:`${path.length} activities, ${first.code} → ${end.code}`,items:path.slice().reverse().map(a=>X.it(a,`${fmtD(a.s)} → ${fmtD(a.f)}${a.tf!=null?' · TF '+Math.round(a.tf)+'d':''}`)),keep:true}; }},
  cpli:{t:'CPLI',refs:{dcma:'DCMA 13',aace:'RP 49R-06'},k:'ratio',dir:'ge',desc:'Critical Path Length Index: remaining path length plus total float on the finish, divided by path length. Path length is measured in calendar days.',
    run:X=>{ const end=X.end; if(!end||X.ddt==null||end.tf==null||end.f<=X.ddt) return {na:!end||X.ddt==null?'No forecast finish':'No float on the finish activity'}; const cpl=(end.f-X.ddt)/DAY, v=(cpl+end.tf)/cpl;
      return {v,sub:`${Math.round(cpl)}d to ${end.code} · float ${Math.round(end.tf)}d`,items:[X.it(end,`Forecast ${fmtD(end.f)} · TF ${Math.round(end.tf)}d`)],keep:true}; }},
  bei:{t:'BEI',refs:{dcma:'DCMA 14',aace:'RP 53R-06'},k:'ratio',dir:'ge',desc:'Baseline Execution Index: activities completed divided by activities with a baseline finish on or before the data date. The list shows due work still open.',
    run:X=>{ if(!X.due||!X.due.length) return {na:!X.due?(X.isL?'Load a baseline to run this check':'Runs on the live schedule only'):'Nothing due by the data date'}; const done=X.acts.filter(a=>a.status==='TK_Complete').length;
      return {v:done/X.due.length,sub:`${done} complete · ${X.due.length} due`,items:X.due.filter(a=>a.status!=='TK_Complete').map(a=>X.it(a,`Not finished · BL finish ${fmtD(a.R.bf)}`))}; }},
  chg_act:{t:'Activities added or deleted',refs:{aace:'RP 53R-06'},k:'pct',dir:'le',chg:1,desc:'Activities added or deleted since the previous saved update, as a share of the activities in this one. Large changes in an update should be explained as a revision, not status.',
    run:X=>{ const P=X.prev; if(!P) return {na:X.prevWhy}; const cur=new Map(X.all.map(a=>[a.id,a])), bad=[]; X.all.forEach(a=>{ if(!P.acts.has(a.id)) bad.push(X.it(a,'Added')); }); P.acts.forEach((a,id)=>{ if(!cur.has(id)) bad.push({k:null,code:a.code,name:a.name,note:'Deleted'}); });
      return {v:X.pct(bad.length,X.all.length),sub:`${bad.filter(b=>b.note==='Added').length} added · ${bad.filter(b=>b.note==='Deleted').length} deleted`,items:bad}; }},
  chg_dur:{t:'Duration changes',refs:{aace:'RP 53R-06'},k:'pct',dir:'le',chg:1,desc:'Incomplete activities whose original duration changed since the previous saved update.',
    run:X=>{ const P=X.prev; if(!P) return {na:X.prevWhy}; const bad=[]; let n=0; X.inc.forEach(a=>{ const b=P.acts.get(a.id); if(!b) return; n++; const d0=(+b.raw.target_drtn_hr_cnt||0)/(b.dh||8), d1=(+a.raw.target_drtn_hr_cnt||0)/(a.dh||8); if(Math.round(d0)!==Math.round(d1)) bad.push(X.it(a,`${Math.round(d0)}d → ${Math.round(d1)}d`)); });
      return {v:X.pct(bad.length,n),sub:`${bad.length} of ${n} incomplete activities`,items:bad}; }},
  chg_logic:{t:'Logic changes',refs:{aace:'RP 53R-06'},k:'pct',dir:'le',chg:1,desc:'Relationships added, deleted or changed in type or lag since the previous saved update, as a share of this update’s relationships.',
    run:X=>{ const P=X.prev; if(!P) return {na:X.prevWhy}; const key=(a,p)=>`${a.id}<${p.a.id}|${p.type}|${Math.round(p.lag)}`, now=new Map(), was=new Map();
      X.all.forEach(a=>a.preds.forEach(p=>now.set(key(a,p),[a,p]))); P.acts.forEach(a=>a.preds.forEach(p=>was.set(key(a,p),[a,p])));
      const bad=[]; now.forEach(([a,p],k)=>{ if(!was.has(k)&&P.acts.has(a.id)) bad.push(X.it(a,`Added: ${p.a.code} ${p.type}${p.lag?' '+Math.round(p.lag)+'d':''}`)); }); was.forEach(([a,p],k)=>{ if(!now.has(k)&&X.byId.has(a.id)) bad.push(X.it(X.byId.get(a.id),`Removed: ${p.a.code} ${p.type}${p.lag?' '+Math.round(p.lag)+'d':''}`)); });
      return {v:X.pct(bad.length,Math.max(1,now.size)),sub:`${bad.length} changes · ${now.size} relationships`,items:bad}; }},
  retro:{t:'Changed actuals',refs:{aace:'RP 53R-06 · 93R-17'},k:'count',dir:'le',chg:1,desc:'Actual start or finish dates that changed after they were reported in the previous saved update. History should not be rewritten without a recorded reason.',
    run:X=>{ const P=X.prev; if(!P) return {na:X.prevWhy}; const bad=[]; X.all.forEach(a=>{ const b=P.acts.get(a.id); if(!b) return; const d=x=>{ const t=pd(x); return t==null?null:X.day(t); };
        const s0=d(b.raw.act_start_date), s1=d(a.raw.act_start_date), f0=d(b.raw.act_end_date), f1=d(a.raw.act_end_date);
        if(s0!=null&&s0!==s1) bad.push(X.it(a,`Actual start ${fmtD(s0*DAY)} → ${s1==null?'removed':fmtD(s1*DAY)}`)); else if(f0!=null&&f0!==f1) bad.push(X.it(a,`Actual finish ${fmtD(f0*DAY)} → ${f1==null?'removed':fmtD(f1*DAY)}`)); });
      return {v:bad.length,sub:`compared with ${X.prevLabel}`,items:bad}; }}
};
// Framework defaults: [id, pass, warn, param]. Thresholds marked AACE are this workbench's defaults: AACE recommended practices describe what to review but do not set pass marks.
const QDEF={
  dcma:{name:'DCMA 14-point',checks:[['logic',5,5],['leads',0,0],['lags',5,5],['fs',90,90],['hard',5,5],['hifloat',5,5,44],['negfloat',0,0],['hidur',5,5,44],['invalid',0,0],['rsrc',0,0],['missed',5,5],['cpt'],['cpli',.95,.95],['bei',.95,.95]]},
  aace:{name:'AACE enhanced',checks:[['logic',2,5],['dangling',2,5],['leads',0,0],['lags',5,10],['biglag',0,3,10],['fs',90,80],['hard',2,5],['soft',10,20],['hifloat',5,10,44],['negfloat',0,5],['nearcrit',25,40,10],['hidur',5,10,44],['invalid',0,0],['oos',0,5],['progint',0,0],['rdod',10,25],['rsrc',0,10],['missed',5,15],['cpt'],['cpli',.95,.9],['bei',.95,.9],['chg_act',5,10],['chg_dur',5,10],['chg_logic',10,20],['retro',0,0]]}
};
const QFW_KEYS=['dcma','aace','custom'];
function qLoadLocal(){ try{ return JSON.parse(localStorage.getItem('pacer.qcfg')||'null'); }catch(_){ return null; } }
function qCfg(){ return Q.cfg||{}; }
function qFwName(k){ const c=qCfg(); return k==='custom'?((c.custom&&c.custom.name)||'Bespoke'):QDEF[k].name; }
function qAvail(){ const c=qCfg(), av=c.avail||{dcma:true,aace:true,custom:!!(c.custom&&c.custom.checks&&c.custom.checks.length)}; const ks=QFW_KEYS.filter(k=>av[k]&&(k!=='custom'||(c.custom&&c.custom.checks&&c.custom.checks.length))); return ks.length?ks:['dcma']; }
function qCurrent(){ const av=qAvail(); let k=null; try{ k=localStorage.getItem('pacer.qfw'); }catch(_){} if(!av.includes(k)) k=av.includes(qCfg().def)?qCfg().def:av[0]; return k; }
const qRow=([id,pass,warn,p])=>({id,on:true,pass:pass??null,warn:warn??pass??null,p:p??(QLIB[id].p?QLIB[id].p.d:null)});
// The effective list of checks for a framework, with any admin overrides applied.
function qChecks(k){ const c=qCfg();
  if(k==='custom'){ const L=(c.custom&&c.custom.checks)||[]; return L.filter(x=>QLIB[x.id]).map(x=>({...qRow([x.id]),...x})); }
  const ov=new Map(((c.fw&&c.fw[k])||[]).map(x=>[x.id,x])); return QDEF[k].checks.map(r=>({...qRow(r),...(ov.get(r[0])||{})})); }
function qStatus(L,ch,v){ if(L.k==='bool') return v?'pass':'fail'; const P=+ch.pass, W=ch.warn==null||ch.warn===''?P:+ch.warn;
  if(L.dir==='ge') return v>=P-1e-9?'pass':v>=Math.min(W,P)-1e-9?'warn':'fail'; return v<=P+1e-9?'pass':v<=Math.max(W,P)+1e-9?'warn':'fail'; }
const qFmt=(k,v)=>v==null?'—':k==='pct'?(v>0&&v<10?(+v).toFixed(1):Math.round(v))+'%':k==='ratio'?(+v).toFixed(2):k==='bool'?(v?'Pass':'Fail'):String(Math.round(v));
const qThrV=(k,v)=>k==='pct'?(+(+v).toFixed(1))+'%':qFmt(k,v);
const qThr=(L,ch)=>L.k==='bool'?'unbroken':`${L.dir==='ge'?'≥':'≤'} ${qThrV(L.k,+ch.pass)}${L.id==='fs'?' FS':''}`;
function qCtx(){
  const isL=S.dq.role==='live', set=isL?M.live:M.base; if(!set.acts.size) return null;
  const ddt=isL?M.dd:M.bdd, day=t=>Math.floor(t/DAY), ddDay=ddt!=null?day(ddt):null, scope=S.dq.scope==='filtered'?new Set(S.rows.map(r=>r.k)):null;
  const all=[...set.acts.values()].filter(a=>a.type!=='TT_LOE'&&a.type!=='TT_WBS'), acts=all.filter(a=>!scope||(a.R&&scope.has(a.R.k)));
  const inc=acts.filter(a=>a.status!=='TK_Complete'), incT=inc.filter(a=>!a.ms), rels=[]; inc.forEach(a=>a.preds.forEach(p=>rels.push({a,p})));
  let end=null; inc.forEach(a=>{ if(a.f!=null&&(!end||a.f>end.f||(a.f===end.f&&a.type==='TT_FinMile'))) end=a; });
  const due=(isL&&M.base.acts.size&&ddt!=null)?acts.filter(a=>a.R&&a.R.B&&a.R.bf!=null&&day(a.R.bf)<=ddDay):null;
  const pv=qPrev(isL);
  return {isL,set,ddt,day,ddDay,all:acts,acts,inc,incT,rels,end,due,byId:new Map(acts.map(a=>[a.id,a])),prev:pv.set,prevWhy:pv.why,prevLabel:pv.label,
    hrs:(a,f)=>{ const v=a.raw[f]; return v===''||v==null?null:(+v)/(a.dh||8); }, pct:(n,d)=>d?n/d*100:0, fp:v=>(v>0&&v<10?v.toFixed(1):Math.round(v))+'%',
    it:(a,note)=>({k:a.R?a.R.k:null,code:a.code,name:a.name,note}), rn:x=>{ const l=Math.round(x.p.lag*10)/10; return `Pred ${x.p.a.code} · ${x.p.type}${l?(l>0?' +':' −')+Math.abs(l)+'d':''}`; }};
}
// The previous saved update of the open project, for the change checks.
function qPrev(isL){
  const L=typeof PER!=='undefined'&&PER.loaded; if(!isL) return {why:'Runs on the live schedule only'}; if(Q.noPrev) return {why:'Not scored in the trend'};
  if(!L||L.multi) return {why:'Open a saved project to compare with its previous update'};
  if(L.pid!==PER.pid||!PER.periods.length) return {why:'Loading the project’s updates…'};
  const P=PER.periods, i=P.findIndex(p=>p.id===L.id); if(i<1) return {why:i<0?'Open a saved update to compare it with the previous one':'This is the project’s first saved update'};
  const prev=P[i-1], key=L.id+'<'+prev.id; if(Q.prevKey===key&&Q.prev) return {set:Q.prev,label:prev.label};
  if(Q.prevBusy!==key){ Q.prevBusy=key; perGetFiles(L.pid,prev).then(fs=>{ Q.prev=buildRole(fs.filter(f=>f.role==='live')).acts; Q.prev={acts:Q.prev}; Q.prevKey=key; }).catch(e=>{ console.warn(e); Q.prevKey=key; Q.prev=null; }).finally(()=>{ Q.prevBusy=null; if(S.tab==='dq') renderDQ(); }); }
  return {why:'Loading '+prev.label+'…'};
}
function runQuality(k){
  k=k||qCurrent(); const X=qCtx(); if(!X) return null;
  DQ.ctx={acts:X.acts.length,inc:X.inc.length,dd:X.ddt,role:X.isL?'Live':'Baseline',fw:k,name:qFwName(k)};
  const out=[]; let n=0;
  qChecks(k).filter(c=>c.on!==false).forEach(ch=>{ const L={...QLIB[ch.id],id:ch.id}; if(!QLIB[ch.id]) return; n++; let r;
    try{ r=L.run(X,ch.p!=null&&ch.p!==''?+ch.p:(L.p?L.p.d:null)); }catch(e){ console.warn(e); r={na:'Could not be calculated'}; }
    const o={n,id:ch.id,title:L.t,desc:L.desc,ref:L.refs[k==='custom'?(L.refs.aace?'aace':'dcma'):k]||L.refs.aace||L.refs.dcma||'',k:L.k,dir:L.dir,ch,thr:qThr(L,ch),items:r.items||[],sub:r.sub||''};
    if(r.na){ Object.assign(o,{status:'na',metric:'N/A',sub:r.na,meter:[0,0]}); }
    else { o.v=r.v; o.metric=qFmt(L.k,r.v); o.status=qStatus(L,ch,r.v); o.pass=o.status==='pass'; o.keepItems=r.keep;
      const P=+ch.pass, W=ch.warn==null?P:+ch.warn;
      if(L.k==='bool') o.meter=[r.v?1:.3,1]; else if(L.k==='ratio') o.meter=[Math.max(0,Math.min(1,r.v/1.2)),P/1.2];
      else if(L.dir==='ge') o.meter=[r.v/100,P/100]; else { const sc=Math.max(P*4,W*1.5,L.k==='count'?10:20); o.meter=[Math.min(1,r.v/sc),P/sc]; }
      if(o.status==='pass'&&!o.keepItems&&!o.items.length) o.items=[]; }
    out.push(o); });
  return out;
}
// Kept for callers that ask for "the quality checks": runs the framework the user has chosen.
function runDCMA(){ return runQuality(); }

function qAdmin(){ if(typeof PER==='undefined'||!PER.mode) return true; return PER.mode==='local'||(PER.mode==='supa'&&PER.srole==='admin')||(PER.mode==='cloud'&&(PER.isOwner||PER.canEdit)); }
async function qLoad(){
  let cfg=null;
  try{ if(PER.mode==='supa'){ if(!PER.companyId) cfg=null; else { const {data,error}=await PER.sb.from('company_settings').select('quality').eq('company_id',PER.companyId).maybeSingle(); if(error) throw error; cfg=data&&data.quality; } }
    else if(PER.store&&PER.store.getQuality) cfg=await PER.store.getQuality(); }catch(e){ console.warn('quality settings',e); cfg=PER.mode==='supa'?null:qLoadLocal(); }
  Q.cfg=cfg&&typeof cfg==='object'&&Object.keys(cfg).length?cfg:(PER.mode==='local'?qLoadLocal():null);
  if(S.tab==='dq'){ renderControls(); renderDQ(); }
}
async function qSaveCfg(cfg){
  if(PER.mode==='supa'){ if(!PER.companyId) throw new Error('Choose a company first.'); const {error}=await PER.sb.from('company_settings').upsert({company_id:PER.companyId,quality:cfg,updated_by:PER.uid||null,updated_at:new Date().toISOString()}); if(error) throw error; }
  else if(PER.mode&&PER.store&&PER.store.setQuality) await PER.store.setQuality(cfg);
  try{ localStorage.setItem('pacer.qcfg',JSON.stringify(cfg)); }catch(_){}
  Q.cfg=cfg;
}
function renderDQ(){
  const el=document.getElementById('dqWrap'); if(el.hidden||!M) return;
  const res=runQuality(); DQ.res=res;
  if(!res){ el.innerHTML=`<div class="dq-empty"><h3>No ${S.dq.role==='live'?'live':'baseline'} schedule loaded</h3><p>Add an XER and set its role to ${S.dq.role==='live'?'Live':'Baseline'} in Files.</p><button class="btn primary" data-open-files>Open files</button></div>`; return; }
  if(DQ.sel==null||!res.some(c=>c.n===DQ.sel)){ const f=res.find(c=>c.status==='fail')||res.find(c=>c.status==='warn'); DQ.sel=f?f.n:null; }
  const assessed=res.filter(c=>c.status!=='na'), passed=assessed.filter(c=>c.status==='pass').length, warn=assessed.filter(c=>c.status==='warn').length, failed=assessed.length-passed-warn, na=res.length-assessed.length, x=DQ.ctx;
  const score=assessed.length?Math.round((passed+warn*.5)/assessed.length*100):null;
  const lab={pass:'Pass',warn:'Amber',fail:'Fail',na:'N/A'}, sh=(L,v)=>qThrV(L.k,v);
  const card=c=>`<button class="dqc ${c.status}${DQ.sel===c.n?' sel':''}" data-dq="${c.n}" aria-expanded="${DQ.sel===c.n}">
    <span class="dqt"><span class="dqn">${p2(c.n)}</span><span class="dqtt">${esc(c.title)}</span><span class="st ${c.status}">${lab[c.status]}</span></span>
    <span class="dqv">${esc(c.metric)}</span>
    <span class="dqs">${esc(c.sub||'')}${c.status!=='na'&&c.thr?` · target ${esc(c.thr)}`:''}</span>
    <span class="dqm"><i style="width:${Math.min(100,Math.max(0,c.meter[0]*100)).toFixed(1)}%"></i>${c.status!=='na'?`<b style="left:${(Math.min(1,c.meter[1])*100).toFixed(1)}%"></b>`:''}</span>${c.ref?`<span class="dqref">${esc(c.ref)}</span>`:''}</button>`;
  const sel=res.find(c=>c.n===DQ.sel);
  const band=c=>{ if(c.k==='bool') return 'Pass when the trace is unbroken'; const P=+c.ch.pass, W=c.ch.warn==null?P:+c.ch.warn, s=c.dir==='ge'?'≥':'≤'; return `Pass ${s} ${sh(c,P)}${W!==P?` · amber ${s} ${sh(c,W)}`:''} · fail beyond`+(c.ch.p!=null&&QLIB[c.id].p?` · ${QLIB[c.id].p.l.toLowerCase()} ${c.ch.p} ${QLIB[c.id].p.u}`:''); };
  const detail=sel?`<div class="dq-detail" id="dqDetail"><div class="dqdh"><div><div class="eyebrow">Check ${sel.n} · ${lab[sel.status]}${sel.ref?' · '+esc(sel.ref):''}</div><h3>${esc(sel.title)}</h3><p>${esc(sel.desc)}</p>${sel.status!=='na'?`<p class="dqband">${esc(band(sel))}</p>`:''}</div>
      ${sel.items.length?`<button class="btn" data-dq-gantt>Show ${sel.items.length} in Gantt</button>`:''}</div>
      ${sel.status==='na'?`<p class="muted">${esc(sel.sub)}.</p>`:sel.items.length?`<div class="dqlist">${sel.items.slice(0,300).map(i=>`<button class="dqi" data-k="${esc(i.k||'')}"><b>${esc(i.code)}</b><span>${esc(i.name)}</span><em>${esc(i.note)}</em></button>`).join('')}</div>${sel.items.length>300?`<div class="note">Showing the first 300 of ${sel.items.length}. Use “Show in Gantt” to see them all.</div>`:''}`:`<p class="muted">No activities fail this check.</p>`}</div>`:'';
  el.innerHTML=`<div class="dq-head">
      <div class="dq-score"><div class="sl">${esc(x.name)}</div><div class="sv">${passed}<small> / ${assessed.length}</small></div><div class="ss">passed${warn?` · <span class="amber">${warn} amber</span>`:''}${failed?` · <span class="late">${failed} failed</span>`:''}${na?` · ${na} not assessed`:''}</div></div>
      ${score!=null?`<div class="dq-score"><div class="sl">Score</div><div class="sv">${score}<small>%</small></div><div class="ss">pass = 1, amber = ½</div></div>`:''}
      <div class="dq-splits" aria-hidden="true">${res.map(c=>`<i class="${c.status}" title="${c.n}. ${esc(c.title)}: ${lab[c.status]}"></i>`).join('')}</div>
      <div class="dq-ctx">${x.role} schedule · ${x.acts.toLocaleString()} activities assessed, ${x.inc.toLocaleString()} incomplete${x.dd!=null?` · data date ${fmtL(x.dd)}`:''}${S.dq.scope==='filtered'?' · current filters applied':''}<br><span>Level-of-effort and WBS summary activities are excluded. Float, duration and lag limits use working days.${x.fw==='aace'?' AACE recommended practices set out what to review; the pass and amber limits here are configurable defaults, not AACE requirements.':''}</span></div>
    </div>
    <div class="dq-grid">${res.map(card).join('')}</div>${detail}`;
}
/* ---- configuration (admins) ---- */
function qOpenConfig(){
  if(!qAdmin()) return perToast('Only an admin can change the quality checks.','err');
  const c=qCfg(), rows=k=>qChecks(k).map(x=>({id:x.id,on:x.on!==false,pass:x.pass,warn:x.warn,p:x.p}));
  Q.edit={tab:qCurrent(),def:c.def||'dcma',avail:{dcma:true,aace:true,custom:false,...(c.avail||{})},fw:{dcma:rows('dcma'),aace:rows('aace')},custom:{name:(c.custom&&c.custom.name)||'Bespoke',checks:(c.custom&&c.custom.checks&&c.custom.checks.length)?rows('custom'):[]}};
  if(!Q.edit.custom.checks.length) Q.edit.avail.custom=false;
  const d=document.createElement('div'); d.className='modal'; d.id='qCfg'; d.innerHTML='<div class="mcard qdlg" role="dialog" aria-modal="true" aria-labelledby="qT"></div>'; document.body.appendChild(d);
  d.addEventListener('click',qCfgClick); d.addEventListener('change',qCfgChange); d.addEventListener('keydown',e=>{ if(e.key==='Escape') d.remove(); });
  qRenderConfig();
}
function qList(k){ return k==='custom'?Q.edit.custom.checks:Q.edit.fw[k]; }
function qRenderConfig(){
  const d=document.getElementById('qCfg'); if(!d) return; const E=Q.edit, k=E.tab, L=qList(k);
  const nm=x=>x==='custom'?E.custom.name||'Bespoke':QDEF[x].name;
  const unit=Lb=>Lb.k==='pct'?'%':Lb.k==='ratio'?'':Lb.k==='count'?'':'';
  const row=(r,i)=>{ const Lb=QLIB[r.id], ref=Lb.refs[k]||Lb.refs.aace||Lb.refs.dcma||'', b=Lb.k==='bool';
    return `<tr class="${r.on?'':'off'}"><td><input type="checkbox" data-qi="${i}" data-qf="on" ${r.on?'checked':''} aria-label="Include ${esc(Lb.t)}"></td>
      <td><b>${esc(Lb.t)}</b><span class="qref">${esc(ref)}</span></td>
      <td>${Lb.p?`<span class="qp"><span>${esc(Lb.p.l)}</span><input class="tvi" data-qi="${i}" data-qf="p" value="${r.p??Lb.p.d}" inputmode="decimal"><span>${esc(Lb.p.u)}</span></span>`:'<span class="muted">—</span>'}</td>
      <td class="r">${b?'<span class="muted">unbroken</span>':`<span class="qth">${Lb.dir==='ge'?'≥':'≤'} <input class="tvi" data-qi="${i}" data-qf="pass" value="${r.pass??''}" inputmode="decimal"> ${unit(Lb)}</span>`}</td>
      <td class="r">${b?'':`<span class="qth">${Lb.dir==='ge'?'≥':'≤'} <input class="tvi" data-qi="${i}" data-qf="warn" value="${r.warn??''}" inputmode="decimal"> ${unit(Lb)}</span>`}</td>
      <td class="r">${k==='custom'?`<button class="link" data-qmv="${i}" data-dir="-1" aria-label="Move up" ${i?'':'disabled'}>↑</button><button class="link" data-qmv="${i}" data-dir="1" aria-label="Move down" ${i<L.length-1?'':'disabled'}>↓</button><button class="link danger" data-qrm="${i}">Remove</button>`:''}</td></tr>`; };
  const missing=Object.keys(QLIB).filter(id=>!L.some(r=>r.id===id));
  d.querySelector('.qdlg').innerHTML=`<div class="mh"><h2 id="qT">Schedule quality checks</h2><button class="fx" data-qx aria-label="Close">×</button></div>
    <div class="qtop"><label class="pfl"><span>Default for everyone</span><select id="qDef">${QFW_KEYS.filter(x=>x!=='custom'||E.custom.checks.length).map(x=>`<option value="${x}"${E.def===x?' selected':''}>${esc(nm(x))}</option>`).join('')}</select></label>
      <div class="pfl"><span>Available to users</span><div class="qav">${QFW_KEYS.map(x=>`<label><input type="checkbox" data-qav="${x}" ${E.avail[x]?'checked':''} ${x==='custom'&&!E.custom.checks.length?'disabled':''}> ${esc(nm(x))}</label>`).join('')}</div></div></div>
    <div class="sg qtabs" role="tablist">${QFW_KEYS.map(x=>`<button role="tab" data-qtab="${x}" class="${k===x?'on':''}" aria-selected="${k===x}">${esc(nm(x))}${x!=='custom'?` · ${qList(x).filter(r=>r.on).length}`:` · ${E.custom.checks.filter(r=>r.on).length}`}</button>`).join('')}</div>
    ${k==='custom'?`<div class="qcust"><label class="pfl"><span>Name</span><input id="qName" maxlength="40" value="${esc(E.custom.name)}"></label><div class="pfl"><span>Start from</span><div class="bcr"><button class="btn sm" data-qfrom="dcma">DCMA 14-point</button><button class="btn sm" data-qfrom="aace">AACE enhanced</button><button class="btn sm ghost" data-qfrom="none">Empty</button></div></div>
      <label class="pfl"><span>Add a check</span><select id="qAdd"><option value="">Choose…</option>${missing.map(id=>`<option value="${id}">${esc(QLIB[id].t)}</option>`).join('')}</select></label></div>`
      :`<p class="muted qnote">${k==='dcma'?'The DCMA 14-point assessment with its published thresholds. Change a limit or switch a check off to suit the contract.':'Checks drawn from AACE recommended practices: 78R-13 (baseline review), 53R-06 (update review), 49R-06 (critical path), 92R-17 (near-critical paths) and 90R-17 (statusing). AACE describes what to review but sets no pass marks, so these limits are starting points to agree for the project.'}</p>`}
    <div class="qtw"><table class="qt"><thead><tr><th></th><th>Check</th><th>Setting</th><th class="r">Pass</th><th class="r">Amber</th><th></th></tr></thead><tbody>${L.map(row).join('')||'<tr><td colspan="6" class="muted">No checks yet. Start from a framework or add checks one by one.</td></tr>'}</tbody></table></div>
    <p class="muted qnote">Percentages are entered as numbers (5 = 5%). Ratios such as CPLI and BEI are decimals. A value between the pass and amber limits shows amber; set them equal for pass or fail only. The change checks compare with the project’s previous saved update.</p>
    <div class="pdf"><span class="muted" data-err></span>${k!=='custom'?`<button class="btn ghost" data-qreset>Reset ${esc(nm(k))}</button>`:''}<button class="btn" data-qx>Cancel</button><button class="btn primary" data-qsave>Save for everyone</button></div>`;
}
function qCfgClick(e){
  const d=document.getElementById('qCfg'), E=Q.edit, t=e.target; if(t===d||t.closest('[data-qx]')){ d.remove(); return; }
  const b=t.closest('button'); if(!b) return;
  if(b.dataset.qtab){ E.tab=b.dataset.qtab; qRenderConfig(); return; }
  if(b.dataset.qfrom){ const f=b.dataset.qfrom; E.custom.checks=f==='none'?[]:E.fw[f].map(r=>({...r})); E.avail.custom=E.custom.checks.length>0; qRenderConfig(); return; }
  if(b.dataset.qrm!=null){ E.custom.checks.splice(+b.dataset.qrm,1); if(!E.custom.checks.length){ E.avail.custom=false; if(E.def==='custom') E.def='dcma'; } qRenderConfig(); return; }
  if(b.dataset.qmv!=null){ const i=+b.dataset.qmv, j=i+(+b.dataset.dir), L=E.custom.checks; [L[i],L[j]]=[L[j],L[i]]; qRenderConfig(); return; }
  if(b.hasAttribute('data-qreset')){ E.fw[E.tab]=QDEF[E.tab].checks.map(r=>{ const x=qRow(r); return {id:x.id,on:true,pass:x.pass,warn:x.warn,p:x.p}; }); qRenderConfig(); return; }
  if(b.hasAttribute('data-qsave')){ const err=d.querySelector('[data-err]');
    if(!QFW_KEYS.some(x=>E.avail[x])) { err.textContent='Make at least one framework available.'; return; }
    if(!E.avail[E.def]){ err.textContent='The default must be one of the available frameworks.'; return; }
    const clean=L=>L.map(r=>({id:r.id,on:!!r.on,pass:r.pass===''||r.pass==null?null:+r.pass,warn:r.warn===''||r.warn==null?null:+r.warn,p:r.p===''||r.p==null?null:+r.p}));
    const cfg={v:1,def:E.def,avail:{...E.avail,custom:!!(E.avail.custom&&E.custom.checks.length)},fw:{dcma:clean(E.fw.dcma),aace:clean(E.fw.aace)},custom:{name:E.custom.name.trim()||'Bespoke',checks:clean(E.custom.checks)},at:Date.now()};
    b.disabled=true; qSaveCfg(cfg).then(()=>{ d.remove(); DQ.sel=null; renderControls(); renderDQ(); perToast(PER.mode==='supa'&&PER.company?`Quality check settings saved for everyone at ${PER.company.name}.`:'Quality check settings saved for everyone.'); }).catch(ex=>{ b.disabled=false; err.textContent=perErr(ex); }); }
}
function qCfgChange(e){
  const t=e.target, E=Q.edit;
  if(t.id==='qDef'){ E.def=t.value; return; }
  if(t.id==='qName'){ E.custom.name=t.value; return; }
  if(t.id==='qAdd'&&t.value){ const x=qRow(QDEF.aace.checks.find(r=>r[0]===t.value)||QDEF.dcma.checks.find(r=>r[0]===t.value)||[t.value,QLIB[t.value].k==='ratio'?.95:QLIB[t.value].dir==='ge'?90:5,QLIB[t.value].k==='ratio'?.9:QLIB[t.value].dir==='ge'?80:10]); E.custom.checks.push({id:x.id,on:true,pass:x.pass,warn:x.warn,p:x.p}); E.avail.custom=true; qRenderConfig(); return; }
  if(t.dataset.qav){ E.avail[t.dataset.qav]=t.checked; return; }
  if(t.dataset.qi!=null){ const r=qList(E.tab)[+t.dataset.qi], f=t.dataset.qf; if(f==='on'){ r.on=t.checked; t.closest('tr').classList.toggle('off',!t.checked); } else { const v=t.value.trim(); r[f]=v===''?null:(isFinite(+v)?+v:r[f]); t.value=r[f]??''; } }
}

