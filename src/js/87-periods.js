async function supaUsers(){
  const sb=PER.sb; const {data,error}=await sb.from('profiles').select('*').order('created_at'); if(error){ perToast(perErr(error),'err'); return; }
  const R=[['pending','Pending'],['viewer','Viewer'],['contributor','Contributor'],['admin','Admin']];
  const d=perDialog('Users',`<p class="muted">Approve new accounts and set what each person can do. Viewers read team projects; contributors also save periods; admins manage everything.</p>
    <div class="ptw"><table class="ptab"><thead><tr><th>Person</th><th>Joined</th><th>Access</th></tr></thead><tbody>${data.map(u=>`<tr><td><b class="un"></b><div class="muted ue"></div></td><td class="num">${fmtD(Date.parse(u.created_at))}</td>
      <td><select data-uid="${esc(u.id)}" ${u.id===PER.uid?'disabled title="You can’t change your own access"':''}>${R.map(([v,l])=>`<option value="${v}" ${u.role===v?'selected':''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`,'Done',()=>{ renderUserChip(); });
  d.querySelectorAll('tbody tr').forEach((tr,i)=>{ tr.querySelector('.un').textContent=data[i].name||data[i].email; tr.querySelector('.ue').textContent=data[i].name?data[i].email:''; tr.style.cursor='default'; });
  d.querySelector('.pdf [data-x]').hidden=true;
  d.addEventListener('change',async e=>{ const s=e.target.closest('select[data-uid]'); if(!s) return; s.disabled=true; const {error}=await sb.from('profiles').update({role:s.value}).eq('id',s.dataset.uid); s.disabled=false; if(error) perToast(perErr(error),'err'); else perToast('Access updated.'); });
}
const perCanDel=by=>PER.mode==='local'||PER.isOwner||PER.canEdit||(!perRO()&&by===PER.uid);
function perRO(){ return PER.mode==='supa'?!(PER.canWrite||(PER.space==='private'&&PER.srole!=='pending')):!!PER.readOnly; }

/* ---- subscriptions ---- */
// Headline figures from a project's latest period (same shape the database trigger writes).
function perSummary(list){
  if(!list||!list.length) return null;
  const L=list.slice().sort((a,b)=>(a.dd||0)-(b.dd||0)||(a.savedAt||0)-(b.savedAt||0)), a=L[L.length-1], b=L.length>1?L[L.length-2]:null, s=a.stats||{}, v=x=>x===undefined?null:x;
  return {periodId:a.id,label:a.label,dd:v(a.dd),finish:v(s.finish),blFinish:v(s.blFinish),bei:v(s.bei),crit:v(s.crit),neg:v(s.neg),pctA:v(s.pctA),pctP:v(s.pctP),rel:s.rel||null,n:v(s.n),prevFinish:b&&b.stats?v(b.stats.finish):null,count:L.length};
}
function perRenderAll(){ renderPer(); if(typeof renderPort==='function') renderPort(); if(M) renderMeta(); }
function perSubscribe(){
  if(PER.unP) PER.unP(); if(PER.unR) PER.unR(); if(PER.unG) PER.unG(); PER.unR=PER.unG=null; PER.periods=[]; PER.projects=[]; PER.programmes=[]; PER.schemaOld=false;
  if(!PER.store){ perRenderAll(); return; }
  PER.unG=PER.store.watchProgrammes(list=>{ PER.programmes=list.sort((a,b)=>(a.sort||0)-(b.sort||0)||String(a.name).localeCompare(b.name)); PER.schemaOld=false; if(typeof renderPort==='function') renderPort(); renderMeta(); if(typeof rkRender==='function') rkRender(); },
    e=>{ if(/programmes|schema cache|does not exist|42P01|PGRST20/i.test((e&&(e.message||e.code))||'')){ PER.schemaOld=true; if(typeof renderPort==='function') renderPort(); } else perToast(perErr(e),'err'); });
  PER.unP=PER.store.watchProjects(list=>{ PER.projects=list.map(p=>Object.assign({programmeId:null,code:'',status:'active',manager:'',description:'',summary:null},p)).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)); if(typeof renderPort==='function') renderPort(); renderMeta(); if(typeof rkRender==='function') rkRender();
      let want=PER.pid; if(!want){ try{ want=localStorage.getItem('pacer.proj.'+PER.space); }catch(_){} }
      if(!PER.projects.some(p=>p.id===want)) want=PER.projects[0]?PER.projects[0].id:null;
      if(want!==PER.pid||!PER.unR) perPick(want); else renderPer(); },
    e=>{ perToast(perErr(e),'err'); perRenderAll(); });
  perRenderAll(); if(typeof rkSubscribe==='function') rkSubscribe();
}
function perPick(pid){
  if(PER.unR) PER.unR(); PER.unR=null; PER.pid=pid; PER.periods=[]; PER.cmp={a:null,b:null,tab:PER.cmp.tab,manual:false}; PER.ms=null;
  try{ if(pid) localStorage.setItem('pacer.proj.'+PER.space,pid); }catch(_){}
  if(pid) PER.unR=PER.store.watchPeriods(pid,list=>{ PER.periods=list.sort((a,b)=>(a.dd||0)-(b.dd||0)||(a.savedAt||0)-(b.savedAt||0)); perFixCmp(); renderPer(); }, e=>perToast(perErr(e),'err'));
  renderPer();
}
function perFixCmp(){ const P=PER.periods, ids=new Set(P.map(p=>p.id)); if(!PER.cmp.manual){ PER.cmp.b=P.length?P[P.length-1].id:null; PER.cmp.a=P.length>1?P[P.length-2].id:null; return; } if(!ids.has(PER.cmp.b)) PER.cmp.b=P.length?P[P.length-1].id:null; if(!ids.has(PER.cmp.a)) PER.cmp.a=P.length>1?P[P.length-2].id:null; }

/* ---- statistics for one saved period ---- */
const perKey=a=>S.match==='code'?a.code:a.proj+'|'+a.code;
function perSets(files){ return {L:buildRole(files.filter(f=>f.role==='live')),B:buildRole(files.filter(f=>f.role==='baseline'))}; }
const perWork=set=>[...set.acts.values()].filter(a=>a.type!=='TT_LOE'&&a.type!=='TT_WBS');
const perDur=a=>{ const v=+a.raw.target_drtn_hr_cnt; return isFinite(v)?v/(a.dh||8):0; };
function perStats(files){
  const {L,B}=perSets(files), acts=perWork(L), base=perWork(B), dd=L.dd, bm=new Map(base.map(b=>[perKey(b),b]));
  let finish=null, blFinish=null, done=0, act=0, ns=0, wA=0, wT=0, wP=0, wPT=0, due=0, crit=0, neg=0, minTF=null, open=0, hard=0;
  const H=new Set(['CS_MSO','CS_MEO','CS_MSOB','CS_MEOB','CS_MANDSTART','CS_MANDFIN']);
  acts.forEach(a=>{ if(a.f!=null&&(finish==null||a.f>finish)) finish=a.f; const st=a.status; if(st==='TK_Complete') done++; else if(st==='TK_Active') act++; else ns++;
    const d=Math.max(perDur(a),0); wT+=d; wA+=d*(st==='TK_Complete'?1:Math.min(100,a.pct)/100);
    if(st!=='TK_Complete'){ if(a.tf!=null){ if(a.tf<=0.01) crit++; if(a.tf<-0.01) neg++; if(minTF==null||a.tf<minTF) minTF=a.tf; }
      if((!a.preds.length&&a.type!=='TT_Mile')||(!a.succs.length&&a.type!=='TT_FinMile')) open++; if(H.has(a.raw.cstr_type)||H.has(a.raw.cstr_type2)) hard++; } });
  base.forEach(b=>{ if(b.f!=null&&(blFinish==null||b.f>blFinish)) blFinish=b.f; const d=Math.max(perDur(b),0); wPT+=d;
    if(dd!=null&&b.s!=null&&b.f!=null){ const fr=dd>=b.f?1:dd<=b.s?0:(dd-b.s)/Math.max(1,b.f-b.s); wP+=d*fr; if(b.f<=dd) due++; } });
  const ms=acts.filter(a=>a.ms).sort((x,y)=>(x.f||0)-(y.f||0)).slice(0,160).map(a=>{ const b=bm.get(perKey(a)); return {k:perKey(a),n:a.name.slice(0,90),f:a.f,d:a.status==='TK_Complete'?1:0,bf:b?b.f:null,t:a.type==='TT_FinMile'?1:0}; });
  return {dd,finish,blFinish,n:acts.length,done,act,ns,pctA:wT?wA/wT:0,pctP:wPT?wP/wPT:null,bei:due?done/due:null,due,crit,neg,minTF,open,hard,links:L.links,projs:[...L.projs],ms,hasBL:base.length>0,cost:perCost(L,B,acts,base,bm,dd)};
}
// Earned value from the resource and expense costs in the XERs. Budget and planned value come from the baseline when it carries costs.
function perCost(L,B,acts,base,bm,dd){
  if(!L.hasCost&&!B.hasCost) return null;
  const useB=!!B.hasCost, cb=useB?base:acts; let bac=0,pv=0,ev=0,ac=0,etc=0;
  cb.forEach(b=>{ const c=b.cost; if(!c) return; bac+=c.bc; if(dd!=null&&b.s!=null&&b.f!=null) pv+=c.bc*(dd>=b.f?1:dd<=b.s?0:(dd-b.s)/Math.max(1,b.f-b.s)); });
  acts.forEach(a=>{ const c=a.cost; if(!c&&!useB) return; const k=a.status==='TK_Complete'?1:a.status==='TK_Active'?Math.max(0,Math.min(100,a.pct))/100:0, b=useB?bm.get(perKey(a)):null, bud=useB?(b&&b.cost?b.cost.bc:0):c.bc;
    ev+=bud*k; if(c){ ac+=c.ac; etc+=c.rc; } });
  const r=v=>Math.round(v*100)/100;
  return {bac:r(bac),pv:r(pv),ev:r(ev),ac:r(ac),etc:r(etc),eac:r(ac+etc),spi:pv?ev/pv:null,cpi:ac?ev/ac:null,fromBL:useB};
}
/* forecast reliability: of the work the earlier update said would finish (or start) by the later data date, how much did */
function perReliability(fa,fb){
  const A=perSets(fa).L, B=perSets(fb).L, ddB=B.dd; if(ddB==null) return null; const bm=new Map(perWork(B).map(a=>[perKey(a),a]));
  let pf=0,hf=0,ps=0,hs=0;
  perWork(A).forEach(a=>{ const b=bm.get(perKey(a)); if(!b) return;
    if(a.status!=='TK_Complete'&&a.f!=null&&a.f<=ddB+DAY){ pf++; if(b.status==='TK_Complete') hf++; }
    if(a.status==='TK_NotStart'&&a.s!=null&&a.s<=ddB+DAY){ ps++; if(b.status!=='TK_NotStart') hs++; } });
  return {pf,hf,ps,hs};
}

/* ---- full comparison of two periods ---- */
function perCompare(fa,fb){
  const A=perSets(fa), Bp=perSets(fb), LA=A.L, LB=Bp.L, ddA=LA.dd, ddB=LB.dd;
  const am=new Map(perWork(LA).map(a=>[perKey(a),a])), bm=new Map(perWork(LB).map(a=>[perKey(a),a])), blm=new Map(perWork(Bp.B).map(a=>[perKey(a),a]));
  const r={ddA,ddB,slip:[],planned:[],completed:[],started:[],added:[],deleted:[],dur:[],logic:[],cstr:[],actual:[],critIn:[],critOut:[],ms:[],finA:null,finB:null};
  const day=t=>t==null?null:Math.round(t/DAY), dif=(x,y)=>x==null||y==null?null:Math.round((y-x)/DAY);
  for(const a of am.values()) if(a.f!=null&&(r.finA==null||a.f>r.finA)) r.finA=a.f;
  for(const b of bm.values()) if(b.f!=null&&(r.finB==null||b.f>r.finB)) r.finB=b.f;
  const pl=a=>new Set(a.preds.map(p=>perKey(p.a)+' '+p.type+(Math.round(p.lag*10)?' '+(Math.round(p.lag*10)/10)+'d':'')));
  const cs=a=>[a.raw.cstr_type,a.raw.cstr_date&&a.raw.cstr_date.slice(0,10),a.raw.cstr_type2,a.raw.cstr_date2&&a.raw.cstr_date2.slice(0,10)].filter(Boolean).map(x=>ENUM[x]||x).join(' ');
  for(const [k,b] of bm){ const a=am.get(k);
    if(!a){ r.added.push({k,code:b.code,name:b.name,note:`${fmtD(b.s)} → ${fmtD(b.f)}`}); continue; }
    const bc=b.status==='TK_Complete', ac=a.status==='TK_Complete';
    if(!bc){ const m=dif(a.f,b.f); r.slip.push({k,code:b.code,name:b.name,fa:a.f,fb:b.f,d:m,tfa:a.tf,tfb:b.tf,dtf:a.tf!=null&&b.tf!=null?Math.round(b.tf-a.tf):null,crit:b.crit}); }
    if(bc&&!ac) r.completed.push({k,code:b.code,name:b.name,fa:a.f,fb:b.f,d:dif(a.f,b.f)});
    if(a.status==='TK_NotStart'&&b.status!=='TK_NotStart') r.started.push({k,code:b.code,name:b.name,fa:a.s,fb:b.s,d:dif(a.s,b.s)});
    if(!ac&&a.f!=null&&ddB!=null&&a.f<=ddB+DAY) r.planned.push({k,code:b.code,name:b.name,fa:a.f,fb:b.f,hit:bc,d:dif(a.f,b.f)});
    const da=Math.round(perDur(a)), db=Math.round(perDur(b)); if(da!==db&&!a.ms) r.dur.push({k,code:b.code,name:b.name,note:`${da}d → ${db}d`,d:db-da});
    const pa=pl(a), pb=pl(b), add=[...pb].filter(x=>!pa.has(x)), rem=[...pa].filter(x=>!pb.has(x));
    if(add.length||rem.length) r.logic.push({k,code:b.code,name:b.name,note:[add.length?'+ '+add.join(', '):'',rem.length?'− '+rem.join(', '):''].filter(Boolean).join(' · ')});
    const ca=cs(a), cb=cs(b); if(ca!==cb) r.cstr.push({k,code:b.code,name:b.name,note:`${ca||'none'} → ${cb||'none'}`});
    const asA=day(pd(a.raw.act_start_date)), afA=day(pd(a.raw.act_end_date)), asB=day(pd(b.raw.act_start_date)), afB=day(pd(b.raw.act_end_date));
    if((asA!=null&&asA!==asB)||(afA!=null&&afA!==afB)) r.actual.push({k,code:b.code,name:b.name,note:[asA!=null&&asA!==asB?`Actual start ${fmtD(asA*DAY)} → ${asB!=null?fmtD(asB*DAY):'removed'}`:'',afA!=null&&afA!==afB?`Actual finish ${fmtD(afA*DAY)} → ${afB!=null?fmtD(afB*DAY):'removed'}`:''].filter(Boolean).join(' · ')});
    if(b.crit&&!a.crit) r.critIn.push({k,code:b.code,name:b.name,note:`TF ${a.tf!=null?Math.round(a.tf)+'d':'—'} → ${Math.round(b.tf)}d`});
    if(a.crit&&!b.crit) r.critOut.push({k,code:b.code,name:b.name,note:bc?'Completed':`TF ${Math.round(a.tf)}d → ${b.tf!=null?Math.round(b.tf)+'d':'—'}`});
    if(b.ms) r.ms.push({k,code:b.code,name:b.name,fa:a.f,fb:b.f,d:dif(a.f,b.f),done:bc,bl:blm.has(k)?blm.get(k).f:null});
  }
  for(const [k,a] of am) if(!bm.has(k)) r.deleted.push({k,code:a.code,name:a.name,note:a.status==='TK_Complete'?'Was complete':`Was ${fmtD(a.s)} → ${fmtD(a.f)}`});
  r.slip.sort((x,y)=>(y.d??-1e9)-(x.d??-1e9)); r.ms.sort((x,y)=>(x.fb||0)-(y.fb||0)); r.planned.sort((x,y)=>(x.hit-y.hit)||((x.fa||0)-(y.fa||0)));
  r.dur.sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
  r.nA=am.size; r.nB=bm.size; r.hit=r.planned.filter(x=>x.hit).length;
  r.slipped=r.slip.filter(x=>x.d>0).length; r.gained=r.slip.filter(x=>x.d<0).length; r.eroded=r.slip.filter(x=>x.dtf!=null&&x.dtf<=-5).length;
  return r;
}

/* ---- load and save ---- */
async function perGetFiles(pid,per){
  const out=[];
  for(const f of per.files||[]){
    let tables=PER.blobs.get(f.h);
    if(!tables){ tables=parseXER(await PER.store.getFileText(pid,f.h,f.name)); PER.blobs.set(f.h,tables); }
    out.push({id:uid(),name:f.name,role:f.role,tables,info:fileInfo(tables),period:per.id});
  }
  return out;
}
async function perPutFile(pid,name,text){ const h=await perHash(text); if(!(await PER.store.hasFile(pid,h))) await PER.store.putFile(pid,h,name,text); return h; }
async function perSavePeriod(pid,files,meta){
  const refs=[];
  for(const f of files){ const txt=tablesToXer(f.tables), h=await perPutFile(pid,f.name,txt); PER.blobs.set(h,f.tables); refs.push({h,name:f.name,role:f.role}); }
  const stats=perStats(files);
  const prev=PER.periods.filter(p=>p.dd!=null&&stats.dd!=null&&p.dd<stats.dd).pop();
  if(prev){ try{ stats.rel=perReliability(await perGetFiles(pid,prev),files); stats.relFrom=prev.id; }catch(_){} }
  const doc={label:meta.label,notes:meta.notes||'',narrative:meta.narrative||{},dd:stats.dd,files:refs,stats,savedBy:PER.uid||'local',savedAt:Date.now()};
  const id=await PER.store.addPeriod(pid,doc);
  if(pid===PER.pid&&!PER.periods.some(p=>p.id===id)){ PER.periods.push({id,...doc}); PER.periods.sort((a,b)=>(a.dd||0)-(b.dd||0)||(a.savedAt||0)-(b.savedAt||0)); }
  return id;
}
async function perDeletePeriod(pid,per){
  await PER.store.deletePeriod(pid,per.id);
  const still=new Set(PER.periods.filter(p=>p.id!==per.id).flatMap(p=>(p.files||[]).map(f=>f.h)));
  for(const f of per.files||[]) if(!still.has(f.h)){ await PER.store.dropFile(pid,f.h); PER.blobs.delete(f.h); }
}
const perDeleteProject=p=>PER.store.deleteProject(p.id);
const perNewProject=name=>PER.store.createProject(name);
function perBusy(msg){ PER.busy=msg||''; ['perBusy','portBusy'].forEach(i=>{ const b=document.getElementById(i); if(b){ b.hidden=!msg; b.textContent=msg||''; } }); if(msg) document.querySelectorAll('#perWrap [data-w],#perWrap [data-pl],#perWrap [data-pd],#portWrap [data-w]').forEach(x=>x.disabled=true); }
async function perRun(msg,fn){ if(PER.busy) return; perBusy(msg); try{ return await fn(); }catch(e){ perToast(perErr(e),'err'); console.warn(e); } finally{ perBusy(''); perRenderAll(); } }

/* ---- dialogs ---- */
function perDialog(title,body,ok,onOk){
  const d=document.createElement('div'); d.className='modal'; d.innerHTML=`<div class="mcard pdlg" role="dialog" aria-modal="true" aria-labelledby="pdT"><div class="mh"><h2 id="pdT"></h2><button class="fx" data-x aria-label="Close">×</button></div><div class="pdb">${body}</div><div class="pdf"><span class="muted" data-err></span><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>${esc(ok)}</button></div></div>`;
  d.querySelector('#pdT').textContent=title; document.body.appendChild(d);
  const close=()=>d.remove(); d.addEventListener('click',e=>{ if(e.target===d||e.target.closest('[data-x]')) close(); });
  d.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); if(e.key==='Enter'&&e.target.tagName==='INPUT'){ e.preventDefault(); d.querySelector('[data-ok]').click(); } });
  d.querySelector('[data-ok]').onclick=async()=>{ const r=await onOk(d); if(r===false) return; close(); };
  setTimeout(()=>{ const i=d.querySelector('input,textarea'); (i||d.querySelector('[data-ok]')).focus(); },30); return d;
}
function perAskProject(after){ portProjectDialog(null,{after:id=>{ perPick(id); if(after) after(id); }}); }
function perAskSave(){
  if(!M||!S.files.some(f=>!f.error&&f.role==='live')){ perToast('Load a live schedule first, then save it as a period.','err'); return; }
  const go=pid=>{ const files=S.files.filter(f=>!f.error&&f.role!=='off'), n=PER.periods.length+1, live=files.filter(f=>f.role==='live'), dupe=PER.periods.find(p=>p.dd===M.dd);
    perDialog('Save as period',`<label class="pfl"><span>Period name</span><input id="pdLab" maxlength="80" value="${esc('Update '+String(n).padStart(2,'0')+' · '+fmtL(M.dd))}"></label>
      <div class="pdg"><div><div class="sl">Data date</div><b>${fmtL(M.dd)}</b></div><div><div class="sl">Project</div><b>${esc((PER.projects.find(p=>p.id===pid)||{}).name||'')}</b></div></div>
      <div class="sl" style="margin-top:12px">Files saved with this period</div><ul class="pdfiles">${files.map(f=>`<li><span class="rl ${f.role}">${f.role==='live'?'Live':'Baseline'}</span>${esc(f.name)}</li>`).join('')}</ul>
      ${dupe?`<p class="pwarn">“${esc(dupe.label)}” already has this data date. Saving again keeps both.</p>`:''}
      ${!live.some(f=>!f.sample)&&live.length?'<p class="muted">You’re saving the sample schedule.</p>':''}
      <label class="pfl"><span>Notes (optional)</span><textarea id="pdNotes" rows="2" maxlength="600" placeholder="e.g. Includes the revised viaduct sequence agreed on site"></textarea></label>${narFields({})}`,'Save period',async d=>{
      const label=d.querySelector('#pdLab').value.trim()||('Period '+n), notes=d.querySelector('#pdNotes').value.trim(), narrative=narRead(d);
      await perRun('Saving period…',async()=>{ const id=await perSavePeriod(pid,files,{label,notes,narrative}); PER.loaded={pid,id,label}; renderMeta(); perToast(`Saved “${label}”.`); }); }); };
  if(PER.pid) go(PER.pid); else perAskProject(go);
}
function perAskImport(){
  if(!PER.pid){ perAskProject(()=>perAskImport()); return; }
  const inp=document.createElement('input'); inp.type='file'; inp.multiple=true; inp.accept='.xer,.XER';
  inp.onchange=()=>{ const list=[...inp.files]; if(!list.length) return; const base=S.files.filter(f=>!f.error&&f.role==='baseline');
    perRun(`Reading ${list.length} file${list.length===1?'':'s'}…`,async()=>{
      const items=[]; for(const file of list){ const buf=await file.arrayBuffer(); let text; try{ text=new TextDecoder('utf-8',{fatal:true}).decode(buf); }catch(_){ text=new TextDecoder('windows-1252').decode(buf); }
        const T=parseXER(text); if(!T.TASK){ perToast(`${file.name} has no TASK table, so it was skipped.`,'err'); continue; } items.push({name:file.name,tables:T,dd:fileInfo(T).dd}); }
      items.sort((a,b)=>(a.dd||0)-(b.dd||0)); let i=0;
      for(const it of items){ i++; perBusy(`Saving ${i} of ${items.length}: ${it.name}`);
        const files=[{id:uid(),name:it.name,role:'live',tables:it.tables}].concat(base); await perSavePeriod(PER.pid,files,{label:it.name.replace(/\.xer$/i,'')+(it.dd?' · '+fmtL(it.dd):''),notes:base.length?'Imported with baseline '+base.map(b=>b.name).join(', '):'Imported without a baseline'});
        await new Promise(r=>setTimeout(r,60)); }
      if(items.length) perToast(`Saved ${items.length} period${items.length===1?'':'s'}${base.length?' against the loaded baseline':''}.`); }); };
  inp.click();
}
async function perSampleHistory(){ await perRun('Building sample history…',async()=>{ const pid=await perNewProject('Northgate Express Rail (sample)'); perPick(pid); await perSampleInto(pid); perToast('Sample history saved: six monthly updates.'); }); }
async function perSampleInto(pid){
  {
    const DDS=[[2026,4,18,.15,'04'],[2026,5,22,.3,'05'],[2026,6,20,.5,'06'],[2026,7,17,.65,'07'],[2026,8,21,.8,'08'],[2026,9,19,1,'09']];
    let i=0; for(const [y,m,d,k,up] of DDS){ i++; perBusy(`Saving sample period ${i} of ${DDS.length}…`); const dt=Date.UTC(y,m,d);
      const files=sampleFiles({ddt:dt,k,up}).map(f=>({...f,sample:false}));
      await perSavePeriod(pid,files,{label:`Update ${up} · ${fmtL(dt)}`,notes:'Generated sample period'}); await new Promise(r=>setTimeout(r,80)); }
  }
}
async function perLoad(per,pid){
  pid=pid||PER.pid;
  await perRun(`Opening ${per.label}…`,async()=>{ const files=await perGetFiles(pid,per); S.files=files; if(typeof B!=='undefined'&&B.st&&B.st.sync){ B.st.sync=false; bSave(); }
    const nxr=files.some(f=>/^NXR-(CIV|SYS)/.test(f.name)); if(S.site.sample&&!nxr) S.site={marks:[],profile:[]}; else if(nxr&&!S.site.marks.length&&!S.site.profile.length) S.site=sampleSite();
    PER.loaded={pid,id:per.id,label:per.label}; rebuild(true); perToast(`Loaded “${per.label}” into the workbench.`); });
}

/* ---- charts (SVG) ---- */
const perC={live:'var(--accent)',base:'var(--base)',ink:'var(--ink2)',good:'var(--early)',bad:'var(--late)',blue:'var(--active)'};
function perChart(o){
  const W=o.w||560, H=o.h||220, m={l:o.ml||(o.yDate?54:42),r:26,t:14,b:28}, iw=W-m.l-m.r, ih=H-m.t-m.b;
  const xs=o.x, x0=Math.min(...xs), x1=Math.max(...xs), xr=x1-x0||1;
  const X=v=>m.l+(xs.length===1?iw/2:(v-x0)/xr*iw);
  let ys=[]; o.series.forEach(s=>s.pts.forEach(p=>p&&p[1]!=null&&ys.push(p[1]))); (o.refs||[]).forEach(r=>r.y!=null&&ys.push(r.y)); if(o.y0!=null) ys.push(o.y0); if(o.y1!=null) ys.push(o.y1);
  if(!ys.length) return `<div class="pempty">Not enough data yet.</div>`;
  let y0=Math.min(...ys), y1=Math.max(...ys); if(y0===y1){ y0-=o.yDate?15*DAY:1; y1+=o.yDate?15*DAY:1; } const pad=(y1-y0)*.08; if(o.y0==null) y0-=pad; if(o.y1==null) y1+=pad;
  const Y=v=>m.t+ih-(v-y0)/(y1-y0)*ih;
  const ticks=[]; if(o.yDate){ const span=(y1-y0)/DAY, stepM=span>900?6:span>400?3:span>150?1:0; if(stepM){ const d=new Date(y0); let t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1); while(t<=y1){ const dt=new Date(t); if(dt.getUTCMonth()%stepM===0) ticks.push(t); t=Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,1); } } else { const s=(y1-y0)/4; for(let i=0;i<=4;i++) ticks.push(y0+s*i); } }
  else { const raw=(y1-y0)/4, mag=Math.pow(10,Math.floor(Math.log10(raw||1))), st=[1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw)||raw; for(let t=Math.ceil(y0/st)*st;t<=y1+1e-9;t+=st) ticks.push(t); }
  const yl=v=>o.yDate?(()=>{ const d=new Date(v); return MON[d.getUTCMonth()]+' '+String(d.getUTCFullYear()).slice(2); })():o.yFmt?o.yFmt(v):String(Math.round(v*100)/100);
  let g=`<svg class="pchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'')}">`;
  ticks.forEach(t=>{ g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="pg"/><text x="${m.l-6}" y="${(Y(t)+4).toFixed(1)}" text-anchor="end" class="pt">${esc(yl(t))}</text>`; });
  const step=Math.max(1,Math.ceil(xs.length/7)); xs.forEach((v,i)=>{ if(i%step&&i!==xs.length-1) return; g+=`<text x="${X(v).toFixed(1)}" y="${H-8}" text-anchor="${xs.length>1&&i===xs.length-1?'end':i===0&&xs.length>1?'start':'middle'}" class="pt">${esc(o.xLab?o.xLab(v,i):fmtD(v))}</text>`; });
  if(o.diag){ const a=Math.max(x0,y0), b=Math.min(x1,y1); if(b>a) g+=`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" class="pdiag"/>`; }
  (o.refs||[]).forEach(r=>{ g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(r.y).toFixed(1)}" y2="${Y(r.y).toFixed(1)}" stroke="${r.c}" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W-m.r-2}" y="${(Y(r.y)-5).toFixed(1)}" text-anchor="end" class="pt" fill="${r.c}">${esc(r.label)}</text>`; });
  o.series.forEach(s=>{ const pts=s.pts.map((p,i)=>p&&p[1]!=null?[X(p[0]),Y(p[1]),i]:null);
    if(s.bar){ const bw=Math.max(6,Math.min(26,iw/xs.length/(s.n||1)-4)); pts.forEach(p=>{ if(!p) return; const yb=Y(Math.max(y0,0)); g+=`<rect x="${(p[0]-bw*(s.n||1)/2+bw*(s.i||0)).toFixed(1)}" y="${Math.min(p[1],yb).toFixed(1)}" width="${bw}" height="${Math.abs(yb-p[1]).toFixed(1)}" rx="2" fill="${s.c}"><title>${esc(s.name)}: ${esc(s.tip?s.tip(s.pts[p[2]]):yl(s.pts[p[2]][1]))}</title></rect>`; }); return; }
    let d='', pen=false; pts.forEach(p=>{ if(!p){ pen=false; return; } d+=(pen?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1); pen=true; });
    g+=`<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w||2.5}" ${s.dash?'stroke-dasharray="5 4"':''} stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach(p=>{ if(!p) return; const sel=o.sel!=null&&xs[p[2]]===o.sel; g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${sel?5:3.5}" fill="${s.hollow&&!sel?'var(--surface)':s.c}" stroke="${s.c}" stroke-width="2"><title>${esc(s.name)} · ${esc(o.xLab?o.xLab(xs[p[2]],p[2]):fmtD(xs[p[2]]))}: ${esc(s.tip?s.tip(s.pts[p[2]]):yl(s.pts[p[2]][1]))}</title></circle>`; }); });
  return g+'</svg>';
}
const perKeyLeg=items=>`<div class="pkl">${items.map(([c,l,d])=>`<span><i style="background:${c}${d?';height:2px':''}"></i>${esc(l)}</span>`).join('')}</div>`;

/* ---- rendering ---- */
function perProfiles(ids){ if(!PER.store||PER.mode==='local') return Promise.resolve({}); return PER.store.profiles(ids).catch(()=>({})); }
function perWho(ps,id){ if(PER.mode==='local') return 'you'; const p=ps[id]; return p?(p.isMe?'you':p.name||'a colleague'):'a colleague'; }
const pctS=v=>v==null?'—':Math.round(v*100)+'%';
const dS=n=>n==null?'—':n===0?'0d':(n>0?'+':'−')+Math.abs(n)+'d';
const dCls=n=>n==null||n===0?'':n>0?'late':'early';
async function renderPer(){
  const el=document.getElementById('perWrap'); if(!el||el.hidden) return;
  if(!PER.mode){ el.innerHTML='<div class="card pempty big"><h3>Sign in to use saved schedules</h3><button class="btn primary" id="perSignIn">Sign in</button></div>'; document.getElementById('perSignIn').onclick=()=>{ if(!document.getElementById('auth')) authStart(); }; return; }
  const P=PER.periods, proj=PER.projects.find(p=>p.id===PER.pid), ro=perRO();
  const ps=await perProfiles(P.map(p=>p.savedBy).concat(proj?[proj.createdBy]:[]));
  const bar=`<div class="card perbar">
    <label class="ctl"><span>Project</span><select id="perProjSel" ${PER.projects.length?'':'disabled'}>${PER.projects.length?portProjectOptions(PER.pid):'<option>No projects yet</option>'}</select></label>
    <button class="btn sm" data-w data-pa="new" ${ro?'disabled':''}>New project</button>
    ${proj?`<button class="btn sm" data-w data-pa="ren" ${perCanDel(proj.createdBy)?'':'disabled'}>Rename</button><button class="btn sm ghostd" data-w data-pa="delp" ${perCanDel(proj.createdBy)?'':'disabled'}>Delete</button>`:''}
    <span class="pspace">${PER.mode!=='local'?(PER.space==='team'?(PER.mode==='supa'&&PER.company?PER.company.name:'Team workspace'):'Private workspace'):'This browser'}</span>
    <span class="sp"></span><span class="pbusy" id="perBusy" ${PER.busy?'':'hidden'}>${esc(PER.busy)}</span>
    ${P.length?'<button class="btn sm ghost" data-pa="xls" title="Download every period as an Excel workbook">Excel</button><button class="btn sm ghost" data-pa="print">Print / PDF</button>':''}<button class="btn sm" data-pa="files" title="Load XER files and set which is live and which is baseline">Schedule files</button><button class="btn sm" data-w data-pa="imp" ${ro?'disabled':''} title="Turn several past XER updates into periods in one go">Import past updates</button>
    ${proj&&P.length&&!ro?'<button class="btn sm" data-w data-pa="upd" title="Enter progress for a new data date and edit the programme, then save it as the next period">Update schedule</button>':''}<button class="btn sm primary" data-w data-pa="save" ${ro?'disabled':''}>Save current as period</button></div>`;
  if(!proj){ el.innerHTML=bar+`<div class="card pempty big"><h3>${PER.projects.length?'Pick a project':'Start your period history'}</h3><p class="muted">Create a project, then save each schedule update as a period. The workbench tracks the forecast, progress and changes from one period to the next.</p>
      <div class="prow">${ro?'':'<button class="btn primary" data-w data-pa="new">Create a project</button><button class="btn" data-w data-pa="sample">Load sample history</button>'}</div>${ro?'<p class="muted">You have view-only access, so ask an editor to create a project.</p>':''}</div>`; perBusy(PER.busy); return; }
  const prevOf=i=>i>0?P[i-1]:null;
  const list=`<aside class="card perlist"><div class="ph"><span class="sl">Periods</span><span class="pn">${P.length}</span></div>
    ${P.length?P.slice().reverse().map(p=>{ const i=P.indexOf(p), pr=prevOf(i), s=p.stats||{}, mv=pr&&pr.stats&&s.finish!=null&&pr.stats.finish!=null?Math.round((s.finish-pr.stats.finish)/DAY):null, cur=PER.loaded&&PER.loaded.id===p.id;
      return `<div class="pitem${cur?' cur':''}${PER.cmp.b===p.id?' isb':''}${PER.cmp.a===p.id?' isa':''}"><div class="pit"><b>${esc(p.label)}</b>${cur?'<span class="pill">Open</span>':''}</div>
        <div class="pim"><span>DD ${fmtD(p.dd)}</span><span>Finish ${fmtD(s.finish)}</span>${mv!=null?`<span class="${dCls(mv)}">${dS(mv)}</span>`:''}</div>
        <div class="pim sub"><span>Saved by <span data-who="${esc(p.savedBy||'')}">${esc(perWho(ps,p.savedBy))}</span> · ${fmtD(p.savedAt)}</span></div>
        ${p.notes?`<div class="pnote">${esc(p.notes)}</div>`:''}${narHas(p.narrative)?`<button class="plink pnar-b" data-pnar="${esc(p.id)}">Narrative: ${NAR.filter(([k])=>p.narrative[k]).map(([,,s])=>s).join(' · ')}</button>`:perCanDel(p.savedBy)?`<button class="plink pnar-b muted" data-pnar="${esc(p.id)}">+ Add narrative</button>`:''}
        <div class="pia"><button class="btn sm" data-pl="${esc(p.id)}">Open</button><button class="plink" data-pab="a" data-pid="${esc(p.id)}">Set as From</button><button class="plink" data-pab="b" data-pid="${esc(p.id)}">Set as To</button>${perCanDel(p.savedBy)?`<button class="plink danger" data-pd="${esc(p.id)}">Delete</button>`:''}</div></div>`; }).join('')
      :`<div class="pempty"><p class="muted">No periods saved yet.</p>${ro?'':'<button class="btn sm primary" data-w data-pa="save">Save current as period</button>'}</div>`}</aside>`;
  el.innerHTML=bar+`<div class="pergrid">${list}<div class="permain" id="perMain"></div></div>`;
  perBusy(PER.busy); renderPerMain();
}
function renderPerMain(){
  const el=document.getElementById('perMain'); if(!el) return; const P=PER.periods;
  if(!P.length){ el.innerHTML=`<div class="card pempty big"><h3>No periods yet</h3><p class="muted">Load this period’s XER files and choose Save current as period. Have a backlog of monthly updates? Import past updates turns each file into a period against the loaded baseline.</p></div>`; return; }
  const xs=P.map(p=>p.dd), st=P.map(p=>p.stats||{}), last=st[st.length-1], prev=st.length>1?st[st.length-2]:null, xl=(v,i)=>fmtD(v).slice(3);
  const mv=prev&&last.finish!=null&&prev.finish!=null?Math.round((last.finish-prev.finish)/DAY):null, vbl=last.finish!=null&&last.blFinish!=null?Math.round((last.finish-last.blFinish)/DAY):null;
  const rel=last.rel, relV=rel&&rel.pf?rel.hf/rel.pf:null;
  const tiles=`<div class="card stats pstats">
    <div class="stat"><div class="sl">Forecast completion</div><div class="sv">${fmtD(last.finish)}</div><div class="ss">${vbl!=null?`<span class="${dCls(vbl)}">${dS(vbl)}</span> vs baseline`:'no baseline'}</div></div>
    <div class="stat"><div class="sl">Moved this period</div><div class="sv ${dCls(mv)}">${dS(mv)}</div><div class="ss">${prev?'since '+fmtD(prev.dd):'first period'}</div></div>
    <div class="stat"><div class="sl">Progress</div><div class="sv">${pctS(last.pctA)}</div><div class="ss">planned ${pctS(last.pctP)}</div></div>
    <div class="stat"><div class="sl">BEI</div><div class="sv ${last.bei!=null&&last.bei<.95?'late':''}">${last.bei!=null?last.bei.toFixed(2):'—'}</div><div class="ss">${last.done} done · ${last.due} due</div></div>
    <div class="stat"><div class="sl">Hit rate</div><div class="sv ${relV!=null&&relV<.8?'late':''}">${pctS(relV)}</div><div class="ss">${rel?`${rel.hf} of ${rel.pf} forecast finishes`:'needs a previous period'}</div></div>
    <div class="stat"><div class="sl">Critical · negative float</div><div class="sv">${last.crit} · <span class="${last.neg?'late':''}">${last.neg}</span></div><div class="ss">min float ${last.minTF!=null?Math.round(last.minTF)+'d':'—'}</div></div></div>`;
  const bl=st.map(s=>s.blFinish).filter(x=>x!=null);
  const c1=perChart({x:xs,yDate:true,xLab:xl,label:'Forecast completion by period',series:[{name:'Forecast completion',c:perC.live,pts:st.map((s,i)=>[xs[i],s.finish])}],refs:bl.length?[{y:bl[bl.length-1],c:'var(--ink3)',label:'Baseline '+fmtD(bl[bl.length-1])}]:[]});
  const c2=perChart({x:xs,xLab:xl,y0:0,y1:1,yFmt:v=>Math.round(v*100)+'%',label:'Planned versus actual progress',series:[{name:'Planned (baseline)',c:'var(--ink3)',dash:true,hollow:true,pts:st.map((s,i)=>[xs[i],s.pctP])},{name:'Actual',c:perC.live,pts:st.map((s,i)=>[xs[i],s.pctA])}]});
  const c3=perChart({x:xs,xLab:xl,y0:0,yFmt:v=>v.toFixed(2),label:'BEI and hit rate',refs:[{y:.95,c:'var(--ink3)',label:'0.95'}],series:[{name:'BEI',c:perC.blue,bar:true,n:2,i:0,pts:st.map((s,i)=>[xs[i],s.bei])},{name:'Hit rate',c:perC.live,bar:true,n:2,i:1,tip:p=>pctS(p[1]),pts:st.map((s,i)=>[xs[i],s.rel&&s.rel.pf?s.rel.hf/s.rel.pf:null])}]});
  const c4=perChart({x:xs,xLab:xl,y0:0,label:'Critical and negative float activities',series:[{name:'Critical',c:perC.live,pts:st.map((s,i)=>[xs[i],s.crit])},{name:'Negative float',c:perC.bad,pts:st.map((s,i)=>[xs[i],s.neg])},{name:'Open ends',c:'var(--ink3)',dash:true,hollow:true,pts:st.map((s,i)=>[xs[i],s.open])}]});
  // milestone trend
  const msAll=new Map(); st.forEach(s=>(s.ms||[]).forEach(m=>{ if(!msAll.has(m.k)) msAll.set(m.k,{k:m.k,n:m.n,t:m.t,last:m.f}); msAll.get(m.k).last=m.f; }));
  const msList=[...msAll.values()].sort((a,b)=>(a.last||0)-(b.last||0));
  if(!PER.ms){ let def=msList.filter(m=>m.t); if(def.length<3) def=msList; PER.ms=new Set(def.slice(-6).map(m=>m.k)); }
  const sel=msList.filter(m=>PER.ms.has(m.k)), PAL2=['var(--accent)','#3B6FE0','#14A37F','#9B5DE5','#D99A00','#E04F8C','#1BA1C4','#6DAA1A'];
  const mta=sel.length?perChart({x:xs,yDate:true,diag:true,xLab:xl,h:280,w:760,label:'Milestone trend',series:sel.map((m,i)=>({name:m.n,c:PAL2[i%PAL2.length],pts:st.map((s,j)=>{ const r=(s.ms||[]).find(q=>q.k===m.k); return [xs[j],r?r.f:null]; })}))}):'<div class="pempty">Pick milestones to plot.</div>';
  const cmp=renderPerCmpShell();
  // cost performance (earned value)
  const cs=st.map(s=>s.cost||null), lc=[...cs].reverse().find(Boolean);
  const costP=lc?(()=>{ const vac=lc.bac-lc.eac, ix=(v,t)=>v==null?'—':`<span class="${v<t?'late':''}">${v.toFixed(2)}</span>`;
    const ch=perChart({x:xs,xLab:xl,y0:0,ml:62,yFmt:v=>moneyK(v),label:'Planned value, earned value and actual cost',refs:[{y:lc.bac,c:'var(--ink3)',label:'Budget '+moneyK(lc.bac)}],series:[{name:'Planned value',c:'var(--ink3)',dash:true,hollow:true,tip:p=>moneyK(p[1]),pts:cs.map((c,i)=>[xs[i],c?c.pv:null])},{name:'Earned value',c:perC.blue,tip:p=>moneyK(p[1]),pts:cs.map((c,i)=>[xs[i],c?c.ev:null])},{name:'Actual cost',c:perC.live,tip:p=>moneyK(p[1]),pts:cs.map((c,i)=>[xs[i],c?c.ac:null])}]});
    return `<div class="card dpanel span2"><div class="ph"><span class="sl">Cost performance</span><span class="pn">earned value from resource and expense costs${lc.fromBL?'':' · no baseline costs, so the live budget is used'}</span></div>
      <div class="pev">${[['Budget at completion',moneyK(lc.bac),''],['Planned value',moneyK(lc.pv),'to data date'],['Earned value',moneyK(lc.ev),'work done, at budget'],['Actual cost',moneyK(lc.ac),'spent to date'],['Schedule index (SPI)',ix(lc.spi,.95),'earned ÷ planned'],['Cost index (CPI)',ix(lc.cpi,.95),'earned ÷ actual'],['Estimate at completion',moneyK(lc.eac),`<span class="${vac<0?'late':'early'}">${vac<0?'−':'+'}${moneyK(Math.abs(vac))}</span> vs budget`]].map(([l,v,s])=>`<div><div class="sl">${l}</div><b>${v}</b><div class="ss">${s}</div></div>`).join('')}</div>
      ${ch}${perKeyLeg([['var(--ink3)','Planned value',1],[perC.blue,'Earned value'],[perC.live,'Actual cost']])}</div>`; })():'';
  // schedule quality trend, scored with the current check set
  const qk=qCurrent(), qsig=JSON.stringify(qCfg())+qk, qs=P.map(p=>QT.get(p.id+'|'+qsig)), qMissing=qs.some(x=>!x);
  if(qMissing) setTimeout(()=>qTrend(qsig,qk),0);
  const qP=`<div class="card dpanel"><div class="ph"><span class="sl">Schedule quality</span><span class="pn">${esc(qFwName(qk))} score by period</span></div>${qs.some(Boolean)?perChart({x:xs,xLab:xl,y0:0,y1:1,yFmt:v=>Math.round(v*100)+'%',label:'Schedule quality score by period',series:[{name:'Score',c:perC.live,tip:p=>Math.round(p[1]*100)+'%',pts:qs.map((q,i)=>[xs[i],q?q.score:null])},{name:'Checks passed',c:perC.good,dash:true,hollow:true,tip:p=>Math.round(p[1]*100)+'%',pts:qs.map((q,i)=>[xs[i],q&&q.n?q.p/q.n:null])}]})+perKeyLeg([[perC.live,'Score (pass = 1, amber = ½)'],[perC.good,'Share of checks passed',1]]):`<div class="pempty">${qMissing?'Scoring each update…':'Not enough data yet.'}</div>`}</div>`;
  el.innerHTML=tiles+`<div class="dgrid pgrid">
    <div class="card dpanel"><div class="ph"><span class="sl">Forecast completion</span><span class="pn">by data date</span></div>${c1}${perKeyLeg([[perC.live,'Forecast'],['var(--ink3)','Baseline finish',1]])}</div>
    <div class="card dpanel"><div class="ph"><span class="sl">Planned vs actual progress</span><span class="pn">duration-weighted</span></div>${c2}${perKeyLeg([['var(--ink3)','Planned (baseline)',1],[perC.live,'Actual']])}</div>
    <div class="card dpanel"><div class="ph"><span class="sl">BEI and hit rate</span><span class="pn">target 0.95</span></div>${c3}${perKeyLeg([[perC.blue,'BEI'],[perC.live,'Hit rate (forecast finishes achieved)']])}</div>
    <div class="card dpanel span2"><div class="ph"><span class="sl">Milestone trend</span><span class="pn">forecast date at each update · a line meeting the diagonal is achieved</span></div>${mta}
      <div class="pmsel">${sel.map((m,i)=>`<span class="pmc on" style="--c:${PAL2[i%PAL2.length]}"><button data-ms="${esc(m.k)}" aria-pressed="true" title="Remove">${esc(m.k.split('|').pop())} · ${esc(m.n)}</button></span>`).join('')}
        <select id="perMsAdd" aria-label="Add milestone"><option value="">+ Add milestone</option>${msList.filter(m=>!PER.ms.has(m.k)).map(m=>`<option value="${esc(m.k)}">${esc(m.k.split('|').pop())} · ${esc(m.n)}</option>`).join('')}</select></div></div>
    <div class="card dpanel"><div class="ph"><span class="sl">Critical &amp; float health</span><span class="pn">incomplete activities</span></div>${c4}${perKeyLeg([[perC.live,'Critical'],[perC.bad,'Negative float'],['var(--ink3)','Open ends',1]])}</div>
    ${qP}${costP}
  </div>`+cmp;
  renderPerCmp();
}
function renderPerCmpShell(){
  const P=PER.periods, o=(id)=>P.map(p=>`<option value="${esc(p.id)}" ${p.id===id?'selected':''}>${esc(p.label)} · ${fmtD(p.dd)}</option>`).join('');
  return `<div class="card pcmp"><div class="pch"><div><h3>Period comparison</h3><p class="muted">What changed between two updates: progress against the earlier forecast, slippage, logic and duration edits, and milestones.</p></div>
    <div class="pcsel"><label class="ctl"><span>From</span><select id="perA"><option value="">—</option>${o(PER.cmp.a)}</select></label><span aria-hidden="true">→</span><label class="ctl"><span>To</span><select id="perB">${o(PER.cmp.b)}</select></label></div></div>
    <div id="perCmp"><div class="pempty">${P.length<2?'Save a second period to compare.':'Loading…'}</div></div></div>`;
}
const perCmpCache=new Map();
async function renderPerCmp(){
  const host=document.getElementById('perCmp'); if(!host) return; const P=PER.periods, a=P.find(p=>p.id===PER.cmp.a), b=P.find(p=>p.id===PER.cmp.b);
  if(!a||!b){ host.innerHTML=`<div class="pempty">${P.length<2?'Save a second period to compare.':'Choose the From and To periods.'}</div>`; return; }
  if(a.id===b.id){ host.innerHTML='<div class="pempty">Pick two different periods.</div>'; return; }
  const key=a.id+'>'+b.id; let r=perCmpCache.get(key);
  if(!r){ host.innerHTML='<div class="pempty"><span class="auth-spin sm"></span> Loading both periods…</div>';
    try{ const [fa,fb]=await Promise.all([perGetFiles(PER.pid,a),perGetFiles(PER.pid,b)]); r=perCompare(fa,fb); perCmpCache.set(key,r); }
    catch(e){ host.innerHTML=`<div class="pempty">${esc(perErr(e))}</div>`; return; }
    if(PER.cmp.a!==a.id||PER.cmp.b!==b.id) return; }
  const back=a.dd!=null&&b.dd!=null&&a.dd>b.dd, fm=r.finA!=null&&r.finB!=null?Math.round((r.finB-r.finA)/DAY):null, hr=r.planned.length?r.hit/r.planned.length:null;
  const T=[['slip','Slippage',r.slipped],['prog','Progress',r.completed.length],['ms','Milestones',r.ms.length],['chg','Changes',r.added.length+r.deleted.length+r.dur.length+r.logic.length+r.cstr.length+r.actual.length],['cp','Critical path',r.critIn.length+r.critOut.length]];
  const tab=PER.cmp.tab;
  const row=(x,cols)=>`<tr data-k="${esc(x.k)}">${cols.map(c=>`<td class="${c[1]||''}">${c[0]}</td>`).join('')}</tr>`;
  const tbl=(head,rows,empty)=>rows.length?`<div class="ptw"><table class="ptab"><thead><tr>${head.map(h=>`<th class="${h[1]||''}">${esc(h[0])}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,400).join('')}</tbody></table>${rows.length>400?`<div class="note">Showing 400 of ${rows.length}.</div>`:''}</div>`:`<div class="pempty sm">${esc(empty)}</div>`;
  const an=x=>`<b>${esc(x.code)}</b>`, nm=x=>`<span class="pnm">${esc(x.name)}</span>`;
  const lst=(title,items,empty)=>`<div class="pcsec"><div class="sl">${esc(title)} <em>${items.length}</em></div>${tbl(['Activity','Name','Detail'].map(h=>[h]),items.map(x=>row(x,[[an(x)],[nm(x)],[esc(x.note),'pnote2']])),empty)}</div>`;
  let body='';
  if(tab==='slip') body=tbl([['Activity'],['Name'],['Finish was','num'],['Finish now','num'],['Moved','num'],['Float was','num'],['Float now','num']],r.slip.filter(x=>x.d).map(x=>row(x,[[an(x)],[nm(x)+(x.crit?' <span class="tagc">Critical</span>':'')],[fmtD(x.fa),'num'],[fmtD(x.fb),'num'],[`<span class="${dCls(x.d)}">${dS(x.d)}</span>`,'num'],[x.tfa!=null?Math.round(x.tfa)+'d':'—','num'],[x.tfb!=null?`<span class="${x.dtf!=null&&x.dtf<0?'late':''}">${Math.round(x.tfb)}d</span>`:'—','num']])),'No forecast finish dates moved.');
  else if(tab==='prog') body=`<div class="pcsec"><div class="sl">Forecast to finish by ${fmtD(r.ddB)} in the earlier update <em>${r.hit} of ${r.planned.length} achieved</em></div>${tbl([['Activity'],['Name'],['Forecast was','num'],['Now','num'],['Result']],r.planned.map(x=>row(x,[[an(x)],[nm(x)],[fmtD(x.fa),'num'],[fmtD(x.fb),'num'],[x.hit?'<span class="early">Finished</span>':`<span class="late">Missed ${dS(x.d)}</span>`]])),'Nothing was forecast to finish in this window.')}</div>`
    +lst('Completed this period',r.completed.map(x=>({...x,note:'Finished '+fmtD(x.fb)+(x.d?` · ${dS(x.d)} vs forecast`:'')})),'Nothing finished.')
    +lst('Started this period',r.started.map(x=>({...x,note:'Started '+fmtD(x.fb)+(x.d?` · ${dS(x.d)} vs forecast`:'')})),'Nothing started.');
  else if(tab==='ms') body=tbl([['Milestone'],['Name'],['Baseline','num'],['Forecast was','num'],['Forecast now','num'],['Moved','num'],['Vs baseline','num']],r.ms.map(x=>{ const vb=x.bl!=null&&x.fb!=null?Math.round((x.fb-x.bl)/DAY):null; return row(x,[[an(x)],[nm(x)+(x.done?' <span class="tagd">Achieved</span>':'')],[fmtD(x.bl),'num'],[fmtD(x.fa),'num'],[fmtD(x.fb),'num'],[`<span class="${dCls(x.d)}">${dS(x.d)}</span>`,'num'],[`<span class="${dCls(vb)}">${dS(vb)}</span>`,'num']]); }),'No milestones in both periods.');
  else if(tab==='chg') body=lst('Added activities',r.added,'None added.')+lst('Deleted activities',r.deleted,'None deleted.')+lst('Original duration changed',r.dur,'No duration changes.')+lst('Logic changed (predecessors)',r.logic,'No logic changes.')+lst('Constraints changed',r.cstr,'No constraint changes.')+lst('Actual dates changed after being recorded',r.actual,'No recorded actuals were altered.');
  else body=lst('Became critical',r.critIn,'Nothing new on the critical path.')+lst('Came off the critical path',r.critOut,'Nothing came off the critical path.');
  host.innerHTML=`${back?'<p class="pwarn">From is later than To, so movements read backwards.</p>':''}
    <div class="pcsum">
      <div><div class="sl">Completion</div><b class="${dCls(fm)}">${dS(fm)}</b><span>${fmtD(r.finA)} → ${fmtD(r.finB)}</span></div>
      <div><div class="sl">Hit rate</div><b class="${hr!=null&&hr<.8?'late':''}">${pctS(hr)}</b><span>${r.hit} of ${r.planned.length} forecast finishes</span></div>
      <div><div class="sl">Completed · started</div><b>${r.completed.length} · ${r.started.length}</b><span>${fmtD(r.ddA)} → ${fmtD(r.ddB)}</span></div>
      <div><div class="sl">Slipped · gained</div><b><span class="late">${r.slipped}</span> · <span class="early">${r.gained}</span></b><span>${r.eroded} lost 5+ days of float</span></div>
      <div><div class="sl">Scope</div><b>+${r.added.length} · −${r.deleted.length}</b><span>${r.nA} → ${r.nB} activities</span></div>
      <div><div class="sl">Edits</div><b class="${r.actual.length?'late':''}">${r.logic.length+r.dur.length+r.cstr.length}${r.actual.length?' · '+r.actual.length+' actuals':''}</b><span>logic, duration, constraints${r.actual.length?', altered actuals':''}</span></div>
    </div>
    <div class="ptabs" role="tablist">${T.map(([id,l,n])=>`<button role="tab" data-ptab="${id}" aria-selected="${tab===id}">${l} <em>${n}</em></button>`).join('')}</div>
    <div class="pcbody">${body}</div>
    <div class="pcfoot"><span class="muted">Rows open the activity when the To period is open in the workbench.</span><button class="btn sm" data-pexp>Export comparison (CSV)</button></div>`;
}
function perCsv(){
  const r=perCmpCache.get(PER.cmp.a+'>'+PER.cmp.b); if(!r) return;
  const q=v=>{ v=v==null?'':String(v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }, d=t=>t==null?'':new Date(t).toISOString().slice(0,10);
  const lines=[['Section','Activity','Name','Earlier','Later','Moved (days)','Detail'].join(',')];
  r.slip.forEach(x=>lines.push(['Forecast finish',x.code,x.name,d(x.fa),d(x.fb),x.d,`TF ${x.tfa!=null?Math.round(x.tfa):''} -> ${x.tfb!=null?Math.round(x.tfb):''}`].map(q).join(',')));
  r.planned.forEach(x=>lines.push(['Planned this period',x.code,x.name,d(x.fa),d(x.fb),x.d,x.hit?'Finished':'Missed'].map(q).join(',')));
  r.ms.forEach(x=>lines.push(['Milestone',x.code,x.name,d(x.fa),d(x.fb),x.d,'Baseline '+d(x.bl)].map(q).join(',')));
  [['Added',r.added],['Deleted',r.deleted],['Duration change',r.dur],['Logic change',r.logic],['Constraint change',r.cstr],['Actuals altered',r.actual],['Became critical',r.critIn],['Off critical path',r.critOut]].forEach(([s,a])=>a.forEach(x=>lines.push([s,x.code,x.name,'','','',x.note].map(q).join(','))));
  const A=PER.periods.find(p=>p.id===PER.cmp.a), B=PER.periods.find(p=>p.id===PER.cmp.b), fn=`Period comparison ${(A&&A.label||'').replace(/[^\w\- ]+/g,'')} to ${(B&&B.label||'').replace(/[^\w\- ]+/g,'')}.csv`;
  perDownload(fn,lines.join('\n'));
}
async function perDownload(fn,data){
  try{ const dl=window.claude?await window.claude.use('downloads'):null; if(dl){ await dl.save({filename:fn,data}); return; } }catch(e){ if(e&&e.code==='declined') return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type:'text/csv'})); a.download=fn; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

/* ---- events ---- */
function wirePer(){
  const chip=document.getElementById('userChip'), menu=document.getElementById('userMenu');
  chip.onclick=e=>{ e.stopPropagation(); menu.hidden=!menu.hidden; chip.setAttribute('aria-expanded',!menu.hidden); };
  document.addEventListener('click',e=>{ if(!menu.hidden&&!menu.contains(e.target)&&e.target!==chip){ menu.hidden=true; chip.setAttribute('aria-expanded','false'); } });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!menu.hidden){ menu.hidden=true; chip.setAttribute('aria-expanded','false'); chip.focus(); } });
  menu.addEventListener('click',e=>{ const s=e.target.closest('[data-space]'); if(s){ PER.space=s.dataset.space; try{ localStorage.setItem('pacer.space',PER.space); }catch(_){} PER.pid=null; perCmpCache.clear(); renderUserChip(); perSubscribe(); return; }
    const u=e.target.closest('[data-um]'); if(!u) return; menu.hidden=true; if(u.dataset.um==='out') signOut(); else if(u.dataset.um==='users') admGo('co-overview'); else if(u.dataset.um==='owner') admGo('wb-overview'); else { if(RK.app==='risk') rkApp('schedule'); setTab('port'); } });
  menu.addEventListener('change',e=>{ if(e.target.id==='umCo'&&e.target.value){ menu.hidden=true; coSwitch(e.target.value); } });
  wirePort();
  const w=document.getElementById('perWrap');
  w.addEventListener('change',e=>{ const t=e.target;
    if(t.id==='perProjSel'){ perCmpCache.clear(); perPick(t.value); }
    else if(t.id==='perA'||t.id==='perB'){ PER.cmp[t.id==='perA'?'a':'b']=t.value||null; PER.cmp.manual=true; renderPer(); }
    else if(t.id==='perMsAdd'&&t.value){ PER.ms.add(t.value); renderPerMain(); } });
  w.addEventListener('click',e=>{
    const a=e.target.closest('[data-pa]'); if(a){ const v=a.dataset.pa, proj=PER.projects.find(p=>p.id===PER.pid);
      if(v==='xls'){ const pj=PER.projects.find(p=>p.id===PER.pid); xlsSave(`${pj?pj.name:'Project'} periods ${new Date().toISOString().slice(0,10)}`,[{name:'Periods',rows:perExportRows()}]); return; }
      if(v==='print'){ const pj=PER.projects.find(p=>p.id===PER.pid); repPrint(pj?pj.name+' periods':'Periods'); return; }
      if(v==='new') perAskProject(); else if(v==='files') openFilesModal(); else if(v==='save') perAskSave(); else if(v==='imp') perAskImport(); else if(v==='sample') perSampleHistory(); else if(v==='upd') updStart(PER.pid);
      else if(v==='ren'&&proj) perDialog('Rename project',`<label class="pfl"><span>Project name</span><input id="pdName" maxlength="80" value="${esc(proj.name)}"></label>`,'Rename',async d=>{ const n=d.querySelector('#pdName').value.trim(); if(!n) return false; await perRun('Renaming…',()=>PER.store.renameProject(proj.id,n)); });
      else if(v==='delp'&&proj) perDialog('Delete project?',`<p>This permanently deletes <b>${esc(proj.name)}</b> and its ${PER.periods.length} saved period${PER.periods.length===1?'':'s'} for everyone. This can’t be undone.</p>`,'Delete project',async()=>{ await perRun('Deleting project…',async()=>{ await perDeleteProject(proj); PER.pid=null; perToast('Project deleted.'); }); });
      return; }
    const l=e.target.closest('[data-pl]'); if(l){ const p=PER.periods.find(x=>x.id===l.dataset.pl); if(p) perLoad(p); return; }
    const ab=e.target.closest('[data-pab]'); if(ab){ PER.cmp[ab.dataset.pab]=ab.dataset.pid; PER.cmp.manual=true; renderPer(); setTimeout(()=>{ const c=document.querySelector('.pcmp'); if(c) c.scrollIntoView({behavior:'smooth',block:'start'}); },50); return; }
    const nb=e.target.closest('[data-pnar]'); if(nb){ const p=PER.periods.find(x=>x.id===nb.dataset.pnar); if(p) narEdit(p); return; }
    const dl=e.target.closest('[data-pd]'); if(dl){ const p=PER.periods.find(x=>x.id===dl.dataset.pd); if(p) perDialog('Delete period?',`<p>This permanently deletes <b>${esc(p.label)}</b> (data date ${fmtL(p.dd)}). Files shared with other periods are kept.</p>`,'Delete period',async()=>{ await perRun('Deleting period…',async()=>{ await perDeletePeriod(PER.pid,p); if(PER.loaded&&PER.loaded.id===p.id) PER.loaded=null; perCmpCache.clear(); perToast('Period deleted.'); }); }); return; }
    const ms=e.target.closest('[data-ms]'); if(ms){ PER.ms.delete(ms.dataset.ms); renderPerMain(); return; }
    const tb=e.target.closest('[data-ptab]'); if(tb){ PER.cmp.tab=tb.dataset.ptab; renderPerCmp(); return; }
    if(e.target.closest('[data-pexp]')){ perCsv(); return; }
    const tr=e.target.closest('tr[data-k]'); if(tr&&M){ const k=tr.dataset.k, code=k.split('|').pop(), rk=M.byKey.has(k)?k:M.byKey.has(code)?code:null;
      if(rk&&PER.loaded&&PER.loaded.id===PER.cmp.b){ setTab('gantt'); selectAct(rk,true); } else perToast(PER.loaded&&PER.loaded.id===PER.cmp.b?'That activity isn’t in the open schedule.':'Open the To period in the workbench to jump to activities.'); }
  });
}


/* ---- update narrative: what changed, why, recovery and risks ---- */
const NAR=[['changed','What changed this period','Changes','e.g. Viaduct deck pours resequenced; two new interface milestones'],['cause','Causes of movement','Causes','e.g. Utility diversion late by 3 weeks; wet weather'],['recovery','Recovery and mitigation','Recovery','e.g. Second piling rig from 10 Nov; weekend working on S04'],['risks','Risks, issues and decisions needed','Risks','e.g. Possession for OLE energisation not yet confirmed by the client']];
const narHas=n=>!!n&&NAR.some(([k])=>n[k]&&String(n[k]).trim());
function narFields(n,open){ n=n||{}; return `<details class="pnar"${open||narHas(n)?' open':''}><summary>Update narrative <span class="muted">(optional, used in reports and AI analysis)</span></summary>${NAR.map(([k,l,,ph])=>`<label class="pfl"><span>${l}</span><textarea data-nar="${k}" rows="2" maxlength="1500" placeholder="${esc(ph)}">${esc(n[k]||'')}</textarea></label>`).join('')}</details>`; }
function narRead(d){ const o={}; d.querySelectorAll('[data-nar]').forEach(t=>{ const v=t.value.trim(); if(v) o[t.dataset.nar]=v; }); return o; }
function narEdit(p){ const can=perCanDel(p.savedBy);
  perDialog(`Narrative · ${p.label}`,can?narFields(p.narrative,true):`<div class="pnar-v">${NAR.filter(([k])=>p.narrative&&p.narrative[k]).map(([k,l])=>`<div class="sl">${l}</div><p>${esc(p.narrative[k])}</p>`).join('')||'<p class="muted">No narrative for this update.</p>'}</div>`,can?'Save narrative':'Close',async d=>{
    if(!can) return; const narrative=narRead(d); try{ await PER.store.updatePeriod(PER.pid,p.id,{narrative}); p.narrative=narrative; perToast('Narrative saved.'); renderPer(); }catch(e){ perToast(perErr(e),'err'); return false; } }); }

/* ---- schedule quality trend: each saved update scored with the current check set (kept in memory) ---- */
const QT=new Map(); let qtBusy=false;
async function qTrend(sig,k){ if(qtBusy||!PER.pid) return; qtBusy=true; const pid=PER.pid; let n=0;
  try{ for(const p of PER.periods.slice()){ const key=p.id+'|'+sig; if(QT.has(key)) continue; const files=await perGetFiles(pid,p); QT.set(key,qScoreFiles(files,k)); n++; await new Promise(r=>setTimeout(r,0)); } }
  catch(e){ console.warn('quality trend',e); } finally{ qtBusy=false; }
  if(n&&S.tab==='per'&&PER.pid===pid) renderPerMain(); }
function qScoreFiles(files,k){ const sf=S.files, sm=M, sr=S.dq.role, ss=S.dq.scope, ctx=DQ.ctx;
  try{ S.files=files; M=buildModel(); S.dq.role='live'; S.dq.scope='all'; Q.noPrev=true; const a=(runQuality(k)||[]).filter(c=>c.status!=='na'), p=a.filter(c=>c.status==='pass').length, w=a.filter(c=>c.status==='warn').length;
    return {p,w,f:a.length-p-w,n:a.length,score:a.length?(p+w*.5)/a.length:null}; }
  finally{ S.files=sf; M=sm; S.dq.role=sr; S.dq.scope=ss; Q.noPrev=false; DQ.ctx=ctx; } }
