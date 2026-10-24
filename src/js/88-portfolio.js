/* ================= Portfolio: programmes and project slots ================= */
const PORT={q:'',status:'all',collapsed:new Set(),sel:new Set()};
const PSTAT={planned:'Planned',active:'Active',on_hold:'On hold',complete:'Complete'};
const PCOL=['#FC4C02','#3B6FE0','#14A37F','#9B5DE5','#D99A00','#E04F8C','#1BA1C4','#6DAA1A'];
const STALE_DAYS=35;
try{ const c=JSON.parse(localStorage.getItem('pacer.port.collapsed')||'[]'); if(Array.isArray(c)) c.forEach(x=>PORT.collapsed.add(x)); }catch(_){}

function portProjectOptions(sel){
  const byP=new Map(); PER.projects.forEach(p=>{ const k=p.programmeId&&PER.programmes.some(g=>g.id===p.programmeId)?p.programmeId:''; if(!byP.has(k)) byP.set(k,[]); byP.get(k).push(p); });
  const opt=p=>`<option value="${esc(p.id)}" ${p.id===sel?'selected':''}>${esc(p.name)}${p.summary?'':' (no schedule yet)'}</option>`;
  let h=''; PER.programmes.forEach(g=>{ const ps=byP.get(g.id); if(ps&&ps.length) h+=`<optgroup label="${esc(g.name)}">${ps.map(opt).join('')}</optgroup>`; });
  const un=byP.get('')||[]; if(un.length) h+=PER.programmes.length?`<optgroup label="Not in a programme">${un.map(opt).join('')}</optgroup>`:un.map(opt).join('');
  return h;
}
// Figures for one project from its summary.
function portFig(p){
  const s=p.summary; if(!s) return {slot:true};
  const day=x=>x==null?null:Math.round(x/DAY);
  const vb=s.finish!=null&&s.blFinish!=null?day(s.finish-s.blFinish):null, mv=s.finish!=null&&s.prevFinish!=null?day(s.finish-s.prevFinish):null;
  const age=s.dd!=null?Math.floor((Date.now()-s.dd)/DAY):null;
  const rag=vb==null?'':vb<=0?'g':vb<=20?'a':'r';
  return {slot:false,s,vb,mv,age,stale:age!=null&&age>STALE_DAYS&&p.status==='active',rag};
}
function portMatch(p){
  if(PORT.status!=='all'&&p.status!==PORT.status) return false;
  const q=PORT.q.trim().toLowerCase(); if(!q) return true;
  const g=PER.programmes.find(x=>x.id===p.programmeId);
  return [p.name,p.code,p.manager,p.description,g&&g.name,g&&g.code,g&&g.client].some(x=>x&&String(x).toLowerCase().includes(q));
}
const portCanEdit=x=>!perRO()&&perCanDel(x&&x.createdBy);
function renderPort(){
  const el=document.getElementById('portWrap'); if(!el||el.hidden) return;
  if(!PER.mode){ el.innerHTML='<div class="card pempty big"><h3>Sign in to see your portfolio</h3><p class="muted">Your programmes, projects and their latest schedule updates appear here once you’re signed in.</p><button class="btn primary" id="portSignIn">Sign in</button></div>'; document.getElementById('portSignIn').onclick=()=>{ if(!document.getElementById('auth')) authStart(); }; return; }
  [...PORT.sel].forEach(id=>{ const p=PER.projects.find(x=>x.id===id); if(!p||!p.summary) PORT.sel.delete(id); });
  const ro=perRO(), G=PER.programmes, P=PER.projects, wsp=PER.mode!=='local'?(PER.space==='team'?(PER.mode==='supa'&&PER.company?PER.company.name:'Team workspace'):'Private workspace'):'This browser';
  const head=`<div class="card porthead">
    <div class="ph-t"><h2>${esc(wsp)}</h2><span class="pspace">${PER.programmes.length} programme${PER.programmes.length===1?'':'s'} · ${PER.projects.length} project${PER.projects.length===1?'':'s'}</span></div>
    <div class="ph-c"><input type="search" id="portQ" placeholder="Search programmes, projects, managers" value="${esc(PORT.q)}" aria-label="Search portfolio">
      <label class="ctl"><span>Status</span><select id="portStatus"><option value="all">All</option>${Object.entries(PSTAT).map(([k,v])=>`<option value="${k}" ${PORT.status===k?'selected':''}>${v}</option>`).join('')}</select></label>
      <span class="pbusy" id="portBusy" ${PER.busy?'':'hidden'}>${esc(PER.busy)}</span>
      ${ro?'':`${!PER.schemaOld&&spMissing()?'<button class="btn sm ghost" data-w data-po="samplemore" title="Adds the sample programmes and fills their empty project slots with schedules">Add sample programmes</button>':''}<button class="btn sm" data-w data-po="addprog" ${PER.schemaOld?'disabled':''}>Add programme</button><button class="btn sm primary" data-w data-po="addproj">Add project</button>`}</div></div>`;
  const old=PER.schemaOld?`<div class="card pwarn portold"><b>One database step left.</b> Programmes need the latest <code>supabase/schema.sql</code>. Open Supabase → SQL Editor → New query, paste the whole file from the GitHub repo and click Run. Projects work in the meantime.</div>`:'';
  if(!P.length&&!G.length){ el.innerHTML=head+old+`<div class="card pempty big"><h3>Build your portfolio</h3><p class="muted">Add a programme, then add a slot for each project in it. A slot holds the project’s name, status and manager until its first schedule update is saved, then shows forecast, variance and progress here. Or load the sample portfolio: four programmes and seven integrated projects with six monthly updates each.</p>
    <div class="prow">${ro?'':`<button class="btn primary" data-w data-po="addprog" ${PER.schemaOld?'disabled':''}>Add a programme</button><button class="btn" data-w data-po="addproj">Add a project slot</button><button class="btn" data-w data-po="sample" ${PER.schemaOld?'disabled':''}>Load sample portfolio</button>`}</div>${ro?'<p class="muted">You have view-only access, so ask an editor to set up programmes.</p>':''}</div>`; perBusy(PER.busy); return; }
  // KPIs over everything (unfiltered)
  const F=P.map(p=>({p,f:portFig(p)})), withS=F.filter(x=>!x.f.slot), slots=F.length-withS.length;
  const behind=withS.filter(x=>x.f.vb!=null&&x.f.vb>0), slipped=withS.filter(x=>x.f.mv!=null&&x.f.mv>0), stale=F.filter(x=>x.p.status==='active'&&(x.f.slot||x.f.stale));
  const worst=behind.slice().sort((a,b)=>b.f.vb-a.f.vb)[0];
  const tiles=`<div class="card stats portstats">
    <div class="stat"><div class="sl">Programmes</div><div class="sv">${G.length}</div><div class="ss">${P.filter(p=>!p.programmeId||!G.some(g=>g.id===p.programmeId)).length} project${P.filter(p=>!p.programmeId||!G.some(g=>g.id===p.programmeId)).length===1?'':'s'} not in one</div></div>
    <div class="stat"><div class="sl">Projects</div><div class="sv">${P.length}</div><div class="ss">${withS.length} with schedules · ${slots} slot${slots===1?'':'s'}</div></div>
    <div class="stat"><div class="sl">Behind baseline</div><div class="sv ${behind.length?'late':''}">${behind.length}</div><div class="ss">of ${withS.filter(x=>x.f.vb!=null).length} with a baseline</div></div>
    <div class="stat"><div class="sl">Worst variance</div><div class="sv ${worst?'late':''}">${worst?dS(worst.f.vb):'—'}</div><div class="ss">${worst?esc(worst.p.name):'nothing behind'}</div></div>
    <div class="stat"><div class="sl">Slipped last period</div><div class="sv ${slipped.length?'late':''}">${slipped.length}</div><div class="ss">forecast finish moved later</div></div>
    <div class="stat"><div class="sl">Updates due</div><div class="sv ${stale.length?'amber':''}">${stale.length}</div><div class="ss">active, none in ${STALE_DAYS} days</div></div></div>`;
  const row=p=>{ const f=portFig(p), s=f.s, can=portCanEdit(p);
    const who=[p.code,p.manager].filter(Boolean).map(esc).join(' · ');
    if(f.slot) return `<div class="prow2 slot" data-pid="${esc(p.id)}">
      <div class="pc-name"><b title="${esc(p.name)}">${esc(p.name)}</b>${who?`<span>${who}</span>`:''}</div>
      <div class="pc-st"><span class="stc ${p.status}">${PSTAT[p.status]||p.status}</span></div>
      <div class="pc-empty"><span class="slotlab">Slot</span> No schedule yet${p.description?` · <span class="muted">${esc(p.description)}</span>`:''}</div>
      <div class="pc-act">${!ro?`<button class="btn sm primary" data-w data-po="upload" data-id="${esc(p.id)}">Add first update</button>`:''}${can?`<button class="btn sm ghost" data-w data-po="editproj" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">Edit</button>`:''}</div></div>`;
    const pa=s.pctA, pp=s.pctP;
    return `<div class="prow2" data-pid="${esc(p.id)}">
      <div class="pc-name"><input type="checkbox" class="psel" data-sel="${esc(p.id)}" ${PORT.sel.has(p.id)?'checked':''} aria-label="Select ${esc(p.name)} to open with others"><i class="rag ${f.rag}" title="${f.rag==='g'?'On or ahead of baseline':f.rag==='a'?'Up to 20 days behind baseline':f.rag==='r'?'More than 20 days behind baseline':'No baseline'}"></i><b title="${esc(p.name)}">${esc(p.name)}</b>${who?`<span>${who}</span>`:''}</div>
      <div class="pc-st"><span class="stc ${p.status}">${PSTAT[p.status]||p.status}</span></div>
      <div class="pc-up"><span class="pl">Latest update</span><b>${fmtD(s.dd)}</b><span class="${f.stale?'amber':'muted'}">${f.stale?f.age+' days ago':esc(s.label||'')}</span></div>
      <div class="pc-fin"><span class="pl">Forecast finish</span><b>${fmtD(s.finish)}</b><span class="muted">BL ${fmtD(s.blFinish)}</span></div>
      <div class="pc-var"><span class="pl">Vs baseline</span><b class="${dCls(f.vb)}">${dS(f.vb)}</b><span class="${dCls(f.mv)}">${f.mv!=null?dS(f.mv)+' this period':'first period'}</span></div>
      <div class="pc-prog"><span class="pl">Progress</span><span class="pbar" title="Actual ${pctS(pa)} · planned ${pctS(pp)}"><i style="width:${Math.max(0,Math.min(100,(pa||0)*100)).toFixed(1)}%"></i>${pp!=null?`<b style="left:${Math.max(0,Math.min(100,pp*100)).toFixed(1)}%"></b>`:''}</span><span class="muted">${pctS(pa)} of ${pctS(pp)} planned</span></div>
      <div class="pc-bei"><span class="pl">BEI</span><b class="${s.bei!=null&&s.bei<.95?'late':''}">${s.bei!=null?(+s.bei).toFixed(2):'—'}</b><span class="muted">${s.count||1} period${(s.count||1)===1?'':'s'}</span></div>
      <div class="pc-act"><button class="btn sm primary" data-w data-po="open" data-id="${esc(p.id)}">Open</button><button class="btn sm" data-po="periods" data-id="${esc(p.id)}">Periods</button>${!ro?`<button class="btn sm ghost" data-w data-po="update" data-id="${esc(p.id)}" title="Update progress and the programme here, or upload this period’s XER files">Update</button>`:''}${can?`<button class="btn sm ghost" data-w data-po="editproj" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">Edit</button>`:''}</div></div>`; };
  const ord=(a,b)=>({active:0,planned:1,on_hold:2,complete:3}[a.status]-{active:0,planned:1,on_hold:2,complete:3}[b.status])||String(a.name).localeCompare(b.name);
  const sect=(g,list,i)=>{ const shown=list.filter(portMatch).sort(ord), F2=list.map(portFig).filter(f=>!f.slot);
    const fin=F2.map(f=>f.s.finish).filter(x=>x!=null), vbs=F2.map(f=>f.vb).filter(x=>x!=null), worstV=vbs.length?Math.max(...vbs):null, rag=worstV==null?'':worstV<=0?'g':worstV<=20?'a':'r';
    const col=g?(g.colour||PCOL[i%PCOL.length]):'var(--ink3)', key=g?g.id:'_none', closed=PORT.collapsed.has(key), can=g&&portCanEdit(g);
    if(PORT.q&&!shown.length&&!(g&&[g.name,g.code,g.client].some(x=>x&&x.toLowerCase().includes(PORT.q.trim().toLowerCase())))) return '';
    return `<section class="card prog${closed?' closed':''}" style="--pc:${col}" data-gid="${esc(key)}">
      <header class="prog-h">
        <button class="prog-tg" data-po="toggle" data-id="${esc(key)}" aria-expanded="${!closed}" aria-label="${closed?'Expand':'Collapse'} ${esc(g?g.name:'Not in a programme')}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>
        <div class="prog-t"><div class="prog-n">${g?esc(g.name):'Not in a programme'}${g&&g.code?`<span class="pcode">${esc(g.code)}</span>`:''}</div>
          <div class="prog-m">${g&&g.client?esc(g.client)+' · ':''}${list.length} project${list.length===1?'':'s'}${list.length-F2.length?` (${list.length-F2.length} slot${list.length-F2.length===1?'':'s'})`:''}${g&&g.description?` · ${esc(g.description)}`:''}</div></div>
        <div class="prog-k"><div><span class="pl">Programme finish</span><b>${fin.length?fmtD(Math.max(...fin)):'—'}</b></div><div><span class="pl">Worst variance</span><b class="${dCls(worstV)}">${dS(worstV)}</b></div><i class="rag ${rag}" aria-hidden="true"></i></div>
        <div class="prog-a">${g&&F2.length>1?`<button class="btn sm primary" data-w data-po="openprog" data-id="${esc(g.id)}" title="Open the latest update of every project in this programme together">Open programme</button>`:''}${!ro&&g?`<button class="btn sm" data-w data-po="addproj" data-g="${esc(g.id)}">Add project</button>`:''}${can?`<button class="btn sm ghost" data-w data-po="editprog" data-id="${esc(g.id)}">Edit</button>`:''}</div>
      </header>
      <div class="prog-b">${shown.length?`<div class="prow2 hd" aria-hidden="true"><div>Project</div><div>Status</div><div>Latest update</div><div>Forecast finish</div><div>Vs baseline</div><div>Progress</div><div>BEI</div><div></div></div>${shown.map(row).join('')}`:`<div class="pempty sm">${list.length?'No projects match the filters.':`No projects yet.${!ro&&g?' Add a project slot to start.':''}`}</div>`}</div></section>`; };
  const un=P.filter(p=>!p.programmeId||!G.some(g=>g.id===p.programmeId));
  const body=G.map((g,i)=>sect(g,P.filter(p=>p.programmeId===g.id),i)).join('')+(un.length?sect(null,un,0):'');
  el.innerHTML=head+old+tiles+`<div class="portlist">${body||'<div class="card pempty">Nothing matches your search.</div>'}</div>
    ${PORT.sel.size?`<div class="selbar card" role="region" aria-label="Selected projects"><b>${PORT.sel.size} project${PORT.sel.size===1?'':'s'} selected</b><span class="muted">${esc([...PORT.sel].map(id=>(PER.projects.find(p=>p.id===id)||{}).name).filter(Boolean).join(', '))}</span><button class="btn sm primary" data-w data-po="opensel">${PORT.sel.size>1?'Open together':'Open'}</button><button class="btn sm" data-po="clearsel">Clear</button></div>`:''}
    <div class="note">Tick projects to open several together, or use Open programme. Rows are coloured by forecast finish against baseline: green on or ahead, amber up to 20 days late, red beyond that. “Updates due” counts active projects with no update in the last ${STALE_DAYS} days.</div>`;
  perBusy(PER.busy);
}

/* ---- dialogs ---- */
function portProgDialog(g){
  const cur=g||{}, cols=PCOL.map(c=>`<label class="swatch" style="--c:${c}"><input type="radio" name="pgCol" value="${c}" ${(cur.colour||PCOL[PER.programmes.length%PCOL.length])===c?'checked':''}><i></i><span class="vh">${c}</span></label>`).join('');
  const d=perDialog(g?'Edit programme':'New programme',`
    <label class="pfl"><span>Programme name</span><input id="pgName" maxlength="120" value="${esc(cur.name||'')}" placeholder="e.g. Northgate Express Rail"></label>
    <div class="pdg"><label class="pfl"><span>Code</span><input id="pgCode" maxlength="20" value="${esc(cur.code||'')}" placeholder="e.g. NXR"></label><label class="pfl"><span>Client</span><input id="pgClient" maxlength="80" value="${esc(cur.client||'')}" placeholder="e.g. Northgate Transit"></label></div>
    <label class="pfl"><span>Description (optional)</span><textarea id="pgDesc" rows="2" maxlength="300">${esc(cur.description||'')}</textarea></label>
    <div class="pfl"><span>Colour</span><div class="swatches">${cols}</div></div>
    ${g&&portCanEdit(g)?`<button class="plink danger" data-del-prog type="button">Delete programme</button>`:''}`,g?'Save':'Create programme',async d=>{
      const name=d.querySelector('#pgName').value.trim(); if(!name){ d.querySelector('[data-err]').textContent='Give the programme a name.'; return false; }
      const f={name,code:d.querySelector('#pgCode').value.trim(),client:d.querySelector('#pgClient').value.trim(),description:d.querySelector('#pgDesc').value.trim(),colour:(d.querySelector('input[name=pgCol]:checked')||{}).value||''};
      await perRun(g?'Saving programme…':'Creating programme…',async()=>{ if(g) await PER.store.updateProgramme(g.id,f); else await PER.store.createProgramme(f); perToast(g?'Programme saved.':`Created “${name}”.`); }); });
  const del=d.querySelector('[data-del-prog]'); if(del) del.onclick=()=>{ const n=PER.projects.filter(p=>p.programmeId===g.id).length; d.remove();
    perDialog('Delete programme?',`<p>This deletes the programme <b>${esc(g.name)}</b>. Its ${n} project${n===1?'':'s'} and their periods are kept and move to “Not in a programme”.</p>`,'Delete programme',async()=>{ await perRun('Deleting programme…',async()=>{ await PER.store.deleteProgramme(g.id); perToast('Programme deleted.'); }); }); };
}
function portProjectDialog(p,o){
  o=o||{}; const cur=p||{status:'active',programmeId:o.programmeId||null}, G=PER.programmes;
  const d=perDialog(p?'Edit project':'New project slot',`
    <label class="pfl"><span>Project name</span><input id="pjName" maxlength="120" value="${esc(cur.name||'')}" placeholder="e.g. Depot & Stabling – Phase 2"></label>
    <div class="pdg"><label class="pfl"><span>Programme</span><select id="pjProg" ${PER.schemaOld?'disabled':''}><option value="">Not in a programme</option>${G.map(g=>`<option value="${esc(g.id)}" ${cur.programmeId===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
      <label class="pfl"><span>Status</span><select id="pjStatus" ${PER.schemaOld?'disabled':''}>${Object.entries(PSTAT).map(([k,v])=>`<option value="${k}" ${cur.status===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
    <div class="pdg"><label class="pfl"><span>Project code</span><input id="pjCode" maxlength="30" value="${esc(cur.code||'')}" placeholder="e.g. NXR-CIV" ${PER.schemaOld?'disabled':''}></label><label class="pfl"><span>Project manager</span><input id="pjMgr" maxlength="80" value="${esc(cur.manager||'')}" ${PER.schemaOld?'disabled':''}></label></div>
    <label class="pfl"><span>Description (optional)</span><textarea id="pjDesc" rows="2" maxlength="300" ${PER.schemaOld?'disabled':''}>${esc(cur.description||'')}</textarea></label>
    ${p?'':`<p class="muted">${PER.mode!=='local'?(PER.space==='team'?'Saved to the team workspace.':'Saved to your private workspace.'):'Saved in this browser.'} The slot fills in once you add its first schedule update.</p>`}
    ${p&&portCanEdit(p)?`<button class="plink danger" data-del-proj type="button">Delete project</button>`:''}`,p?'Save':'Create slot',async d=>{
      const name=d.querySelector('#pjName').value.trim(); if(!name){ d.querySelector('[data-err]').textContent='Give the project a name.'; return false; }
      const f=PER.schemaOld?{name}:{name,programmeId:d.querySelector('#pjProg').value||null,status:d.querySelector('#pjStatus').value,code:d.querySelector('#pjCode').value.trim(),manager:d.querySelector('#pjMgr').value.trim(),description:d.querySelector('#pjDesc').value.trim()};
      await perRun(p?'Saving project…':'Creating slot…',async()=>{ if(p){ await PER.store.updateProject(p.id,f); perToast('Project saved.'); } else { const id=await PER.store.createProject(name,f); perToast(`Added “${name}”.`); if(o.after) o.after(id); } }); });
  const del=d.querySelector('[data-del-proj]'); if(del) del.onclick=()=>{ d.remove(); const n=p.summary?p.summary.count||0:0;
    perDialog('Delete project?',`<p>This permanently deletes <b>${esc(p.name)}</b>${n?` and its ${n} saved period${n===1?'':'s'}`:''} for everyone. This can’t be undone.</p>`,'Delete project',async()=>{ await perRun('Deleting project…',async()=>{ await perDeleteProject(p); if(PER.pid===p.id) PER.pid=null; perToast('Project deleted.'); }); }); };
}

/* ---- actions ---- */
async function portOpen(pid,keep){
  const p=PER.projects.find(x=>x.id===pid); if(!p) return;
  let list; try{ list=await PER.store.listPeriods(pid); }catch(e){ perToast(perErr(e),'err'); return; }
  const sm=perSummary(list); if(!sm){ perToast('This project has no saved periods yet.','err'); return; }
  const per=list.find(x=>x.id===sm.periodId); perPick(pid); await perLoad(per,pid); if(!keep||S.tab==='port'||S.tab==='per') setTab('dash'); else renderMeta();
}
// Open the latest update of several projects together, e.g. a whole programme.
async function portOpenMany(pids,o){
  o=o||{}; pids=[...new Set(pids)].filter(id=>{ const p=PER.projects.find(x=>x.id===id); return p&&p.summary; });
  if(!pids.length){ perToast('None of those projects has a saved update yet.','err'); return; }
  if(pids.length===1&&!o.all){ await portOpen(pids[0],o.keep); return; }
  await perRun(`Opening ${pids.length} projects…`,async()=>{
    const files=[], items=[]; let i=0;
    for(const pid of pids){ i++; const p=PER.projects.find(x=>x.id===pid); perBusy(`Opening ${p.name} (${i} of ${pids.length})…`);
      const list=await PER.store.listPeriods(pid), sm=perSummary(list); if(!sm) continue;
      const per=list.find(x=>x.id===sm.periodId); files.push(...await perGetFiles(pid,per)); items.push({pid,id:per.id,label:per.label,dd:per.dd}); }
    S.files=files; S.match='proj'; if(typeof B!=='undefined'&&B.st&&B.st.sync){ B.st.sync=false; bSave(); }
    const nxr=files.some(f=>/^NXR-(CIV|SYS)/.test(f.name)); if(S.site.sample&&!nxr) S.site={marks:[],profile:[]}; else if(nxr&&!S.site.marks.length&&!S.site.profile.length) S.site=sampleSite();
    PER.loaded={multi:true,all:!!o.all,pid:items[0].pid,ids:items.map(x=>x.id),items,label:`${items.length} projects`};
    PER.pid=items[0].pid; perPick(items[0].pid);
    rebuild(true); perToast(`Opened ${items.length} projects together.`); });
  PORT.sel.clear(); if(!o.keep||S.tab==='port'||S.tab==='per') setTab('dash'); else renderMeta();
}
function portOpenProgramme(gid,keep){ const ids=PER.projects.filter(p=>p.programmeId===gid&&p.summary).map(p=>p.id); portOpenMany(ids,{all:true,keep}); }
function portUpload(pid){
  const inp=document.createElement('input'); inp.type='file'; inp.multiple=true; inp.accept='.xer,.XER';
  inp.onchange=async()=>{ const list=[...inp.files]; if(!list.length) return;
    S.files=[]; PER.loaded=null; await addFiles(list); perPick(pid);
    const ok=S.files.filter(f=>!f.error);
    if(!ok.some(f=>f.role==='live')){ perToast('None of those files could be read as a live schedule.','err'); return; }
    perToast(ok.some(f=>f.role==='baseline')?'Files loaded. Check the roles, then save the period.':'Loaded with no baseline. To compare against one, cancel, open Schedule files from the header menu and set a file’s role to Baseline.');
    setTimeout(perAskSave,150); };
  inp.click();
}
async function portSample(){
  await perRun('Building sample portfolio…',async()=>{
    const g1=await PER.store.createProgramme({name:SP_DEFS.NXR.name,code:'NXR',client:SP_DEFS.NXR.client,description:SP_DEFS.NXR.desc,colour:SP_DEFS.NXR.colour});
    const pid=await PER.store.createProject('Civils & Systems',{programmeId:g1,code:'NXR-CS',status:'active',manager:'A. Patel',description:'Main works contract'});
    perPick(pid); perBusy('Building Northgate Express Rail · Civils & Systems…'); await perSampleInto(pid);
    const n=await spPopulate({NXR:g1});
    perToast(`Sample portfolio ready: four programmes, ${n+1} projects, six monthly updates each.`); });
}
function wirePort(){
  addEventListener('beforeunload',e=>{ if(PER.busy){ e.preventDefault(); e.returnValue='Saving is still in progress. Leave anyway?'; return e.returnValue; } });
  const w=document.getElementById('portWrap');
  w.addEventListener('input',e=>{ if(e.target.id==='portQ'){ PORT.q=e.target.value; const pos=e.target.selectionStart; renderPort(); const q=document.getElementById('portQ'); if(q){ q.focus(); try{ q.setSelectionRange(pos,pos); }catch(_){} } } });
  w.addEventListener('change',e=>{ if(e.target.id==='portStatus'){ PORT.status=e.target.value; renderPort(); }
    else if(e.target.dataset.sel){ const id=e.target.dataset.sel; e.target.checked?PORT.sel.add(id):PORT.sel.delete(id); const y=scrollY; renderPort(); scrollTo(0,y); } });
  w.addEventListener('click',e=>{
    const b=e.target.closest('[data-po]'); if(!b) return; const v=b.dataset.po, id=b.dataset.id;
    if(v==='addprog') portProgDialog(null);
    else if(v==='addproj') portProjectDialog(null,{programmeId:b.dataset.g||null});
    else if(v==='editprog') portProgDialog(PER.programmes.find(g=>g.id===id));
    else if(v==='editproj') portProjectDialog(PER.projects.find(p=>p.id===id));
    else if(v==='open') portOpen(id);
    else if(v==='periods'){ perPick(id); setTab('per'); }
    else if(v==='upload') portUpload(id);
    else if(v==='update') portUpdateChoice(id);
    else if(v==='sample') portSample();
    else if(v==='samplemore') portSampleMore();
    else if(v==='openprog') portOpenProgramme(id);
    else if(v==='opensel') portOpenMany([...PORT.sel]);
    else if(v==='clearsel'){ PORT.sel.clear(); renderPort(); }
    else if(v==='toggle'){ PORT.collapsed.has(id)?PORT.collapsed.delete(id):PORT.collapsed.add(id); try{ localStorage.setItem('pacer.port.collapsed',JSON.stringify([...PORT.collapsed])); }catch(_){} renderPort(); }
  });
}

