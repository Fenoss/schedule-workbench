/* ---------------- column chooser ---------------- */
function renderColPanel(){ renderShown(); renderAvail(''); }
function renderShown(){
  const el=document.getElementById('cpShown'), cols=gCols();
  el.innerHTML=cols.length?cols.map((c,i)=>`<div class="cprow"><span class="cpl" title="${esc(c.label)}">${esc(c.label)}</span><span class="cpg">${esc(c.group.replace(' activity fields',''))}</span>
    <button data-up="${esc(c.id)}" aria-label="Move ${esc(c.label)} up" ${i?'':'disabled'}>↑</button><button data-down="${esc(c.id)}" aria-label="Move ${esc(c.label)} down" ${i<cols.length-1?'':'disabled'}>↓</button><button data-del="${esc(c.id)}" aria-label="Hide ${esc(c.label)}">×</button></div>`).join('')
    :'<div class="muted" style="font-size:13px;padding:6px 0">No columns shown. Pick some from the list.</div>';
  const b=document.querySelector('#cCols .cbadge'); if(b) b.textContent=cols.length;
}
function renderAvail(q){
  q=(q||'').trim().toLowerCase(); const el=document.getElementById('cpAvail'), groups=new Map();
  availableCols().forEach(c=>{ if(q&&!(c.label.toLowerCase().includes(q)||(c.field||'').includes(q))) return; if(!groups.has(c.group)) groups.set(c.group,[]); groups.get(c.group).push(c); });
  el.innerHTML=[...groups].map(([g,cs])=>`<div class="cpgh">${esc(g)} <em>${cs.length}</em></div>`+cs.map(c=>`<button class="cpa${S.cols.includes(c.id)?' on':''}" data-add="${esc(c.id)}" title="${esc(c.field?c.field:c.label)}"><span class="bx"></span><span class="cpl">${esc(c.label)}</span>${c.field?`<code>${esc(c.field)}</code>`:''}</button>`).join('')).join('')
    ||'<div class="muted" style="font-size:13px;padding:8px 0">No fields match.</div>';
}

/* ---------------- orchestration ---------------- */
function redraw(){ if(S.tab==='gantt') drawGantt(); else if(S.tab==='tld') drawTLD(); else if(S.tab==='dq') renderDQ(); else if(S.tab==='exec') renderExec(); else if(S.tab==='ifc') renderIfc(); else if(S.tab==='ai') renderAi(); else if(S.tab==='build') renderBuild(); else if(S.tab==='per') renderPer(); else if(S.tab==='port') renderPort(); else if(S.tab==='admin') renderAdmin(); else renderDash(); }
function applyFilters(){ S.rows=filtered(); buildItems(); renderLegend(); updateBadge(); if(S.tab==='tld') T.view=null; redraw(); }
function pickTldDefaults(){
  const u=M.udfs; const sU=u.find(x=>/chain|km|mile|station|loc|ch\b/i.test(x)&&/start|from|begin/i.test(x))||u.find(x=>/start|from/i.test(x));
  const eU=u.find(x=>/chain|km|mile|station|loc|ch\b/i.test(x)&&/end|to|finish/i.test(x))||u.find(x=>/end|finish/i.test(x));
  const locT=M.codeTypes.find(t=>/loc|segment|area|zone|section|chain|station/i.test(t))||M.codeTypes[0]||'';
  const lab=(sU||u[0]||'').toLowerCase(); if(!S.tld._unitSet) S.tld.inUnit=/\(m\)|metre|meter|\bm\b/.test(lab)?'m':/mile|\bmi\b/.test(lab)?'mi':/\bft\b|feet|station/.test(lab)?'ft':'km';
  if(S.tld.mapType&&!M.codeTypes.includes(S.tld.mapType)) S.tld.mapType=''; if(!S.tld.mapType) S.tld.mapType=locT;
  if(S.tld.overlay&&!M.codeTypes.includes(S.tld.overlay)) S.tld.overlay='';
  if(!S.tld.udfS||!u.includes(S.tld.udfS)) S.tld.udfS=sU||u[0]||'';
  if(!S.tld.udfE||!u.includes(S.tld.udfE)) S.tld.udfE=eU||S.tld.udfS;
  if(!S.tld.locType||!M.codeTypes.includes(S.tld.locType)) S.tld.locType=locT;
  if(!(S.tld.src==='udf'&&S.tld.udfS)&&S.tld.src!=='map'&&S.tld.src!=='name') S.tld.src=sU?'udf':locT?'map':(u.length?'udf':'name');
  if(S.tld.src==='map') ensureMap(S.tld.mapType);
  const disc=M.codeTypes.find(t=>/disc|trade|work ?type|package|resp|contractor/i.test(t));
  if(S.tld.colorBy.startsWith('code:')&&!M.codeTypes.includes(S.tld.colorBy.slice(5))) S.tld.colorBy='crit';
  if(S.tld.colorBy==='crit'&&disc&&!S.tld._set) S.tld.colorBy='code:'+disc;
  if(S.colorBy.startsWith('code:')&&!M.codeTypes.includes(S.colorBy.slice(5))) S.colorBy='crit';
  if(S.group.startsWith('code:')&&!M.codeTypes.includes(S.group.slice(5))) S.group='wbs';
}
// Header: which schedule is open (programme / project / period), with a switcher.
function ctxInfo(){
  const ok=S.files.filter(f=>!f.error&&f.role!=='off'), hasP=typeof PER!=='undefined';
  const pf=ok.find(f=>f.period), LD=hasP?PER.loaded:null;
  const L=LD&&pf?(LD.multi?(ok.every(f=>!f.period||LD.ids.includes(f.period))?LD:null):(LD.id===pf.period?LD:null)):null;
  let proj=null, prog=null;
  if(L&&L.multi){ const gs=[...new Set(L.items.map(i=>(PER.projects.find(p=>p.id===i.pid)||{}).programmeId))]; prog=gs.length===1&&gs[0]?PER.programmes.find(g=>g.id===gs[0])||null:null; }
  else if(L){ proj=PER.projects.find(p=>p.id===L.pid)||null; prog=proj&&PER.programmes.find(g=>g.id===proj.programmeId); }
  return {ok,L,proj,prog,sample:ok.some(f=>f.sample),built:ok.some(f=>f.builder)};
}
function renderMeta(){
  const el=document.getElementById('meta'); if(!el) return;
  const {ok,L,proj,prog,sample,built}=ctxInfo();
  let t1, t2=[];
  if(!ok.length){ t1='<b>Select Schedule</b>'; t2.push('Pick a project or add XER files'); }
  else {
    if(L&&L.multi) t1=(prog?`<span class="cx-g">${esc(prog.name)}</span><span class="cx-s" aria-hidden="true">/</span>`:'')+`<b>${L.all&&prog?'All projects':L.items.length+' projects'}</b><span class="pill">Combined</span>`;
    else if(L) t1=(prog?`<span class="cx-g">${esc(prog.name)}</span><span class="cx-s" aria-hidden="true">/</span>`:'')+`<b>${esc(proj?proj.name:'Saved project')}</b>`;
    else t1=`<b>${sample?'Sample schedule':built?'Schedule built here':'Unsaved schedule'}</b>`;
    const dd=M&&M.dd!=null?fmtL(M.dd):null;
    if(L&&L.multi){ const ds=L.items.map(i=>i.dd).filter(x=>x!=null), lo=Math.min(...ds), hi=Math.max(...ds); t2.push(esc(L.items.map(i=>(PER.projects.find(p=>p.id===i.pid)||{}).name||'').join(', '))); if(ds.length&&lo!==hi) t2.push(`Data dates ${fmtD(lo)}–${fmtD(hi)}`); }
    else if(L) t2.push(esc(L.label)); else t2.push(`${ok.length} file${ok.length===1?'':'s'}${sample||built?'':' · not saved'}`);
    if(dd&&!(L&&!L.multi&&String(L.label).includes(dd))&&!(L&&L.multi&&L.items.some(i=>i.dd!==L.items[0].dd))) t2.push('Data date '+(M?fmtD(M.dd):''));
    if(M&&M.base&&M.base.acts.size&&M.bdd!=null) t2.push('Baseline '+fmtD(M.bdd));
  }
  el.innerHTML=`<span class="cx-t"><span class="cx-1">${t1}</span><span class="cx-2">${t2.join(' · ')}</span></span><svg class="cx-c" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
  el.setAttribute('aria-label','Open schedule: '+el.textContent.replace(/\s+/g,' ').trim()+'. Switch project');
  el.title='Switch project';
  const np=document.getElementById('navProjName'); if(np){ const c=ctxInfo(); np.textContent=!c.ok.length||!c.L?'':c.L.multi?(c.prog?c.prog.name:c.L.items.length+' projects'):(c.proj?c.proj.name:c.L.label); }
  if(typeof aiCtxLabel==='function') aiCtxLabel();
  const m=document.getElementById('ctxMenu'); if(m&&!m.hidden) renderCtxMenu();
}
function renderCtxMenu(){
  const m=document.getElementById('ctxMenu'); if(!m) return;
  const {ok,L}=ctxInfo(), signed=typeof PER!=='undefined'&&PER.mode, q=(m.dataset.q||'').toLowerCase();
  let list='';
  if(!signed) list='<div class="cxm-e">Sign in to open your saved projects.</div>';
  else if(!PER.projects.length) list='<div class="cxm-e">No saved projects yet. Add one on the Portfolio page.</div>';
  else {
    const item=p=>{ const s=p.summary, cur=L&&(L.multi?L.items.some(i=>i.pid===p.id):L.pid===p.id); return `<button class="cxm-i${cur?' cur':''}" data-cx="${esc(p.id)}" ${s?'':'disabled'}><span class="cxm-n">${esc(p.name)}${cur?' <em>Open</em>':''}</span><span class="cxm-d">${s?esc(s.label||'')+(s.dd!=null&&!String(s.label||'').includes(fmtL(s.dd))?' · '+fmtD(s.dd):''):'No schedule yet'}</span></button>`; };
    const match=p=>!q||[p.name,p.code,(PER.programmes.find(g=>g.id===p.programmeId)||{}).name].some(x=>x&&String(x).toLowerCase().includes(q));
    const groups=PER.programmes.map(g=>[g.name,PER.projects.filter(p=>p.programmeId===g.id&&match(p)),g.id]);
    groups.push(['Not in a programme',PER.projects.filter(p=>(!p.programmeId||!PER.programmes.some(g=>g.id===p.programmeId))&&match(p))]);
    list=groups.filter(([,ps])=>ps.length).map(([n,ps,gid])=>`<div class="cxm-g"><span>${esc(n)}</span>${gid&&PER.projects.filter(p=>p.programmeId===gid&&p.summary).length>1?`<button class="cxm-all" data-cxg="${esc(gid)}">Open all</button>`:''}</div>${ps.sort((a,b)=>String(a.name).localeCompare(b.name)).map(item).join('')}`).join('')||'<div class="cxm-e">No projects match.</div>';
  }
  const search=signed&&PER.projects.length>6?`<input type="search" class="cxm-q" id="ctxQ" placeholder="Find a project" value="${esc(m.dataset.q||'')}" aria-label="Find a project">`:'';
  m.innerHTML=`<div class="cxm-h">Select Schedule</div>${search}<div class="cxm-l">${list}</div>
    <div class="cxm-f">${signed?'<button data-cxa="port">Portfolio</button>':'<button data-cxa="signin">Sign in</button>'}${signed&&ok.length&&!L&&!perRO()?'<button data-cxa="save">Save as period…</button>':''}${signed&&L&&!L.multi&&!perRO()?'<button data-cxa="upd">Update schedule…</button>':''}<button data-cxa="files">Schedule files${ok.length?` (${ok.length})`:''}…</button></div>`;
}
function wireCtx(){
  const b=document.getElementById('meta'), m=document.getElementById('ctxMenu');
  const close=()=>{ m.hidden=true; b.setAttribute('aria-expanded','false'); };
  b.onclick=e=>{ e.stopPropagation(); if(!m.hidden){ close(); return; } m.dataset.q=''; renderCtxMenu(); m.hidden=false; b.setAttribute('aria-expanded','true'); const q=document.getElementById('ctxQ'); if(q) q.focus(); };
  document.addEventListener('click',e=>{ if(!m.hidden&&!m.contains(e.target)&&!b.contains(e.target)) close(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!m.hidden){ close(); b.focus(); } });
  m.addEventListener('input',e=>{ if(e.target.id==='ctxQ'){ m.dataset.q=e.target.value; const pos=e.target.selectionStart; renderCtxMenu(); const q=document.getElementById('ctxQ'); if(q){ q.focus(); try{ q.setSelectionRange(pos,pos); }catch(_){} } } });
  m.addEventListener('click',e=>{
    const it=e.target.closest('[data-cx]'); if(it){ close(); portOpen(it.dataset.cx,true); return; }
    const gg=e.target.closest('[data-cxg]'); if(gg){ close(); portOpenProgramme(gg.dataset.cxg,true); return; }
    const a=e.target.closest('[data-cxa]'); if(!a) return; close();
    if(a.dataset.cxa==='port') setTab('port'); else if(a.dataset.cxa==='save') perAskSave(); else if(a.dataset.cxa==='upd') updStart(PER.loaded.pid); else if(a.dataset.cxa==='files') openFilesModal(); else if(a.dataset.cxa==='signin'&&!document.getElementById('auth')) authStart(); });
}
function rebuild(fitView){
  M=buildModel(); colCache=new Map();
  M.t0g=Date.UTC(new Date(M.t0).getUTCFullYear(),new Date(M.t0).getUTCMonth(),1)-14*DAY; M.t1g=M.t1+60*DAY;
  // prune filters to values that still exist
  const F=S.F; F.wbs=new Set([...F.wbs].filter(k=>M.wbs.has(k))); F.proj=new Set([...F.proj].filter(p=>M.projs.includes(p)));
  for(const t in F.codes) if(!M.codeTypes.includes(t)) delete F.codes[t];
  drvCache=new WeakMap(); cpCache=null; if(typeof AI!=='undefined'){ AI.codeMap=null; }
  if(S.sel&&!M.byKey.has(S.sel)) closeDrawer();
  renderDock();
  if(S.ex.init&&S.ex.rows.length&&S.ex.rows.every(r=>!exMembers(r).length)){ S.ex.init=false; S.ex.rows=[]; S.ex.ms=[]; S.ex.title=''; }
  pickTldDefaults(); renderMeta(); renderFilters(); renderControls(); renderFiles(); if(!document.getElementById('colPanel').hidden) renderColPanel();
  const empty=!M.rows.length; document.querySelectorAll('.empty').forEach(e=>e.remove());
  if(empty){ [gWrap,tWrap].forEach(w=>w.insertAdjacentHTML('beforeend',`<div class="empty"><h3>Load your schedules</h3><p>Add XER exports for your baseline and live programmes. Each project can be its own file.</p><button class="btn primary" data-open-files>Add XER files</button></div>`)); }
  S.rows=filtered(); buildItems(); renderLegend(); updateBadge();
  T.view=null;
  if(fitView) fitGantt(); else redraw();
}
const PROJ_TABS=['dash','gantt','tld','dq','ifc','per','exec'];
function setTab(t){
  if(t==='ai'){ t=S.lastProj||'dash'; setTimeout(()=>aiPanel(true),0); }
  S.tab=t; if(t==='admin'&&!admAllowed()) t='port';
  const TABS={port:'tabPort',dash:'tabDash',per:'tabPer',gantt:'tabGantt',tld:'tabTld',dq:'tabDq',ifc:'tabIfc',exec:'tabExec',build:'tabBuild',admin:'tabAdmin'}; Object.entries(TABS).forEach(([x,id])=>document.getElementById(id).setAttribute('aria-selected',t===x));
  const inProj=PROJ_TABS.includes(t); document.getElementById('navProj').setAttribute('aria-selected',inProj); document.getElementById('nav2').hidden=!inProj;
  if(inProj) S.lastProj=t; else if(!document.getElementById('aiWrap').hidden) aiPanel(false);
  gWrap.hidden=t!=='gantt'; tWrap.hidden=t!=='tld'; document.getElementById('dqWrap').hidden=t!=='dq'; document.getElementById('dashWrap').hidden=t!=='dash'; document.getElementById('execWrap').hidden=t!=='exec'; document.getElementById('ifcWrap').hidden=t!=='ifc'; document.getElementById('buildWrap').hidden=t!=='build'; document.getElementById('perWrap').hidden=t!=='per'; document.getElementById('portWrap').hidden=t!=='port'; document.getElementById('adminWrap').hidden=t!=='admin'; if(t!=='build') document.getElementById('bAi').hidden=true; if(t!=='exec'){ const pk=document.getElementById('exPick'); if(pk) pk.hidden=true; }
  document.getElementById('legend').hidden=['dq','dash','exec','ifc','ai','build','per','port','admin'].includes(t); document.getElementById('controls').hidden=['dash','exec','ifc','ai','build','per','port','admin'].includes(t); document.getElementById('sbView').hidden=document.getElementById('controls').hidden;
  document.querySelector('.main').classList.toggle('wide',t==='build'||t==='per'||t==='port'||t==='admin'); setNote(''); tip.hidden=true;
  if(t!=='gantt'&&typeof closeCols==='function') closeCols();
  if(t==='gantt'){ hideDrawer(); if(G.needFit) requestAnimationFrame(fitGantt); } renderDock(); POPS.forEach(p=>document.getElementById(p).hidden=true); if(t!=='tld') document.getElementById('clashList').hidden=true;
  renderControls(); renderLegend(); try{ localStorage.setItem('pacer.tab',t); }catch(_){}
  redraw();
}

/* ---------------- events ---------------- */
function wire(){
  gWrap=document.getElementById('ganttWrap'); gCv=document.getElementById('ganttCv'); gSc=document.getElementById('ganttSc'); gSp=document.getElementById('ganttSp');
  tWrap=document.getElementById('tldWrap'); tCv=document.getElementById('tldCv'); tip=document.getElementById('tip');
  const side=document.getElementById('side');

  // tabs
  document.getElementById('tabGantt').onclick=()=>setTab('gantt');
  document.getElementById('tabDash').onclick=()=>setTab('dash');
  document.getElementById('tabExec').onclick=()=>setTab('exec');
  document.getElementById('tabIfc').onclick=()=>setTab('ifc');
  document.getElementById('navProj').onclick=()=>{ if(!S.files.some(f=>!f.error&&f.role!=='off')){ document.getElementById('meta').click(); return; } setTab(S.lastProj||'dash'); };
  document.getElementById('btnAi').onclick=()=>aiPanel();
  document.getElementById('aiClose').onclick=()=>{ aiPanel(false); document.getElementById('btnAi').focus(); };
  document.getElementById('aiWrap').addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); aiPanel(false); document.getElementById('btnAi').focus(); } });
  addEventListener('resize',()=>{ if(!document.getElementById('aiWrap').hidden) aiPlace(); });
  document.getElementById('tabBuild').onclick=()=>setTab('build');
  document.getElementById('tabPer').onclick=()=>setTab('per'); document.getElementById('tabPort').onclick=()=>setTab('port'); document.getElementById('tabAdmin').onclick=()=>setTab('admin'); wirePer();
  wireBuild(); wireBa();
  wireAi();
  wireIfc();
  wireExec(); wireExPick();
  document.getElementById('dashWrap').addEventListener('click',e=>{
    const k=e.target.closest('[data-k]'); if(k&&k.dataset.k){ setTab('gantt'); selectAct(k.dataset.k,true); return; }
    const h=e.target.closest('[data-hist]'); if(h){ const b=DASH.hist[+h.dataset.hist]; if(!b||!b.keys.length) return; S.F.ids={label:`Finish variance ${b.label}`,set:new Set(b.keys)}; renderFilters(); setTab('gantt'); applyFilters(); fitGantt(); return; }
    const w=e.target.closest('[data-wbsf]'); if(w){ const key=w.dataset.wbsf; S.F.wbs.has(key)?S.F.wbs.delete(key):S.F.wbs.add(key); renderFilters(); applyFilters(); } });
  document.getElementById('tabTld').onclick=()=>setTab('tld');
  document.getElementById('tabDq').onclick=()=>setTab('dq');
  document.getElementById('dqWrap').addEventListener('click',e=>{
    const card=e.target.closest('[data-dq]'); if(card){ const n=+card.dataset.dq; DQ.sel=DQ.sel===n?null:n; renderDQ(); if(DQ.sel){ const d=document.getElementById('dqDetail'); if(d&&d.getBoundingClientRect().top>innerHeight-120) d.scrollIntoView({block:'nearest',behavior:'smooth'}); } return; }
    const it=e.target.closest('.dqi'); if(it&&it.dataset.k){ openDrawer(it.dataset.k); return; }
    if(e.target.closest('[data-dq-gantt]')){ const c=DQ.res.find(x=>x.n===DQ.sel); if(!c) return; S.F.ids={label:`${DQ.ctx?DQ.ctx.name:'Quality'} ${c.n} · ${c.title}`,set:new Set(c.items.map(i=>i.k).filter(Boolean))}; renderFilters(); setTab('gantt'); applyFilters(); fitGantt(); } });

  // sidebar filters
  side.addEventListener('click',e=>{
    const c=e.target.closest('.chip,.tn,#fClear,#fIdsX'); if(!c) return;
    if(c.id==='fIdsX'){ delete S.F.ids; renderFilters(); applyFilters(); return; }
    if(c.id==='fClear'){ S.F={q:'',status:new Set(),cmp:new Set(),crit:false,wbs:new Set(),codes:{},proj:new Set()}; renderFilters(); applyFilters(); return; }
    if(c.dataset.wbs!=null){ const k=c.dataset.wbs; S.F.wbs.has(k)?S.F.wbs.delete(k):S.F.wbs.add(k); c.classList.toggle('on'); }
    else if(c.dataset.code!=null){ const t=c.dataset.code, v=c.dataset.v; const set=S.F.codes[t]||(S.F.codes[t]=new Set()); set.has(v)?set.delete(v):set.add(v); c.classList.toggle('on'); }
    else { const f=c.dataset.f, v=c.dataset.v, set=f==='status'?S.F.status:f==='cmp'?S.F.cmp:S.F.proj; set.has(v)?set.delete(v):set.add(v); c.classList.toggle('on'); }
    side.querySelectorAll('details').forEach(d=>{ const n=d.querySelector('.on-n'); if(!n) return; const t=d.querySelector('[data-code]'); const k=t?t.dataset.code:null; n.textContent=(k?(S.F.codes[k]||new Set()).size:S.F.wbs.size)||''; });
    applyFilters();
  });
  let qT; side.addEventListener('input',e=>{ if(e.target.id==='fq'){ clearTimeout(qT); qT=setTimeout(()=>{ S.F.q=e.target.value; applyFilters(); },160); } });
  side.addEventListener('change',e=>{ if(e.target.id==='fcrit'){ S.F.crit=e.target.checked; applyFilters(); } });
  document.getElementById('btnFilters').onclick=()=>side.classList.toggle('open'); sbInit();

  // controls
  const ctl=document.getElementById('controls');
  ctl.addEventListener('change',e=>{ const id=e.target.id, v=e.target.value;
    if(id==='cGroup'){ S.group=v; S.collapsed.clear(); buildItems(); drawGantt(); }
    else if(id==='cColor'){ S.colorBy=v; renderLegend(); drawGantt(); }
    else if(id==='cBase'){ S.showBase=e.target.checked; renderLegend(); T.view=null; redraw(); }
    else if(id==='cLoc'){ if(v==='udf'||v==='name') S.tld.src=v; else if(v.startsWith('map:')){ S.tld.src='map'; S.tld.mapType=v.slice(4); ensureMap(S.tld.mapType); } else { S.tld.src='code'; S.tld.locType=v.slice(5); } T.view=null; renderControls(); drawTLD(); if(S.tld.src==='map'&&!document.getElementById('chPanel').hidden) renderChPanel(); }
    else if(id==='cCpBy'){ S.cp.by=v; cpChanged(); }
    else if(id==='cCpThr'){ const n=parseFloat(v); S.cp.thr=isFinite(n)?n:0; cpChanged(); }
    else if(id==='cInU'){ S.tld.inUnit=v; S.tld._unitSet=true; T.view=null; drawTLD(); }
    else if(id==='cFmt'){ S.tld.fmt=v; saveCh(); drawTLD(); if(!document.getElementById('chPanel').hidden) renderChPanel(); }
    else if(id==='cOv'){ S.tld.overlay=v; if(v) ensureMap(v); drawTLD(); }
    else if(id==='cChF'||id==='cChT'){ applyWindow(); }
    else if(id==='cUs'){ S.tld.udfS=v; T.view=null; drawTLD(); }
    else if(id==='cUe'){ S.tld.udfE=v; T.view=null; drawTLD(); }
    else if(id==='cTColor'){ S.tld.colorBy=v; S.tld._set=true; renderLegend(); drawTLD(); if(!document.getElementById('stylePanel').hidden) renderStyles(); } });
  ctl.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.cp){ S.cp.mode=b.dataset.cp; cpChanged(); return; }
    if(b.dataset.lg){ S.logic=b.dataset.lg; try{ localStorage.setItem('pacer.logic',S.logic); }catch(_){} renderControls(); renderLegend(); drawGantt(); return; }
    if(b.dataset.pop){ togglePop(b.dataset.pop); return; }
    if(b.id==='cChMap'){ togglePop('chPanel'); return; }
    if(b.id==='cCols'){ const cp=document.getElementById('colPanel'); cp.hidden?openCols():closeCols(); return; }
    if(b.dataset.z){ b.dataset.z==='fit'?fitGantt():zoomGantt(b.dataset.z==='in'?1.6:1/1.6); }
    if(b.dataset.x){ if(b.dataset.x==='expand') S.collapsed.clear(); else G.items.forEach(it=>{ if(it.t==='g'&&(S.group!=='wbs'||it.d>=1)) S.collapsed.add(it.key); }); buildItems(); drawGantt(); }
    if(b.dataset.o){ S.tld.orient=b.dataset.o; T.view=null; renderControls(); drawTLD(); }
    if(b.dataset.tz){ T.view=null; drawTLD(); }
    if(b.dataset.dqr){ S.dq.role=b.dataset.dqr; DQ.sel=null; renderControls(); renderDQ(); }
    if(b.dataset.dqs){ S.dq.scope=b.dataset.dqs; DQ.sel=null; renderControls(); renderDQ(); }
    if(b.dataset.qfw){ try{ localStorage.setItem('pacer.qfw',b.dataset.qfw); }catch(_){} DQ.sel=null; renderControls(); renderDQ(); }
    if(b.hasAttribute('data-qcfg')) qOpenConfig(); });

  // gantt interactions
  gSc.addEventListener('scroll',()=>requestAnimationFrame(drawGantt),{passive:true});
  gSc.addEventListener('wheel',e=>{
    const rc=gSc.getBoundingClientRect(), x=e.clientX-rc.left;
    if(e.ctrlKey||e.metaKey){ e.preventDefault(); zoomGantt(e.deltaY<0?1.15:1/1.15,Math.max(tableW(),x)); return; }
    if(x<tableW()&&(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))){ e.preventDefault(); S.tblX+=e.deltaX||e.deltaY; drawGantt(); }
  },{passive:false});
  const zoneAt=h=>{ const TW=tableW();
    if(Math.abs(h.x-TW)<=5) return {mode:'split'};
    if(h.y<G.HEAD&&h.x<TW){ const lay=colLayout(); const edge=lay.find(o=>Math.abs(o.x+o.w-6-h.x)<=5); if(edge) return {mode:'colw',id:edge.c.id,w:edge.w};
      const col=lay.find(o=>h.x>=o.x-6&&h.x<o.x+o.w-6); return {mode:'hdr',id:col?col.c.id:null}; }
    return {mode:'pan',inTable:h.x<TW}; };
  let drag=null;
  gSc.addEventListener('pointerdown',e=>{ if(e.pointerType!=='mouse'||e.button!==0) return; const h=gHit(e); if(h.x>gSc.clientWidth||h.y>gSc.clientHeight) return;
    drag={...zoneAt(h),x:e.clientX,y:e.clientY,sl:gSc.scrollLeft,st:gSc.scrollTop,tx:S.tblX,tw:tableW(),moved:false}; if(drag.mode!=='pan') e.preventDefault(); });
  window.addEventListener('pointermove',e=>{
    if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)>4){ drag.moved=true; tip.hidden=true; if(drag.mode==='pan') gSc.style.cursor='grabbing'; }
    if(!drag.moved) return;
    if(drag.mode==='split'){ S.tw=Math.max(120,drag.tw+dx); drawGantt(); }
    else if(drag.mode==='colw'){ S.colW[drag.id]=Math.max(40,Math.round(drag.w+dx)); drawGantt(); }
    else if(drag.mode==='pan'){ if(drag.inTable){ S.tblX=drag.tx-dx; drawGantt(); } else gSc.scrollLeft=drag.sl-dx; gSc.scrollTop=drag.st-dy; }
  });
  window.addEventListener('pointerup',e=>{ if(!drag) return; const d=drag; drag=null; gSc.style.cursor='';
    if(d.moved){ if(d.mode==='split'||d.mode==='colw') savePrefs(); return; }
    if(d.mode==='hdr'&&d.id){ if(!S.sort||S.sort.id!==d.id) S.sort={id:d.id,dir:1}; else if(S.sort.dir===1) S.sort.dir=-1; else S.sort=null; savePrefs(); buildItems(); drawGantt(); return; }
    if(d.mode==='pan') gClick(e); });
  gSc.addEventListener('click',e=>{ /* touch & pen taps */ if(e.pointerType&&e.pointerType!=='mouse') gClick(e); else if(e.detail===0) gClick(e); });
  gSc.addEventListener('pointermove',e=>{ if(drag&&drag.moved) return; const h=gHit(e);
    if(!drag&&e.pointerType==='mouse'){ const z=zoneAt(h); gSc.style.cursor=z.mode==='split'||z.mode==='colw'?'col-resize':z.mode==='hdr'&&z.id?'pointer':''; }
    if(h.i!==G.hover){ G.hover=h.i; drawGantt(); }
    const it=G.items[h.i]; if(it&&it.t==='a'&&e.pointerType==='mouse') showTip(it.r,e); else tip.hidden=true; });
  gSc.addEventListener('pointerleave',()=>{ G.hover=-1; tip.hidden=true; drawGantt(); });
  function gClick(e){ const h=gHit(e), it=G.items[h.i]; if(!it) return; if(it.t==='g'){ S.collapsed.has(it.key)?S.collapsed.delete(it.key):S.collapsed.add(it.key); buildItems(); drawGantt(); } else selectAct(it.r.k); }

  wireTlPanels();
  // chainage window + map panel
  document.getElementById('controls').addEventListener('keydown',e=>{ if((e.target.id==='cChF'||e.target.id==='cChT')&&e.key==='Enter'){ e.preventDefault(); applyWindow(); } });
  const chp=document.getElementById('chPanel');
  document.addEventListener('click',e=>{ if(!chp.hidden&&!chp.contains(e.target)&&!e.target.closest('#cChMap')) chp.hidden=true; });
  chp.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const type=S.tld.mapType;
    if(b.id==='chClose'){ chp.hidden=true; return; }
    if(b.id==='chDetect'){ const n=detectMap(type); renderChPanel(n?`Found chainage in ${n} code value${n===1?'':'s'}.`:'No chainage found in the code names. Try Spread evenly, or type values in.'); }
    if(b.id==='chSpread'){ const L=parseChText(document.getElementById('chLen').value,S.tld.inUnit); if(L>0){ spreadMap(type,L); renderChPanel('Spread evenly. Adjust any row as needed.'); } }
    if(b.id==='chClear'){ S.chmap[type]={}; saveCh(); renderChPanel(); }
    T.view=null; drawTLD(); });
  chp.addEventListener('change',e=>{ const i=e.target.closest('[data-chv]'); if(!i) return; const type=S.tld.mapType, map=chMapFor(type), [v,end]=[i.dataset.chv,+i.dataset.end];
    const m=parseChText(i.value,S.tld.inUnit); const g=map[v]||[null,null]; g[end]=m; if(g[0]==null&&g[1]==null) delete map[v]; else map[v]=g; saveCh(); i.value=m==null?'':fmtCh(m); i.classList.toggle('bad',i.value!==''&&m==null); T.view=null; drawTLD(); });

  // details dock
  document.getElementById('dock').addEventListener('click',e=>{
    if(e.target.closest('#dkClose')){ closeDock(); return; }
    const t=e.target.closest('[data-dt]'); if(t){ S.dockTab=t.dataset.dt; renderDock(); return; }
    const nav=e.target.closest('[data-nav]'); if(nav){ const ks=G.items.filter(x=>x.t==='a').map(x=>x.r.k), i=ks.indexOf(S.sel), n=ks[i+(nav.dataset.nav==='next'?1:-1)]; if(n) selectAct(n,true); return; }
    const row=e.target.closest('[data-k]'); if(row&&row.dataset.k){ selectAct(row.dataset.k,true); } });
  document.addEventListener('keydown',e=>{ if(S.tab!=='gantt'||!S.sel||(e.key!=='ArrowDown'&&e.key!=='ArrowUp')||e.target.closest('input,select,textarea')) return;
    e.preventDefault(); const ks=G.items.filter(x=>x.t==='a').map(x=>x.r.k), i=ks.indexOf(S.sel), n=ks[i+(e.key==='ArrowDown'?1:-1)]; if(n) selectAct(n,true); });

  // column chooser
  const cp=document.getElementById('colPanel');
  const openCols=()=>{ renderColPanel(); cp.hidden=false; const q=document.getElementById('cpq'); q.value=''; q.focus(); };
  window.closeCols=()=>{ cp.hidden=true; };
  document.addEventListener('click',e=>{ if(!cp.hidden&&!cp.contains(e.target)&&!e.target.closest('#cCols')) closeCols(); });
  cp.addEventListener('input',e=>{ if(e.target.id==='cpq') renderAvail(e.target.value); });
  cp.addEventListener('click',e=>{ const b=e.target.closest('button,[data-add]'); if(!b) return;
    if(b.id==='cpClose'){ closeCols(); return; }
    if(b.id==='cpReset'){ S.cols=['d:code','d:name','d:finish','d:varF']; S.colW={}; S.tw=null; S.tblX=0; S.sort=null; }
    else if(b.dataset.add){ const id=b.dataset.add; const i=S.cols.indexOf(id); i<0?S.cols.push(id):S.cols.splice(i,1); }
    else if(b.dataset.up){ const i=S.cols.indexOf(b.dataset.up); if(i>0){ [S.cols[i-1],S.cols[i]]=[S.cols[i],S.cols[i-1]]; } }
    else if(b.dataset.down){ const i=S.cols.indexOf(b.dataset.down); if(i>=0&&i<S.cols.length-1){ [S.cols[i+1],S.cols[i]]=[S.cols[i],S.cols[i+1]]; } }
    else if(b.dataset.del){ S.cols=S.cols.filter(x=>x!==b.dataset.del); if(S.sort&&S.sort.id===b.dataset.del) S.sort=null; }
    else return;
    savePrefs(); renderShown(); renderAvail(document.getElementById('cpq').value); buildItems(); drawGantt(); });
  window.openCols=openCols;

  // TLD interactions
  let td=null;
  tCv.addEventListener('wheel',e=>{ if(!T.view||!T.plot) return; e.preventDefault(); const rc=tCv.getBoundingClientRect(), {fl,ft}=tFrac(e.clientX-rc.left,e.clientY-rc.top); const k=e.deltaY>0?1.15:1/1.15, V=T.view;
    const lc=V.l0+fl*(V.l1-V.l0), tc=V.t0+ft*(V.t1-V.t0); V.l0=lc+(V.l0-lc)*k; V.l1=lc+(V.l1-lc)*k; V.t0=tc+(V.t0-tc)*k; V.t1=tc+(V.t1-tc)*k; tip.hidden=true; drawTLD(); },{passive:false});
  tCv.addEventListener('pointerdown',e=>{ if(!T.view) return; tCv.setPointerCapture(e.pointerId); td={x:e.clientX,y:e.clientY,v:{...T.view},moved:false}; });
  tCv.addEventListener('pointermove',e=>{ const rc=tCv.getBoundingClientRect(), x=e.clientX-rc.left, y=e.clientY-rc.top;
    if(td){ const dx=e.clientX-td.x, dy=e.clientY-td.y; if(!td.moved&&Math.hypot(dx,dy)>4){ td.moved=true; tip.hidden=true; }
      if(td.moved){ const p=T.plot, v=td.v, W=p.x1-p.x0, H=p.y1-p.y0; const [dl,dt]=T.vert?[-dx/W*(v.l1-v.l0),-dy/H*(v.t1-v.t0)]:[-dy/H*(v.l1-v.l0),-dx/W*(v.t1-v.t0)];
        T.view={l0:v.l0+dl,l1:v.l1+dl,t0:v.t0+dt,t1:v.t1+dt}; drawTLD(); } return; }
    const r=tHit(x,y); tCv.style.cursor=r?'pointer':'crosshair'; if(e.pointerType==='mouse') showTip(r,e); });
  tCv.addEventListener('pointerup',e=>{ if(!td) return; const moved=td.moved; td=null; if(!moved){ const rc=tCv.getBoundingClientRect(), r=tHit(e.clientX-rc.left,e.clientY-rc.top); if(r) openDrawer(r.k); } });
  tCv.addEventListener('pointerleave',()=>{ if(!td) tip.hidden=true; });
  tCv.addEventListener('dblclick',()=>{ T.view=null; drawTLD(); });

  // drawer
  const dr=document.getElementById('drawer');
  dr.addEventListener('click',e=>{ if(e.target.id==='dClose'){ closeDrawer(); return; } const b=e.target.closest('.rel'); if(b){ if(S.tab==='gantt') selectAct(b.dataset.k,true); else openDrawer(b.dataset.k); } });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(!document.getElementById('colPanel').hidden) closeCols(); else if(!document.getElementById('modal').hidden) closeModal(); else if(S.sel&&S.tab==='gantt') closeDock(); else if(S.sel) closeDrawer(); } });

  // files modal
  const modal=document.getElementById('modal');
  const openModal=()=>{ renderFiles(); modal.hidden=false; document.getElementById('mClose').focus(); };
  window.openFilesModal=openModal;
  window.closeModal=()=>{ modal.hidden=true; };
  document.getElementById('btnFiles').onclick=openModal; wireCtx();
  document.addEventListener('click',e=>{ if(e.target.closest('[data-open-files]')) openModal(); });
  document.getElementById('mClose').onclick=closeModal; document.getElementById('mDone').onclick=closeModal;
  modal.addEventListener('click',e=>{ if(e.target===modal) closeModal();
    const rb=e.target.closest('[data-role]'); if(rb){ const f=S.files.find(x=>x.id===rb.dataset.id); if(f){ f.role=rb.dataset.role; rebuild(true); } }
    const rm=e.target.closest('[data-rm]'); if(rm){ S.files=S.files.filter(x=>x.id!==rm.dataset.rm); rebuild(true); } });
  document.getElementById('fileIn').addEventListener('change',e=>{ addFiles([...e.target.files]); e.target.value=''; });
  const drop=document.getElementById('drop');
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop',e=>{ const fs=[...(e.dataTransfer?.files||[])]; if(fs.length) addFiles(fs); });
  document.getElementById('matchSel').onchange=e=>{ S.match=e.target.value; rebuild(false); };
  document.getElementById('loadSample').onclick=()=>{ S.files=S.files.filter(f=>!f.sample).concat(sampleFiles()); if(!S.site.marks.length) S.site=sampleSite(); if(!Object.keys(S.styles).length) S.styles=sampleStyles(); rebuild(true); };
  document.getElementById('clearFiles').onclick=()=>{ S.files=[]; if(S.site.sample) S.site={marks:[],profile:[]}; rebuild(true); };

  // theme + resize
  const re=()=>{ readTheme(); renderLegend(); drawProfile(); redraw(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',re);
  new MutationObserver(re).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  let rz; new ResizeObserver(()=>{ cancelAnimationFrame(rz); rz=requestAnimationFrame(()=>{ drawProfile(); redraw(); }); }).observe(document.body);
}

