/* ================= Schedule Builder: CPM engine + editor ================= */
const bid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
const dayOf=ms=>Math.floor(ms/DAY);
const isoD=d=>{ if(d==null) return ''; const x=new Date(d*DAY); return `${x.getUTCFullYear()}-${p2(x.getUTCMonth()+1)}-${p2(x.getUTCDate())}`; };
const fmtDay=d=>d==null?'':fmtD(d*DAY);
function parseDay(s){
  s=String(s||'').trim(); if(!s) return null; let m;
  if((m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return Math.floor(Date.UTC(+m[1],m[2]-1,+m[3])/DAY);
  if((m=/^(\d{1,2})[\s\-\/.]([A-Za-z]{3})[a-z]*[\s\-\/.,]*(\d{2,4})$/.exec(s))){ const mo=MON.findIndex(x=>x.toLowerCase()===m[2].toLowerCase()); if(mo>=0){ let y=+m[3]; if(y<100) y+=2000; return Math.floor(Date.UTC(y,mo,+m[1])/DAY); } }
  if((m=/^([A-Za-z]{3})[a-z]*[\s\-\/.]+(\d{1,2}),?[\s\-\/.]+(\d{2,4})$/.exec(s))){ const mo=MON.findIndex(x=>x.toLowerCase()===m[1].toLowerCase()); if(mo>=0){ let y=+m[3]; if(y<100) y+=2000; return Math.floor(Date.UTC(y,mo,+m[2])/DAY); } }
  if((m=/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/.exec(s))){ let a=+m[1], b=+m[2], y=+m[3]; if(y<100) y+=2000; const [d,mo]=a>12?[a,b]:[b,a]; return Math.floor(Date.UTC(y,mo-1,d)/DAY); }
  return null;
}
const CSTR=[['','As soon as possible'],['SNET','Start on or after'],['FNET','Finish on or after'],['SNLT','Start on or before'],['FNLT','Finish on or before'],['MSO','Start on'],['MFO','Finish on']];
const CSTR_P6={SNET:'CS_MSOA',FNET:'CS_MEOA',SNLT:'CS_MSOB',FNLT:'CS_MEOB',MSO:'CS_MSO',MFO:'CS_MEO'};
const P6_CSTR={CS_MSOA:'SNET',CS_MEOA:'FNET',CS_MSOB:'SNLT',CS_MEOB:'FNLT',CS_MSO:'MSO',CS_MEO:'MFO',CS_MANDSTART:'MSO',CS_MANDFIN:'MFO'};
ENUM.CS_MSOA=ENUM.CS_MSOA||'Start On or After'; ENUM.CS_MEOA=ENUM.CS_MEOA||'Finish On or After';

function compileCal(cal,base,span){
  let work=(cal.work||[]).map(Boolean); if(!work.some(Boolean)) work=[1,1,1,1,1,1,1].map(Boolean);
  const hol=new Set((cal.hol||[]).map(parseDay).filter(d=>d!=null));
  const cum=new Int32Array(span+1), wd=[];
  for(let i=0;i<span;i++){ const d=base+i; cum[i]=wd.length; if(work[(d+4)%7]&&!hol.has(d)) wd.push(d); } // 1970-01-01 was a Thursday (dow 4)
  cum[span]=wd.length;
  const idx=d=>{ const i=d-base; return i<=0?0:i>=span?wd.length:cum[i]; };
  return { idx,
    next:d=>wd[Math.min(idx(d),wd.length-1)],
    prev:d=>wd[Math.max(0,idx(d+1)-1)],
    add:(d,n)=>wd[Math.max(0,Math.min(wd.length-1,idx(d)+n))],
    count:(a,b)=>b<a?0:idx(b+1)-idx(a),
    isWork:d=>idx(d+1)-idx(d)===1 };
}
const bStatus=a=>a.as!=null&&a.af!=null?'cp':a.as!=null?'ip':'ns';
const bDur=a=>a.type==='task'?Math.max(0,Math.round(+a.dur||0)):0;

function bCompute(st){
  const acts=st.acts, byId=new Map(acts.map(a=>[a.id,a])), dd=st.dd, out={R:new Map(),loops:[],openEnds:[],warnings:[]};
  let base=dd-900; acts.forEach(a=>[a.as,a.af,a.cdate].forEach(d=>{ if(d!=null&&d-500<base) base=d-500; })); if(st.mf!=null&&st.mf-500<base) base=st.mf-500;
  const cals=new Map(); st.cals.forEach(c=>cals.set(c.id,compileCal(c,base,365*45)));
  const fallback=cals.get(st.defCal)||cals.values().next().value||compileCal({work:[0,1,1,1,1,1,0]},base,365*45);
  const calOf=a=>cals.get(a.cal)||fallback;
  const preds=new Map(acts.map(a=>[a.id,[]])), succs=new Map(acts.map(a=>[a.id,[]]));
  st.rels.forEach(r=>{ if(byId.has(r.p)&&byId.has(r.s)&&r.p!==r.s){ preds.get(r.s).push(r); succs.get(r.p).push(r); } });
  const indeg=new Map(acts.map(a=>[a.id,preds.get(a.id).length])), q=acts.filter(a=>!indeg.get(a.id)).map(a=>a.id), order=[];
  for(let i=0;i<q.length;i++){ const id=q[i]; order.push(id); succs.get(id).forEach(r=>{ const n=indeg.get(r.s)-1; indeg.set(r.s,n); if(n===0) q.push(r.s); }); }
  out.loops=acts.filter(a=>indeg.get(a.id)>0).map(a=>a.code);
  const sff=(c,f,d)=>d>0?c.add(c.prev(f),-(d-1)):f+1;
  const R=out.R;
  for(const id of order){ const a=byId.get(id), c=calOf(a), dur=bDur(a), s=bStatus(a), r={id,dur,status:s,fwd:new Map(),drv:new Set()};
    if(s==='cp'){ r.es=a.as; r.ef=Math.max(a.as-(dur?0:1),a.af); r.rs=r.es; r.rem=0; R.set(id,r); continue; }
    let rem=dur; if(s==='ip'){ rem=a.rem!=null&&a.rem!==''?Math.max(0,Math.round(+a.rem)):a.pct!=null&&a.pct!==''?Math.max(0,Math.round(dur*(1-(+a.pct)/100))):Math.max(1,dur-c.count(a.as,dd-1)); }
    r.rem=rem; let es=c.next(dd);
    preds.get(id).forEach(rel=>{ const p=R.get(rel.p); if(!p) return; const lag=Math.round(+rel.lag||0); let cand;
      if(rel.t==='SS') cand=c.add(c.next(p.es),lag);
      else if(rel.t==='FF') cand=sff(c,c.add(c.prev(p.ef),lag),rem);
      else if(rel.t==='SF') cand=sff(c,c.add(c.next(p.es),lag)-1,rem);
      else cand=c.add(c.next(p.ef+1),lag);
      r.fwd.set(rel,cand); if(cand>es) es=cand; });
    if(s==='ns'&&a.cdate!=null&&a.cstr){ const cd=a.cdate;
      if(a.cstr==='SNET') es=Math.max(es,c.next(cd)); else if(a.cstr==='FNET') es=Math.max(es,sff(c,cd,rem)); else if(a.cstr==='MSO') es=c.next(cd); else if(a.cstr==='MFO') es=sff(c,cd,rem); }
    if(rem>0) es=c.next(es);
    if(s==='ip'){ r.rs=es; r.es=a.as; r.ef=rem>0?c.add(es,rem-1):Math.max(a.as,c.prev(dd-1)); }
    else { r.es=r.rs=es; r.ef=dur>0?c.add(es,dur-1):es-1; }
    R.set(id,r); }
  let pEF=-Infinity; R.forEach(r=>{ if(r.ef>pEF) pEF=r.ef; }); out.finish=isFinite(pEF)?pEF:null;
  const pLF=st.mf!=null?st.mf:pEF;
  for(let i=order.length-1;i>=0;i--){ const id=order[i], a=byId.get(id), r=R.get(id), c=calOf(a);
    if(r.status==='cp'){ r.lf=r.ef; r.ls=r.es; r.tf=null; r.ff=null; continue; }
    const d=r.rem; let lf=c.prev(pLF);
    succs.get(id).forEach(rel=>{ const sr=R.get(rel.s); if(!sr||sr.status==='cp') return; const cs=calOf(byId.get(rel.s)), lag=Math.round(+rel.lag||0); let cand;
      if(rel.t==='SS'){ const ls=cs.add(cs.next(sr.ls),-lag); cand=d>0?c.add(c.next(ls),d-1):ls-1; }
      else if(rel.t==='FF') cand=c.prev(cs.add(cs.prev(sr.lf),-lag));
      else if(rel.t==='SF'){ const ls=cs.add(cs.prev(sr.lf+1),-lag); cand=d>0?c.add(c.next(ls),d-1):ls-1; }
      else cand=c.prev(cs.add(cs.next(sr.ls),-lag)-1);
      if(cand<lf) lf=cand; });
    if(r.status==='ns'&&a.cdate!=null&&a.cstr){ const cd=a.cdate;
      if(a.cstr==='FNLT') lf=Math.min(lf,c.prev(cd)); else if(a.cstr==='MFO') lf=c.prev(cd);
      else if(a.cstr==='SNLT'){ const ls=c.prev(cd); lf=Math.min(lf,d>0?c.add(ls,d-1):ls-1); } else if(a.cstr==='MSO'){ const ls=c.next(cd); lf=d>0?c.add(ls,d-1):ls-1; } }
    r.lf=lf; r.ls=d>0?c.add(c.prev(lf),-(d-1)):lf+1;
    r.tf=c.idx(lf+1)-c.idx(r.ef+1); }
  // free float + driving relationships
  R.forEach((r,id)=>{ if(r.status==='cp') return; const a=byId.get(id); let ff=Infinity;
    succs.get(id).forEach(rel=>{ const sr=R.get(rel.s); if(!sr||sr.status==='cp') return; const cand=sr.fwd.get(rel); if(cand==null) return; const cs=calOf(byId.get(rel.s)); const sl=cs.idx(sr.rs)-cs.idx(cand); if(sl<=0) sr.drv.add(rel); ff=Math.min(ff,sl); });
    r.ff=ff===Infinity?r.tf:Math.max(0,Math.min(ff,r.tf)); r.crit=r.tf<=0;
    const np=!preds.get(id).length&&a.type!=='start', ns=!succs.get(id).length&&a.type!=='finish'; if(np||ns) out.openEnds.push({code:a.code,why:np&&ns?'no predecessor or successor':np?'no predecessor':'no successor'}); });
  R.forEach(r=>{ if(r.status!=='cp') return; });
  out.preds=preds; out.succs=succs; out.calOf=calOf; out.crit=[...R.values()].filter(r=>r.crit).length;
  return out;
}

/* ---------- conversions: builder <-> Workbench model / XER ---------- */
function bCalFromName(name,hrs){ const n=String(name||'').toLowerCase(); const work=/7\s*-?\s*day|seven/.test(n)?[1,1,1,1,1,1,1]:/6\s*-?\s*day|six/.test(n)?[0,1,1,1,1,1,1]:[0,1,1,1,1,1,0]; return {id:bid(),name:name||'Standard',work,hrs:hrs||8,hol:[]}; }
function bFromSet(set,dd,files){
  const st={v:1,name:M.projs.join(' + ')||'Imported schedule',dd:dd!=null?dayOf(dd):dayOf(Date.now()),mf:null,cals:[],projects:[],wbs:[],acts:[],rels:[],codeTypes:[],baseline:null,sync:false,chUnit:S.tld.inUnit||'km'};
  const calByName=new Map(), projBy=new Map(), wbsBy=new Map(), actBy=new Map();
  const acts=[...set.acts.values()];
  acts.forEach(a=>{ if(!projBy.has(a.proj)){ const p={id:bid(),short:a.proj,name:(a.wp[0]&&a.wp[0].n)||a.proj,src:{f:a.fname,pid:a.raw.proj_id},srcWbs:a.wp[0]&&a.wp[0].id}; projBy.set(a.proj,p); st.projects.push(p); } });
  const chS=S.tld.src==='udf'?S.tld.udfS:null, chE=S.tld.src==='udf'?S.tld.udfE:null;
  acts.forEach(a=>{
    const p=projBy.get(a.proj); let parent=null, key=a.proj;
    a.wp.slice(1).forEach(w=>{ key+=' › '+w.k; if(!wbsBy.has(key)){ const n={id:bid(),proj:p.id,parent,code:w.k,name:w.n,seq:w.seq||wbsBy.size+1,src:w.id,name0:w.n,code0:w.k}; wbsBy.set(key,n); st.wbs.push(n); } parent=wbsBy.get(key).id; });
    const cn=a.calName||'Standard'; if(!calByName.has(cn)){ const pc=p6CalParse(a.calRow), c=pc?{id:bid(),name:cn,work:pc.work,hrs:+a.calRow.day_hr_cnt||a.dh||8,hol:pc.hol}:bCalFromName(cn,a.dh); if(a.calRow) c.src=a.calRow.clndr_id; calByName.set(cn,c); st.cals.push(c); }
    const raw=a.raw, dh=a.dh||8, type=a.type==='TT_Mile'?'start':a.type==='TT_FinMile'?'finish':'task';
    const dur=type==='task'?Math.max(0,Math.round((+raw.target_drtn_hr_cnt||0)/dh)):0;
    const x={id:bid(),proj:p.id,wbs:parent,seq:st.acts.length+1,code:a.code,name:a.name,type,dur,cal:calByName.get(cn).id,cstr:P6_CSTR[raw.cstr_type]||'',cdate:raw.cstr_date?(()=>{ const t=pd(raw.cstr_date), fin=/^(FNET|FNLT|MFO)$/.test(P6_CSTR[raw.cstr_type]||''); return dayOf(t)-(fin&&(t%DAY)<=8*HR?1:0); })():null,as:null,af:null,rem:null,pct:null,codes:{...a.codes},ch0:null,ch1:null,src:{f:a.fname,t:a.raw.task_id}};
    if(!x.cstr) x.cdate=null;
    if(a.status==='TK_Complete'){ x.as=dayOf(pd(raw.act_start_date)??a.s); const tf=pd(raw.act_end_date)??a.f; x.af=dayOf(tf); if(type==='finish'&&(tf%DAY)<=8*HR){ x.af-=1; x.as=x.af+1; } }
    else if(a.status==='TK_Active'){ x.as=dayOf(pd(raw.act_start_date)??a.s); x.rem=Math.round((+raw.remain_drtn_hr_cnt||0)/dh); x.pct=Math.round(+raw.phys_complete_pct||0); }
    if(chS){ const v0=parseFloat(a.udf[chS]), v1=parseFloat(a.udf[chE||chS]); if(isFinite(v0)) x.ch0=v0; if(isFinite(v1)) x.ch1=v1; }
    x.src.ch=[x.ch0,x.ch1]; x.src.codes=JSON.stringify(x.codes); x.src.cstr=[x.cstr,x.cdate,raw.cstr_type||'',raw.cstr_date||''];
    actBy.set(a,x); st.acts.push(x); });
  if(files) bRsFromFiles(st,files);
  st.defCal=st.cals[0]?st.cals[0].id:null; if(!st.cals.length){ const c=bCalFromName('Standard 5-day',8); st.cals.push(c); st.defCal=c.id; }
  acts.forEach(a=>a.preds.forEach(p=>{ const s=actBy.get(a), q=actBy.get(p.a); if(s&&q) st.rels.push({p:q.id,s:s.id,t:p.type,lag:Math.round(p.lag)}); }));
  M.codeTypes.forEach(t=>st.codeTypes.push({name:t,values:(M.codeOrder[t]||[]).map(o=>({short:o.short,name:o.name}))}));
  return st;
}
function bSnapshot(st,res){ const by={}; st.acts.forEach(a=>{ const r=res.R.get(a.id); if(r) by[a.id]={es:r.es,ef:r.ef,ls:r.ls,lf:r.lf,tf:r.tf,ff:r.ff,dur:r.dur}; }); return by; }
function bToXer(st,res,mode,snap){
  const isB=mode==='base', off=isB?500000:0, files=[];
  const calId=new Map(st.cals.map((c,i)=>[c.id,i+1])), calHrs=new Map(st.cals.map(c=>[c.id,+c.hrs||8]));
  const types=st.codeTypes.map((t,i)=>({id:801+i,name:t.name,values:t.values}));
  const codeIdFor=(ti,short)=>{ const j=types[ti].values.findIndex(v=>v.short===short); return j<0?null:types[ti].id*1000+j+1; };
  const projId=new Map(st.projects.map((p,i)=>[p.id,(isB?2001:1001)+i])), actNum=new Map(st.acts.map((a,i)=>[a.id,off+200000+i])), wbsNum=new Map(st.wbs.map((w,i)=>[w.id,off+100000+i]));
  const byId=new Map(st.acts.map(a=>[a.id,a])), H=8*HR, E=17*HR, T=d=>d==null?'':fx(d*DAY+H), TE=d=>d==null?'':fx(d*DAY+E), FE=d=>d==null?'':st.finMsAm?T(d+1):TE(d);
  const tbl=(name,fields,rows)=>`%T\t${name}\n%F\t${fields.join('\t')}\n`+rows.map(r=>'%R\t'+fields.map(f=>String(r[f]??'').replace(/[\t\r\n]/g,' ')).join('\t')).join('\n')+(rows.length?'\n':'');
  const ddate=isB&&snap&&snap.dd!=null?snap.dd:st.dd;
  st.projects.forEach(p=>{ const pid=projId.get(p.id), root=off+90000+pid;
    const wbs=[{wbs_id:root,proj_id:pid,seq_num:0,proj_node_flag:'Y',wbs_short_name:p.short,wbs_name:p.name,parent_wbs_id:''}].concat(st.wbs.filter(w=>w.proj===p.id).map(w=>({wbs_id:wbsNum.get(w.id),proj_id:pid,seq_num:w.seq,proj_node_flag:'N',wbs_short_name:w.code,wbs_name:w.name,parent_wbs_id:w.parent&&wbsNum.has(w.parent)?wbsNum.get(w.parent):root})));
    const tasks=[], preds=[], tav=[], udf=[], trs=[], pcs=[], memos=[]; let pid2=off+1;
    st.acts.filter(a=>a.proj===p.id).forEach(a=>{ const r=isB?snap.R[a.id]:res.R.get(a.id); if(!r) return; const hrs=calHrs.get(a.cal)||8, tt=a.type==='start'?'TT_Mile':a.type==='finish'?'TT_FinMile':'TT_Task', s=isB?'ns':bStatus(a);
      const fin=a.type==='finish', ms=a.type!=='task'||r.dur===0;
      const es=ms?(fin?FE(r.ef):T(r.es)):T(r.rs!=null&&s==='ip'?r.rs:r.es), ef=ms?(fin?FE(r.ef):T(r.es)):TE(r.ef);
      const ls=ms?(fin?FE(r.lf):T(r.ls)):T(r.ls), lf=ms?(fin?FE(r.lf):T(r.ls)):TE(r.lf);
      const t={task_id:actNum.get(a.id),proj_id:pid,wbs_id:a.wbs&&wbsNum.has(a.wbs)?wbsNum.get(a.wbs):root,clndr_id:calId.get(a.cal)||1,phys_complete_pct:0,task_code:a.code,task_name:a.name,task_type:tt,status_code:'TK_NotStart',duration_type:'DT_FixedDUR2',
        total_float_hr_cnt:r.tf==null?'':r.tf*hrs,free_float_hr_cnt:r.ff==null?'':r.ff*hrs,target_drtn_hr_cnt:r.dur*hrs,remain_drtn_hr_cnt:r.dur*hrs,act_start_date:'',act_end_date:'',early_start_date:es,early_end_date:ef,late_start_date:ls,late_end_date:lf,
        target_start_date:es,target_end_date:ef,cstr_type:CSTR_P6[a.cstr]||'',cstr_date:a.cstr&&a.cdate!=null?T(a.cdate):'',driving_path_flag:r.tf!=null&&r.tf<=0?'Y':'N'};
      if(s==='cp') Object.assign(t,{status_code:'TK_Complete',phys_complete_pct:100,act_start_date:T(a.as),act_end_date:ms&&fin?FE(a.af):TE(a.af),early_start_date:'',early_end_date:'',late_start_date:'',late_end_date:'',remain_drtn_hr_cnt:0,total_float_hr_cnt:'',free_float_hr_cnt:''});
      else if(s==='ip') Object.assign(t,{status_code:'TK_Active',phys_complete_pct:a.pct!=null&&a.pct!==''?+a.pct:Math.round((1-(r.rem/(r.dur||1)))*100),act_start_date:T(a.as),remain_drtn_hr_cnt:r.rem*hrs,late_start_date:''});
      tasks.push(t);
      if(!isB){ const tid=actNum.get(a.id);
        (a.asg||[]).forEach((x,j)=>{ const rs=(st.rsrcs||[]).find(q=>q.id===x.r); if(!rs) return; trs.push({taskrsrc_id:tid*10+j+1,task_id:tid,proj_id:pid,rsrc_id:700+(st.rsrcs||[]).indexOf(rs),rsrc_type:rs.type,target_qty:+x.bu||0,remain_qty:+x.ru||0,act_reg_qty:+x.au||0,act_ot_qty:0,cost_per_qty:+x.price||0,target_cost:r2(x.bc),remain_cost:r2(x.rc),act_reg_cost:r2(x.ac),act_ot_cost:0,act_start_date:s!=='ns'?T(a.as):'',act_end_date:s==='cp'?TE(a.af):'',target_start_date:t.target_start_date,target_end_date:t.target_end_date}); });
        (a.exp||[]).forEach((x,j)=>pcs.push({cost_item_id:tid*10+j+1,proj_id:pid,task_id:tid,cost_name:x.name,target_cost:r2(x.bc),act_cost:r2(x.ac),remain_cost:r2(x.rc),cost_load_type:'CL_Uniform',auto_compute_act_flag:'N'}));
        if(a.note) memos.push({memo_id:tid,task_id:tid,memo_type_id:1,proj_id:pid,task_memo:memoHtml(a.note)}); }
      (res.preds.get(a.id)||[]).forEach(rel=>{ if(isB&&!snap.R[rel.p]) return; preds.push({task_pred_id:pid2++,task_id:actNum.get(a.id),pred_task_id:actNum.get(rel.p),proj_id:pid,pred_proj_id:projId.get(byId.get(rel.p).proj),pred_type:'PR_'+(rel.t||'FS'),lag_hr_cnt:(Math.round(+rel.lag||0))*hrs}); });
      types.forEach((ty,ti)=>{ const v=a.codes&&a.codes[ty.name]; if(v==null) return; const cid=codeIdFor(ti,v); if(cid) tav.push({task_id:actNum.get(a.id),actv_code_type_id:ty.id,actv_code_id:cid,proj_id:pid}); });
      if(a.ch0!=null&&a.ch0!=='') udf.push({udf_type_id:901,fk_id:actNum.get(a.id),proj_id:pid,udf_number:a.ch0});
      if(a.ch1!=null&&a.ch1!=='') udf.push({udf_type_id:902,fk_id:actNum.get(a.id),proj_id:pid,udf_number:a.ch1}); });
    const u=st.chUnit||'km';
    let txt=`ERMHDR\t21.12\t${isoD(ddate)}\tProject\tADMIN\tSchedule Workbench\tdbxDatabaseNoName\tProject Management\tUSD\n`;
    txt+=tbl('CALENDAR',['clndr_id','default_flag','clndr_name','day_hr_cnt','week_hr_cnt'],st.cals.map((c,i)=>({clndr_id:i+1,default_flag:c.id===st.defCal?'Y':'N',clndr_name:c.name,day_hr_cnt:+c.hrs||8,week_hr_cnt:(+c.hrs||8)*(c.work||[]).filter(Boolean).length})));
    txt+=tbl('PROJECT',['proj_id','proj_short_name','last_recalc_date','plan_start_date','next_data_date','plan_end_date'],[{proj_id:pid,proj_short_name:p.short,last_recalc_date:fx(ddate*DAY),plan_start_date:fx(ddate*DAY),next_data_date:fx(ddate*DAY),plan_end_date:st.mf!=null?TE(st.mf):''}]);
    txt+=tbl('PROJWBS',['wbs_id','proj_id','seq_num','proj_node_flag','wbs_short_name','wbs_name','parent_wbs_id'],wbs);
    txt+=tbl('ACTVTYPE',['actv_code_type_id','actv_code_type','seq_num','actv_short_len','proj_id','actv_code_type_scope'],types.map((t,i)=>({actv_code_type_id:t.id,actv_code_type:t.name,seq_num:i+1,actv_short_len:20,proj_id:'',actv_code_type_scope:'AS_Global'})));
    txt+=tbl('ACTVCODE',['actv_code_id','parent_actv_code_id','actv_code_type_id','actv_code_name','short_name','seq_num','color'],types.flatMap(t=>t.values.map((v,j)=>({actv_code_id:t.id*1000+j+1,parent_actv_code_id:'',actv_code_type_id:t.id,actv_code_name:v.name||v.short,short_name:v.short,seq_num:j+1,color:''}))));
    txt+=tbl('UDFTYPE',['udf_type_id','table_name','udf_type_name','udf_type_label','logical_data_type'],[{udf_type_id:901,table_name:'TASK',udf_type_name:'user_field_901',udf_type_label:`Chainage Start (${u})`,logical_data_type:'FT_FLOAT_2_DECIMALS'},{udf_type_id:902,table_name:'TASK',udf_type_name:'user_field_902',udf_type_label:`Chainage End (${u})`,logical_data_type:'FT_FLOAT_2_DECIMALS'}]);
    txt+=tbl('TASK',['task_id','proj_id','wbs_id','clndr_id','phys_complete_pct','task_code','task_name','task_type','duration_type','status_code','total_float_hr_cnt','free_float_hr_cnt','target_drtn_hr_cnt','remain_drtn_hr_cnt','act_start_date','act_end_date','early_start_date','early_end_date','late_start_date','late_end_date','target_start_date','target_end_date','cstr_type','cstr_date','driving_path_flag'],tasks);
    txt+=tbl('TASKPRED',['task_pred_id','task_id','pred_task_id','proj_id','pred_proj_id','pred_type','lag_hr_cnt'],preds);
    txt+=tbl('TASKACTV',['task_id','actv_code_type_id','actv_code_id','proj_id'],tav);
    txt+=tbl('UDFVALUE',['udf_type_id','fk_id','proj_id','udf_date','udf_number','udf_text'],udf);
    if(trs.length){ const ids=new Set(trs.map(r=>r.rsrc_id)); txt+=tbl('RSRC',['rsrc_id','rsrc_short_name','rsrc_name','rsrc_type'],(st.rsrcs||[]).map((r,i)=>({rsrc_id:700+i,rsrc_short_name:r.short,rsrc_name:r.name,rsrc_type:r.type})).filter(r=>ids.has(r.rsrc_id)));
      txt+=tbl('TASKRSRC',['taskrsrc_id','task_id','proj_id','rsrc_id','rsrc_type','target_qty','remain_qty','act_reg_qty','act_ot_qty','cost_per_qty','target_cost','remain_cost','act_reg_cost','act_ot_cost','act_start_date','act_end_date','target_start_date','target_end_date'],trs); }
    if(pcs.length) txt+=tbl('PROJCOST',['cost_item_id','proj_id','task_id','cost_name','target_cost','act_cost','remain_cost','cost_load_type','auto_compute_act_flag'],pcs);
    if(memos.length){ txt+=tbl('MEMOTYPE',['memo_type_id','seq_num','task_flag','memo_type'],[{memo_type_id:1,seq_num:1,task_flag:'Y',memo_type:'Notes'}]); txt+=tbl('TASKMEMO',['memo_id','task_id','memo_type_id','proj_id','task_memo'],memos); }
    txt+='%E\n';
    files.push({name:`${p.short}_${isB?'Baseline':'Live'}.xer`,text:txt}); });
  return files;
}
function bToFiles(){
  const st=B.st, res=B.res, out=[];
  bToXer(st,res,'live').forEach(f=>{ const T=parseXER(f.text); out.push({id:uid(),name:f.name,role:'live',tables:T,info:fileInfo(T),builder:true}); });
  if(st.baseline){ const bs=st.baseline; const bst={...st,acts:bs.acts,rels:bs.rels,projects:bs.projects||st.projects,wbs:bs.wbs||st.wbs,cals:bs.cals||st.cals,dd:bs.dd};
    const bres={R:new Map(),preds:new Map()}; bst.acts.forEach(a=>bres.preds.set(a.id,[])); bst.rels.forEach(r=>{ if(bres.preds.has(r.s)) bres.preds.get(r.s).push(r); });
    bToXer(bst,bres,'base',{R:bs.R,dd:bs.dd}).forEach(f=>{ const T=parseXER(f.text); out.push({id:uid(),name:f.name,role:'baseline',tables:T,info:fileInfo(T),builder:true}); }); }
  return out;
}

/* ---------- resources, costs, notes and other P6 data ---------- */
// P6 calendar data: weekdays 1=Sun..7=Sat, exceptions as Excel serial days. Holidays only (working exceptions are ignored).
function p6CalParse(row){
  const d=row&&row.clndr_data; if(!d) return null;
  const i=d.indexOf('DaysOfWeek'); if(i<0) return null; const j=d.indexOf('Exceptions'), dow=d.slice(i,j>i?j:undefined), work=[0,0,0,0,0,0,0]; let found=false;
  for(let k=1;k<=7;k++){ const a=dow.indexOf(`(0||${k}()(`); if(a<0) continue; found=true; const b=k<7?dow.indexOf(`(0||${k+1}()(`,a+1):-1; work[k-1]=/s\|\d/.test(dow.slice(a,b<0?dow.length:b))?1:0; }
  if(!found||!work.some(Boolean)) return null;
  const hol=[]; if(j>=0){ const re=/\(0\|\|\d+\(d\|(\d+)\)\([\s\x7f]*\)\)/g; let m; while((m=re.exec(d.slice(j)))) hol.push(isoD(+m[1]-25569)); }
  return {work,hol};
}
const memoText=h=>String(h||'').replace(/\x7f\x7f/g,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\n{3,}/g,'\n\n').trim();
const memoHtml=t=>`<HTML><BODY>${esc(t).replace(/\n/g,'<br>')}</BODY></HTML>`;
const RS_TYPES=[['RT_Labor','Labour'],['RT_Equip','Equipment'],['RT_Mat','Material']];
const r2=v=>Math.round((+v||0)*100)/100;
// Read resource assignments, expenses and notebook notes from the source XER tables into builder state.
function bRsFromFiles(st,files){
  const tabs=new Map(files.map(f=>[f.name,f.tables])), rsBy=new Map(); st.rsrcs=st.rsrcs||[];
  const rsFor=(fname,rid,T)=>{ const row=(T.RSRC||[]).find(r=>String(r.rsrc_id)===String(rid)), short=row?(row.rsrc_short_name||row.rsrc_name||'R'+rid):'R'+rid;
    let r=rsBy.get(short); if(!r){ const rate=(T.RSRCRATE||[]).filter(x=>String(x.rsrc_id)===String(rid)).map(x=>+x.cost_per_qty||0).find(v=>v>0);
      r={id:bid(),short,name:row?(row.rsrc_name||short):short,type:row&&row.rsrc_type||'RT_Labor',unit:row&&row.rsrc_type==='RT_Mat'?(row.unit_id||'unit'):'h',price:rate||0,src:{},name0:null}; r.name0=r.name; rsBy.set(short,r); st.rsrcs.push(r); }
    r.src[fname]=rid; return r; };
  const idx=new Map(); files.forEach(f=>{ const T=f.tables, g=k=>{ const m=new Map(); (T[k]||[]).forEach(r=>{ const id=String(r.task_id); if(!m.has(id)) m.set(id,[]); m.get(id).push(r); }); return m; };
    idx.set(f.name,{T,tr:g('TASKRSRC'),pc:g('PROJCOST'),memo:g('TASKMEMO')}); });
  st.acts.forEach(a=>{ const I=a.src&&idx.get(a.src.f); if(!I) return; const tid=String(a.src.t);
    a.asg=(I.tr.get(tid)||[]).map(r=>{ const rs=rsFor(a.src.f,r.rsrc_id,I.T), bu=+r.target_qty||0, ot=+r.act_ot_qty||0, au=(+r.act_reg_qty||0)+ot, price=+r.cost_per_qty||rs.price||0;
      const st0=bStatus(a), ru=r.remain_qty!==''&&r.remain_qty!=null?+r.remain_qty:st0==='cp'?0:Math.max(0,bu-au);
      if(!rs.price&&price) rs.price=price;
      const otc=+r.act_ot_cost||0, bc=r.target_cost!==''&&r.target_cost!=null?+r.target_cost:bu*price, ac=r.act_reg_cost!=null&&r.act_reg_cost!==''?(+r.act_reg_cost||0)+otc:au*price, rc=r.remain_cost!==''&&r.remain_cost!=null?+r.remain_cost:ru*price;
      return {id:bid(),r:rs.id,bu,au,ru,price,bc:r2(bc),ac:r2(ac),rc:r2(rc),ot,otc,src:r.taskrsrc_id}; });
    a.exp=(I.pc.get(tid)||[]).map(r=>{ const bc=+r.target_cost||0, ac=+r.act_cost||0; return {id:bid(),name:r.cost_name||'Expense',bc,ac,rc:r.remain_cost!==''&&r.remain_cost!=null?+r.remain_cost:Math.max(0,bc-ac),src:r.cost_item_id}; });
    const m=(I.memo.get(tid)||[])[0]; a.note=m?memoText(m.task_memo):''; a.src.note=a.note; a.src.memo=m?m.memo_id:null; });
}
// Cost roll-ups
function bCostOf(a){ let bc=0,ac=0,rc=0,bu=0,au=0,ru=0; (a.asg||[]).forEach(x=>{ bc+=+x.bc||0; ac+=+x.ac||0; rc+=+x.rc||0; bu+=+x.bu||0; au+=+x.au||0; ru+=+x.ru||0; }); (a.exp||[]).forEach(x=>{ bc+=+x.bc||0; ac+=+x.ac||0; rc+=+x.rc||0; }); return {bc,ac,rc,eac:ac+rc,bu,au,ru}; }
function bCostTot(acts){ const t={bc:0,ac:0,rc:0,eac:0,n:0}; acts.forEach(a=>{ if(!(a.asg&&a.asg.length)&&!(a.exp&&a.exp.length)) return; const c=bCostOf(a); t.bc+=c.bc; t.ac+=c.ac; t.rc+=c.rc; t.eac+=c.eac; t.n++; }); return t; }
let moneyF=null; const money=v=>{ if(v==null||!isFinite(v)) return ''; if(!moneyF) moneyF=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}); return moneyF.format(v); };
const moneyK=v=>{ if(v==null||!isFinite(v)) return '—'; const a=Math.abs(v); return (v<0?'−':'')+(a>=1e6?'$'+(a/1e6).toFixed(a>=1e7?1:2)+'m':a>=1e4?'$'+Math.round(a/1e3)+'k':money(a)); };
function bResText(a){ const L=a.asg||[]; if(!L.length) return (a.exp&&a.exp.length)?`${a.exp.length} expense${a.exp.length===1?'':'s'}`:''; return L.map(x=>{ const r=(B.st.rsrcs||[]).find(r=>r.id===x.r); return r?r.short:'?'; }).join(', '); }
// Keep assignment actuals and remaining in step with the activity's progress during an update, until someone edits them by hand.
function updRsAuto(st,res){
  const u=st.upd; if(!u) return;
  st.acts.forEach(a=>{ const f=u.f0[a.id]; if(!f) return; const s=bStatus(a), r=res.R.get(a.id); if(!r) return;
    const rem0=f[2]==='ip'?f[4]:f[2]==='ns'?bDur(a)||f[4]||0:0, frac=s==='cp'?0:s==='ns'?1:rem0>0?r.rem/rem0:(r.rem>0?1:0);
    (a.asg||[]).forEach(x=>{ if(x.man||!x.u0) return; const [au0,ru0,ac0,rc0]=x.u0; if(s==='ns'&&f[2]==='ns'){ x.au=au0; x.ru=ru0; x.ac=ac0; x.rc=rc0; return; }
      x.ru=Math.round(ru0*frac*10)/10; x.au=Math.round((au0+Math.max(0,ru0-x.ru))*10)/10; x.rc=r2(rc0*frac); x.ac=r2(ac0+Math.max(0,rc0-x.rc)); });
    (a.exp||[]).forEach(x=>{ if(x.man||!x.u0) return; const [ac0,rc0]=x.u0; x.rc=r2(rc0*frac); x.ac=r2(ac0+Math.max(0,rc0-x.rc)); }); });
}
/* ---- dialogs: activity resources & costs, resource dictionary ---- */
function bAsgOpen(id){ const el=document.getElementById('bDlg'); el.dataset.act=id; el.dataset.kind='asg'; el.hidden=false; bRenderRsDialog(); }
function bRenderRsDialog(){
  const el=document.getElementById('bDlg'), st=B.st, kind=el.dataset.kind; if(el.hidden||!st) return false; st.rsrcs=st.rsrcs||[]; el.classList.toggle('wide',kind==='asg'||kind==='rsrc');
  if(kind==='asg'){ const a=st.acts.find(x=>x.id===el.dataset.act); if(!a){ el.hidden=true; return true; } const c=bCostOf(a), up=!!st.upd;
    const num=(i,f,v,w)=>`<input class="tvi" style="width:${w||66}px" data-asg="${i}" data-asf="${f}" value="${v==null?'':Math.round(v*100)/100}" inputmode="decimal">`;
    const enm=(i,f,v,w)=>`<input class="tvi" style="width:${w||84}px" data-exp="${i}" data-exf="${f}" value="${v==null?'':Math.round(v*100)/100}" inputmode="decimal">`;
    el.innerHTML=`<div class="cph"><strong>Resources &amp; costs · ${esc(a.code)}</strong><span class="sp"></span><button class="fx" data-bd="close" aria-label="Close">×</button></div>
      <div class="muted" style="font-size:13px;margin:-4px 0 10px">${esc(a.name)}${up?' · actuals and remaining follow this activity’s progress until you change them here':''}</div>
      <div class="rs-t"><table class="rst"><thead><tr><th>Resource</th><th class="r">Budget units</th><th class="r">Actual units</th><th class="r">Remaining units</th><th class="r">Price / unit</th><th class="r">Budget cost</th><th class="r">Actual cost</th><th class="r">Remaining cost</th><th class="r">At completion</th><th></th></tr></thead><tbody>
      ${(a.asg||[]).map((x,i)=>`<tr><td><select data-asg="${i}" data-asf="r">${st.rsrcs.map(r=>`<option value="${r.id}"${r.id===x.r?' selected':''}>${esc(r.short)} · ${esc(r.name)}</option>`).join('')}</select></td><td class="r">${num(i,'bu',x.bu)}</td><td class="r">${num(i,'au',x.au)}</td><td class="r">${num(i,'ru',x.ru)}</td><td class="r">${num(i,'price',x.price,64)}</td><td class="r">${num(i,'bc',x.bc,84)}</td><td class="r">${num(i,'ac',x.ac,84)}</td><td class="r">${num(i,'rc',x.rc,84)}</td><td class="r">${money(x.ac+x.rc)}</td><td><button class="link danger" data-asdel="${i}" aria-label="Remove assignment">Remove</button></td></tr>`).join('')||'<tr><td colspan="10" class="muted">No resources assigned.</td></tr>'}
      </tbody></table></div>
      <div class="bcr" style="margin:8px 0 14px"><button class="btn sm" data-rsa="addasg" ${st.rsrcs.length?'':'disabled'}>+ Assign resource</button><button class="btn sm ghost" data-rsa="dict">Resource dictionary…</button>${st.rsrcs.length?'':'<span class="muted" style="font-size:12.5px">Add a resource to the dictionary first.</span>'}</div>
      <div class="rs-t"><table class="rst"><thead><tr><th>Expense</th><th class="r">Budget cost</th><th class="r">Actual cost</th><th class="r">Remaining cost</th><th class="r">At completion</th><th></th></tr></thead><tbody>
      ${(a.exp||[]).map((x,i)=>`<tr><td><input data-exp="${i}" data-exf="name" value="${esc(x.name)}" class="rs-n"></td><td class="r">${enm(i,'bc',x.bc)}</td><td class="r">${enm(i,'ac',x.ac)}</td><td class="r">${enm(i,'rc',x.rc)}</td><td class="r">${money(x.ac+x.rc)}</td><td><button class="link danger" data-exdel="${i}">Remove</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No expenses.</td></tr>'}
      </tbody></table></div>
      <div class="bcr" style="margin:8px 0 14px"><button class="btn sm" data-rsa="addexp">+ Add expense</button></div>
      <div class="rs-sum"><span>Budget <b>${money(c.bc)||'$0'}</b></span><span>Actual <b>${money(c.ac)||'$0'}</b></span><span>Remaining <b>${money(c.rc)||'$0'}</b></span><span>At completion <b>${money(c.eac)||'$0'}</b> <em class="${dCls(Math.round(c.eac-c.bc))}">${c.bc?(c.eac-c.bc===0?'on budget':(c.eac>c.bc?'+':'−')+money(Math.abs(c.eac-c.bc))+' vs budget'):''}</em></span></div>
      <label class="exf" style="margin-top:12px"><span>Notes</span><textarea rows="3" data-anote="1" placeholder="Notebook text carried to and from P6">${esc(a.note||'')}</textarea></label>`;
    return true; }
  if(kind==='rsrc'){ const used=new Map(); st.acts.forEach(a=>(a.asg||[]).forEach(x=>used.set(x.r,(used.get(x.r)||0)+1)));
    el.innerHTML=`<div class="cph"><strong>Resources</strong><span class="sp"></span><button class="btn sm" data-rsa="addrs">Add resource</button><button class="fx" data-bd="close" aria-label="Close">×</button></div>
      <div class="rs-t"><table class="rst"><thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Unit</th><th class="r">Price / unit</th><th class="r">Used on</th><th></th></tr></thead><tbody>
      ${st.rsrcs.map((r,i)=>`<tr><td><input class="rs-s" data-rs="${i}" data-rsf="short" value="${esc(r.short)}"></td><td><input class="rs-n" data-rs="${i}" data-rsf="name" value="${esc(r.name)}"></td><td><select data-rs="${i}" data-rsf="type">${RS_TYPES.map(([k,l])=>`<option value="${k}"${r.type===k?' selected':''}>${l}</option>`).join('')}</select></td><td><input class="tvi" style="width:56px;text-align:left" data-rs="${i}" data-rsf="unit" value="${esc(r.unit||'h')}"></td><td class="r"><input class="tvi" style="width:74px" data-rs="${i}" data-rsf="price" value="${r.price||0}"></td><td class="r">${used.get(r.id)||0}</td><td>${used.get(r.id)?'':`<button class="link danger" data-rsdel="${i}">Delete</button>`}</td></tr>`).join('')||'<tr><td colspan="7" class="muted">No resources yet.</td></tr>'}
      </tbody></table></div>
      <p class="muted" style="font-size:12.5px;margin:8px 0 0">Price per unit sets the cost of new assignments and of units you change. Costs already in the schedule are kept as they are.</p>`;
    return true; }
  return false;
}
function bWireRs(){
  const dl=document.getElementById('bDlg');
  dl.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const st=B.st, a=st.acts.find(x=>x.id===dl.dataset.act); st.rsrcs=st.rsrcs||[];
    const v=b.dataset.rsa;
    if(v==='dict'){ dl.dataset.kind='rsrc'; bRenderRsDialog(); return; }
    if(v==='addrs'){ bPush(); let n=st.rsrcs.length+1; while(st.rsrcs.some(r=>r.short==='RES-'+n)) n++; st.rsrcs.push({id:bid(),short:'RES-'+n,name:'New resource',type:'RT_Labor',unit:'h',price:0,src:{}}); bChanged(); bRenderRsDialog(); return; }
    if(b.dataset.rsdel!=null){ bPush(); st.rsrcs.splice(+b.dataset.rsdel,1); bChanged(); bRenderRsDialog(); return; }
    if(!a) return;
    if(v==='addasg'){ bPush(); const r=st.rsrcs[0], bu=bDur(a)*8||8; a.asg=a.asg||[]; a.asg.push({id:bid(),r:r.id,bu,au:0,ru:bu,price:r.price||0,bc:r2(bu*(r.price||0)),ac:0,rc:r2(bu*(r.price||0)),ot:0,otc:0,man:true}); bChanged(); bRenderRsDialog(); }
    else if(v==='addexp'){ bPush(); a.exp=a.exp||[]; a.exp.push({id:bid(),name:'Expense',bc:0,ac:0,rc:0,man:true}); bChanged(); bRenderRsDialog(); }
    else if(b.dataset.asdel!=null){ bPush(); a.asg.splice(+b.dataset.asdel,1); bChanged(); bRenderRsDialog(); }
    else if(b.dataset.exdel!=null){ bPush(); a.exp.splice(+b.dataset.exdel,1); bChanged(); bRenderRsDialog(); } });
  dl.addEventListener('change',e=>{ const t=e.target, st=B.st, a=st.acts.find(x=>x.id===dl.dataset.act);
    if(t.dataset.rs!=null){ const r=st.rsrcs[+t.dataset.rs], f=t.dataset.rsf; bPush(); if(f==='price') r.price=Math.max(0,parseFloat(t.value)||0); else if(f==='short'){ const v=t.value.trim(); if(v&&!st.rsrcs.some(x=>x!==r&&x.short===v)) r.short=v; } else r[f]=t.value.trim()||r[f]; bChanged(); bRenderRsDialog(); return; }
    if(!a) return;
    if(t.dataset.anote){ bPush(); a.note=t.value.replace(/\s+$/,''); bChanged(); return; }
    if(t.dataset.asg!=null){ const x=a.asg[+t.dataset.asg], f=t.dataset.asf; bPush(); x.man=true;
      if(f==='r'){ x.r=t.value; const r=st.rsrcs.find(q=>q.id===t.value); if(r&&r.price&&!x.price){ x.price=r.price; x.bc=r2(x.bu*x.price); x.ac=r2(x.au*x.price); x.rc=r2(x.ru*x.price); } }
      else { const n=Math.max(0,parseFloat(t.value)||0); x[f]=n;
        if(f==='price'){ x.bc=r2(x.bu*n); x.ac=r2(x.au*n); x.rc=r2(x.ru*n); }
        else if(['bu','au','ru'].includes(f)&&x.price){ x[{bu:'bc',au:'ac',ru:'rc'}[f]]=r2(n*x.price); }
        if(f==='bu'&&bStatus(a)==='ns'){ x.ru=n; if(x.price) x.rc=r2(n*x.price); } }
      bChanged(); bRenderRsDialog(); return; }
    if(t.dataset.exp!=null){ const x=a.exp[+t.dataset.exp], f=t.dataset.exf; bPush(); x.man=true; if(f==='name') x.name=t.value.trim()||'Expense'; else { x[f]=Math.max(0,parseFloat(t.value)||0); if(f==='bc'&&bStatus(a)==='ns') x.rc=x[f]; } bChanged(); bRenderRsDialog(); } });
}
/* ---- write an update back into the original XER tables, keeping everything the editor doesn't touch ---- */
function updPatch(st,res,src){
  const H=8*HR, E=17*HR, T=d=>d==null?'':fx(d*DAY+H), TE=d=>d==null?'':fx(d*DAY+E), FE=d=>d==null?'':st.finMsAm?T(d+1):TE(d);
  const out=src.map(f=>{ const C={}; Object.entries(f.tables).forEach(([k,rows])=>{ if(Array.isArray(rows)) C[k]=rows.map(r=>({...r})); }); return {name:f.name,T:C}; });
  const byName=new Map(out.map(o=>[o.name,o])), tb=(o,k)=>o.T[k]||(o.T[k]=[]);
  const mx=(rows,k)=>rows.reduce((m,r)=>Math.max(m,+r[k]||0),0);
  const gen=(o,k,f)=>{ const key='_n_'+k+f; if(o[key]==null) o[key]=mx(tb(o,k),f); return ++o[key]; };
  let gTask=Math.max(0,...out.map(o=>mx(tb(o,'TASK'),'task_id')));
  const projF=new Map();
  st.projects.forEach(p=>{ let o=p.src&&byName.get(p.src.f); if(!o) o=out.find(o=>(o.T.PROJECT||[]).some(r=>r.proj_short_name===p.short)); if(!o) return;
    const pr=(o.T.PROJECT||[]).find(r=>p.src&&String(r.proj_id)===String(p.src.pid))||(o.T.PROJECT||[]).find(r=>r.proj_short_name===p.short)||(o.T.PROJECT||[])[0];
    const pid=pr?pr.proj_id:''; let root=p.srcWbs; if(root==null||!(o.T.PROJWBS||[]).some(w=>String(w.wbs_id)===String(root))){ const rw=(o.T.PROJWBS||[]).find(w=>w.proj_node_flag==='Y'&&String(w.proj_id)===String(pid)); root=rw?rw.wbs_id:''; }
    projF.set(p.id,{o,pid,root}); });
  // data date
  out.forEach(o=>(o.T.PROJECT||[]).forEach(r=>{ r.last_recalc_date=fx(st.dd*DAY); if('next_data_date' in r) r.next_data_date=fx(st.dd*DAY); }));
  // task ids
  const tidOf=new Map(), keep=new Map(out.map(o=>[o.name,new Set()]));
  st.acts.forEach(a=>{ const P=projF.get(a.proj); if(!P) return; const same=a.src&&a.src.f===P.o.name&&(P.o.T.TASK||[]).some(r=>String(r.task_id)===String(a.src.t));
    const tid=same?a.src.t:String(++gTask); tidOf.set(a.id,{o:P.o,tid:String(tid),pid:P.pid,P}); keep.get(P.o.name).add(String(tid)); });
  // calendars and WBS
  const calId=(o,cal)=>{ const C=tb(o,'CALENDAR'); if(cal&&cal.src!=null&&C.some(r=>String(r.clndr_id)===String(cal.src))) return cal.src; if(!cal) return (C[0]||{}).clndr_id||'';
    const ex=C.find(r=>r.clndr_name===cal.name); if(ex) return ex.clndr_id; const id=gen(o,'CALENDAR','clndr_id'); C.push({clndr_id:id,default_flag:'N',clndr_name:cal.name,day_hr_cnt:+cal.hrs||8,week_hr_cnt:(+cal.hrs||8)*(cal.work||[]).filter(Boolean).length}); return id; };
  const wbsId=(o,P,wid)=>{ if(!wid) return P.root; const w=st.wbs.find(x=>x.id===wid); if(!w) return P.root; const W=tb(o,'PROJWBS');
    let row=w.src!=null&&W.find(r=>String(r.wbs_id)===String(w.src));
    if(row){ if(w.name!==w.name0) row.wbs_name=w.name; if(w.code!==w.code0) row.wbs_short_name=w.code; return row.wbs_id; }
    const par=wbsId(o,P,w.parent), id=gen(o,'PROJWBS','wbs_id'); W.push({wbs_id:id,proj_id:P.pid,seq_num:w.seq||0,proj_node_flag:'N',wbs_short_name:w.code,wbs_name:w.name,parent_wbs_id:par}); w.src=id; w.name0=w.name; w.code0=w.code; return id; };
  const calHrs=new Map(st.cals.map(c=>[c.id,+c.hrs||8])), byId=new Map(st.acts.map(a=>[a.id,a]));
  // TASK rows
  const deleted=new Map(out.map(o=>[o.name,new Set()]));
  out.forEach(o=>{ o.T.TASK=(o.T.TASK||[]).filter(r=>{ if(r.task_type==='TT_WBS'||keep.get(o.name).has(String(r.task_id))) return true; deleted.get(o.name).add(String(r.task_id)); return false; }); });
  st.acts.forEach(a=>{ const I=tidOf.get(a.id); if(!I) return; const r=res.R.get(a.id); if(!r) return; const o=I.o, hrs=calHrs.get(a.cal)||8, s=bStatus(a), fin=a.type==='finish', ms=a.type!=='task'||r.dur===0;
    let row=(o.T.TASK||[]).find(x=>String(x.task_id)===I.tid); const isNew=!row; if(isNew){ row={task_id:I.tid,proj_id:I.pid}; o.T.TASK.push(row); }
    const es=ms?(fin?FE(r.ef):T(r.es)):T(r.rs!=null&&s==='ip'?r.rs:r.es), ef=ms?(fin?FE(r.ef):T(r.es)):TE(r.ef), ls=ms?(fin?FE(r.lf):T(r.ls)):T(r.ls), lf=ms?(fin?FE(r.lf):T(r.ls)):TE(r.lf);
    const cal=st.cals.find(c=>c.id===a.cal);
    Object.assign(row,{wbs_id:wbsId(o,I.P,a.wbs),clndr_id:calId(o,cal),task_code:a.code,task_name:a.name,task_type:a.type==='start'?'TT_Mile':a.type==='finish'?'TT_FinMile':(row.task_type&&!/Mile/.test(row.task_type)?row.task_type:'TT_Task'),
      target_drtn_hr_cnt:r.dur*hrs,driving_path_flag:r.tf!=null&&r.tf<=0?'Y':'N'});
    const c0=a.src&&a.src.cstr; if(!(c0&&!isNew&&c0[0]===a.cstr&&c0[1]===a.cdate)) Object.assign(row,{cstr_type:CSTR_P6[a.cstr]||'',cstr_date:a.cstr&&a.cdate!=null?(a.cstr.startsWith('F')||a.cstr==='MFO'?TE(a.cdate):T(a.cdate)):''});
    if(s==='cp') Object.assign(row,{status_code:'TK_Complete',phys_complete_pct:100,act_start_date:T(a.as),act_end_date:ms?(fin?FE(a.af):T(a.af)):TE(a.af),early_start_date:'',early_end_date:'',late_start_date:'',late_end_date:'',remain_drtn_hr_cnt:0,total_float_hr_cnt:'',free_float_hr_cnt:''});
    else if(s==='ip') Object.assign(row,{status_code:'TK_Active',phys_complete_pct:a.pct!=null&&a.pct!==''?+a.pct:Math.round((1-(r.rem/(r.dur||1)))*100),act_start_date:T(a.as),act_end_date:'',early_start_date:es,early_end_date:ef,late_start_date:ls,late_end_date:lf,remain_drtn_hr_cnt:r.rem*hrs,total_float_hr_cnt:r.tf==null?'':r.tf*hrs,free_float_hr_cnt:r.ff==null?'':r.ff*hrs});
    else Object.assign(row,{status_code:'TK_NotStart',phys_complete_pct:0,act_start_date:'',act_end_date:'',early_start_date:es,early_end_date:ef,late_start_date:ls,late_end_date:lf,remain_drtn_hr_cnt:r.dur*hrs,total_float_hr_cnt:r.tf==null?'':r.tf*hrs,free_float_hr_cnt:r.ff==null?'':r.ff*hrs,target_start_date:es,target_end_date:ef});
    if(isNew&&s!=='ns'){ row.target_start_date=T(a.as); row.target_end_date=s==='cp'?TE(a.af):ef; }
    if('restart_date' in row||'reend_date' in row){ row.restart_date=s==='cp'?'':es; row.reend_date=s==='cp'?'':ef; }
    if(!isNew&&!row.duration_type) row.duration_type='DT_FixedDUR2'; if(isNew){ row.duration_type='DT_FixedDUR2'; row.complete_pct_type='CP_Phys'; } });
  // cascade deletes into every task-keyed table
  const allDel=new Set(); deleted.forEach(set=>set.forEach(t=>allDel.add(t)));
  out.forEach(o=>{ const del=deleted.get(o.name); Object.keys(o.T).forEach(k=>{ if(k==='TASK') return; const rows=o.T[k]; if(!rows.length) return;
      if(k==='TASKPRED') o.T[k]=rows.filter(r=>!del.has(String(r.task_id))&&!allDel.has(String(r.pred_task_id)));
      else if(k==='UDFVALUE'){ const tt=new Set((o.T.UDFTYPE||[]).filter(u=>u.table_name==='TASK').map(u=>String(u.udf_type_id))); o.T[k]=rows.filter(r=>!(tt.has(String(r.udf_type_id))&&del.has(String(r.fk_id)))); }
      else if('task_id' in rows[0]) o.T[k]=rows.filter(r=>!del.has(String(r.task_id))); }); });
  // relationships: rebuild for our activities, reusing the original rows where the link is unchanged
  out.forEach(o=>{ const old=new Map((o.T.TASKPRED||[]).map(r=>[`${r.task_id}|${r.pred_task_id}|${r.pred_type}`,r])), mine=new Set([...tidOf.values()].filter(I=>I.o===o).map(I=>I.tid)), rows=(o.T.TASKPRED||[]).filter(r=>!mine.has(String(r.task_id)));
    st.acts.forEach(a=>{ const I=tidOf.get(a.id); if(!I||I.o!==o) return; const hrs=calHrs.get(a.cal)||8;
      (res.preds.get(a.id)||[]).forEach(rel=>{ const Pq=tidOf.get(rel.p); if(!Pq) return; const type='PR_'+(rel.t||'FS'), k=`${I.tid}|${Pq.tid}|${type}`, ex=old.get(k);
        const row=ex||{task_pred_id:gen(o,'TASKPRED','task_pred_id'),task_id:I.tid,pred_task_id:Pq.tid,proj_id:I.pid,pred_proj_id:Pq.pid,pred_type:type};
        row.lag_hr_cnt=Math.round(+rel.lag||0)*hrs; rows.push(row); }); });
    o.T.TASKPRED=rows; });
  // resources
  const rsId=(o,rs)=>{ if(rs.src&&rs.src[o.name]!=null) { const row=(o.T.RSRC||[]).find(r=>String(r.rsrc_id)===String(rs.src[o.name])); if(row){ if(rs.name!==rs.name0) row.rsrc_name=rs.name; row.rsrc_short_name=rs.short; } else tb(o,'RSRC').push({rsrc_id:rs.src[o.name],rsrc_short_name:rs.short,rsrc_name:rs.name,rsrc_type:rs.type}); return rs.src[o.name]; }
    const ex=(o.T.RSRC||[]).find(r=>r.rsrc_short_name===rs.short); if(ex){ rs.src[o.name]=ex.rsrc_id; return ex.rsrc_id; }
    const anyId=Object.values(rs.src||{})[0], used=(o.T.RSRC||[]).map(r=>String(r.rsrc_id)).concat((o.T.TASKRSRC||[]).map(r=>String(r.rsrc_id)));
    const id=anyId!=null&&!used.includes(String(anyId))?anyId:used.reduce((m,v)=>Math.max(m,+v||0),0)+1;
    tb(o,'RSRC').push({rsrc_id:id,rsrc_short_name:rs.short,rsrc_name:rs.name,rsrc_type:rs.type}); rs.src=rs.src||{}; rs.src[o.name]=id; return id; };
  out.forEach(o=>{ const mine=new Map([...tidOf.entries()].filter(([,I])=>I.o===o).map(([id,I])=>[I.tid,id])), oldTr=new Map((o.T.TASKRSRC||[]).map(r=>[String(r.taskrsrc_id),r])), oldPc=new Map((o.T.PROJCOST||[]).map(r=>[String(r.cost_item_id),r]));
    const tr=(o.T.TASKRSRC||[]).filter(r=>!mine.has(String(r.task_id))), pc=(o.T.PROJCOST||[]).filter(r=>!mine.has(String(r.task_id)));
    mine.forEach((aid,tid)=>{ const a=byId.get(aid), I=tidOf.get(aid), r=res.R.get(aid), s=bStatus(a), hrs=calHrs.get(a.cal)||8; if(!r) return;
      const rs0=s==='cp'?'':T(r.rs!=null&&s==='ip'?r.rs:r.es), re0=s==='cp'?'':TE(r.ef);
      (a.asg||[]).forEach(x=>{ const rs=(st.rsrcs||[]).find(q=>q.id===x.r); if(!rs) return; let row=x.src!=null&&oldTr.get(String(x.src)); if(row&&String(row.task_id)!==tid) row=null;
        if(!row){ row={taskrsrc_id:gen(o,'TASKRSRC','taskrsrc_id'),task_id:tid,proj_id:I.pid,rsrc_type:rs.type,target_start_date:T(a.as!=null?a.as:r.es),target_end_date:TE(r.ef)}; x.src=row.taskrsrc_id; }
        const ot=Math.min(+x.ot||0,+x.au||0), otc=Math.min(+x.otc||0,+x.ac||0);
        Object.assign(row,{rsrc_id:rsId(o,rs),target_qty:+x.bu||0,remain_qty:+x.ru||0,act_reg_qty:r2((+x.au||0)-ot),act_ot_qty:ot,cost_per_qty:+x.price||0,target_cost:r2(x.bc),remain_cost:r2(x.rc),act_reg_cost:r2((+x.ac||0)-otc),act_ot_cost:otc,
          act_start_date:s!=='ns'?T(a.as):'',act_end_date:s==='cp'?TE(a.af):'',restart_date:rs0,reend_date:re0});
        if(r.rem>0&&s!=='cp'&&'remain_qty_per_hr' in row) row.remain_qty_per_hr=r2((+x.ru||0)/(r.rem*hrs));
        tr.push(row); });
      (a.exp||[]).forEach(x=>{ let row=x.src!=null&&oldPc.get(String(x.src)); if(row&&String(row.task_id)!==tid) row=null;
        if(!row){ row={cost_item_id:gen(o,'PROJCOST','cost_item_id'),task_id:tid,proj_id:I.pid,cost_load_type:'CL_Uniform',auto_compute_act_flag:'N'}; x.src=row.cost_item_id; }
        Object.assign(row,{cost_name:x.name,target_cost:r2(x.bc),act_cost:r2(x.ac),remain_cost:r2(x.rc)}); pc.push(row); }); });
    o.T.TASKRSRC=tr; o.T.PROJCOST=pc; });
  // activity codes, chainage and notes — only where they changed
  const chS=S.tld.src==='udf'?S.tld.udfS:null, chE=S.tld.src==='udf'?(S.tld.udfE||S.tld.udfS):null;
  st.acts.forEach(a=>{ const I=tidOf.get(a.id); if(!I) return; const o=I.o, isNew=!(a.src&&a.src.f===o.name&&String(a.src.t)===I.tid);
    if(isNew||JSON.stringify(a.codes||{})!==a.src.codes){ o.T.TASKACTV=(o.T.TASKACTV||[]).filter(r=>String(r.task_id)!==I.tid);
      Object.entries(a.codes||{}).forEach(([tn,v])=>{ if(v==null||v==='') return; const TY=tb(o,'ACTVTYPE'), CO=tb(o,'ACTVCODE'); let ty=TY.find(t=>t.actv_code_type===tn);
        if(!ty){ ty={actv_code_type_id:gen(o,'ACTVTYPE','actv_code_type_id'),actv_code_type:tn,seq_num:TY.length+1,actv_short_len:20,proj_id:'',actv_code_type_scope:'AS_Global'}; TY.push(ty); }
        let co=CO.find(c=>String(c.actv_code_type_id)===String(ty.actv_code_type_id)&&(c.short_name||c.actv_code_name)===v);
        if(!co){ const def=(st.codeTypes.find(t=>t.name===tn)||{values:[]}).values.find(x=>x.short===v); co={actv_code_id:gen(o,'ACTVCODE','actv_code_id'),parent_actv_code_id:'',actv_code_type_id:ty.actv_code_type_id,actv_code_name:def&&def.name||v,short_name:v,seq_num:CO.length+1,color:''}; CO.push(co); }
        tb(o,'TASKACTV').push({task_id:I.tid,actv_code_type_id:ty.actv_code_type_id,actv_code_id:co.actv_code_id,proj_id:I.pid}); }); }
    const ch=a.src&&!isNew?a.src.ch:[null,null];
    [[0,chS,a.ch0],[1,chE,a.ch1]].forEach(([i,lab,v])=>{ if(!lab||(v??null)===(ch[i]??null)) return; const UT=tb(o,'UDFTYPE'); let ut=UT.find(u=>u.table_name==='TASK'&&(u.udf_type_label||u.udf_type_name)===lab);
      if(!ut){ ut={udf_type_id:gen(o,'UDFTYPE','udf_type_id'),table_name:'TASK',udf_type_name:'user_field_'+(UT.length+900),udf_type_label:lab,logical_data_type:'FT_FLOAT_2_DECIMALS'}; UT.push(ut); }
      const UV=tb(o,'UDFVALUE'); o.T.UDFVALUE=UV.filter(r=>!(String(r.udf_type_id)===String(ut.udf_type_id)&&String(r.fk_id)===I.tid)); if(v!=null&&v!=='') o.T.UDFVALUE.push({udf_type_id:ut.udf_type_id,fk_id:I.tid,proj_id:I.pid,udf_date:'',udf_number:v,udf_text:''}); });
    const n0=a.src&&!isNew?a.src.note||'':'', n1=a.note||'';
    if(n1!==n0||(isNew&&n1)){ const TM=tb(o,'TASKMEMO'); let row=a.src&&!isNew&&a.src.memo!=null&&TM.find(m=>String(m.memo_id)===String(a.src.memo));
      if(!n1){ if(row) o.T.TASKMEMO=TM.filter(m=>m!==row); }
      else if(row) row.task_memo=memoHtml(n1);
      else { const MT=tb(o,'MEMOTYPE'); let mt=MT[0]; if(!mt){ mt={memo_type_id:gen(o,'MEMOTYPE','memo_type_id'),seq_num:1,eps_flag:'N',proj_flag:'N',wbs_flag:'N',task_flag:'Y',memo_type:'Notes'}; MT.push(mt); }
        TM.push({memo_id:gen(o,'TASKMEMO','memo_id'),task_id:I.tid,memo_type_id:mt.memo_type_id,proj_id:I.pid,task_memo:memoHtml(n1)}); } } });
  return out.map(o=>({name:o.name,tables:o.T}));
}
/* ---- sample data: crews with rates, materials expenses and a few notebook notes ---- */
function spEnrich(T,defs){
  const H=c=>[...String(c)].reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,7), tasks=new Map((T.TASK||[]).map(t=>[String(t.task_id),t]));
  const used=new Set((T.TASKRSRC||[]).map(r=>String(r.rsrc_id)));
  T.RSRC=[...used].map(id=>{ const d=defs[id]||['R'+id,'Resource '+id]; return {rsrc_id:id,rsrc_short_name:d[0]+'-CREW',rsrc_name:d[1]+' crew',rsrc_type:'RT_Labor',unit_id:''}; });
  const price=id=>80+(+id%7)*9;
  T.RSRCRATE=[...used].map((id,i)=>({rsrc_rate_id:+id*10+1,rsrc_id:id,cost_per_qty:price(id),start_date:'2025-01-01 00:00'}));
  const prog=t=>t.status_code==='TK_Complete'?1:t.status_code==='TK_Active'?Math.min(.99,(+t.phys_complete_pct||0)/100):0;
  (T.TASKRSRC||[]).forEach(r=>{ const t=tasks.get(String(r.task_id)); if(!t) return; const q=+r.target_qty||0, p=price(r.rsrc_id), k=prog(t), au=Math.round(q*k), ru=q-au;
    Object.assign(r,{rsrc_type:'RT_Labor',cost_per_qty:p,remain_qty:ru,act_reg_qty:au,act_ot_qty:0,target_cost:q*p,remain_cost:ru*p,act_reg_cost:au*p,act_ot_cost:0,
      target_start_date:t.target_start_date,target_end_date:t.target_end_date,act_start_date:t.act_start_date||'',act_end_date:t.act_end_date||'',restart_date:t.status_code==='TK_Complete'?'':t.early_start_date,reend_date:t.status_code==='TK_Complete'?'':t.early_end_date}); });
  T.PROJCOST=[]; T.TASKMEMO=[]; T.MEMOTYPE=[{memo_type_id:1,seq_num:1,eps_flag:'N',proj_flag:'N',wbs_flag:'N',task_flag:'Y',memo_type:'Notes'}];
  const NOTES=['Access permit needed two weeks before start.','Night possession required for the critical works.','Long-lead materials ordered; confirm delivery slot with the supplier.','Hold point: client sign-off before the next stage.'];
  (T.TASK||[]).forEach(t=>{ const h=H(t.task_code), d=(+t.target_drtn_hr_cnt||0)/8, k=prog(t); if(t.task_type!=='TT_Task'||!d) return;
    if(h%3===0){ const bc=Math.round(d*(1200+h%9*150)/100)*100, ac=Math.round(bc*k); T.PROJCOST.push({cost_item_id:+t.task_id*10+3,acct_id:'',proj_id:t.proj_id,task_id:t.task_id,cost_type_id:'',cost_name:'Materials & plant',target_cost:bc,act_cost:ac,remain_cost:bc-ac,cost_load_type:'CL_Uniform',auto_compute_act_flag:'N'}); }
    if(h%7===0) T.TASKMEMO.push({memo_id:+t.task_id*10+7,task_id:t.task_id,memo_type_id:1,proj_id:t.proj_id,task_memo:memoHtml(NOTES[h%NOTES.length])}); });
  return T;
}

/* ---------- editor state ---------- */
const B={st:null,res:null,undo:[],redo:[],rows:[],sel:{r:0,c:'name'},edit:null,collapsed:new Set(),ppd:5,t0:0,offX:0,gw:null,links:true,drag:null,hover:null,toast:'',saveT:0,syncT:0};
const BRH=30, BHEAD=50;
function bBlank(){
  const today=dayOf(Date.now()), pid=bid(), cal={id:bid(),name:'Standard 5-day',work:[0,1,1,1,1,1,0],hrs:8,hol:[]}, w1=bid(), w2=bid();
  const a1={id:bid(),proj:pid,wbs:w1,seq:1,code:'A1000',name:'Project start',type:'start',dur:0,cal:cal.id,cstr:'',cdate:null,as:null,af:null,rem:null,pct:null,codes:{},ch0:null,ch1:null};
  const a2={...a1,id:bid(),seq:2,code:'A1010',name:'Mobilisation',type:'task',dur:10};
  const a3={...a1,id:bid(),wbs:w2,seq:1,code:'A1020',name:'Design',type:'task',dur:20};
  const a4={...a1,id:bid(),wbs:w2,seq:2,code:'A1030',name:'Project complete',type:'finish',dur:0};
  return {v:1,name:'New schedule',dd:today,mf:null,defCal:cal.id,cals:[cal],projects:[{id:pid,short:'PRJ-01',name:'New project'}],
    wbs:[{id:w1,proj:pid,parent:null,code:'1',name:'Start-up',seq:1},{id:w2,proj:pid,parent:null,code:'2',name:'Delivery',seq:2}],
    acts:[a1,a2,a3,a4],rels:[{p:a1.id,s:a2.id,t:'FS',lag:0},{p:a2.id,s:a3.id,t:'FS',lag:0},{p:a3.id,s:a4.id,t:'FS',lag:0}],codeTypes:[{name:'Discipline',values:[]}],baseline:null,sync:false,chUnit:'km'};
}
function bLoad(){ try{ const s=localStorage.getItem('pacer.builder'); if(s){ B.st=JSON.parse(s); B.res=bCompute(B.st); } }catch(_){ B.st=null; } }
function bSave(){ clearTimeout(B.saveT); B.saveT=setTimeout(()=>{ try{ localStorage.setItem('pacer.builder',JSON.stringify(B.st)); }catch(_){ bToastMsg('This schedule is too large to keep in browser storage. Use Save file to keep a copy.'); } },400); }
function bPush(){ B.undo.push(JSON.stringify(B.st)); if(B.undo.length>60) B.undo.shift(); B.redo=[]; }
function bChanged(opts={}){ B.res=bCompute(B.st); if(B.st.upd) updRsAuto(B.st,B.res); bSave(); bRenderAll(); if(B.st.sync){ clearTimeout(B.syncT); B.syncT=setTimeout(bSyncWorkbench,900); } }
function bSyncWorkbench(){ if(!B.st||!B.res) return; S.files=S.files.filter(f=>!f.builder&&!f.sample).map(f=>({...f,role:f.error?f.role:'off'})).concat(bToFiles()); rebuild(false); }
function bToastMsg(t){ B.toast=t; const el=document.getElementById('bToast'); if(el){ el.textContent=t; el.hidden=!t; clearTimeout(el._t); if(t) el._t=setTimeout(()=>{ el.hidden=true; },6000); } }
const bAct=id=>B.st.acts.find(a=>a.id===id);
function bNextCode(proj){ const codes=B.st.acts.filter(a=>a.proj===proj).map(a=>a.code); let best=null; codes.forEach(c=>{ const m=/^(.*?)(\d+)$/.exec(c); if(m&&(!best||+m[2]>best.n)) best={pre:m[1],n:+m[2],len:m[2].length}; });
  if(!best) return 'A1000'; let n=best.n+10; let c; do{ c=best.pre+String(n).padStart(best.len,'0'); n+=10; }while(codes.includes(c)); return c; }
function bPredText(a){ const st=B.st; return st.rels.filter(r=>r.s===a.id).map(r=>{ const p=bAct(r.p); if(!p) return ''; const pre=p.proj!==a.proj?(st.projects.find(x=>x.id===p.proj)||{}).short+':':''; const lag=Math.round(+r.lag||0); return pre+p.code+(r.t!=='FS'||lag?r.t:'')+(lag?(lag>0?'+':'')+lag:''); }).filter(Boolean).join(', '); }
function bSuccText(a){ const st=B.st; return st.rels.filter(r=>r.p===a.id).map(r=>{ const s=bAct(r.s); if(!s) return ''; const lag=Math.round(+r.lag||0); return s.code+(r.t!=='FS'||lag?r.t:'')+(lag?(lag>0?'+':'')+lag:''); }).filter(Boolean).join(', '); }
function bParsePreds(text,a){
  const st=B.st, rels=[], errs=[];
  String(text||'').split(/[,;]+/).map(t=>t.trim()).filter(Boolean).forEach(tok=>{
    const m=/^(?:([^:\s]+):)?\s*(.+?)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+(?:\.\d+)?)\s*[dD]?)?$/i.exec(tok); if(!m){ errs.push(tok); return; }
    const proj=m[1]?st.projects.find(p=>p.short.toLowerCase()===m[1].toLowerCase()):null, code=m[2].trim().toLowerCase();
    let cands=st.acts.filter(x=>x.code.toLowerCase()===code&&(!proj||x.proj===proj.id)); if(cands.length>1) cands=cands.filter(x=>x.proj===a.proj).concat(cands.filter(x=>x.proj!==a.proj));
    const p=cands[0]; if(!p||p.id===a.id){ errs.push(tok); return; }
    rels.push({p:p.id,s:a.id,t:(m[3]||'FS').toUpperCase(),lag:m[5]?(m[4]==='-'?-1:1)*Math.round(+m[5]):0}); });
  return {rels,errs};
}
function bWouldLoop(rels){ const st=B.st, all=st.rels.concat(rels), succ=new Map(); all.forEach(r=>{ if(!succ.has(r.p)) succ.set(r.p,[]); succ.get(r.p).push(r.s); });
  const seen=new Set(), stack=new Set(); let loop=false; const dfs=n=>{ if(loop) return; if(stack.has(n)){ loop=true; return; } if(seen.has(n)) return; seen.add(n); stack.add(n); (succ.get(n)||[]).forEach(dfs); stack.delete(n); }; st.acts.forEach(a=>dfs(a.id)); return loop; }

/* ---------- rows ---------- */
function bRowsBuild(){
  const st=B.st, rows=[], under=new Map();
  st.projects.forEach(p=>{ rows.push({t:'p',p,depth:0}); if(B.collapsed.has(p.id)) return;
    st.acts.filter(a=>a.proj===p.id&&!st.wbs.some(w=>w.id===a.wbs)).sort((x,y)=>x.seq-y.seq).forEach(a=>rows.push({t:'a',a,depth:1}));
    const walk=(parent,depth)=>{ st.wbs.filter(w=>w.proj===p.id&&(w.parent||null)===parent).sort((x,y)=>x.seq-y.seq).forEach(w=>{ rows.push({t:'w',w,depth}); if(!B.collapsed.has(w.id)){ st.acts.filter(a=>a.wbs===w.id).sort((x,y)=>x.seq-y.seq).forEach(a=>rows.push({t:'a',a,depth:depth+1})); walk(w.id,depth+1); } }); };
    walk(null,1); });
  if(st.upd&&st.upd.view==='due'){ const keep=[]; for(let i=0;i<rows.length;i++){ const r=rows[i]; if(r.t==='a'){ if(updDue(st.upd,r.a,st.dd)||!st.upd.p0[r.a.id]) keep.push(r); continue; }
      let has=false; for(let j=i+1;j<rows.length&&rows[j].depth>r.depth;j++){ const q=rows[j]; if(q.t==='a'&&(updDue(st.upd,q.a,st.dd)||!st.upd.p0[q.a.id])){ has=true; break; } } if(has) keep.push(r); }
    rows.length=0; rows.push(...keep); }
  B.rows=rows;
  // summaries
  const kids=new Map(); st.wbs.forEach(w=>kids.set(w.id,[])); st.wbs.forEach(w=>{ if(w.parent&&kids.has(w.parent)) kids.get(w.parent).push(w.id); });
  const actsUnder=id=>{ const out=st.acts.filter(a=>a.wbs===id); (kids.get(id)||[]).forEach(k=>out.push(...actsUnder(k))); return out; };
  B.sum=new Map();
  const sm=list=>{ let s=Infinity,f=-Infinity,tf=Infinity,bs=Infinity,bf=-Infinity; list.forEach(a=>{ const r=B.res.R.get(a.id); if(!r) return; s=Math.min(s,r.es); f=Math.max(f,r.ef); if(r.tf!=null) tf=Math.min(tf,r.tf); const b=st.baseline&&st.baseline.R[a.id]; if(b){ bs=Math.min(bs,b.es); bf=Math.max(bf,b.ef); } }); return {s,f,tf:tf===Infinity?null:tf,bs,bf,n:list.length,cost:bCostTot(list)}; };
  st.wbs.forEach(w=>B.sum.set(w.id,sm(actsUnder(w.id))));
  st.projects.forEach(p=>B.sum.set(p.id,sm(st.acts.filter(a=>a.proj===p.id))));
}
function bCols(){
  const cals=B.st.cals.map(c=>[c.id,c.name]);
  const cols=[
    {k:'code',l:'ID',w:92},{k:'name',l:'Activity name',w:250},{k:'type',l:'Type',w:110,opts:[['task','Task'],['start','Start milestone'],['finish','Finish milestone']]},
    {k:'dur',l:'Dur (d)',w:62,r:1,num:1},{k:'start',l:'Start',w:92,r:1,date:1},{k:'finish',l:'Finish',w:92,r:1,date:1},
    {k:'preds',l:'Predecessors',w:180},{k:'succs',l:'Successors',w:150,ro:1},{k:'tf',l:'Total float',w:72,r:1,ro:1},{k:'ff',l:'Free float',w:70,r:1,ro:1},
    {k:'cal',l:'Calendar',w:120,opts:cals},{k:'cstr',l:'Constraint',w:130,opts:CSTR},{k:'cdate',l:'Constraint date',w:100,r:1,date:1},
    {k:'as',l:'Actual start',w:96,r:1,date:1},{k:'af',l:'Actual finish',w:96,r:1,date:1},{k:'rem',l:'Remaining (d)',w:86,r:1,num:1},{k:'pct',l:'% complete',w:76,r:1,num:1},
    {k:'res',l:'Resources',w:150,ro:1,dlg:1},{k:'bcost',l:'Budget cost',w:96,r:1,ro:1,dlg:1},{k:'acost',l:'Actual cost',w:96,r:1,ro:1,dlg:1},{k:'rcost',l:'Remaining cost',w:100,r:1,ro:1,dlg:1},{k:'eac',l:'At completion',w:100,r:1,ro:1,dlg:1},
    {k:'note',l:'Notes',w:200},
    {k:'ch0',l:'Chainage from',w:90,r:1,num:1},{k:'ch1',l:'Chainage to',w:86,r:1,num:1}];
  if(B.st.upd){ const pk=['as','af','rem','pct','dur','type','res','acost','rcost','eac'], pc=pk.map(k=>cols.find(c=>c.k===k)); pk.forEach(k=>cols.splice(cols.findIndex(c=>c.k===k),1)); cols.splice(cols.findIndex(c=>c.k==='finish')+1,0,...pc); }
  B.st.codeTypes.forEach(t=>cols.push({k:'code:'+t.name,l:t.name,w:120,opts:[['','—']].concat(t.values.map(v=>[v.short,v.name&&v.name!==v.short?`${v.short} · ${v.name}`:v.short]))}));
  return cols;
}
function bCellText(row,c){
  const st=B.st;
  if(row.t!=='a'){ const id=row.t==='p'?row.p.id:row.w.id, sm=B.sum.get(id)||{};
    if(c.k==='code') return row.t==='p'?row.p.short:row.w.code; if(c.k==='name') return row.t==='p'?row.p.name:row.w.name;
    if(c.k==='start') return isFinite(sm.s)?fmtDay(sm.s):''; if(c.k==='finish') return isFinite(sm.f)?fmtDay(sm.f):'';
    if(c.k==='tf') return sm.tf==null?'':String(sm.tf); if(c.k==='dur'&&isFinite(sm.s)) return String(Math.max(0,sm.f-sm.s+1))+'c';
    if(sm.cost&&sm.cost.n&&['bcost','acost','rcost','eac'].includes(c.k)) return money(sm.cost[{bcost:'bc',acost:'ac',rcost:'rc',eac:'eac'}[c.k]]);
    return ''; }
  const a=row.a, r=B.res.R.get(a.id);
  switch(c.k){
    case 'code': return a.code; case 'name': return a.name; case 'type': return {task:'Task',start:'Start milestone',finish:'Finish milestone'}[a.type];
    case 'dur': return a.type==='task'?String(a.dur):'0';
    case 'start': return r?fmtDay(r.status==='ns'?r.es:a.as):''; case 'finish': return r?fmtDay(a.type==='start'?r.es:r.ef):'';
    case 'preds': return bPredText(a); case 'succs': return bSuccText(a);
    case 'tf': return r&&r.tf!=null?String(r.tf):''; case 'ff': return r&&r.ff!=null?String(r.ff):'';
    case 'cal': return (st.cals.find(x=>x.id===a.cal)||{}).name||''; case 'cstr': return (CSTR.find(x=>x[0]===(a.cstr||''))||CSTR[0])[1].replace('As soon as possible','');
    case 'cdate': return fmtDay(a.cdate); case 'as': return fmtDay(a.as); case 'af': return fmtDay(a.af);
    case 'rem': return r&&r.status==='ip'?String(r.rem):a.rem!=null?String(a.rem):''; case 'pct': return a.pct!=null&&a.pct!==''?a.pct+'%':r&&r.status==='cp'?'100%':'';
    case 'ch0': return a.ch0==null?'':String(a.ch0); case 'ch1': return a.ch1==null?'':String(a.ch1);
    case 'res': return bResText(a); case 'note': return (a.note||'').replace(/\s+/g,' ');
    case 'bcost': case 'acost': case 'rcost': case 'eac': { if(!(a.asg&&a.asg.length)&&!(a.exp&&a.exp.length)) return ''; const k=bCostOf(a); return money(k[{bcost:'bc',acost:'ac',rcost:'rc',eac:'eac'}[c.k]]); }
  }
  if(c.k.startsWith('code:')) return (a.codes||{})[c.k.slice(5)]||'';
  return '';
}
function bEditValue(row,c){ if(row.t==='a'){ const a=row.a; if(c.date){ const r=B.res.R.get(a.id); const v=c.k==='start'?(r?(r.status==='ns'?r.es:a.as):null):c.k==='finish'?(r?r.ef:null):a[c.k]; return v==null?'':isoD(v); } if(c.k==='preds') return bPredText(a); if(c.opts) return c.k.startsWith('code:')?((a.codes||{})[c.k.slice(5)]||''):(a[c.k]||''); if(c.k==='pct') return a.pct==null?'':String(a.pct); return a[c.k]==null?'':String(a[c.k]); }
  return bCellText(row,c); }
function bCommit(row,c,val){
  const st=B.st; val=typeof val==='string'?val.trim():val;
  if(row.t==='p'){ if(c.k==='code'&&val){ bPush(); row.p.short=val; } else if(c.k==='name'){ bPush(); row.p.name=val; } else return; bChanged(); return; }
  if(row.t==='w'){ if(c.k==='code'&&val){ bPush(); row.w.code=val; } else if(c.k==='name'){ bPush(); row.w.name=val; } else return; bChanged(); return; }
  const a=row.a, r=B.res.R.get(a.id), c0=c.k;
  if(c.ro) return;
  if(c0==='code'){ if(!val) return bToastMsg('An activity needs an ID.'); if(st.acts.some(x=>x!==a&&x.proj===a.proj&&x.code.toLowerCase()===val.toLowerCase())) return bToastMsg(`${val} is already used in this project.`); bPush(); a.code=val; }
  else if(c0==='name'){ bPush(); a.name=val; }
  else if(c0==='type'){ bPush(); a.type=val; if(val!=='task') a.dur=0; else if(!a.dur) a.dur=5; }
  else if(c0==='dur'){ const n=Math.round(+val); if(!isFinite(n)||n<0) return bToastMsg('Duration must be a whole number of working days.'); bPush(); a.dur=n; if(n===0&&a.type==='task') a.type='finish'; else if(n>0&&a.type!=='task') a.type='task'; }
  else if(c0==='start'){ const d=parseDay(val); if(d==null) return bToastMsg('Type a date like 2026-11-03 or 3 Nov 26.'); bPush(); if(bStatus(a)==='ns'){ a.cstr='SNET'; a.cdate=d; bToastMsg(`Set a "Start on or after ${fmtDay(d)}" constraint on ${a.code}.`); } else { a.as=d; } }
  else if(c0==='finish'){ const d=parseDay(val); if(d==null||!r) return bToastMsg('Type a date like 2026-11-03 or 3 Nov 26.'); if(a.type!=='task') { bPush(); a.cstr='FNET'; a.cdate=d; } else { const cal=B.res.calOf(a); const n=cal.count(r.status==='ns'?r.es:r.rs,d); if(n<1) return bToastMsg('Finish must be after the start.'); bPush(); if(r.status==='ip') a.rem=n; else a.dur=n; } }
  else if(c0==='preds'){ const {rels,errs}=bParsePreds(val,a); if(bWouldLoop(rels.filter(x=>!st.rels.some(y=>y.p===x.p&&y.s===x.s)).concat([]))){ /* evaluate with replacement */ }
    const others=st.rels.filter(x=>x.s!==a.id); const test={...st,rels:others}; const saved=st.rels; st.rels=others; const loops=bWouldLoop(rels); st.rels=saved;
    if(loops) return bToastMsg('That would create a loop in the logic, so it was not applied.'); bPush(); st.rels=others.concat(rels); if(errs.length) bToastMsg(`Not recognised: ${errs.join(', ')}. Use IDs like A1010, A1010SS+5 or PRJ-02:B2000.`); }
  else if(c0==='cal'){ bPush(); a.cal=val; }
  else if(c0==='cstr'){ bPush(); a.cstr=val; if(val&&a.cdate==null&&r) a.cdate=val.startsWith('F')||val==='MFO'?r.ef:r.es; if(!val) a.cdate=null; }
  else if(c0==='cdate'){ if(!val){ bPush(); a.cdate=null; a.cstr=''; } else { const d=parseDay(val); if(d==null) return bToastMsg('Type a date like 2026-11-03 or 3 Nov 26.'); bPush(); a.cdate=d; if(!a.cstr) a.cstr='SNET'; } }
  else if(c0==='as'||c0==='af'){ if(!val){ bPush(); a[c0]=null; if(c0==='as') a.af=null; } else { const d=parseDay(val); if(d==null) return bToastMsg('Type a date like 2026-11-03 or 3 Nov 26.'); if(d>=st.dd+1&&c0==='af') return bToastMsg('An actual finish must be on or before the data date.'); if(d>st.dd&&c0==='as') return bToastMsg('An actual start must be on or before the data date.'); bPush(); a[c0]=d; if(c0==='af'&&a.as==null) a.as=r?Math.min(r.es,d):d; if(c0==='af'){ a.rem=null; a.pct=100; } } }
  else if(c0==='rem'){ const n=val===''?null:Math.round(+val); if(n!=null&&(!isFinite(n)||n<0)) return; bPush(); a.rem=n; if(n!=null&&a.as==null) a.as=Math.min(r?r.es:st.dd,st.dd); }
  else if(c0==='pct'){ const n=val===''?null:Math.max(0,Math.min(100,Math.round(parseFloat(val)))); bPush(); a.pct=n; if(n!=null&&n>0&&a.as==null) a.as=Math.min(r?r.es:st.dd,st.dd); if(n===100&&a.af==null){ a.af=Math.min(st.dd,r?Math.max(r.ef,a.as):st.dd); } if(n!=null&&n<100){ a.af=null; a.rem=Math.max(1,Math.round(bDur(a)*(1-n/100))); } }
  else if(c0==='note'){ bPush(); a.note=val; }
  else if(c0==='ch0'||c0==='ch1'){ const n=val===''?null:parseFloat(val); bPush(); a[c0]=isFinite(n)?n:null; }
  else if(c0.startsWith('code:')){ bPush(); a.codes=a.codes||{}; if(val) a.codes[c0.slice(5)]=val; else delete a.codes[c0.slice(5)]; }
  bChanged();
}

/* ---------- render ---------- */
function renderBuild(){
  const host=document.getElementById('buildWrap'); if(host.hidden) return;
  if(!B.st){ host.innerHTML=`<div class="card bstart"><div class="bst-h"><h3>Build a schedule</h3><p class="muted">Create projects, WBS and activities, link them and let the CPM engine calculate dates, float and the critical path. Then use it across every tab.</p></div>
      <div class="bst-g"><button class="bst-c" data-bnew="blank"><b>Start blank</b><span>One project with a start milestone, two tasks and a finish milestone on a 5-day calendar.</span></button>
      <button class="bst-c" data-bnew="model" ${M&&M.live.acts.size?'':'disabled'}><b>Edit the loaded schedule</b><span>${M&&M.live.acts.size?`Bring in ${M.live.acts.size} activities, logic, progress${M.base.acts.size?' and the baseline':''} from the XERs in Files.`:'Load an XER in Files first.'}</span></button>
      <label class="bst-c"><input type="file" id="bOpen" accept=".json,application/json" hidden><b>Open a saved builder file</b><span>A .json file saved from this builder.</span></label>
      <button class="bst-c bst-ai" data-bnew="ai"><b>✦ Build with AI</b><span>Write a brief and add drawings, bills of quantities, specs or previous schedules. Claude drafts a logic-linked programme for you to review.</span></button></div></div>`; return; }
  if(!host.querySelector('#bGrid')) bShell();
  bRenderAll();
}
function bShell(){
  const host=document.getElementById('buildWrap');
  host.innerHTML=`<div class="card bupd" id="bUpd" hidden></div><div class="card btool">
      <div class="btr"><input id="bName" class="bname" aria-label="Schedule name"><label class="ctl"><span>Data date</span><input type="date" id="bDD"></label><label class="ctl"><span>Must finish by</span><input type="date" id="bMF"></label>
        <span class="bsp"></span><div class="sg"><button data-ba="undo" title="Undo (Ctrl+Z)">↶ Undo</button><button data-ba="redo" title="Redo (Ctrl+Y)">↷ Redo</button></div>
        <select id="bMenu" aria-label="File"><option value="">File…</option><option value="new">New blank schedule</option><option value="model">Replace with the loaded schedule</option><option value="open">Open builder file (.json)</option><option value="save">Save builder file (.json)</option><option value="xer">Export XER</option><option value="xercopy">Copy XER to clipboard</option><option value="csv">Export activities (.csv)</option><option value="close">Close builder</option></select>
        <input type="file" id="bOpen2" accept=".json,application/json" hidden></div>
      <div class="btr"><div class="sg"><button data-ba="act">+ Activity</button><button data-ba="ms">+ Milestone</button><button data-ba="wbs">+ WBS</button><button data-ba="proj">+ Project</button></div>
        <div class="sg"><button data-ba="up" title="Move up (Alt+↑)">↑</button><button data-ba="down" title="Move down (Alt+↓)">↓</button><button data-ba="out" title="Outdent WBS (Alt+←)">⇤</button><button data-ba="in" title="Indent WBS (Alt+→)">⇥</button><button data-ba="link" title="Link to the activity above (FS)">Link ↑</button><button data-ba="del" title="Delete row (Ctrl+Delete)">Delete</button></div>
        <div class="sg"><button data-ba="cals">Calendars</button><button data-ba="codes">Codes</button><button data-ba="rsrc" title="Resource dictionary">Resources</button><button data-ba="asg" title="Resources, costs and notes for the selected activity">Costs &amp; notes</button></div>
        <button class="btn sm bai-btn" data-ba="ai">✦ AI build</button>
        <span class="bsp"></span>
        <label class="tg"><input type="checkbox" id="bLinks" checked> Links</label>
        <div class="sg"><button data-bz="out">−</button><button data-bz="fit">Fit</button><button data-bz="in">+</button></div>
        <button class="btn sm" data-ba="base">Capture baseline</button><button class="btn sm primary" data-ba="use" id="bUse">Use in Workbench</button></div>
    </div>
    <div class="bstat" id="bStat"></div>
    <div class="card bwrap" id="bWrapIn">
      <div class="bgrid" id="bGrid"><div class="bghead" id="bGHead"></div><div class="bgbody" id="bGBody" tabindex="0"><div class="bgsp" id="bGSp"></div><div class="bgrows" id="bGRows"></div></div></div>
      <div class="bdiv" id="bDiv" title="Drag to resize"></div>
      <div class="bgantt" id="bGantt"><canvas id="bCv"></canvas></div>
    </div>
    <div class="btoast" id="bToast" hidden></div>
    <div class="colpanel card bdlg" id="bDlg" hidden></div>
    <div class="note">Type predecessors as <code>A1010</code>, <code>A1010SS+5</code>, <code>A1020FF-2</code> or <code>PRJ-02:B2000</code> for another project. Typing a start date on an unstarted activity adds a "Start on or after" constraint. On the Gantt, drag a bar to move it, drag its right end to change duration, and drag from the dot to another bar to link them. Enter edits, Tab moves right, Ctrl+Z undoes.</div>`;
  bWireShell(); updWireBar(); bWireRs();
}
function bRenderAll(){
  if(!B.st||document.getElementById('buildWrap').hidden||!document.getElementById('bGrid')) return;
  bRowsBuild();
  const st=B.st, res=B.res;
  const nm=document.getElementById('bName'); if(document.activeElement!==nm) nm.value=st.name;
  document.getElementById('bDD').value=isoD(st.dd); document.getElementById('bMF').value=st.mf!=null?isoD(st.mf):'';
  document.querySelector('[data-ba="undo"]').disabled=!B.undo.length; document.querySelector('[data-ba="redo"]').disabled=!B.redo.length;
  const fin=res.finish, mfv=st.mf!=null&&fin!=null?(()=>{ const c=compileCal(st.cals.find(c=>c.id===st.defCal)||st.cals[0],Math.min(fin,st.mf)-10,Math.abs(fin-st.mf)+30); return fin>st.mf?-(c.count(st.mf+1,fin)):c.count(fin+1,st.mf); })():null;
  const bl=st.baseline?Object.values(st.baseline.R).reduce((m,x)=>Math.max(m,x.ef),-Infinity):null;
  document.getElementById('bStat').innerHTML=`<span><b>${st.acts.length}</b> activities · <b>${st.rels.length}</b> relationships</span>
    <span>Finish <b>${fin!=null?fmtL(fin*DAY):'—'}</b>${bl!=null&&isFinite(bl)&&fin!=null?` <em class="${fin>bl?'late':fin<bl?'early':''}">${fin===bl?'on baseline':sgn(fin-bl)+'d vs baseline'}</em>`:''}${mfv!=null?` <em class="${mfv<0?'late':'early'}">${mfv<0?`${-mfv}d late for must-finish`:`${mfv}d float to must-finish`}</em>`:''}</span>
    <span><b class="acc">${res.crit}</b> critical</span>
    ${res.loops.length?`<span class="late"><b>Loop in logic:</b> ${esc(res.loops.slice(0,8).join(', '))}${res.loops.length>8?'…':''}. These activities were not scheduled.</span>`:''}
    ${res.openEnds.length?`<span title="${esc(res.openEnds.map(o=>o.code+' '+o.why).join('\n'))}"><b>${res.openEnds.length}</b> open ends</span>`:''}
    ${(()=>{ const t=bCostTot(st.acts); return t.n?`<span>Budget <b>${moneyK(t.bc)}</b> · actual <b>${moneyK(t.ac)}</b> · at completion <b>${moneyK(t.eac)}</b>${t.bc?` <em class="${dCls(Math.round(t.eac-t.bc))}">${t.eac===t.bc?'on budget':(t.eac>t.bc?'+':'−')+moneyK(Math.abs(t.eac-t.bc))+' vs budget'}</em>`:''}</span>`:''; })()}
    <span>${st.baseline?`Baseline captured ${fmtL(st.baseline.at)}`:'No baseline yet'}</span>
    <span>${st.sync?'<span class="pill">Live in Workbench</span>':''}</span>`;
  updRenderBar(); bRenderGrid(); bDrawGantt();
  const dl=document.getElementById('bDlg'); if(dl&&!dl.hidden&&['asg','rsrc'].includes(dl.dataset.kind)&&!dl.contains(document.activeElement)) bRenderRsDialog();
}
function bRenderGrid(){
  const cols=bCols(), head=document.getElementById('bGHead'), body=document.getElementById('bGBody'), rowsEl=document.getElementById('bGRows'), sp=document.getElementById('bGSp');
  const W=cols.reduce((s,c)=>s+c.w,0)+40;
  head.innerHTML=`<div class="bhr" style="width:${W}px"><div class="bc bn">#</div>${cols.map(c=>`<div class="bc${c.r?' r':''}" style="width:${c.w}px">${esc(c.l)}</div>`).join('')}</div>`;
  head.scrollLeft=body.scrollLeft;
  sp.style.height=(B.rows.length*BRH)+'px'; sp.style.width=W+'px';
  const top=body.scrollTop, h=body.clientHeight||400, i0=Math.max(0,Math.floor(top/BRH)-4), i1=Math.min(B.rows.length-1,Math.ceil((top+h)/BRH)+4);
  let html=''; const selA=B.rows[B.sel.r];
  for(let i=i0;i<=i1;i++){ const row=B.rows[i], isSel=i===B.sel.r, r=row.t==='a'?B.res.R.get(row.a.id):null;
    const cls=row.t==='p'?'bp':row.t==='w'?'bw':(r&&r.crit?'crit':'')+(r&&r.status==='cp'?' done':'')+(B.st.upd&&updNeeds(row.a)?' uneed':'');
    html+=`<div class="brow ${cls}${isSel?' sel':''}" data-r="${i}" style="top:${i*BRH}px;width:${W}px"><div class="bc bn">${row.t==='a'?i+1:''}</div>`;
    cols.forEach(c=>{ const editing=B.edit&&B.edit.r===i&&B.edit.c===c.k, cs=isSel&&B.sel.c===c.k;
      let inner;
      if(editing){ const v=esc(B.edit.val); if(c.opts&&row.t==='a') inner=`<select class="bin" data-bin="1">${c.opts.map(([k,l])=>`<option value="${esc(k)}"${String(B.edit.val)===String(k)?' selected':''}>${esc(l)}</option>`).join('')}</select>`; else inner=`<input class="bin" data-bin="1" value="${v}" ${c.date?'placeholder="yyyy-mm-dd"':''}>`; }
      else { let t=bCellText(row,c); if(c.k==='name'){ const ind=(row.depth||0)*14; const tog=row.t!=='a'?`<span class="btog" data-btog="${row.t==='p'?row.p.id:row.w.id}">${B.collapsed.has(row.t==='p'?row.p.id:row.w.id)?'▸':'▾'}</span>`:''; inner=`<span style="padding-left:${ind}px" class="bnm">${tog}${row.t==='a'&&row.a.type!=='task'?'<i class="bmi">◆</i>':''}${esc(t)}</span>`; }
        else if(c.k==='tf'&&t!==''&&row.t==='a'){ inner=`<span class="${+t<0?'late':+t===0?'acc':''}">${esc(t)}</span>`; }
        else inner=esc(t); }
      html+=`<div class="bc${c.r?' r':''}${cs?' cur':''}${c.ro||(row.t!=='a'&&!['code','name'].includes(c.k))?' ro':''}" data-c="${c.k}" style="width:${c.w}px">${inner}</div>`; });
    html+='</div>'; }
  rowsEl.innerHTML=html;
  if(B.edit){ const inp=rowsEl.querySelector('[data-bin]'); if(inp){ inp.focus(); if(inp.setSelectionRange&&B.edit.fresh){ const l=inp.value.length; inp.setSelectionRange(B.edit.sel?0:l,l); B.edit.fresh=false; } } }
}
function bScrollIntoView(i){ const body=document.getElementById('bGBody'); const y=i*BRH; if(y<body.scrollTop) body.scrollTop=y; else if(y+BRH>body.scrollTop+body.clientHeight) body.scrollTop=y+BRH-body.clientHeight; }
function bDrawGantt(){
  const wrap=document.getElementById('bGantt'), cv=document.getElementById('bCv'); if(!wrap) return;
  const W=wrap.clientWidth, H=wrap.clientHeight; if(!W||!H) return;
  const ctx=setupCanvas(cv,W,H), st=B.st, res=B.res, body=document.getElementById('bGBody'), sy=body.scrollTop, HD=BHEAD+1;
  if(!B.t0){ bFit(true); }
  const X=d=>(d-B.t0)*B.ppd-B.offX;
  ctx.fillStyle=C.surface; ctx.fillRect(0,0,W,H);
  const dA=B.t0+B.offX/B.ppd, dB=dA+W/B.ppd, sc=scaleFor(B.ppd);
  ctx.save(); ctx.beginPath(); ctx.rect(0,HD,W,H-HD); ctx.clip();
  const i0=Math.max(0,Math.floor(sy/BRH)), i1=Math.min(B.rows.length-1,Math.ceil((sy+H-HD)/BRH));
  for(let i=i0;i<=i1;i++){ const y=HD+i*BRH-sy, row=B.rows[i]; if(row.t!=='a'){ ctx.fillStyle=C.band; ctx.fillRect(0,y,W,BRH); } if(i===B.sel.r){ ctx.fillStyle=C.accentSoft; ctx.fillRect(0,y,W,BRH); } }
  ctx.lineWidth=1; ctx.strokeStyle=C.grid; sc.bot((dA-60)*DAY,dB*DAY).forEach(t=>{ const x=Math.round(X(t/DAY))+.5; ctx.beginPath(); ctx.moveTo(x,HD); ctx.lineTo(x,H); ctx.stroke(); });
  ctx.strokeStyle=C.line; sc.top((dA-400)*DAY,dB*DAY).forEach(t=>{ const x=Math.round(X(t/DAY))+.5; ctx.beginPath(); ctx.moveTo(x,HD); ctx.lineTo(x,H); ctx.stroke(); });
  B.bars=[];
  for(let i=i0;i<=i1;i++){ const y=HD+i*BRH-sy, row=B.rows[i];
    if(row.t!=='a'){ const sm=B.sum.get(row.t==='p'?row.p.id:row.w.id); if(!sm||!isFinite(sm.s)) continue; const x1=X(sm.s), x2=X(sm.f+1);
      if(st.baseline&&isFinite(sm.bs)){ ctx.fillStyle=C.base; ctx.fillRect(X(sm.bs),y+21,Math.max(2,X(sm.bf+1)-X(sm.bs)),3); }
      ctx.fillStyle=C.ink; ctx.fillRect(x1,y+9,Math.max(2,x2-x1),5); ctx.beginPath(); ctx.moveTo(x1,y+9); ctx.lineTo(x1+5,y+9); ctx.lineTo(x1,y+18); ctx.fill(); ctx.beginPath(); ctx.moveTo(x2,y+9); ctx.lineTo(x2-5,y+9); ctx.lineTo(x2,y+18); ctx.fill(); continue; }
    const a=row.a, r=res.R.get(a.id); if(!r) continue;
    let es=r.status==='ns'?r.es:a.as, ef=r.ef; if(B.drag&&B.drag.a===a&&B.drag.moved){ if(B.drag.mode==='move'){ es+=B.drag.dd; ef+=B.drag.dd; } if(B.drag.mode==='size') ef=Math.max(es,ef+B.drag.dd); }
    const b=st.baseline&&st.baseline.R[a.id];
    if(b){ ctx.fillStyle=C.base; if(a.type==='task'&&b.dur>0){ rr(ctx,X(b.es),y+20,Math.max(2,X(b.ef+1)-X(b.es)),5,2); ctx.fill(); } else { diamond(ctx,X(a.type==='finish'?b.ef+1:b.es),y+22,4); ctx.fill(); } }
    const col=r.status==='cp'?C.done:r.crit?C.accent:C.bar;
    if(a.type!=='task'||r.dur===0){ const x=X(a.type==='finish'?ef+1:es); ctx.fillStyle=col; diamond(ctx,x,y+12,6.5); ctx.fill(); B.bars.push({i,a,x1:x-7,x2:x+7,y,ms:1});
      ctx.font=FONT(500,11); ctx.fillStyle=C.ink2; ctx.fillText(fmtDay(a.type==='finish'?ef:es),x+10,y+16); continue; }
    const x1=X(es), x2=X(ef+1), w=Math.max(3,x2-x1);
    if(r.status==='ip'&&st.dd>es&&st.dd<=ef){ const xd=X(st.dd); ctx.fillStyle=col; ctx.globalAlpha=.45; rr(ctx,x1,y+6,w,12,3); ctx.fill(); ctx.globalAlpha=1; rr(ctx,x1,y+6,Math.max(3,xd-x1),12,3); ctx.fill(); }
    else { ctx.fillStyle=col; rr(ctx,x1,y+6,w,12,3); ctx.fill(); }
    if(r.tf>0&&r.status!=='cp'){ const xl=X(r.lf+1); ctx.strokeStyle=C.ink3; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x2+1,y+12); ctx.lineTo(xl,y+12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xl,y+9); ctx.lineTo(xl,y+15); ctx.stroke(); }
    if(B.hover&&B.hover.a===a&&r.status!=='cp'){ ctx.fillStyle=C.surface; ctx.strokeStyle=C.accent; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x2+7,y+12,4.5,0,7); ctx.fill(); ctx.stroke(); }
    B.bars.push({i,a,x1,x2,y}); }
  if(B.links){ const idx=new Map(); B.rows.forEach((row,i)=>{ if(row.t==='a') idx.set(row.a.id,i); });
    for(let i=i0;i<=i1;i++){ const row=B.rows[i]; if(row.t!=='a') continue; const s=row.a, sr=res.R.get(s.id); if(!sr) continue;
      (res.preds.get(s.id)||[]).forEach(rel=>{ const j=idx.get(rel.p); if(j==null) return; const p=bAct(rel.p), pr=res.R.get(rel.p); if(!pr) return;
        const pEnd=p.type==='finish'||pr.dur===0?(p.type==='finish'?pr.ef+1:pr.es):pr.ef+1, pStart=pr.status==='ns'?pr.es:p.as, sStart=sr.status==='ns'?sr.es:s.as, sEnd=s.type==='finish'||sr.dur===0?(s.type==='finish'?sr.ef+1:sr.es):sr.ef+1;
        const xa=X(rel.t==='SS'||rel.t==='SF'?pStart:pEnd), xb=X(rel.t==='FF'||rel.t==='SF'?sEnd:sStart), ya=HD+j*BRH-sy+12, yb=HD+i*BRH-sy+12, drv=sr.drv.has(rel);
        ctx.strokeStyle=pr.crit&&sr.crit?C.accent:C.ink3; ctx.lineWidth=drv?1.5:1; ctx.setLineDash(drv?[]:[3,3]);
        const ex=(rel.t==='FF'||rel.t==='SF')?Math.max(xa,xb)+8:xa+6; ctx.beginPath(); ctx.moveTo(xa,ya); ctx.lineTo(ex,ya); ctx.lineTo(ex,yb); ctx.lineTo(xb,yb); ctx.stroke(); ctx.setLineDash([]);
        const dir=xb>=ex?1:-1; ctx.fillStyle=ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(xb,yb); ctx.lineTo(xb-5*dir,yb-3.5); ctx.lineTo(xb-5*dir,yb+3.5); ctx.closePath(); ctx.fill(); }); } }
  if(B.drag&&B.drag.mode==='link'&&B.drag.moved){ ctx.strokeStyle=C.accent; ctx.lineWidth=2; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(B.drag.x0,B.drag.y0); ctx.lineTo(B.drag.cx,B.drag.cy); ctx.stroke(); ctx.setLineDash([]); }
  const xd=Math.round(X(st.dd))+.5; ctx.strokeStyle=C.accent; ctx.lineWidth=1.5; ctx.setLineDash([5,4]); ctx.beginPath(); ctx.moveTo(xd,HD); ctx.lineTo(xd,H); ctx.stroke(); ctx.setLineDash([]);
  if(st.mf!=null){ const xm=Math.round(X(st.mf+1))+.5; ctx.strokeStyle=C.late; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(xm,HD); ctx.lineTo(xm,H); ctx.stroke(); }
  ctx.restore();
  // header
  ctx.fillStyle=C.surface; ctx.fillRect(0,0,W,HD); const tops=sc.top((dA-400)*DAY,(dB+1)*DAY), bots=sc.bot((dA-60)*DAY,(dB+1)*DAY);
  ctx.strokeStyle=C.line; tops.forEach((t,i)=>{ const x=X(t/DAY), nx=i<tops.length-1?X(tops[i+1]/DAY):W+400; ctx.beginPath(); ctx.moveTo(Math.round(x)+.5,0); ctx.lineTo(Math.round(x)+.5,24); ctx.stroke(); ctx.font=FONT(700,13,true); ctx.fillStyle=C.ink; const lx=Math.max(x,0)+6; if(nx-lx>24) ctx.fillText(fit(ctx,sc.ft(t).toUpperCase(),nx-lx-6),lx,17); });
  ctx.font=FONT(500,11); ctx.fillStyle=C.ink2; bots.forEach((t,i)=>{ const x=X(t/DAY), nx=i<bots.length-1?X(bots[i+1]/DAY):x+999, lab=sc.fb(t); if(nx-x>ctx.measureText(lab).width+6) ctx.fillText(lab,x+3,HD-12); });
  if(xd>0&&xd<W){ ctx.font=FONT(700,10); const lab='DATA DATE', w=ctx.measureText(lab).width+10; ctx.fillStyle=C.accent; rr(ctx,xd-w/2,26,w,15,7.5); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText(lab,xd-w/2+5,37); }
  ctx.strokeStyle=C.line; ctx.beginPath(); ctx.moveTo(0,HD-.5); ctx.lineTo(W,HD-.5); ctx.stroke();
}
function bFit(silent){ const wrap=document.getElementById('bGantt'); const W=wrap?wrap.clientWidth:800; let a=Infinity,b=-Infinity; B.res.R.forEach((r,id)=>{ const x=bAct(id); a=Math.min(a,r.status==='ns'?r.es:x.as); b=Math.max(b,r.ef,r.lf||-Infinity); }); if(B.st.baseline) Object.values(B.st.baseline.R).forEach(x=>{ a=Math.min(a,x.es); b=Math.max(b,x.ef); });
  if(!isFinite(a)){ a=B.st.dd-10; b=B.st.dd+90; } a=Math.min(a,B.st.dd); B.t0=a-7; B.ppd=Math.max(0.15,Math.min(60,(W-60)/Math.max(10,b-a+20))); B.offX=0; if(!silent) bDrawGantt(); }

/* ---------- actions ---------- */
function bSelRow(){ return B.rows[B.sel.r]; }
function bCtx(){ const row=bSelRow(); const st=B.st; if(!row) return {proj:st.projects[0]?.id,wbs:null,after:null};
  if(row.t==='p') return {proj:row.p.id,wbs:null,after:null}; if(row.t==='w') return {proj:row.w.proj,wbs:row.w.id,after:null}; return {proj:row.a.proj,wbs:row.a.wbs,after:row.a}; }
function bAddAct(kind){ const st=B.st, cx=bCtx(); if(!cx.proj) return bToastMsg('Add a project first.'); bPush();
  const sibs=st.acts.filter(a=>a.proj===cx.proj&&a.wbs===cx.wbs).sort((x,y)=>x.seq-y.seq); let seq=cx.after?cx.after.seq+0.5:(sibs.length?sibs[sibs.length-1].seq+1:1);
  const a={id:bid(),proj:cx.proj,wbs:cx.wbs,seq,code:bNextCode(cx.proj),name:kind==='ms'?'New milestone':'New activity',type:kind==='ms'?'finish':'task',dur:kind==='ms'?0:5,cal:(cx.after&&cx.after.cal)||st.defCal,cstr:'',cdate:null,as:null,af:null,rem:null,pct:null,codes:{},ch0:null,ch1:null};
  st.acts.push(a); if(cx.after) st.rels.push({p:cx.after.id,s:a.id,t:'FS',lag:0});
  st.acts.filter(x=>x.proj===a.proj&&x.wbs===a.wbs).sort((x,y)=>x.seq-y.seq).forEach((x,i)=>x.seq=i+1);
  bChanged(); const i=B.rows.findIndex(r=>r.t==='a'&&r.a===a); if(i>=0){ B.sel={r:i,c:'name'}; bScrollIntoView(i); bStartEdit(true); } }
function bAddWbs(){ const st=B.st, row=bSelRow(); const cx=bCtx(); if(!cx.proj) return bToastMsg('Add a project first.'); bPush();
  const parent=row&&row.t==='w'?row.w.id:row&&row.t==='a'?row.a.wbs:null; const pw=parent?st.wbs.find(w=>w.id===parent):null; const sibs=st.wbs.filter(w=>w.proj===cx.proj&&(w.parent||null)===(parent||null));
  const w={id:bid(),proj:cx.proj,parent:parent||null,code:(pw?pw.code+'.':'')+(sibs.length+1),name:'New WBS',seq:sibs.length+1}; st.wbs.push(w); bChanged();
  const i=B.rows.findIndex(r=>r.t==='w'&&r.w===w); if(i>=0){ B.sel={r:i,c:'name'}; bScrollIntoView(i); bStartEdit(true); } }
function bAddProj(){ const st=B.st; bPush(); const n=st.projects.length+1, p={id:bid(),short:`PRJ-${p2(n)}`,name:'New project'}; st.projects.push(p); const w={id:bid(),proj:p.id,parent:null,code:'1',name:'Work',seq:1}; st.wbs.push(w); bChanged(); const i=B.rows.findIndex(r=>r.t==='p'&&r.p===p); if(i>=0){ B.sel={r:i,c:'name'}; bScrollIntoView(i); bStartEdit(true); } }
function bDelete(){ const st=B.st, row=bSelRow(); if(!row) return; bPush();
  if(row.t==='a'){ st.acts=st.acts.filter(a=>a!==row.a); st.rels=st.rels.filter(r=>r.p!==row.a.id&&r.s!==row.a.id); bToastMsg(`Deleted ${row.a.code}. Ctrl+Z to undo.`); }
  else if(row.t==='w'){ const ids=new Set([row.w.id]); let grow=true; while(grow){ grow=false; st.wbs.forEach(w=>{ if(w.parent&&ids.has(w.parent)&&!ids.has(w.id)){ ids.add(w.id); grow=true; } }); } const gone=new Set(st.acts.filter(a=>ids.has(a.wbs)).map(a=>a.id)); st.wbs=st.wbs.filter(w=>!ids.has(w.id)); st.acts=st.acts.filter(a=>!gone.has(a.id)); st.rels=st.rels.filter(r=>!gone.has(r.p)&&!gone.has(r.s)); bToastMsg(`Deleted WBS ${row.w.code} and ${gone.size} activities. Ctrl+Z to undo.`); }
  else { if(st.projects.length===1) { B.undo.pop(); return bToastMsg('A schedule needs at least one project.'); } const pid=row.p.id, gone=new Set(st.acts.filter(a=>a.proj===pid).map(a=>a.id)); st.projects=st.projects.filter(p=>p.id!==pid); st.wbs=st.wbs.filter(w=>w.proj!==pid); st.acts=st.acts.filter(a=>a.proj!==pid); st.rels=st.rels.filter(r=>!gone.has(r.p)&&!gone.has(r.s)); bToastMsg(`Deleted project ${row.p.short}. Ctrl+Z to undo.`); }
  B.sel.r=Math.max(0,Math.min(B.sel.r,B.rows.length-2)); bChanged(); }
function bMove(dir){ const st=B.st, row=bSelRow(); if(!row||row.t==='p') return;
  if(row.t==='a'){ const sibs=st.acts.filter(a=>a.proj===row.a.proj&&a.wbs===row.a.wbs).sort((x,y)=>x.seq-y.seq), i=sibs.indexOf(row.a), j=i+dir; if(j<0||j>=sibs.length) return; bPush(); [sibs[i].seq,sibs[j].seq]=[sibs[j].seq,sibs[i].seq]; }
  else { const sibs=st.wbs.filter(w=>w.proj===row.w.proj&&(w.parent||null)===(row.w.parent||null)).sort((x,y)=>x.seq-y.seq), i=sibs.indexOf(row.w), j=i+dir; if(j<0||j>=sibs.length) return; bPush(); [sibs[i].seq,sibs[j].seq]=[sibs[j].seq,sibs[i].seq]; }
  bChanged(); const k=B.rows.findIndex(r=>(r.t==='a'&&r.a===row.a)||(r.t==='w'&&r.w===row.w)); if(k>=0){ B.sel.r=k; bScrollIntoView(k); bRenderAll(); } }
function bIndent(dir){ const st=B.st, row=bSelRow(); if(!row) return;
  if(row.t==='a'){ // move activity into the WBS above / out to parent WBS
    if(dir>0){ for(let i=B.sel.r-1;i>=0;i--){ const r=B.rows[i]; if(r.t==='w'&&r.w.id!==row.a.wbs&&r.w.proj===row.a.proj){ bPush(); row.a.wbs=r.w.id; row.a.seq=999; break; } if(r.t==='p') break; } }
    else { const w=st.wbs.find(x=>x.id===row.a.wbs); if(!w) return; bPush(); row.a.wbs=w.parent||null; row.a.seq=999; }
    st.acts.forEach(()=>{}); bChanged(); return; }
  if(row.t!=='w') return; const w=row.w, sibs=st.wbs.filter(x=>x.proj===w.proj&&(x.parent||null)===(w.parent||null)).sort((x,y)=>x.seq-y.seq);
  if(dir>0){ const i=sibs.indexOf(w); if(i<=0) return bToastMsg('Indent needs a WBS above at the same level.'); bPush(); w.parent=sibs[i-1].id; w.seq=999; }
  else { if(!w.parent) return; const par=st.wbs.find(x=>x.id===w.parent); bPush(); w.parent=par?par.parent||null:null; w.seq=(par?par.seq:0)+0.5; }
  const fix=(proj,parent)=>st.wbs.filter(x=>x.proj===proj&&(x.parent||null)===parent).sort((x,y)=>x.seq-y.seq).forEach((x,i)=>x.seq=i+1); fix(w.proj,w.parent||null); bChanged(); }
function bLinkUp(){ const row=bSelRow(); if(!row||row.t!=='a') return; for(let i=B.sel.r-1;i>=0;i--){ const r=B.rows[i]; if(r.t==='a'){ if(B.st.rels.some(x=>x.p===r.a.id&&x.s===row.a.id)) return bToastMsg('Already linked.'); if(bWouldLoop([{p:r.a.id,s:row.a.id}])) return bToastMsg('That would create a loop.'); bPush(); B.st.rels.push({p:r.a.id,s:row.a.id,t:'FS',lag:0}); bChanged(); return; } } }
function bUndo(){ if(!B.undo.length) return; B.redo.push(JSON.stringify(B.st)); B.st=JSON.parse(B.undo.pop()); B.edit=null; bChanged(); }
function bRedo(){ if(!B.redo.length) return; B.undo.push(JSON.stringify(B.st)); B.st=JSON.parse(B.redo.pop()); B.edit=null; bChanged(); }
function bCapture(){ const st=B.st; bPush(); st.baseline={at:Date.now(),dd:st.dd,R:bSnapshot(st,B.res),acts:JSON.parse(JSON.stringify(st.acts)),rels:JSON.parse(JSON.stringify(st.rels)),projects:JSON.parse(JSON.stringify(st.projects)),wbs:JSON.parse(JSON.stringify(st.wbs)),cals:JSON.parse(JSON.stringify(st.cals))}; bChanged(); bToastMsg('Baseline captured. Grey bars now show it, and variance appears across the Workbench once you use the schedule there.'); }
function bUse(){ const st=B.st; if(B.res.loops.length) return bToastMsg('Fix the loop in the logic first.'); st.sync=true; bSave(); S.files=S.files.filter(f=>!f.builder&&!f.sample).map(f=>({...f,role:f.error?f.role:'off'})).concat(bToFiles()); rebuild(true); bRenderAll(); bToastMsg(st.upd?'Previewing the update in every tab. Nothing is saved until you choose Save as Update.':'This schedule now drives every tab. Edits here update the Workbench automatically.'); }
function bStartEdit(selectAll,initial){ const row=bSelRow(); if(!row) return; const c=bCols().find(x=>x.k===B.sel.c); if(c&&c.dlg){ if(row.t==='a') bAsgOpen(row.a.id); return; } if(!c||c.ro) return; if(row.t!=='a'&&!['code','name'].includes(c.k)) return; if(row.t==='a'&&B.res.R.get(row.a.id)&&false) return;
  B.edit={r:B.sel.r,c:c.k,val:initial!=null?initial:bEditValue(row,c),fresh:true,sel:!!selectAll&&initial==null}; bRenderGrid(); }
function bFinishEdit(save,move){ const e=B.edit; if(!e) return; B.edit=null; const row=B.rows[e.r], c=bCols().find(x=>x.k===e.c); if(save&&row&&c&&String(e.val)!==String(bEditValue(row,c))) bCommit(row,c,e.val); else bRenderGrid();
  if(move){ const cols=bCols().map(x=>x.k); if(move==='down') B.sel.r=Math.min(B.rows.length-1,B.sel.r+1); if(move==='right'){ const i=cols.indexOf(B.sel.c); B.sel.c=cols[Math.min(cols.length-1,i+1)]; } if(move==='left'){ const i=cols.indexOf(B.sel.c); B.sel.c=cols[Math.max(0,i-1)]; } bScrollIntoView(B.sel.r); bRenderGrid(); bDrawGantt(); }
  const body=document.getElementById('bGBody'); if(body) body.focus({preventScroll:true}); }
async function bSaveFile(name,data,ext){ let dl=null; try{ dl=await window.claude?.use?.('downloads'); }catch(_){}
  if(!dl){ bToastMsg('Saving files is not available in this view. Use Copy XER, or open the artifact in Claude.'); return; }
  try{ await dl.save({filename:name,data}); bToastMsg(`Saved ${name}.`); }catch(e){ bToastMsg(e&&e.code==='declined'?'Save cancelled.':'The file could not be saved here.'); } }
function bXerText(){ return bToXer(B.st,B.res,'live').map(f=>f.text).join('').replace(/%E\n(?=ERMHDR)/g,'').replace(/\nERMHDR[^\n]*\n/g,'\n'); }
function bCsv(){ const cols=bCols().filter(c=>c.k!=='succs'), q=v=>`"${String(v??'').replace(/"/g,'""')}"`; const lines=[['Project','WBS'].concat(cols.map(c=>c.l)).map(q).join(',')];
  B.rows.forEach(row=>{ if(row.t!=='a') return; const p=B.st.projects.find(x=>x.id===row.a.proj), w=B.st.wbs.find(x=>x.id===row.a.wbs); lines.push([p?p.short:'',w?w.code:''].concat(cols.map(c=>bCellText(row,c))).map(q).join(',')); }); return lines.join('\n'); }
function bDialog(kind){ const el=document.getElementById('bDlg'); if(!el.hidden&&el.dataset.kind===kind){ el.hidden=true; return; } el.dataset.kind=kind; el.hidden=false; bRenderDialog(); }
function bRenderDialog(){ const el=document.getElementById('bDlg'), st=B.st, kind=el.dataset.kind; if(el.hidden) return; el.classList.toggle('wide',['asg','rsrc'].includes(kind)); if(bRenderRsDialog()) return;
  const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  if(kind==='cals') el.innerHTML=`<div class="cph"><strong>Calendars</strong><span class="sp"></span><button class="btn sm" data-bd="addcal">Add calendar</button><button class="fx" data-bd="close" aria-label="Close">×</button></div>
    <div class="bcals">${st.cals.map(c=>`<div class="bcal"><div class="bcr"><input data-calf="name" data-cal="${c.id}" value="${esc(c.name)}" aria-label="Calendar name"><label class="bdef"><input type="radio" name="bdefc" data-caldef="${c.id}" ${st.defCal===c.id?'checked':''}> Default</label><button class="link" data-caldel="${c.id}">Delete</button></div>
      <div class="bcr"><span class="ctl">Work days</span><div class="sg">${DOW.map((d,i)=>`<button data-calday="${i}" data-cal="${c.id}" class="${c.work[i]?'on':''}">${d}</button>`).join('')}</div><span class="ctl">Hours/day</span><input class="tvi" data-calf="hrs" data-cal="${c.id}" value="${c.hrs}"></div>
      <label class="exf"><span>Holidays and non-working days (one per line, e.g. 2026-12-25)</span><textarea rows="3" data-calf="hol" data-cal="${c.id}">${esc((c.hol||[]).join('\n'))}</textarea></label></div>`).join('')}</div>
    <p class="muted" style="font-size:12.5px;margin:8px 0 0">The engine schedules in whole working days. Hours per day converts durations and float when you export to XER.</p>`;
  if(kind==='codes') el.innerHTML=`<div class="cph"><strong>Activity codes</strong><span class="sp"></span><button class="btn sm" data-bd="addcode">Add code type</button><button class="fx" data-bd="close" aria-label="Close">×</button></div>
    <div class="bcals">${st.codeTypes.map((t,i)=>`<div class="bcal"><div class="bcr"><input data-codef="name" data-code="${i}" value="${esc(t.name)}" aria-label="Code type name"><button class="link" data-codedel="${i}">Delete</button></div>
      <label class="exf"><span>Values, one per line as CODE, Description</span><textarea rows="4" data-codef="values" data-code="${i}">${esc(t.values.map(v=>v.name&&v.name!==v.short?`${v.short}, ${v.name}`:v.short).join('\n'))}</textarea></label></div>`).join('')||'<p class="muted">No code types yet.</p>'}</div>
    <p class="muted" style="font-size:12.5px;margin:8px 0 0">Each code type becomes a column in the grid and a filter, colour and grouping option across the Workbench.</p>`;
}
function bWireShell(){
  const host=document.getElementById('buildWrap'), body=document.getElementById('bGBody'), head=document.getElementById('bGHead'), cv=document.getElementById('bCv');
  body.addEventListener('scroll',()=>{ head.scrollLeft=body.scrollLeft; requestAnimationFrame(()=>{ bRenderGrid(); bDrawGantt(); }); },{passive:true});
  document.getElementById('bName').addEventListener('change',e=>{ bPush(); B.st.name=e.target.value.trim()||'Untitled schedule'; bChanged(); });
  document.getElementById('bDD').addEventListener('change',e=>{ const d=parseDay(e.target.value); if(d==null) return; if(B.st.upd&&d<=B.st.upd.prevDD){ e.target.value=isoD(B.st.dd); return bToastMsg(`The new data date must be after the last update’s, ${fmtL(B.st.upd.prevDD*DAY)}.`); } bPush(); B.st.dd=d; bChanged(); });
  document.getElementById('bMF').addEventListener('change',e=>{ bPush(); B.st.mf=e.target.value?parseDay(e.target.value):null; bChanged(); });
  document.getElementById('bLinks').addEventListener('change',e=>{ B.links=e.target.checked; bDrawGantt(); });
  host.querySelector('.btool').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const a=b.dataset.ba, z=b.dataset.bz;
    if(z){ if(z==='fit') bFit(); else { const W=document.getElementById('bGantt').clientWidth, mid=B.t0+(B.offX+W/2)/B.ppd; B.ppd=Math.max(0.15,Math.min(60,B.ppd*(z==='in'?1.6:1/1.6))); B.offX=(mid-B.t0)*B.ppd-W/2; bDrawGantt(); } return; }
    ({undo:bUndo,redo:bRedo,act:()=>bAddAct('act'),ms:()=>bAddAct('ms'),wbs:bAddWbs,proj:bAddProj,up:()=>bMove(-1),down:()=>bMove(1),out:()=>bIndent(-1),in:()=>bIndent(1),link:bLinkUp,del:bDelete,cals:()=>bDialog('cals'),codes:()=>bDialog('codes'),rsrc:()=>bDialog('rsrc'),asg:()=>{ const row=bSelRow(); if(row&&row.t==='a') bAsgOpen(row.a.id); else bToastMsg('Select an activity first.'); },base:bCapture,use:bUse,ai:baOpen}[a]||(()=>{}))(); });
  document.getElementById('bMenu').addEventListener('change',async e=>{ const v=e.target.value; e.target.value='';
    if(v==='new'){ bPush(); const keep=B.undo; B.st=bBlank(); B.undo=keep; B.t0=0; bChanged(); bToastMsg('New blank schedule. Ctrl+Z brings back the previous one.'); }
    else if(v==='model'){ if(!M||!M.live.acts.size) return bToastMsg('Load an XER in Files first.'); bPush(); const keep=B.undo; bImportModel(); B.undo=keep; }
    else if(v==='open') document.getElementById('bOpen2').click();
    else if(v==='save') bSaveFile(`${(B.st.name||'schedule').replace(/[^\w\- ]+/g,'').trim()||'schedule'}.json`,JSON.stringify(B.st),'json');
    else if(v==='xer') bSaveFile(`${(B.st.name||'schedule').replace(/[^\w\- ]+/g,'').trim()||'schedule'}.xer.txt`,bXerText(),'txt');
    else if(v==='xercopy'){ try{ await navigator.clipboard.writeText(bXerText()); bToastMsg('XER copied. Paste it into a text file saved with a .xer extension.'); }catch(_){ bToastMsg('Copy was blocked here. Use Export XER instead.'); } }
    else if(v==='csv') bSaveFile(`${(B.st.name||'schedule').replace(/[^\w\- ]+/g,'').trim()||'schedule'}.csv`,bCsv(),'csv');
    else if(v==='close'){ B.st=null; try{ localStorage.removeItem('pacer.builder'); }catch(_){} renderBuild(); } });
  document.getElementById('bOpen2').addEventListener('change',e=>bOpenFile(e.target.files[0]));
  // grid mouse
  body.addEventListener('mousedown',e=>{ if(e.target.closest('[data-bin]')) return; const rowEl=e.target.closest('.brow'); if(!rowEl) return; const tog=e.target.closest('[data-btog]'); if(tog){ const id=tog.dataset.btog; B.collapsed.has(id)?B.collapsed.delete(id):B.collapsed.add(id); bRenderAll(); e.preventDefault(); return; }
    const cell=e.target.closest('.bc'); if(B.edit) bFinishEdit(true); B.sel={r:+rowEl.dataset.r,c:cell&&cell.dataset.c?cell.dataset.c:B.sel.c}; e.preventDefault(); bRenderGrid(); bDrawGantt(); body.focus({preventScroll:true}); });
  body.addEventListener('dblclick',e=>{ if(e.target.closest('[data-bin]')) return; if(e.target.closest('.brow')) bStartEdit(false); });
  body.addEventListener('input',e=>{ if(e.target.dataset.bin&&B.edit) B.edit.val=e.target.value; });
  body.addEventListener('change',e=>{ if(e.target.tagName==='SELECT'&&e.target.dataset.bin&&B.edit){ B.edit.val=e.target.value; bFinishEdit(true); } });
  body.addEventListener('focusout',e=>{ if(e.target.dataset&&e.target.dataset.bin&&B.edit){ setTimeout(()=>{ if(B.edit&&!body.contains(document.activeElement)) bFinishEdit(true); },0); } });
  body.addEventListener('keydown',e=>{
    if(B.edit){ if(e.key==='Enter'){ e.preventDefault(); bFinishEdit(true,'down'); } else if(e.key==='Tab'){ e.preventDefault(); bFinishEdit(true,e.shiftKey?'left':'right'); } else if(e.key==='Escape'){ e.preventDefault(); bFinishEdit(false); } return; }
    const cols=bCols().map(c=>c.k), ci=cols.indexOf(B.sel.c), mod=e.ctrlKey||e.metaKey;
    if(mod&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?bRedo():bUndo(); return; } if(mod&&e.key.toLowerCase()==='y'){ e.preventDefault(); bRedo(); return; }
    if(e.altKey&&e.key==='ArrowUp'){ e.preventDefault(); bMove(-1); return; } if(e.altKey&&e.key==='ArrowDown'){ e.preventDefault(); bMove(1); return; }
    if(e.altKey&&e.key==='ArrowRight'){ e.preventDefault(); bIndent(1); return; } if(e.altKey&&e.key==='ArrowLeft'){ e.preventDefault(); bIndent(-1); return; }
    if(e.key==='ArrowDown'){ e.preventDefault(); B.sel.r=Math.min(B.rows.length-1,B.sel.r+1); } else if(e.key==='ArrowUp'){ e.preventDefault(); B.sel.r=Math.max(0,B.sel.r-1); }
    else if(e.key==='ArrowRight'||(e.key==='Tab'&&!e.shiftKey)){ e.preventDefault(); B.sel.c=cols[Math.min(cols.length-1,ci+1)]; } else if(e.key==='ArrowLeft'||(e.key==='Tab'&&e.shiftKey)){ e.preventDefault(); B.sel.c=cols[Math.max(0,ci-1)]; }
    else if(e.key==='Enter'||e.key==='F2'){ e.preventDefault(); bStartEdit(e.key==='Enter'); return; }
    else if(e.key==='Insert'){ e.preventDefault(); bAddAct('act'); return; }
    else if((e.key==='Delete'||e.key==='Backspace')&&mod){ e.preventDefault(); bDelete(); return; }
    else if(e.key==='Delete'||e.key==='Backspace'){ const row=bSelRow(), c=bCols().find(x=>x.k===B.sel.c); if(row&&row.t==='a'&&c&&['preds','cstr','cdate','as','af','rem','pct','ch0','ch1'].includes(c.k)||(c&&c.k.startsWith('code:'))){ e.preventDefault(); bCommit(row,c,''); } return; }
    else if(e.key.length===1&&!mod&&!e.altKey){ const row=bSelRow(), c=bCols().find(x=>x.k===B.sel.c); if(row&&c&&!c.opts&&!c.ro){ e.preventDefault(); bStartEdit(false,e.key); } return; }
    else return;
    bScrollIntoView(B.sel.r); bRenderGrid(); bDrawGantt(); });
  // divider
  const div=document.getElementById('bDiv'), grid=document.getElementById('bGrid'); let dv=null;
  div.addEventListener('pointerdown',e=>{ dv={x:e.clientX,w:grid.offsetWidth}; div.setPointerCapture(e.pointerId); });
  div.addEventListener('pointermove',e=>{ if(!dv) return; const W=document.getElementById('bWrapIn').clientWidth; B.gw=Math.max(240,Math.min(W-200,dv.w+e.clientX-dv.x)); grid.style.width=B.gw+'px'; bDrawGantt(); });
  div.addEventListener('pointerup',()=>{ dv=null; });
  // gantt interactions
  const hit=(x,y)=>{ for(const b of (B.bars||[])){ if(y>=b.y+2&&y<=b.y+BRH-4){ if(!b.ms&&Math.abs(x-(b.x2+7))<=6) return {b,mode:'link'}; if(!b.ms&&x>=b.x2-5&&x<=b.x2+2) return {b,mode:'size'}; if(x>=b.x1-2&&x<=b.x2+2) return {b,mode:'move'}; } } return null; };
  cv.addEventListener('wheel',e=>{ if(e.ctrlKey||e.metaKey){ e.preventDefault(); const rc=cv.getBoundingClientRect(), mx=e.clientX-rc.left, mid=B.t0+(B.offX+mx)/B.ppd; B.ppd=Math.max(0.15,Math.min(60,B.ppd*(e.deltaY<0?1.15:1/1.15))); B.offX=(mid-B.t0)*B.ppd-mx; bDrawGantt(); return; }
    if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){ e.preventDefault(); B.offX+=e.deltaX||e.deltaY; bDrawGantt(); return; } e.preventDefault(); body.scrollTop+=e.deltaY; },{passive:false});
  cv.addEventListener('pointermove',e=>{ const rc=cv.getBoundingClientRect(), x=e.clientX-rc.left, y=e.clientY-rc.top;
    if(B.drag){ const dx=e.clientX-B.drag.sx; if(Math.abs(dx)>3||Math.abs(e.clientY-B.drag.sy)>3) B.drag.moved=true; if(B.drag.mode==='pan'){ B.offX=B.drag.o-dx; bDrawGantt(); return; } B.drag.dd=Math.round(dx/B.ppd); B.drag.cx=x; B.drag.cy=y; bDrawGantt(); return; }
    const h=hit(x,y); cv.style.cursor=h?(h.mode==='move'?'grab':h.mode==='size'?'ew-resize':'crosshair'):'default'; const ha=h?h.b.a:null; if((B.hover&&B.hover.a)!==ha){ B.hover=h?{a:ha}:null; bDrawGantt(); }
    if(h&&e.pointerType==='mouse'){ const a=h.b.a, r=B.res.R.get(a.id); tip.innerHTML=`<div class="tt">${esc(a.name)}</div><div class="tc">${esc(a.code)} · ${r.status==='cp'?'Complete':r.status==='ip'?'In progress':'Not started'}${r.crit?' · critical':''}</div><table><tr><td>Start</td><td>${fmtDay(r.status==='ns'?r.es:a.as)}</td></tr><tr><td>Finish</td><td>${fmtDay(r.ef)}</td></tr><tr><td>Late finish</td><td>${fmtDay(r.lf)}</td></tr><tr><td>Total float</td><td>${r.tf==null?'—':r.tf+' d'}</td></tr></table>`; tip.hidden=false; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+14)+'px'; } else tip.hidden=true; });
  cv.addEventListener('pointerleave',()=>{ tip.hidden=true; if(B.hover){ B.hover=null; bDrawGantt(); } });
  cv.addEventListener('pointerdown',e=>{ const rc=cv.getBoundingClientRect(), x=e.clientX-rc.left, y=e.clientY-rc.top; const h=hit(x,y); cv.setPointerCapture(e.pointerId); tip.hidden=true;
    if(h&&B.res.R.get(h.b.a.id).status!=='cp'){ B.drag={mode:h.mode,a:h.b.a,sx:e.clientX,sy:e.clientY,dd:0,moved:false,x0:h.b.x2+7,y0:h.b.y+12,cx:x,cy:y}; const i=h.b.i; B.sel.r=i; bRenderGrid(); }
    else { B.drag={mode:'pan',sx:e.clientX,sy:e.clientY,o:B.offX,moved:false}; if(h){ B.sel.r=h.b.i; bRenderGrid(); bDrawGantt(); } } });
  cv.addEventListener('pointerup',e=>{ const d=B.drag; B.drag=null; if(!d) return; if(!d.moved){ bDrawGantt(); return; }
    const a=d.a, st=B.st; if(d.mode==='move'&&d.dd){ const r=B.res.R.get(a.id); if(r.status!=='ns') { bToastMsg('Started activities keep their actual start; change the remaining duration instead.'); bDrawGantt(); return; } bPush(); a.cstr='SNET'; a.cdate=r.es+d.dd; bChanged(); bToastMsg(`${a.code} now has "Start on or after ${fmtDay(a.cdate)}".`); }
    else if(d.mode==='size'&&d.dd){ const r=B.res.R.get(a.id), c=B.res.calOf(a), nf=r.ef+d.dd, n=c.count(r.status==='ns'?r.es:r.rs,nf); if(n<1){ bDrawGantt(); return; } bPush(); if(r.status==='ip') a.rem=n; else a.dur=n; bChanged(); }
    else if(d.mode==='link'){ const rc=cv.getBoundingClientRect(), y=e.clientY-rc.top; const t=(B.bars||[]).find(b=>y>=b.y&&y<=b.y+BRH); if(t&&t.a!==a){ if(st.rels.some(r=>r.p===a.id&&r.s===t.a.id)) bToastMsg('Already linked.'); else if(bWouldLoop([{p:a.id,s:t.a.id}])) bToastMsg('That would create a loop.'); else { bPush(); st.rels.push({p:a.id,s:t.a.id,t:'FS',lag:0}); bChanged(); bToastMsg(`Linked ${a.code} → ${t.a.code} (FS).`); } } else bDrawGantt(); }
    else bDrawGantt(); });
  // dialogs
  const dl=document.getElementById('bDlg');
  dl.addEventListener('click',e=>{ const b=e.target.closest('button,input[type=radio]'); if(!b) return; const st=B.st;
    if(b.dataset.bd==='close'){ dl.hidden=true; return; }
    if(b.dataset.bd==='addcal'){ bPush(); st.cals.push({id:bid(),name:'New calendar',work:[0,1,1,1,1,1,0],hrs:8,hol:[]}); bChanged(); bRenderDialog(); }
    if(b.dataset.caldel){ if(st.cals.length===1) return bToastMsg('Keep at least one calendar.'); bPush(); const id=b.dataset.caldel; st.cals=st.cals.filter(c=>c.id!==id); if(st.defCal===id) st.defCal=st.cals[0].id; st.acts.forEach(a=>{ if(a.cal===id) a.cal=st.defCal; }); bChanged(); bRenderDialog(); }
    if(b.dataset.calday!=null){ const c=st.cals.find(x=>x.id===b.dataset.cal); bPush(); c.work[+b.dataset.calday]=c.work[+b.dataset.calday]?0:1; bChanged(); bRenderDialog(); }
    if(b.dataset.caldef){ bPush(); st.defCal=b.dataset.caldef; bChanged(); }
    if(b.dataset.bd==='addcode'){ bPush(); st.codeTypes.push({name:'New code',values:[]}); bChanged(); bRenderDialog(); }
    if(b.dataset.codedel!=null){ bPush(); const t=st.codeTypes.splice(+b.dataset.codedel,1)[0]; st.acts.forEach(a=>{ if(a.codes) delete a.codes[t.name]; }); bChanged(); bRenderDialog(); } });
  dl.addEventListener('change',e=>{ const t=e.target, st=B.st;
    if(t.dataset.cal&&t.dataset.calf){ const c=st.cals.find(x=>x.id===t.dataset.cal); bPush(); if(t.dataset.calf==='name') c.name=t.value; if(t.dataset.calf==='hrs') c.hrs=Math.max(1,Math.min(24,+t.value||8)); if(t.dataset.calf==='hol') c.hol=t.value.split(/\n|,/).map(x=>x.trim()).filter(x=>parseDay(x)!=null).map(x=>isoD(parseDay(x))); bChanged(); bRenderDialog(); }
    if(t.dataset.code!=null){ const ty=st.codeTypes[+t.dataset.code]; bPush(); if(t.dataset.codef==='name'){ const old=ty.name; ty.name=t.value.trim()||old; st.acts.forEach(a=>{ if(a.codes&&a.codes[old]!=null){ a.codes[ty.name]=a.codes[old]; if(old!==ty.name) delete a.codes[old]; } }); } else ty.values=t.value.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{ const [s,...rest]=l.split(','); return {short:s.trim(),name:rest.join(',').trim()||s.trim()}; }); bChanged(); } });
  new ResizeObserver(()=>requestAnimationFrame(()=>{ if(!B.st||!document.getElementById('bGrid')) return; bRenderGrid(); bDrawGantt(); })).observe(document.getElementById('bWrapIn'));
}
function bModelState(){ const st=bFromSet(M.live,M.dd,S.files.filter(f=>!f.error&&f.role==='live'));
  if(M.base.acts.size){ const bs=bFromSet(M.base,M.bdd), bres=bCompute(bs), psh=new Map(st.projects.map(p=>[p.id,p.short])), byCode=new Map(st.acts.map(a=>[psh.get(a.proj)+'|'+a.code,a.id])), R={};
    bs.acts.forEach(a=>{ const id=byCode.get((bs.projects.find(p=>p.id===a.proj)||{}).short+'|'+a.code); const r=bres.R.get(a.id); if(id&&r) R[id]={es:r.es,ef:r.ef,ls:r.ls,lf:r.lf,tf:r.tf,ff:r.ff,dur:r.dur}; });
    const keep=new Set(Object.keys(R)); st.baseline={at:M.bdd||Date.now(),dd:dayOf(M.bdd||Date.now()),R,acts:st.acts.filter(a=>keep.has(a.id)).map(a=>({...a,as:null,af:null,rem:null,pct:null})),rels:st.rels.filter(r=>keep.has(r.p)&&keep.has(r.s)),projects:st.projects,wbs:st.wbs,cals:st.cals}; }
  return st; }
function bImportModel(){ B.st=bModelState(); B.res=bCompute(B.st);
  B.t0=0; B.sel={r:0,c:'name'}; bChanged(); bToastMsg(`Imported ${B.st.acts.length} activities and recalculated. Calendars were set from their names (5-day unless the name says 6 or 7 day), so check them under Calendars.`); }
function bOpenFile(file){ if(!file) return; file.text().then(t=>{ const st=JSON.parse(t); if(!st||!Array.isArray(st.acts)||!Array.isArray(st.cals)) throw new Error('not a builder file'); if(B.st) bPush(); B.st=st; B.t0=0; if(!document.getElementById('bGrid')) bShell(); bChanged(); bToastMsg(`Opened ${file.name}.`); }).catch(()=>bToastMsg('That file is not a Schedule Workbench builder file.')); }
function wireBuild(){
  const host=document.getElementById('buildWrap');
  host.addEventListener('click',e=>{ const b=e.target.closest('[data-bnew]'); if(!b||b.disabled) return; if(b.dataset.bnew==='ai'){ baOpen(); return; } if(b.dataset.bnew==='blank'){ B.st=bBlank(); B.undo=[]; B.res=bCompute(B.st); B.t0=0; bShell(); bChanged(); } else if(b.dataset.bnew==='model'){ bShell(); bImportModel(); } });
  host.addEventListener('change',e=>{ if(e.target.id==='bOpen'){ const f=e.target.files[0]; if(f){ bOpenFile(f); } } });
  document.addEventListener('keydown',e=>{ if(S.tab!=='build'||!B.st) return; if((e.ctrlKey||e.metaKey)&&!e.target.closest('input,textarea,select')){ if(e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?bRedo():bUndo(); } else if(e.key.toLowerCase()==='y'){ e.preventDefault(); bRedo(); } } });
}

