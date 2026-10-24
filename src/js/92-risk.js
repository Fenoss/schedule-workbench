/* ================= Risk Workbench: model, configuration and storage =================
   Risk registers at portfolio, programme and project level, sharing one scoring matrix so risks roll up.
   A risk can have a parent at a higher level (escalated or aggregated risks) and can be an interface risk
   between two or more projects. Each risk carries qualitative scores (inherent, current, target) and a
   three-point quantitative estimate kept ready for Monte Carlo. */
const RK={app:'schedule',tab:'over',scope:{lv:'portfolio',id:null},roll:true,risks:[],un:null,loaded:false,schemaOld:false,cfg:null,
  q:'',f:{st:'live',cat:'',rt:'',type:'',owner:'',ifc:false},cell:null,sort:{k:'cur',d:-1},group:'',heat:'cur',ifcG:'',ifcPair:null,act:{f:'open',owner:''},
  ed:null,edTab:'det',ce:null,ceLv:'portfolio',ceProg:''};
const RLV=['portfolio','programme','project'], RLV_L={portfolio:'Portfolio',programme:'Programme',project:'Project'};
const RST={draft:'Draft',open:'Open',monitor:'Monitoring',occurred:'Occurred',closed:'Closed'}, RST_LIVE=['draft','open','monitor'];
const RSTRAT={threat:[['avoid','Avoid'],['reduce','Reduce'],['transfer','Transfer'],['accept','Accept']],opp:[['exploit','Exploit'],['enhance','Enhance'],['share','Share'],['accept','Accept']]};
const RACT={todo:'Not started',doing:'In progress',done:'Done',dropped:'Cancelled'};
const RDIST={tri:'Triangular',pert:'PERT',uni:'Uniform'};
const RQ=['pre','cur','tgt'], RQ_L={pre:'Inherent',cur:'Current',tgt:'Target'}, RQ_S={pre:'Before any response',cur:'With responses in place today',tgt:'Once all planned actions are done'};

function rkDefaultCfg(){
  return {v:1,align:'aligned',
    cols:{all:['ref','title','scope','category','owner','status','cur','trend','costEV','timeEV','strategy','actions','review'],
      portfolio:['ref','title','scope','category','owner','status','pre','cur','tgt','costEV','timeEV','children','review'],
      programme:['ref','title','scope','category','owner','status','cur','tgt','costEV','timeEV','ifc','children','actions','review'],
      project:['ref','title','category','owner','status','pre','cur','tgt','trend','costEV','timeEV','strategy','actions','nextdue','review']},
    progCols:{},fields:[],
    prob:[{l:'Very low',max:10},{l:'Low',max:30},{l:'Medium',max:50},{l:'High',max:70},{l:'Very high',max:100}],
    ilab:['Very low','Low','Medium','High','Very high'],
    dims:[{id:'cost',l:'Cost',kind:'cost',b:[50000,250000,1000000,5000000]},{id:'time',l:'Schedule',kind:'time',b:[7,30,90,180]},
      {id:'hs',l:'Health & safety',kind:'text',d:['First aid only','Medical treatment','Lost-time injury','Major injury','Fatality']},
      {id:'rep',l:'Reputation',kind:'text',d:['Internal only','Local complaint','Regional media','National media','Licence to operate at stake']}],
    bands:[{l:'Low',max:4,c:'#2E9E6A'},{l:'Medium',max:9,c:'#D99A00'},{l:'High',max:16,c:'#E8641E'},{l:'Very high',max:25,c:'#C8243A'}],
    cats:['Commercial','Design','Construction','Interfaces','Stakeholder & consents','Environmental','Health & safety','Third parties & utilities','Supply chain','Operational readiness','Funding & governance'],
    esc:{programme:{score:15,cost:1000000},portfolio:{score:20,cost:5000000}},
    review:30,cur:'$'};
}
function rkCfg(){ if(RK._cc&&RK._ccSrc===RK.cfg) return RK._cc; const d=rkDefaultCfg(), c=RK.cfg||{}; const o=Object.assign({},d,c); o.cols=Object.assign({},d.cols,c.cols||{}); o.esc=Object.assign({},d.esc,c.esc||{}); o.progCols=c.progCols||{}; o.fields=c.fields||[]; RK._cc=o; RK._ccSrc=RK.cfg; return o; }

/* ---- columns available to a register ---- */
const RCOL={
  ref:{l:'Ref',w:84}, title:{l:'Risk',w:300}, type:{l:'Type',w:90}, level:{l:'Level',w:96}, scope:{l:'Register',w:170}, category:{l:'Category',w:150},
  owner:{l:'Owner',w:120}, status:{l:'Status',w:100}, cause:{l:'Cause',w:220}, event:{l:'Event',w:220}, effect:{l:'Effect',w:220},
  pre:{l:'Inherent',w:92}, cur:{l:'Current',w:92}, tgt:{l:'Target',w:92}, trend:{l:'Trend',w:66},
  prob:{l:'Probability',w:92,num:1}, cost3:{l:'Cost min / likely / max',w:190,num:1}, costEV:{l:'Cost exposure',w:110,num:1}, time3:{l:'Days min / likely / max',w:160,num:1}, timeEV:{l:'Schedule exposure',w:110,num:1},
  strategy:{l:'Response',w:96}, respOwner:{l:'Response owner',w:120}, actions:{l:'Actions',w:84,num:1}, nextdue:{l:'Next action due',w:118,num:1},
  prox:{l:'Proximity',w:100,num:1}, review:{l:'Next review',w:104,num:1}, raised:{l:'Raised',w:96,num:1}, updated:{l:'Updated',w:96,num:1},
  parent:{l:'Parent risk',w:160}, children:{l:'Child risks',w:90,num:1}, ifc:{l:'Interface between',w:200}, acts:{l:'Schedule activities',w:150}, cont:{l:'Contingency',w:110,num:1}
};
const RCOL_REQ=['ref','title'];
function rkColDefs(){ const o={}; for(const k in RCOL) o[k]=RCOL[k].l; rkCfg().fields.forEach(f=>o['f:'+f.id]=f.l); return o; }
// Which column set a register uses, following the alignment the admin chose.
function rkColsFor(scope){ const c=rkCfg(), lv=scope.lv; let cols;
  if(c.align==='aligned') cols=c.cols.all;
  else if(c.align==='tiered') cols=c.cols[lv];
  else { const gid=lv==='programme'?scope.id:lv==='project'?(rkProj(scope.id)||{}).programmeId:null; cols=lv==='portfolio'?c.cols.portfolio:(gid&&c.progCols[gid])||(lv==='programme'?c.cols.programme:c.cols.project); }
  const defs=rkColDefs(); cols=(cols||[]).filter(k=>k in defs); RCOL_REQ.slice().reverse().forEach(k=>{ if(!cols.includes(k)) cols.unshift(k); }); return cols; }
function rkColSource(scope){ const c=rkCfg(), lv=scope.lv; if(c.align==='aligned') return 'One format for every register'; if(c.align==='tiered') return `${RLV_L[lv]} format`;
  if(lv==='portfolio') return 'Portfolio format'; const gid=lv==='programme'?scope.id:(rkProj(scope.id)||{}).programmeId, g=rkProg(gid); return g&&c.progCols[gid]?`${g.name} format`:`Default ${lv} format`; }

/* ---- lookups ---- */
const rkProg=id=>id&&(typeof PER!=='undefined')?PER.programmes.find(g=>g.id===id):null;
const rkProj=id=>id&&(typeof PER!=='undefined')?PER.projects.find(p=>p.id===id):null;
const rkById=id=>RK.risks.find(r=>r.id===id)||null;
const rkRank=lv=>RLV.indexOf(lv);
function rkProgOf(r){ return r.level==='programme'?r.programmeId:r.level==='project'?((rkProj(r.projectId)||{}).programmeId||null):null; }
function rkScopeOf(r){ return r.level==='portfolio'?{lv:'portfolio',id:null}:r.level==='programme'?{lv:'programme',id:r.programmeId}:{lv:'project',id:r.projectId}; }
function rkScopeName(sc){ if(!sc||sc.lv==='portfolio') return rkPortName(); const x=sc.lv==='programme'?rkProg(sc.id):rkProj(sc.id); return x?x.name:`(removed ${sc.lv})`; }
function rkPortName(){ return typeof PER!=='undefined'&&PER.mode==='supa'&&PER.company?PER.company.name+' portfolio':'Portfolio'; }
function rkScopeCode(sc){ if(sc.lv==='portfolio') return 'PF'; const x=sc.lv==='programme'?rkProg(sc.id):rkProj(sc.id); return (x&&x.code)||(sc.lv==='programme'?'PG':'PR'); }
const rkLive=r=>RST_LIVE.includes(r.status);
const rkKids=r=>r&&r.id?RK.risks.filter(x=>x.parentId===r.id&&x.id!==r.id):[];
function rkAncestors(r){ const out=[], seen=new Set(); let p=r&&rkById(r.parentId); while(p&&!seen.has(p.id)){ seen.add(p.id); out.push(p); p=rkById(p.parentId); } return out; }
function rkDesc(r){ const out=[], st=[...rkKids(r)], seen=new Set([r.id]); while(st.length){ const k=st.shift(); if(seen.has(k.id)) continue; seen.add(k.id); out.push(k); st.push(...rkKids(k)); } return out; }
// Risks that can be this risk's parent: a higher level whose register contains this one.
function rkParentOptions(r){ const g=rkProgOf(r); return RK.risks.filter(p=>p.id!==r.id&&rkRank(p.level)<rkRank(r.level)&&!rkDesc(r).some(d=>d.id===p.id)&&(p.level==='portfolio'||(p.level==='programme'&&p.programmeId===g))); }
// Is this risk in the register being viewed? roll=true also brings in lower-level registers.
function rkIn(r,sc,roll){ if(sc.lv==='portfolio') return roll||r.level==='portfolio';
  if(sc.lv==='programme') return (r.level==='programme'&&r.programmeId===sc.id)||(roll&&r.level==='project'&&rkProgOf(r)===sc.id)||(rkIfcPids(r).some(pid=>(rkProj(pid)||{}).programmeId===sc.id)&&r.level!=='portfolio'&&roll);
  return (r.level==='project'&&r.projectId===sc.id)||rkIfcPids(r).includes(sc.id); }
const rkIfcPids=r=>(r.d&&r.d.ifc&&r.d.ifc.on&&Array.isArray(r.d.ifc.pids))?r.d.ifc.pids:[];
const rkIsIfc=r=>rkIfcPids(r).length>=2||(r.d&&r.d.ifc&&r.d.ifc.on&&rkIfcPids(r).length>=1&&r.level==='project');

/* ---- scoring ---- */
function rkImpactFromValue(dim,v){ if(v==null||!isFinite(v)||v<=0) return 0; const b=dim.b||[]; let i=1; b.forEach(t=>{ if(v>t) i++; }); return Math.min(5,i); }
function rkProbScore(pct){ if(pct==null||!isFinite(pct)||pct<=0) return 0; const P=rkCfg().prob; for(let i=0;i<P.length;i++) if(pct<=P[i].max) return i+1; return 5; }
function rkScore(s){ if(!s||!s.p) return null; const I=Object.values(s.i||{}).map(Number).filter(x=>x>0); if(!I.length) return null; return s.p*Math.max(...I); }
function rkBand(score){ if(score==null) return null; const B=rkCfg().bands; for(const b of B) if(score<=b.max) return b; return B[B.length-1]; }
const rkQS=(r,k)=>rkScore(r.d&&r.d.q&&r.d.q[k]);
function rkCurScore(r){ return rkQS(r,'cur')??rkQS(r,'pre'); }
function rkChip(score,o){ o=o||{}; if(score==null) return `<span class="rk-chip na"${o.t?` title="${esc(o.t)}"`:''}>—</span>`; const b=rkBand(score); return `<span class="rk-chip" style="--rc:${b.c}" title="${esc((o.t?o.t+': ':'')+b.l+' · score '+score)}">${score}<em>${esc(o.short?b.l.replace('Very high','V high'):b.l)}</em></span>`; }
/* ---- quantitative ---- */
function rkMean(t,dist){ if(!t) return null; const v=k=>t[k]===''||t[k]==null||!isFinite(+t[k])?null:+t[k]; let a=v('min'),m=v('ml'),b=v('max');
  if(a==null&&m==null&&b==null) return null; if(m==null) m=a!=null&&b!=null?(a+b)/2:(a??b); if(a==null) a=m; if(b==null) b=m;
  return dist==='pert'?(a+4*m+b)/6:dist==='uni'?(a+b)/2:(a+m+b)/3; }
function rkQt(r,post){ const q=(r.d&&r.d.qt)||{}, s=post&&q.post&&(q.post.p!=null&&q.post.p!=='')?q.post:q; return {p:+s.p||0,cost:rkMean(s.cost,q.dist),time:rkMean(s.time,q.dist)}; }
// Own expected value. A parent set to roll up its children reports their total instead.
function rkEV(r,post,k){ const q=(r.d&&r.d.qt)||{}; if(q.fromKids){ return rkKids(r).filter(rkLive).reduce((n,c)=>n+rkEV(c,post,k),0); } const x=rkQt(r,post); return x[k]==null?0:x.p/100*x[k]; }
// For totals: count each estimate once (roll-up parents are carried by their children).
function rkEVown(r,post,k){ const q=(r.d&&r.d.qt)||{}; if(q.fromKids) return 0; const x=rkQt(r,post); return x[k]==null?0:x.p/100*x[k]; }
// Portfolio totals: threats only, each estimate once. Opportunities are reported separately.
const rkIsOpp=r=>r.d&&r.d.type==='opp';
const rkTot=(L,post,k)=>L.reduce((n,r)=>n+(rkIsOpp(r)?0:rkEVown(r,post,k)),0);
const rkOppTot=(L,post,k)=>L.reduce((n,r)=>n+(rkIsOpp(r)?-rkEVown(r,post,k):0),0);
function rkMoney(v,o){ o=o||{}; if(v==null||!isFinite(v)) return '—'; const c=rkCfg().cur||'$', a=Math.abs(v), s=v<0?'−':'';
  if(o.full) return s+c+Math.round(a).toLocaleString(); return s+c+(a>=1e9?(a/1e9).toFixed(1)+'bn':a>=1e6?(a/1e6).toFixed(a>=1e7?0:1)+'m':a>=1e3?(a/1e3).toFixed(0)+'k':Math.round(a)); }
const rkDays=v=>v==null||!isFinite(v)?'—':`${Math.round(v)} d`;
function rkTrend(r){ const h=(r.d&&r.d.hist)||[]; if(h.length<2) return 0; const a=h[h.length-2].cur, b=h[h.length-1].cur; if(a==null||b==null) return 0; return Math.sign(b-a); }
const rkTrendHtml=t=>t>0?'<span class="rk-tr up" title="Score up since last review">▲</span>':t<0?'<span class="rk-tr dn" title="Score down since last review">▼</span>':'<span class="rk-tr fl" title="No change">–</span>';
const rkToday=()=>{ const n=new Date(); return Date.UTC(n.getFullYear(),n.getMonth(),n.getDate()); };
const rkActs=r=>((r.d&&r.d.actions)||[]);
const rkOpenActs=r=>rkActs(r).filter(a=>a.status!=='done'&&a.status!=='dropped');
const rkOverdue=a=>a.due&&a.due<rkToday()&&a.status!=='done'&&a.status!=='dropped';
const rkReviewDue=r=>rkLive(r)&&r.d&&r.d.review&&r.d.review<rkToday();
function rkEscTo(r){ if(!rkLive(r)||r.level==='portfolio') return null; const e=rkCfg().esc, sc=rkCurScore(r)||0, ev=rkEV(r,false,'cost');
  const up=r.level==='project'?['programme','portfolio']:['portfolio']; let want=null;
  up.forEach(lv=>{ const t=e[lv]; if(t&&((t.score&&sc>=t.score)||(t.cost&&ev>=t.cost))) want=want||lv; });
  if(!want) return null; const par=rkAncestors(r); if(par.some(p=>rkRank(p.level)<=rkRank(want))) return null; return want; }

/* ---- storage ---- */
function rkCanEdit(){ return typeof PER!=='undefined'&&!!PER.mode&&!perRO(); }
function rkCanDel(r){ return rkCanEdit()&&perCanDel(r&&r.createdBy); }
function rkAdmin(){ return typeof qAdmin==='function'?qAdmin():true; }
async function rkLoadCfg(){ let c=null; try{ if(PER.store&&PER.store.getRiskCfg) c=await PER.store.getRiskCfg(); }catch(e){ if(/risk|column|schema cache|42703/i.test((e&&(e.message||e.code))||'')) RK.schemaOld=true; else console.warn('risk settings',e); }
  if(!c&&PER.mode==='local'){ try{ c=JSON.parse(localStorage.getItem('pacer.rkcfg')||'null'); }catch(_){} }
  RK.cfg=c&&typeof c==='object'?c:null; }
async function rkSaveCfg(cfg){ if(!PER.store||!PER.store.setRiskCfg) throw new Error('Sign in to save settings.'); await PER.store.setRiskCfg(cfg); if(PER.mode==='local'){ try{ localStorage.setItem('pacer.rkcfg',JSON.stringify(cfg)); }catch(_){} } RK.cfg=cfg; }
function rkSubscribe(){
  if(RK.un){ try{ RK.un(); }catch(_){} RK.un=null; } RK.risks=[]; RK.loaded=false; RK._refs={};
  if(typeof PER==='undefined'||!PER.store||!PER.store.watchRisks){ rkRender(); return; }
  RK.un=PER.store.watchRisks(list=>{ RK.schemaOld=false; RK.loaded=true; RK.risks=list.map(r=>Object.assign({status:'open',ref:'',parentId:null,programmeId:null,projectId:null},r,{d:r.d||{}})); rkRender(); },
    e=>{ RK.loaded=true; if(/risks|schema cache|does not exist|42P01|PGRST20/i.test((e&&(e.message||e.code))||'')){ RK.schemaOld=true; rkRender(); } else perToast(perErr(e),'err'); });
  rkLoadCfg().then(()=>rkRender());
}
function rkNextRef(sc){ const pre=rkScopeCode(sc)+'-R'; let n=(RK._refs||{})[pre]||0; RK.risks.forEach(r=>{ if(String(r.ref).startsWith(pre)){ const k=parseInt(String(r.ref).slice(pre.length),10); if(k>n) n=k; } }); return pre+String(n+1).padStart(3,'0'); }
function rkSnap(r){ return {at:Date.now(),by:typeof userName==='function'?userName():'',cur:rkCurScore(r),tgt:rkQS(r,'tgt'),ev:Math.round(rkEV(r,false,'cost')),evt:Math.round(rkEV(r,false,'time')*10)/10,st:r.status}; }
async function rkCreate(r){ r=Object.assign({status:'open',parentId:null,programmeId:null,projectId:null},r); delete r.id; delete r.createdAt; delete r.updatedAt; r.d=Object.assign({},r.d||{}); if(!r.ref) r.ref=rkNextRef(rkScopeOf(r)); { const m=/^(.*-R)(\d+)$/.exec(r.ref); if(m){ RK._refs=RK._refs||{}; RK._refs[m[1]]=Math.max(RK._refs[m[1]]||0,+m[2]); } } if(!r.d.raised) r.d.raised=rkToday();
  if(!r.d.review) r.d.review=rkToday()+rkCfg().review*DAY; r.d.hist=(r.d.hist||[]).concat([rkSnap(r)]); return PER.store.createRisk(r); }
async function rkUpdate(r,prev){ const d=Object.assign({},r.d); const s=rkSnap(r), h=(d.hist||[]).slice(-49), last=h[h.length-1];
  if(!last||last.cur!==s.cur||last.tgt!==s.tgt||last.ev!==s.ev||last.evt!==s.evt||last.st!==s.st||d._reviewed){ h.push(s); } delete d._reviewed; d.hist=h;
  const f={level:r.level,programmeId:r.level==='programme'?r.programmeId:null,projectId:r.level==='project'?r.projectId:null,parentId:r.parentId||null,ref:r.ref,title:r.title,status:r.status,d};
  await PER.store.updateRisk(r.id,f); }
async function rkDelete(r){ for(const k of rkKids(r)) await PER.store.updateRisk(k.id,{parentId:null}); await PER.store.deleteRisk(r.id); }
