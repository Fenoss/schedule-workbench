/* ---------------- model ---------------- */
const S={
  cols:['d:code','d:name','d:finish','d:varF'], colW:{}, tw:null, tblX:0, sort:null,
  files:[], match:'code', tab:'gantt', group:'wbs', colorBy:'crit', showBase:true, logic:'sel', dockTab:'rel', ppd:3, collapsed:new Set(), sel:null, rows:[],
  dq:{role:'live',scope:'all'},
  ifc:{code:null,manual:[],sel:null,days:10,amber:10,wi:null},
  cp:{mode:'off',by:'float',thr:0},
  ex:{title:'',size:'ppt169',cp:false,ifcs:[],msRow:{},tl:{from:'',to:'',scale:'auto'},rows:[],ms:[],showBase:true,color:'row',green:0,amber:20,pct:true,init:false},
  tld:{src:'udf', locType:'', mapType:'', udfS:'', udfE:'', orient:'v', colorBy:'crit', inUnit:'km', fmt:'kmm', overlay:'',
       labels:'id', spans:'line', progress:true, weekends:true, site:true, clash:true, bufM:0, bufD:0},
  chmap:{}, styles:{}, site:{marks:[],profile:[]},
  F:{q:'', status:new Set(), cmp:new Set(), crit:false, wbs:new Set(), codes:{}, proj:new Set()}
};
let M=null;

function buildRole(files){
  const set={acts:new Map(), codeTypes:new Map(), udfs:new Set(), fields:new Set(), dd:null, links:0, xlinks:0, files:files.length, projs:new Set()};
  const byFile=new Map(), byGlobal=new Map(), seenPairs=new Set();
  files.forEach((f,fi)=>{
    const T=f.tables, projs={}, cal={}, calN={}, calR={}, wbs={}, ctype={}, codes={}, udft={};
    if(T.TASK&&T.TASK[0]) Object.keys(T.TASK[0]).forEach(k=>set.fields.add(k));
    (T.PROJECT||[]).forEach(p=>{ const d=pd(p.last_recalc_date||p.next_data_date); projs[p.proj_id]={short:p.proj_short_name||('P'+p.proj_id),dd:d}; set.projs.add(projs[p.proj_id].short); if(d!=null&&(set.dd==null||d>set.dd)) set.dd=d; });
    (T.CALENDAR||[]).forEach(c=>{ cal[c.clndr_id]=+c.day_hr_cnt||8; calN[c.clndr_id]=c.clndr_name; calR[c.clndr_id]=c; });
    (T.PROJWBS||[]).forEach(w=>wbs[w.wbs_id]=w);
    (T.ACTVTYPE||[]).forEach(t=>{ ctype[t.actv_code_type_id]=t.actv_code_type; if(!set.codeTypes.has(t.actv_code_type)) set.codeTypes.set(t.actv_code_type,new Map()); });
    (T.ACTVCODE||[]).forEach(c=>{ const tn=ctype[c.actv_code_type_id]; if(!tn) return; const sh=c.short_name||c.actv_code_name; codes[c.actv_code_id]={type:tn,short:sh};
      const m=set.codeTypes.get(tn); if(!m.has(sh)) m.set(sh,{short:sh,name:c.actv_code_name||sh,seq:+c.seq_num||0,color:c.color}); });
    (T.UDFTYPE||[]).forEach(u=>{ if(u.table_name==='TASK'){ udft[u.udf_type_id]=u.udf_type_label||u.udf_type_name; set.udfs.add(udft[u.udf_type_id]); } });
    const pc={};
    const wpath=id=>{ if(pc[id]) return pc[id]; const w=wbs[id]; if(!w) return []; const par=wbs[w.parent_wbs_id];
      let p; if(w.proj_node_flag==='Y'||!par){ const pj=projs[w.proj_id]; p=[{k:pj?pj.short:w.wbs_short_name,n:w.wbs_name||w.wbs_short_name,seq:+w.seq_num||0,id:w.wbs_id}]; }
      else p=wpath(w.parent_wbs_id).concat([{k:w.wbs_short_name,n:w.wbs_name||w.wbs_short_name,seq:+w.seq_num||0,id:w.wbs_id}]);
      return pc[id]=p; };
    (T.TASK||[]).forEach(t=>{
      if(t.task_type==='TT_WBS') return;
      const pj=projs[t.proj_id]?projs[t.proj_id].short:('P'+t.proj_id), dh=cal[t.clndr_id]||8;
      let s=pd(t.act_start_date)||pd(t.early_start_date)||pd(t.restart_date)||pd(t.target_start_date);
      let f=pd(t.act_end_date)||pd(t.early_end_date)||pd(t.reend_date)||pd(t.target_end_date);
      if(s==null) s=f; if(f==null) f=s;
      const ms=t.task_type==='TT_Mile'||t.task_type==='TT_FinMile';
      let wp=wpath(t.wbs_id); if(!wp.length) wp=[{k:pj,n:pj,seq:0}];
      const tf=t.total_float_hr_cnt===''||t.total_float_hr_cnt==null?null:(+t.total_float_hr_cnt)/dh;
      const a={id:pj+'|'+t.task_code, code:t.task_code, name:t.task_name||'', proj:pj, type:t.task_type, ms, status:t.status_code, pct:+t.phys_complete_pct||0,
        tf, crit: tf!=null && tf<=0.01 && t.status_code!=='TK_Complete', s, f, wp, codes:{}, udf:{}, preds:[], succs:[], fi, fname:files[fi].name, dh, raw:t, calRow:calR[t.clndr_id], calName:calN[t.clndr_id]||t.clndr_id};
      if(set.acts.has(a.id)) a.id+='#'+fi;
      set.acts.set(a.id,a); byFile.set(fi+':'+t.task_id,a); if(!byGlobal.has(t.task_id)) byGlobal.set(t.task_id,a);
    });
    (T.TASKACTV||[]).forEach(r=>{ const a=byFile.get(fi+':'+r.task_id), c=codes[r.actv_code_id]; if(a&&c) a.codes[c.type]=c.short; });
    const addCost=(a,bc,ac,rc)=>{ if(!a) return; const c=a.cost||(a.cost={bc:0,ac:0,rc:0}); c.bc+=bc; c.ac+=ac; c.rc+=rc; if(bc||ac||rc) set.hasCost=true; };
    (T.TASKRSRC||[]).forEach(r=>{ set.hasRsrc=true; const a=byFile.get(fi+':'+r.task_id); if(a){ a.rsrc=true; addCost(a,+r.target_cost||0,(+r.act_reg_cost||0)+(+r.act_ot_cost||0),+r.remain_cost||0); } });
    (T.PROJCOST||[]).forEach(r=>addCost(byFile.get(fi+':'+r.task_id),+r.target_cost||0,+r.act_cost||0,+r.remain_cost||0));
    (T.UDFVALUE||[]).forEach(r=>{ const lab=udft[r.udf_type_id]; if(!lab) return; const a=byFile.get(fi+':'+r.fk_id); if(!a) return;
      a.udf[lab]=r.udf_number!==''&&r.udf_number!=null?+r.udf_number:(r.udf_text||r.udf_date||''); });
  });
  const res=(fi,id)=>byFile.get(fi+':'+id)||byGlobal.get(id);
  files.forEach((f,fi)=>(f.tables.TASKPRED||[]).forEach(r=>{
    const sA=res(fi,r.task_id), pA=res(fi,r.pred_task_id); if(!sA||!pA) return;
    const key=sA.id+'<'+pA.id+'|'+r.pred_type; if(seenPairs.has(key)) return; seenPairs.add(key);
    const type=(r.pred_type||'PR_FS').replace('PR_',''), lag=(+r.lag_hr_cnt||0)/(sA.dh||8);
    sA.preds.push({a:pA,type,lag}); pA.succs.push({a:sA,type,lag}); set.links++; if(pA.fi!==sA.fi) set.xlinks++;
  }));
  return set;
}

function buildModel(){
  const live=buildRole(S.files.filter(f=>f.role==='live')), base=buildRole(S.files.filter(f=>f.role==='baseline'));
  const mk=a=>S.match==='code'?a.code:a.proj+'|'+a.code;
  const map=new Map();
  for(const a of live.acts.values()){ let k=mk(a); if(map.has(k)) k=a.id; map.set(k,{k,L:a,B:null}); }
  for(const b of base.acts.values()){ let k=mk(b); const r=map.get(k); if(r&&!r.B){ r.B=b; continue; } if(r) k=b.id+'@BL'; map.set(k,{k,L:null,B:b}); }
  const wbs=new Map(), roots=[];
  const rows=[...map.values()].map(r=>{
    const a=r.L||r.B; if(r.L) r.L.R=r; if(r.B) r.B.R=r;
    r.code=a.code; r.name=a.name; r.proj=a.proj; r.wp=a.wp; r.codes=r.L?{...(r.B?r.B.codes:{}),...r.L.codes}:r.B.codes;
    r.ms=a.ms; r.s=a.s; r.f=a.f; r.bs=r.B?r.B.s:null; r.bf=r.B?r.B.f:null;
    r.status=r.L?r.L.status:null; r.crit=!!(r.L&&r.L.crit); r.tf=r.L?r.L.tf:null;
    r.varF=(r.L&&r.B&&r.L.f!=null&&r.B.f!=null)?dd(r.L.f-r.B.f):null;
    r.varS=(r.L&&r.B&&r.L.s!=null&&r.B.s!=null)?dd(r.L.s-r.B.s):null;
    r.cmp=!r.B?'added':!r.L?'removed':(r.varF!=null&&r.varF>0)?'late':'ontime';
    let acc=''; r.wkeys=r.wp.map((p,i)=>{ const parent=acc; acc=i?acc+' › '+p.k:p.k; if(!wbs.has(acc)){ const n={key:acc,label:p.n,short:p.k,seq:p.seq,depth:i,children:[],n:0}; wbs.set(acc,n); if(i) wbs.get(parent).children.push(n); else roots.push(n); } return acc; });
    r.wkeys.forEach(k=>wbs.get(k).n++);
    return r;
  });
  const srt=arr=>{ arr.sort((x,y)=>(x.seq-y.seq)||x.short.localeCompare(y.short)); arr.forEach(n=>srt(n.children)); }; srt(roots);
  const codeTypes=new Map();
  for(const src of [live.codeTypes,base.codeTypes]) for(const [t,m] of src){ if(!codeTypes.has(t)) codeTypes.set(t,new Map()); const cm=codeTypes.get(t); for(const [k,v] of m) if(!cm.has(k)) cm.set(k,v); }
  const codeOrder={}; for(const [t,m] of codeTypes){ codeOrder[t]=[...m.values()].sort((a,b)=>(a.seq-b.seq)||a.short.localeCompare(b.short)); }
  const codeCount={}; rows.forEach(r=>{ for(const [t,v] of Object.entries(r.codes)){ (codeCount[t]=codeCount[t]||{}); codeCount[t][v]=(codeCount[t][v]||0)+1; } });
  const usedTypes=[...codeTypes.keys()].filter(t=>codeCount[t]);
  const udfs=[...new Set([...live.udfs,...base.udfs])];
  const projs=[...new Set(rows.map(r=>r.proj))].sort();
  let t0=Infinity,t1=-Infinity; rows.forEach(r=>{ for(const t of [r.s,r.f,r.bs,r.bf]) if(t!=null){ t0=Math.min(t0,t); t1=Math.max(t1,t);} });
  if(!isFinite(t0)){ t0=Date.now(); t1=t0+90*DAY; }
  const byKey=new Map(rows.map(r=>[r.k,r]));
  return {rows,byKey,live,base,wbs,roots,codeTypes:usedTypes,liveFields:[...live.fields],baseFields:[...base.fields],codeOrder,codeCount,udfs,projs,t0,t1,dd:live.dd??base.dd,bdd:base.dd};
}

/* ---------------- filtering ---------------- */
const stat=r=>!r.L?null:r.status==='TK_Complete'?'cp':r.status==='TK_Active'?'ip':'ns';
function filtered(){
  const F=S.F, q=F.q.trim().toLowerCase();
  return M.rows.filter(r=>{
    if(F.ids&&!F.ids.set.has(r.k)) return false;
    if(q&&!(r.code.toLowerCase().includes(q)||r.name.toLowerCase().includes(q))) return false;
    if(F.status.size&&!F.status.has(stat(r))) return false;
    if(F.cmp.size&&!F.cmp.has(r.cmp)) return false;
    if(F.crit&&!r.crit) return false;
    if(F.proj.size&&!F.proj.has(r.proj)) return false;
    if(F.wbs.size&&!r.wkeys.some(k=>F.wbs.has(k))) return false;
    for(const t in F.codes){ const set=F.codes[t]; if(set.size&&!set.has(r.codes[t])) return false; }
    return true;
  });
}
function activeFilterCount(){ const F=S.F; let n=(F.ids?1:0)+(F.q.trim()?1:0)+F.status.size+F.cmp.size+(F.crit?1:0)+F.proj.size+F.wbs.size; for(const t in F.codes) n+=F.codes[t].size; return n; }


/* ---------------- Gantt table columns ---------------- */
const FIELD_LABELS={task_code:'Activity ID',task_name:'Activity Name',status_code:'Activity Status',task_type:'Activity Type',early_start_date:'Early Start',early_end_date:'Early Finish',late_start_date:'Late Start',late_end_date:'Late Finish',
  act_start_date:'Actual Start',act_end_date:'Actual Finish',target_start_date:'Planned Start',target_end_date:'Planned Finish',restart_date:'Remaining Early Start',reend_date:'Remaining Early Finish',
  rem_late_start_date:'Remaining Late Start',rem_late_end_date:'Remaining Late Finish',total_float_hr_cnt:'Total Float',free_float_hr_cnt:'Free Float',target_drtn_hr_cnt:'Original Duration',remain_drtn_hr_cnt:'Remaining Duration',
  phys_complete_pct:'Physical % Complete',complete_pct_type:'% Complete Type',duration_type:'Duration Type',cstr_type:'Primary Constraint',cstr_date:'Primary Constraint Date',cstr_type2:'Secondary Constraint',cstr_date2:'Secondary Constraint Date',
  driving_path_flag:'Driving Path',priority_type:'Priority',float_path:'Float Path',float_path_order:'Float Path Order',expect_end_date:'Expected Finish',external_early_start_date:'External Early Start',external_late_end_date:'External Late Finish',
  suspend_date:'Suspend Date',resume_date:'Resume Date',clndr_id:'Calendar',wbs_id:'WBS',proj_id:'Project',rsrc_id:'Primary Resource',location_id:'Location',
  target_work_qty:'Budgeted Labor Units',act_work_qty:'Actual Labor Units',remain_work_qty:'Remaining Labor Units',target_equip_qty:'Budgeted Nonlabor Units',act_equip_qty:'Actual Nonlabor Units',remain_equip_qty:'Remaining Nonlabor Units',
  act_this_per_work_qty:'Actual This Period Labor Units',est_wt:'Estimated Weight',review_type:'Review Status',lock_plan_flag:'Lock Remaining',auto_compute_act_flag:'Auto Compute Actuals',
  create_date:'Added Date',create_user:'Added By',update_date:'Last Modified Date',update_user:'Last Modified By',guid:'GUID',task_id:'Internal Activity ID'};
const ENUM={TK_NotStart:'Not Started',TK_Active:'In Progress',TK_Complete:'Completed',TT_Task:'Task Dependent',TT_Rsrc:'Resource Dependent',TT_LOE:'Level of Effort',TT_Mile:'Start Milestone',TT_FinMile:'Finish Milestone',TT_WBS:'WBS Summary',
  DT_FixedDUR2:'Fixed Duration & Units/Time',DT_FixedRate:'Fixed Duration & Units',DT_FixedQty:'Fixed Units',DT_FixedDrtn:'Fixed Units/Time',CS_MSO:'Start On',CS_MSOB:'Start On or Before',CS_MSOA:'Start On or After',CS_MEO:'Finish On',
  CS_MEOB:'Finish On or Before',CS_MEOA:'Finish On or After',CS_ALAP:'As Late As Possible',CS_MANDSTART:'Mandatory Start',CS_MANDFIN:'Mandatory Finish',PT_Normal:'Normal',PT_High:'High',PT_Low:'Low',PT_Top:'Top',PT_Lowest:'Lowest',
  CP_Phys:'Physical',CP_Drtn:'Duration',CP_Units:'Units',RV_OK:'OK',RV_Pending:'Pending',RV_Reject:'Rejected'};
const titleize=f=>f.replace(/_(hr_cnt|qty|flag|type|id)$/,m=>' '+m.slice(1).split('_')[0]).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const fieldLabel=f=>FIELD_LABELS[f]||titleize(f);
const fieldRank=f=>{ const i=Object.keys(FIELD_LABELS).indexOf(f); return i<0?1e4:i; };
const DERIVED=[
  ['code','Activity ID',96,'l'],['name','Activity Name',260,'l'],['proj','Project',90,'l'],['wbs','WBS Code',110,'l'],['wbsName','WBS Name',170,'l'],['status','Status',100,'l'],
  ['start','Start',84,'l'],['finish','Finish',84,'l'],['bstart','BL Start',84,'l'],['bfinish','BL Finish',84,'l'],['varS','Start Var (d)',78,'r'],['varF','Finish Var (d)',78,'r'],
  ['tf','Total Float (d)',80,'r'],['crit','Critical',70,'l'],['cmp','Vs Baseline',100,'l'],['pct','% Complete',78,'r'],['cal','Calendar',120,'l']];
let colCache=new Map();
const vcol=v=>v>0?C.late:v<0?C.early:C.ink3;
function fmtRaw(f,v,a){
  if(v==null||v==='') return null;
  if(/_date\d?$/.test(f)) return {s:fmtD(pd(v)),v:pd(v)};
  if(/_hr_cnt$/.test(f)){ const n=(+v)/(a.dh||8); const r=Math.round(n*10)/10; return {s:(Number.isInteger(r)?r:r.toFixed(1))+'d',v:n,num:1}; }
  if(/_pct$/.test(f)) return {s:Math.round(+v)+'%',v:+v,num:1};
  if(/_flag$/.test(f)) return {s:v==='Y'?'Yes':v==='N'?'No':v,v};
  if(f==='clndr_id') return {s:a.calName,v:a.calName};
  if(f==='proj_id') return {s:a.proj,v:a.proj};
  if(f==='wbs_id'){ const w=a.wp[a.wp.length-1]; return {s:w.k,v:w.k}; }
  if(ENUM[v]) return {s:ENUM[v],v:ENUM[v]};
  if(/(_qty|_cost|_cnt|_num|_wt|_order)$/.test(f)&&/^-?\d+(\.\d+)?$/.test(v)){ const n=+v; return {s:n.toLocaleString(undefined,{maximumFractionDigits:2}),v:n,num:1}; }
  return {s:String(v),v:String(v).toLowerCase()};
}
function colDef(id){
  if(colCache.has(id)) return colCache.get(id);
  const k=id.slice(0,2), f=id.slice(2); let d=null;
  if(k==='d:'){ const x=DERIVED.find(z=>z[0]===f); if(!x) return null;
    d={id,label:x[1],w:x[2],align:x[3],group:'Schedule'};
    const G={code:r=>[r.code,r.code],name:r=>[r.name,r.name.toLowerCase()],proj:r=>[r.proj,r.proj],wbs:r=>[r.wp[r.wp.length-1].k,r.wkeys[r.wkeys.length-1]],wbsName:r=>[r.wp[r.wp.length-1].n,r.wp[r.wp.length-1].n],
      status:r=>{ const t=!r.L?'Removed':r.status==='TK_Complete'?'Completed':r.status==='TK_Active'?'In Progress':'Not Started'; return [t,t]; },
      start:r=>[r.L?fmtD(r.s):null,r.L?r.s:null],finish:r=>[r.L?fmtD(r.f):null,r.L?r.f:null],bstart:r=>[r.B?fmtD(r.bs):null,r.bs],bfinish:r=>[r.B?fmtD(r.bf):null,r.bf],
      varS:r=>[r.varS==null?null:sgn(r.varS),r.varS],
      varF:r=>[r.cmp==='added'?'NEW':r.cmp==='removed'?'DEL':r.varF==null?null:sgn(r.varF),r.varF],
      tf:r=>[r.tf==null?null:String(Math.round(r.tf)),r.tf],crit:r=>[r.crit?'Yes':(r.L?'No':null),r.crit?1:0],
      cmp:r=>{ const t={late:'Behind',ontime:'On or ahead',added:'Added',removed:'Removed'}[r.cmp]; return [t,t]; },
      pct:r=>[r.L?Math.round(r.L.pct)+'%':null,r.L?r.L.pct:null],cal:r=>{ const a=r.L||r.B; return [a.calName,a.calName]; }}[f];
    d.get=r=>G(r)[0]; d.sv=r=>G(r)[1];
    if(f==='varF') d.color=r=>r.cmp==='added'?C.accent:r.cmp==='removed'?C.ink3:vcol(r.varF);
    if(f==='varS') d.color=r=>vcol(r.varS);
    if(f==='code') d.color=r=>(cpOn()?cpSet().has(r.k):r.crit)?C.accent:C.ink2;
    if(f==='tf') d.color=r=>r.crit?C.accent:C.ink;
    if(f==='code'||f==='varF'||f==='varS') d.bold=true;
  } else if(k==='L:'||k==='B:'){ const bl=k==='B:', w=/_date\d?$/.test(f)?84:/_hr_cnt|_pct|_qty|_cost/.test(f)?84:f==='task_name'?240:120;
    const num=/_hr_cnt$|_pct$|_qty$|_cost$|_cnt$|_order$|_wt$/.test(f);
    d={id,label:(bl?'BL ':'')+fieldLabel(f),w,align:num?'r':'l',group:bl?'Baseline activity fields':'Live activity fields',field:f};
    const val=r=>{ const a=bl?r.B:r.L; return a?fmtRaw(f,a.raw[f],a):null; };
    d.get=r=>{ const x=val(r); return x?x.s:null; }; d.sv=r=>{ const x=val(r); return x?x.v:null; };
  } else if(k==='c:'){ d={id,label:f,w:110,align:'l',group:'Activity codes'};
    d.get=r=>{ const v=r.codes[f]; if(v==null) return null; const o=(M.codeOrder[f]||[]).find(x=>x.short===v); return o&&o.name!==v?`${v} · ${o.name}`:v; }; d.sv=r=>r.codes[f]??null;
  } else if(k==='u:'){ d={id,label:f,w:110,align:'l',group:'User fields'};
    const val=r=>{ const a=r.L||r.B; const v=a.udf[f]; return v===''||v==null?null:v; };
    d.get=r=>{ const v=val(r); return v==null?null:typeof v==='number'?v.toLocaleString(undefined,{maximumFractionDigits:3}):String(v); }; d.sv=r=>{ const v=val(r); return typeof v==='string'?v.toLowerCase():v; };
    d.align='r';
  }
  colCache.set(id,d); return d;
}
function availableCols(){
  const out=[]; DERIVED.forEach(x=>out.push('d:'+x[0]));
  const fl=arr=>arr.filter(f=>f!=='task_name'&&f!=='task_code').sort((a,b)=>(fieldRank(a)-fieldRank(b))||fieldLabel(a).localeCompare(fieldLabel(b)));
  fl(M.liveFields).forEach(f=>out.push('L:'+f)); fl(M.baseFields).forEach(f=>out.push('B:'+f));
  M.codeTypes.forEach(t=>out.push('c:'+t)); M.udfs.forEach(u=>out.push('u:'+u));
  return out.map(colDef).filter(Boolean);
}
const gCols=()=>S.cols.map(colDef).filter(Boolean);
const colW=c=>S.colW[c.id]||c.w;
const colsW=()=>gCols().reduce((a,c)=>a+colW(c),0)+12;
function colLayout(){ let x=12-S.tblX; return gCols().map(c=>{ const o={c,x,w:colW(c)}; x+=o.w; return o; }); }
function savePrefs(){ try{ localStorage.setItem('pacer.cols',JSON.stringify({cols:S.cols,colW:S.colW,tw:S.tw,sort:S.sort})); }catch(_){} }
function loadPrefs(){ try{ const p=JSON.parse(localStorage.getItem('pacer.cols')||'null'); if(p&&Array.isArray(p.cols)&&p.cols.length){ S.cols=p.cols; S.colW=p.colW||{}; S.tw=p.tw??null; S.sort=p.sort||null; } }catch(_){} }

/* ---------------- theme ---------------- */
const C={};
function readTheme(){ const cs=getComputedStyle(document.documentElement); ['bg','surface','surface2','band','line','grid','ink','ink2','ink3','accent','accentSoft','late','early','active','base','bar','done'].forEach(k=>C[k]=cs.getPropertyValue('--'+k).trim()); }
const FONT=(w,s,cond)=>`${w} ${s}px ${cond?"'Barlow Condensed','Arial Narrow'":"Barlow"}, system-ui, sans-serif`;
function codeColor(type,v){ const ord=M.codeOrder[type]||[]; const i=ord.findIndex(o=>o.short===v); return i<0?C.ink3:PAL[i%PAL.length]; }
function colorOf(r,by){
  if(!r.L) return C.base;
  if(by==='crit') return r.status==='TK_Complete'?C.done:r.crit?C.accent:C.bar;
  if(by==='status') return r.status==='TK_Complete'?C.done:r.status==='TK_Active'?C.active:C.bar;
  if(by.startsWith('code:')){ const t=by.slice(5), v=r.codes[t]; return v==null?C.ink3:codeColor(t,v); }
  return C.bar;
}
function setupCanvas(cv,w,h){ const dpr=window.devicePixelRatio||1; const W=Math.round(w*dpr),H=Math.round(h*dpr); if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; cv.style.width=w+'px'; cv.style.height=h+'px'; } const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); return ctx; }
function fit(ctx,s,w){ if(w<=8) return ''; if(ctx.measureText(s).width<=w) return s; let lo=0,hi=s.length; while(lo<hi){ const m=(lo+hi+1)>>1; if(ctx.measureText(s.slice(0,m)+'…').width<=w) lo=m; else hi=m-1; } return lo?s.slice(0,lo)+'…':''; }
function rr(ctx,x,y,w,h,r){ r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function diamond(ctx,x,y,s){ ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x+s,y); ctx.lineTo(x,y+s); ctx.lineTo(x-s,y); ctx.closePath(); }
function setLS(ctx,v){ if('letterSpacing' in ctx) ctx.letterSpacing=v; }

