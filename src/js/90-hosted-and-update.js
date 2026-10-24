(function(){
  if(typeof window==='undefined'||window.claude||!window.SW_CONFIG) return;
  const C=window.SW_CONFIG;
  const downloads={save:async({filename,data})=>{ const b=data instanceof Blob?data:new Blob([data]); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); return {status:'saved'}; }};
  const sample=C.ai!==false&&supaOn()?makeHostedSample(C):null;
  window.claude={use:async n=>n==='downloads'?downloads:n==='sample'?sample:null,hosted:true};
})();

/* ================= Live schedule update (statusing + programme edits, saved as the next period) ================= */
// The update session lives on the builder state as st.upd, so it survives a page reload with the rest of the Build tab.
const updPad=n=>String(n).padStart(2,'0');
function updNextNo(list,per){ const m=/update\s*0*(\d+)/i.exec(per&&per.label||''); return m?+m[1]+1:list.length+1; }
function updDdTag(d){ const x=new Date(d*DAY); return updPad(x.getUTCDate())+MON[x.getUTCMonth()]+String(x.getUTCFullYear()).slice(2); }
const updProg=a=>[a.as,a.af,a.rem,a.pct];
function updTouched(u,a){ const p=u.p0[a.id]; if(!p) return true; const q=updProg(a); return q.some((v,i)=>(v??null)!==(p[i]??null)); }
// Due this period: not complete at the last update and forecast (at that update) to start before the new data date.
function updDue(u,a,dd){ const f=u.f0[a.id]; return !!f&&f[2]!=='cp'&&f[0]<dd; }
function updNeeds(a){ const st=B.st, u=st&&st.upd; return !!u&&updDue(u,a,st.dd)&&!updTouched(u,a); }
function updStats(){
  const st=B.st, u=st.upd, dd=st.dd, ids=new Set(st.acts.map(a=>a.id)); let due=0, done=0, needs=0, comp=0, started=0, added=0;
  st.acts.forEach(a=>{ const p=u.p0[a.id]; if(!p){ added++; return; }
    if(updDue(u,a,dd)){ due++; if(updTouched(u,a)) done++; else needs++; }
    if(a.af!=null&&p[1]==null) comp++; if(a.as!=null&&p[0]==null) started++; });
  const deleted=Object.keys(u.p0).filter(id=>!ids.has(id)).length;
  const fin=B.res.finish, mv=fin!=null&&u.prevFinish!=null?fin-u.prevFinish:null;
  const bl=st.baseline?Object.values(st.baseline.R).reduce((m,x)=>Math.max(m,x.ef),-Infinity):null, vb=fin!=null&&bl!=null&&isFinite(bl)?fin-bl:null;
  const c=bCostTot(st.acts);
  return {due,done,needs,comp,started,added,deleted,fin,mv,vb,crit:B.res.crit,loops:B.res.loops.length,cost:c.n||u.costs?{spent:c.ac-(u.ac0||0),eac:c.eac,dEac:c.eac-(u.eac0||0),bc:c.bc}:null};
}

async function updStart(pid){
  if(!PER.mode) return perToast('Sign in to update a saved schedule.','err');
  if(perRO()) return perToast('You have view-only access. Ask an editor or admin to update this schedule.','err');
  const p=PER.projects.find(x=>x.id===pid); if(!p) return;
  let list; try{ list=await PER.store.listPeriods(pid); }catch(e){ return perToast(perErr(e),'err'); }
  const sm=perSummary(list); if(!sm) return perToast('This project has no saved update yet. Add its first update from P6 XER files.','err');
  const per=list.find(x=>x.id===sm.periodId), u0=B.st&&B.st.upd;
  if(u0&&u0.pid===pid&&u0.perId===per.id){ setTab('build'); perToast('Carrying on with the update you started.'); return; }
  const prevDD=per.dd!=null?dayOf(per.dd):dayOf(Date.now()), n=updNextNo(list,per);
  const warn=u0?`<p class="pwarn">You have an unsaved update of ${esc(u0.projName)} open. Starting this one discards it.</p>`:B.st?'<p class="pwarn">This replaces the schedule open in the Build tab. Save it as a builder file first if you need it.</p>':'';
  perDialog(`Update ${p.name}`,`<div class="pdg"><div><div class="sl">Last update</div><b>${esc(per.label)}</b></div><div><div class="sl">Its data date</div><b>${fmtL(per.dd)}</b></div></div>
    <label class="pfl" style="margin-top:12px"><span>New data date</span><input type="date" id="udDD" value="${isoD(prevDD+28)}" min="${isoD(prevDD+1)}"></label>
    <div class="sl" style="margin-top:14px">Progress</div>
    <label class="uopt"><input type="radio" name="udP" value="none" checked><span><b>I’ll enter progress</b> Activities due this period are listed for you to enter actual dates, % complete and remaining durations. Anything left unstatused moves to the new data date.</span></label>
    <label class="uopt"><input type="radio" name="udP" value="plan"><span><b>Start from planned progress</b> Progress every activity as the last update forecast, up to the new data date. Then correct the ones that didn’t go to plan.</span></label>
    <p class="muted" style="margin:10px 0 0">You can also change durations, logic and constraints, and add or delete activities. Saving makes this the project’s next update, with the same baseline.</p>${warn}`,'Start update',async d=>{
    const v=parseDay(d.querySelector('#udDD').value);
    if(v==null||v<=prevDD){ d.querySelector('[data-err]').textContent=`Pick a date after ${fmtL(per.dd)}.`; return false; }
    const plan=d.querySelector('[name=udP]:checked').value==='plan';
    setTimeout(async()=>{ perPick(pid); await perLoad(per,pid); if(!PER.loaded||PER.loaded.id!==per.id) return; updBegin(p,per,n,v,plan); },0); });
}
function updBegin(p,per,n,newDD,plan){
  const st=bModelState(), res0=bCompute(st), f0={}, p0={};
  st.acts.forEach(a=>{ const r=res0.R.get(a.id); if(r) f0[a.id]=[r.status==='ip'?r.rs:r.es,a.type==='start'?r.es:r.ef,r.status,r.es,r.rem]; p0[a.id]=updProg(a);
    (a.asg||[]).forEach(x=>{ x.u0=[x.au,x.ru,x.ac,x.rc]; x.man=false; }); (a.exp||[]).forEach(x=>{ x.u0=[x.ac,x.rc]; x.man=false; }); });
  const c0=bCostTot(st.acts);
  st.upd={pid:p.id,perId:per.id,perLabel:per.label,projName:p.name,prevDD:st.dd,n,baseRefs:(per.files||[]).filter(f=>f.role==='baseline').map(f=>({h:f.h,name:f.name,role:f.role})),
    liveNames:(per.files||[]).filter(f=>f.role==='live').map(f=>f.name),liveRefs:(per.files||[]).filter(f=>f.role==='live').map(f=>({h:f.h,name:f.name,role:f.role})),ac0:c0.ac,eac0:c0.eac,costs:c0.n>0,f0,p0,prevFinish:res0.finish,view:'due',startedAt:Date.now()};
  st.name=`${p.name} · Update ${updPad(n)}`; st.dd=newDD; st.sync=false;
  st.finMsAm=[...M.live.acts.values()].some(a=>a.type==='TT_FinMile'&&a.f!=null&&(a.f%DAY)<=8*HR); // keep the source files' finish-milestone time convention
  const k=plan?updPlanned(st):0;
  B.st=st; B.undo=[]; B.redo=[]; B.t0=0; B.sel={r:0,c:'as'}; B.collapsed=new Set(); B.res=bCompute(st);
  setTab('build'); if(!document.getElementById('bGrid')) bShell(); bChanged();
  const pt=document.getElementById('perToast'); if(pt) pt.className='ptoast';
  bToastMsg(plan?`Progressed ${k} activit${k===1?'y':'ies'} as planned to ${fmtL(newDD*DAY)}. Correct any that didn’t go to plan.`:`Enter progress up to ${fmtL(newDD*DAY)}. Activities due this period are listed; use All activities to edit the rest of the programme.`);
}
// Progress untouched activities exactly as the last update forecast them, up to the data date.
function updPlanned(st){
  const u=st.upd, dd=st.dd, res=bCompute(st); let n=0;
  st.acts.forEach(a=>{ const f=u.f0[a.id]; if(!f||f[2]==='cp'||bStatus(a)==='cp'||updTouched(u,a)) return; const [es,ef]=f;
    if(a.type==='start'){ if(es<dd){ a.as=a.af=es; a.rem=null; a.pct=null; n++; } return; }
    if(a.type==='finish'){ if(ef<dd){ a.af=ef; a.as=ef+1; a.rem=null; a.pct=null; n++; } return; }
    const s=a.as!=null?a.as:es; if(s>=dd) return; a.as=s;
    if(ef<dd){ a.af=Math.max(ef,s); a.rem=null; a.pct=100; }
    else { const c=res.calOf(a), rem=Math.max(1,c.count(dd,ef)), D=bDur(a)||1; a.af=null; a.rem=rem; a.pct=Math.max(0,Math.min(99,Math.round((1-rem/D)*100))); }
    n++; });
  return n;
}
function updRenderBar(){
  const el=document.getElementById('bUpd'); if(!el) return; const st=B.st, u=st&&st.upd;
  const useB=document.getElementById('bUse'), capB=document.querySelector('[data-ba="base"]');
  if(useB) useB.textContent=u?'Preview in Workbench':'Use in Workbench'; if(capB) capB.hidden=!!u;
  if(!u){ el.hidden=true; el.innerHTML=''; return; }
  const s=updStats(), fin=s.fin!=null?fmtL(s.fin*DAY):'—';
  el.hidden=false;
  el.innerHTML=`<div class="bu-h"><span class="sl">Updating</span><b>${esc(u.projName)}</b><span class="muted">from ${esc(u.perLabel)} · data date ${fmtL(u.prevDD*DAY)} → <b>${fmtL(st.dd*DAY)}</b></span></div>
    <div class="sg" role="group" aria-label="Show"><button data-uv="due" class="${u.view==='due'?'on':''}" aria-pressed="${u.view==='due'}">Due this period · ${s.due}</button><button data-uv="all" class="${u.view==='all'?'on':''}" aria-pressed="${u.view==='all'}">All activities</button></div>
    <button class="btn sm" data-ua="plan" title="Progress every activity you haven’t touched as the last update forecast, up to the data date" ${s.needs?'':'disabled'}>Status the rest as planned</button>
    <span class="bu-s"><span><b>${s.done}</b> of ${s.due} statused${s.needs?` · <span class="amber">${s.needs} to do</span>`:''}</span><span><b>${s.comp}</b> finished · <b>${s.started}</b> started</span>
      <span>Finish <b>${fin}</b>${s.mv!=null?` <em class="${dCls(s.mv)}">${s.mv===0?'no change':dS(s.mv)+' vs last update'}</em>`:''}${s.vb!=null?` <em class="${dCls(s.vb)}">${dS(s.vb)} vs baseline</em>`:''}</span>
      ${s.cost?`<span>Spent this period <b>${moneyK(s.cost.spent)}</b> · at completion <b>${moneyK(s.cost.eac)}</b>${Math.round(s.cost.dEac)?` <em class="${dCls(Math.round(s.cost.dEac))}">${s.cost.dEac>0?'+':'−'}${moneyK(Math.abs(s.cost.dEac))} vs last update</em>`:''}</span>`:''}
      ${s.added||s.deleted?`<span>${s.added?`<b>${s.added}</b> added`:''}${s.added&&s.deleted?' · ':''}${s.deleted?`<b>${s.deleted}</b> deleted`:''}</span>`:''}</span>
    <span class="bsp"></span><button class="btn sm ghost" data-ua="discard">Discard</button><button class="btn sm primary" data-ua="save">Save as Update ${updPad(u.n)}</button>`;
}
function updWireBar(){
  const el=document.getElementById('bUpd'); if(!el) return;
  el.addEventListener('click',e=>{ const v=e.target.closest('[data-uv]'), a=e.target.closest('[data-ua]'); const u=B.st&&B.st.upd; if(!u) return;
    if(v){ u.view=v.dataset.uv; B.sel={r:0,c:B.sel.c}; bSave(); bRenderAll(); return; }
    if(!a) return;
    if(a.dataset.ua==='plan'){ bPush(); const k=updPlanned(B.st); bChanged(); bToastMsg(k?`Progressed ${k} activit${k===1?'y':'ies'} as planned. Ctrl+Z undoes it.`:'Nothing left to progress as planned.'); }
    else if(a.dataset.ua==='save') updSave();
    else if(a.dataset.ua==='discard') updDiscard(); });
}
function updDiscard(){
  const u=B.st.upd;
  perDialog('Discard this update?',`<p>Your progress and edits to ${esc(u.projName)} haven’t been saved. Discarding them leaves ${esc(u.perLabel)} as the latest update.</p>`,'Discard update',async()=>{
    const preview=S.files.some(f=>f.builder); B.st=null; B.undo=[]; B.redo=[]; try{ localStorage.removeItem('pacer.builder'); }catch(_){} document.getElementById('buildWrap').innerHTML=''; renderBuild();
    if(preview&&PER.store){ try{ const per=(await PER.store.listPeriods(u.pid)).find(x=>x.id===u.perId); if(per){ perPick(u.pid); await perLoad(per,u.pid); } }catch(_){} }
    perToast('Update discarded.'); });
}
function updSave(){
  const st=B.st, u=st.upd;
  if(!PER.mode||!PER.store) return bToastMsg('Sign in to save this update.');
  if(perRO()) return bToastMsg('You have view-only access, so this update can’t be saved.');
  if(!PER.projects.some(p=>p.id===u.pid)) return bToastMsg(`${u.projName} isn’t in this workspace. Switch workspace from the account menu, then save.`);
  if(B.res.loops.length) return bToastMsg('Fix the loop in the logic first.');
  if(st.dd<=u.prevDD) return bToastMsg(`Set a data date after ${fmtL(u.prevDD*DAY)} first.`);
  const s=updStats(), dd=st.dd*DAY, later=PER.pid===u.pid?PER.periods.filter(p=>p.dd!=null&&p.dd>=dd):[], newer=PER.pid===u.pid?PER.periods.filter(p=>p.dd!=null&&dayOf(p.dd)>u.prevDD&&p.id!==u.perId):[];
  const bad=st.acts.filter(a=>(a.as!=null&&a.as>st.dd)||(a.af!=null&&a.af>st.dd)).map(a=>a.code);
  if(bad.length) return bToastMsg(`Actual dates must be on or before the data date: ${bad.slice(0,6).join(', ')}${bad.length>6?'…':''}.`);
  perDialog(`Save Update ${updPad(u.n)}`,`<label class="pfl"><span>Period name</span><input id="udLab" maxlength="80" value="${esc(`Update ${updPad(u.n)} · ${fmtL(dd)}`)}"></label>
    <div class="pdg"><div><div class="sl">Data date</div><b>${fmtL(dd)}</b></div><div><div class="sl">Forecast finish</div><b>${s.fin!=null?fmtL(s.fin*DAY):'—'}</b> ${s.mv!=null?`<span class="${dCls(s.mv)}">${s.mv===0?'no change':dS(s.mv)}</span>`:''}</div>
      <div><div class="sl">This period</div><b>${s.comp}</b> finished · <b>${s.started}</b> started</div><div><div class="sl">Programme changes</div>${s.added||s.deleted?`<b>${s.added}</b> added · <b>${s.deleted}</b> deleted`:'none added or deleted'}</div>
      ${s.cost?`<div><div class="sl">Spent this period</div><b>${moneyK(s.cost.spent)}</b></div><div><div class="sl">Cost at completion</div><b>${moneyK(s.cost.eac)}</b> ${Math.round(s.cost.dEac)?`<span class="${dCls(Math.round(s.cost.dEac))}">${s.cost.dEac>0?'+':'−'}${moneyK(Math.abs(s.cost.dEac))}</span>`:''}</div>`:''}</div>
    ${s.needs?`<p class="pwarn">${s.needs} activit${s.needs===1?'y was':'ies were'} due this period with no progress entered. ${s.needs===1?'It moves':'They move'} to the new data date.</p>`:''}
    ${newer.length?`<p class="pwarn">${esc(newer[newer.length-1].label)} was saved after the update you started from. Saving still adds this as a new period.</p>`:''}
    ${later.length&&!newer.length?`<p class="pwarn">A period with this data date or later already exists.</p>`:''}
    <label class="pfl" style="margin-top:12px"><span>Notes (optional)</span><textarea id="udNotes" rows="2" maxlength="600" placeholder="e.g. Piling restarted after the utility diversion"></textarea></label>${narFields({})}
    <p class="muted" style="margin:10px 0 0">The new live XER${st.projects.length>1?'s are':' is'} written from last period’s file${st.projects.length>1?'s':''}: progress, dates, logic, resources, costs and notes are updated, and everything else in P6 (calendars, cost accounts, roles, steps, user fields and the rest) is kept as it was. The baseline is unchanged.</p>`,'Save update',async d=>{
    const label=d.querySelector('#udLab').value.trim()||`Update ${updPad(u.n)}`, notes=d.querySelector('#udNotes').value.trim(), narrative=narRead(d);
    setTimeout(()=>updCommit(label,notes,narrative),0); });
}
async function updCommit(label,notes,narrative){
  const st=B.st, u=st.upd; let saved=null;
  await perRun('Saving update…',async()=>{
    if(PER.pid!==u.pid){ perPick(u.pid); }
    if(!PER.periods.length){ const list=await PER.store.listPeriods(u.pid); PER.periods=list.sort((a,b)=>(a.dd||0)-(b.dd||0)||(a.savedAt||0)-(b.savedAt||0)); }
    const base=await perGetFiles(u.pid,{id:u.perId,files:u.baseRefs});
    const nm=n=>{ const b=n.replace(/\.xer$/i,''), m=/^(.*?)_UP\d+_[^_]*$/i.exec(b); return `${m?m[1]:b}_UP${updPad(u.n)}_${updDdTag(st.dd)}.xer`; };
    const srcLive=u.liveRefs&&u.liveRefs.length?await perGetFiles(u.pid,{id:u.perId,files:u.liveRefs}):[];
    const patched=srcLive.length?updPatch(st,B.res,srcLive):[], covered=new Set(st.projects.filter(p=>patched.some(f=>(f.tables.PROJECT||[]).some(r=>r.proj_short_name===p.short))).map(p=>p.short));
    const extra=bToXer(st,B.res,'live').filter(f=>!covered.has(f.name.replace(/_Live\.xer$/,''))).map(f=>({name:f.name.replace(/_Live\.xer$/,'.xer'),tables:parseXER(f.text)}));
    const live=patched.concat(extra).map(f=>({id:uid(),name:nm(f.name),role:'live',tables:f.tables,info:fileInfo(f.tables)}));
    const files=live.concat(base.map(f=>({...f,role:'baseline'})));
    const id=await perSavePeriod(u.pid,files,{label,notes:notes||`Updated in the workbench from ${u.perLabel}`,narrative});
    S.files=files.map(f=>({...f,period:id})); PER.loaded={pid:u.pid,id,label}; saved={id,label};
    B.st=null; B.undo=[]; B.redo=[]; try{ localStorage.removeItem('pacer.builder'); }catch(_){} document.getElementById('buildWrap').innerHTML='';
    rebuild(true); });
  if(!saved) return;
  renderBuild(); renderMeta(); setTab('per'); perToast(`Saved “${saved.label}” as the latest update of ${u.projName}.`);
}
function portUpdateChoice(pid){
  const p=PER.projects.find(x=>x.id===pid); if(!p) return;
  perDialog(`Update ${p.name}`,`<label class="uopt"><input type="radio" name="ucM" value="edit" checked><span><b>Update it here</b> Set a new data date, enter progress and change the programme in the workbench.</span></label>
    <label class="uopt"><input type="radio" name="ucM" value="xer"><span><b>Upload XER files</b> Use an update you’ve already done in P6.</span></label>`,'Continue',d=>{
    const v=d.querySelector('[name=ucM]:checked').value; setTimeout(()=>v==='edit'?updStart(pid):portUpload(pid),0); });
}

