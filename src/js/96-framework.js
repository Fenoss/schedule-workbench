/* ================= Framework Workbench =================
   The single place to set up the portfolio (programmes, projects and their attributes) and the data
   structures the other workbenches share: WBS, OBS, RBS, CBS, activity code dictionaries, the interface
   register and project attributes. The Risk Workbench takes its categories from the RBS, owners from the
   OBS and interface IDs from the register; Conformance checks schedules and risk registers against them. */
const FW={tab:'port',structs:[],un:null,loaded:false,schemaOld:false,sel:null,sid:null,work:null,ifc:null,q:'',open:new Set()};
const FWK={wbs:{l:'Work Breakdown Structure',s:'WBS',d:'The standard breakdown of the work.',tree:1},
  obs:{l:'Organisation Breakdown Structure',s:'OBS',d:'Roles and teams.',tree:1},
  rbs:{l:'Risk Breakdown Structure',s:'RBS',d:'Sources of risk.',tree:1},
  cbs:{l:'Cost Breakdown Structure',s:'CBS',d:'How cost is broken down and reported.',tree:1},
  code:{l:'Activity code',s:'Code',d:'Allowed values for a P6 activity code type — name it exactly as the code type is named in P6.',tree:1},
  other:{l:'Other structure',s:'Other',d:'Any other coding structure you want to keep alongside.',tree:1},
  ifc:{l:'Interface register',s:'IFC',d:'Interface IDs between projects.'},attrs:{l:'Project attributes',s:'Attr',d:'Fields kept for every programme and project.'}};
const FW_IFT=['Access','Handover','Design information','Utility / power','Testing & commissioning','Other'], FW_IFS={open:'Open',agreed:'Agreed',risk:'At risk',closed:'Closed'};
const fwId=()=>'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const fwClone=o=>JSON.parse(JSON.stringify(o));

/* ---- shared lookups other workbenches use ---- */
const fwOf=kind=>FW.structs.filter(s=>s.kind===kind);
const fwOne=kind=>fwOf(kind)[0]||null;
function fwTree(nodes){ const kids=new Map(), ids=new Set(nodes.map(n=>n.id)); nodes.forEach(n=>{ const p=n.p&&ids.has(n.p)?n.p:null; if(!kids.has(p)) kids.set(p,[]); kids.get(p).push(n); });
  const out=[], walk=(p,dep,path)=>(kids.get(p)||[]).forEach(n=>{ const pa=path.concat(n); out.push({n,dep,path:pa,kids:(kids.get(n.id)||[]).length}); walk(n.id,dep+1,pa); }); walk(null,0,[]); return out; }
function fwRbsCats(){ const s=fwOne('rbs'); return s?fwTree(s.data.nodes||[]).filter(x=>x.dep===0).map(x=>x.n.name).filter(Boolean):[]; }
function fwObsNames(){ return [...new Set(fwOf('obs').flatMap(s=>(s.data.nodes||[]).map(n=>n.name)).filter(Boolean))]; }
function fwIfcItems(){ const s=fwOne('ifc'); return s?(s.data.items||[]):[]; }
function fwAttrs(on){ const s=fwOne('attrs'); return (s?(s.data.fields||[]):[]).filter(f=>!on||f.on==='both'||f.on===on); }
function fwCanStruct(){ return typeof PER!=='undefined'&&!!PER.mode&&(typeof qAdmin==='function'?qAdmin():true); }
function fwSubscribe(){ if(FW.un){ try{ FW.un(); }catch(_){} FW.un=null; } FW.structs=[]; FW.loaded=false; FW.work=null; FW.ifc=null;
  if(typeof PER==='undefined'||!PER.store||!PER.store.watchStructures){ fwRender(); return; }
  FW.un=PER.store.watchStructures(list=>{ FW.schemaOld=false; FW.loaded=true; FW.structs=list.map(s=>Object.assign({data:{}},s)).sort((a,b)=>(a.sort||0)-(b.sort||0)||String(a.name).localeCompare(b.name)); if(typeof RK!=='undefined') RK._cc=null; fwRender(); if(typeof rkRender==='function') rkRender(); },
    e=>{ FW.loaded=true; if(/structures|schema cache|does not exist|42P01|PGRST20/i.test((e&&(e.message||e.code))||'')){ FW.schemaOld=true; fwRender(); } else perToast(perErr(e),'err'); }); }
async function fwSave(s){ if(!PER.store||!PER.store.saveStructure) throw new Error('Sign in to save.'); return PER.store.saveStructure(s); }

/* ---- shell ---- */
function wireFw(){ document.getElementById('fwNav').addEventListener('click',e=>{ const b=e.target.closest('[data-fwt]'); if(b) fwGo(b.dataset.fwt); });
  const w=document.getElementById('fwWrap'); w.addEventListener('click',fwClick); w.addEventListener('change',fwChange); w.addEventListener('input',fwInput);
  try{ const t=localStorage.getItem('pacer.fwtab'); if(['port','str','ifc','conf'].includes(t)) FW.tab=t; }catch(_){} }
function fwGo(t){ if(FW.work&&FW.work.dirty&&t!=='str'&&!confirm('Discard unsaved changes to this structure?')) return; if(t!=='str') FW.work=null; FW.tab=t; try{ localStorage.setItem('pacer.fwtab',t); }catch(_){} if(S.tab==='admin') setTab('port'); fwRender(); window.scrollTo(0,0); }
function fwRender(){ if(typeof RK==='undefined'||RK.app!=='frame') return; const el=document.getElementById('fwWrap'); if(!el) return;
  document.querySelectorAll('#fwNav [data-fwt]').forEach(b=>b.setAttribute('aria-selected',b.dataset.fwt===FW.tab));
  if(!PER.mode){ el.innerHTML='<div class="card pempty big"><h3>Sign in to set up your portfolio</h3><p class="muted">The Framework Workbench holds your programmes, projects and the structures the other workbenches share.</p><button class="btn primary" data-fw="signin">Sign in</button></div>'; return; }
  if(FW.schemaOld&&PER.mode==='supa'&&FW.tab!=='port'){ el.innerHTML=fwHead()+`<div class="card pwarn portold"><b>One database step left.</b> Structures need the latest <code>supabase/schema.sql</code>. Open Supabase → SQL Editor → New query, paste the whole file from the GitHub repo and click Run, then reload this page.</div>`; return; }
  const sy=window.scrollY, act=document.activeElement, aid=act&&act.id, ad=act&&act.dataset?Object.assign({},act.dataset):null, apos=act&&act.selectionStart;
  el.innerHTML=fwHead()+(FW.tab==='str'?fwStrHtml():FW.tab==='ifc'?fwIfcHtml():FW.tab==='conf'?fwConfHtml():fwPortHtml());
  let n=aid?document.getElementById(aid):null; if(!n&&ad){ const k=Object.keys(ad).find(k=>/^fw[A-Z]/.test(k)&&k!=='fw'); if(k){ const sel=`[data-${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${CSS.escape(ad[k])}"]`; n=el.querySelector(sel); } }
  if(n&&n!==document.body){ n.focus(); try{ if(apos!=null) n.setSelectionRange(apos,apos); }catch(_){} }
  if(Math.abs(window.scrollY-sy)>2) window.scrollTo(0,sy); }
function fwHead(){ const sub={port:'Programmes, projects and their attributes',str:'Breakdown structures and activity code standards',ifc:'Interface IDs between projects, shared with schedules and risk registers',conf:'How schedules and risk registers match your standards'}[FW.tab];
  const ws=PER.mode==='supa'&&PER.company?PER.company.name:PER.mode==='local'?'This browser':'Team workspace';
  return `<div class="card porthead rk-head"><div class="ph-t"><h2>${esc(ws)}</h2><span class="pspace">${esc(sub)}</span></div><div class="ph-c">
    ${FW.tab==='port'?`<input type="search" id="fwQ" placeholder="Search programmes and projects" value="${esc(FW.q)}" aria-label="Search portfolio"><button class="btn sm ghost" data-fw="xls">Excel</button>${!perRO()?'<button class="btn sm ghost" data-fw="import">Import</button>':''}${fwCanStruct()?'<button class="btn sm ghost" data-fw="attrs">Attributes</button>':''}${!perRO()?'<button class="btn sm" data-fw="addprog">Add programme</button><button class="btn sm primary" data-fw="addproj">Add project</button>':''}`:''}
    ${FW.tab==='str'&&FW.structs.length?'<button class="btn sm ghost" data-fw="xls">Excel</button>':''}
    ${(FW.tab==='str'||FW.tab==='ifc')&&fwCanStruct()&&!FW.structs.some(s=>s.kind!=='attrs')?'<button class="btn sm" data-fw="std">Load standard structures</button>':''}</div></div>`; }

/* ---- Portfolio ---- */
function fwUse(kind,id){ const R=typeof RK!=='undefined'?RK.risks.filter(r=>rkLive(r)&&(kind==='proj'?(r.projectId===id||rkIfcPids(r).includes(id)):(r.programmeId===id||rkProgOf(r)===id))):[];
  const I=fwIfcItems().filter(x=>kind==='proj'?(x.g===id||x.r===id):[x.g,x.r].some(pid=>(rkProj(pid)||{}).programmeId===id)); return {R,I}; }
function fwPortHtml(){ const G=PER.programmes||[], P=PER.projects||[], q=FW.q.trim().toLowerCase(), m=x=>!q||[x.name,x.code,x.manager,x.client,x.description].some(v=>String(v||'').toLowerCase().includes(q));
  if(!FW.sel||(FW.sel.k==='prog'&&!G.some(g=>g.id===FW.sel.id))||(FW.sel.k==='proj'&&!P.some(p=>p.id===FW.sel.id))) FW.sel=G[0]?{k:'prog',id:G[0].id}:P[0]?{k:'proj',id:P[0].id}:null;
  const item=(k,x,dep)=>{ const on=FW.sel&&FW.sel.k===k&&FW.sel.id===x.id, s=x.summary, miss=k==='proj'?(!x.code||!x.manager):!x.code;
    return `<button class="fw-ti${on?' on':''}" style="--dep:${dep}" data-fwsel="${k}:${esc(x.id)}">${k==='prog'?`<i class="fw-dot" style="background:${esc(x.colour||'var(--ink3)')}"></i>`:''}<span class="fw-tn"><b>${esc(x.name)}</b><span class="muted">${esc([x.code,k==='proj'?x.manager:x.client].filter(Boolean).join(' · ')||(k==='proj'?'no code':''))}</span></span>${miss?'<span class="fw-warn" title="Missing code'+(k==='proj'?' or manager':'')+'">!</span>':''}${k==='proj'?`<span class="fw-st ${esc(x.status||'')}">${esc(PSTAT[x.status]||'')}</span>`:`<span class="muted fw-c">${P.filter(p=>p.programmeId===x.id).length}</span>`}</button>`; };
  let tree=''; G.forEach(g=>{ const ps=P.filter(p=>p.programmeId===g.id), pm=ps.filter(m); if(m(g)||pm.length){ tree+=item('prog',g,0)+(m(g)?ps:pm).map(p=>item('proj',p,1)).join(''); } });
  const loose=P.filter(p=>!p.programmeId||!G.some(g=>g.id===p.programmeId)).filter(m); if(loose.length) tree+='<div class="fw-tg">Not in a programme</div>'+loose.map(p=>item('proj',p,0)).join('');
  const nP=P.length, nG=G.length, noCode=P.filter(p=>!p.code).length+G.filter(g=>!g.code).length, req=fwAttrs().filter(f=>f.req), miss=req.length?P.filter(p=>fwAttrs('project').filter(f=>f.req).some(f=>(p.attrs||{})[f.id]==null||(p.attrs||{})[f.id]==='')).length:0;
  const tiles=`<div class="card stats rk-stats fw-stats"><div class="stat"><div class="sl">Programmes</div><div class="sv">${nG}</div><div class="ss">${G.filter(g=>g.code).length} with a code</div></div><div class="stat"><div class="sl">Projects</div><div class="sv">${nP}</div><div class="ss">${P.filter(p=>p.status==='active').length} active</div></div>
    <div class="stat"><div class="sl">Missing codes</div><div class="sv ${noCode?'amber':''}">${noCode}</div><div class="ss">programmes and projects</div></div><div class="stat"><div class="sl">Missing attributes</div><div class="sv ${miss?'amber':''}">${miss}</div><div class="ss">${req.length?`projects missing a required field`:'no required fields set'}</div></div>
    <div class="stat"><div class="sl">Structures</div><div class="sv">${FW.structs.filter(s=>FWK[s.kind]&&FWK[s.kind].tree).length}</div><div class="ss">${['wbs','obs','rbs','cbs'].filter(k=>fwOne(k)).map(k=>FWK[k].s).join(' · ')||'none yet'}</div></div><div class="stat"><div class="sl">Interfaces</div><div class="sv">${fwIfcItems().length}</div><div class="ss">in the register</div></div></div>`;
  if(!nP&&!nG) return tiles+`<div class="card pempty big"><h3>Set up your portfolio</h3><p class="muted">Add programmes and the projects in them, or import them from a spreadsheet. Schedules, risk registers and reports all hang off this structure.</p><div class="prow">${perRO()?'':'<button class="btn primary" data-fw="addprog">Add a programme</button><button class="btn" data-fw="import">Import from Excel</button>'}</div></div>`;
  return tiles+`<div class="fw-port"><div class="card fw-tree">${tree||'<p class="muted">Nothing matches.</p>'}</div><div class="card fw-det">${fwDetHtml()}</div></div>`; }
function fwAttrInput(f,v,dis){ const id=`data-fwattr="${esc(f.id)}"`; const lab=`${esc(f.l)}${f.req?' <b class="late" title="Required">*</b>':''}`;
  if(f.type==='choice') return `<label class="pfl"><span>${lab}</span><select ${id} ${dis}><option value="">—</option>${(f.opts||[]).map(o=>`<option${String(v)===o?' selected':''}>${esc(o)}</option>`).join('')}</select></label>`;
  return `<label class="pfl"><span>${lab}</span><input ${id} ${f.type==='number'?'type="number" step="any"':f.type==='date'?'type="date"':''} value="${esc(f.type==='date'&&v?xD(v):v??'')}" ${dis}></label>`; }
function fwDetHtml(){ const s=FW.sel; if(!s) return '<p class="muted">Choose a programme or project.</p>';
  const x=s.k==='prog'?rkProg(s.id):rkProj(s.id); if(!x) return ''; const can=!perRO()&&portCanEdit(x), dis=can?'':'disabled', A=fwAttrs(s.k==='prog'?'programme':'project'), U=fwUse(s.k,s.id), at=x.attrs||{};
  const sm=x.summary;
  const fields=s.k==='prog'?`<div class="rk-g2"><label class="pfl"><span>Programme name</span><input data-fwf="name" value="${esc(x.name)}" ${dis}></label><label class="pfl"><span>Code</span><input data-fwf="code" value="${esc(x.code||'')}" maxlength="20" ${dis}></label></div>
      <div class="rk-g2"><label class="pfl"><span>Client</span><input data-fwf="client" value="${esc(x.client||'')}" ${dis}></label><div class="pfl"><span>Colour</span><div class="swatches">${PCOL.map(c=>`<label class="swatch" style="--c:${c}"><input type="radio" name="fwCol" data-fwf="colour" value="${c}" ${(x.colour||'')===c?'checked':''} ${dis}><i></i><span class="vh">${c}</span></label>`).join('')}</div></div></div>`
    :`<div class="rk-g2"><label class="pfl"><span>Project name</span><input data-fwf="name" value="${esc(x.name)}" ${dis}></label><label class="pfl"><span>Code</span><input data-fwf="code" value="${esc(x.code||'')}" maxlength="30" ${dis}></label></div>
      <div class="rk-g3"><label class="pfl"><span>Programme</span><select data-fwf="programmeId" ${dis}><option value="">Not in a programme</option>${PER.programmes.map(g=>`<option value="${esc(g.id)}"${x.programmeId===g.id?' selected':''}>${esc(g.name)}</option>`).join('')}</select></label><label class="pfl"><span>Status</span><select data-fwf="status" ${dis}>${Object.entries(PSTAT).map(([k,v])=>`<option value="${k}"${x.status===k?' selected':''}>${v}</option>`).join('')}</select></label><label class="pfl"><span>Project manager</span><input data-fwf="manager" value="${esc(x.manager||'')}" list="fwObsL" ${dis}></label></div>`;
  return `<div class="fw-dh"><span class="rk-lv l${s.k==='prog'?1:2}">${s.k==='prog'?'Programme':'Project'}</span><h3>${esc(x.name)}</h3></div>
    <datalist id="fwObsL">${fwObsNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
    <form class="fw-form" data-fwform="${s.k}:${esc(s.id)}">${fields}<label class="pfl"><span>Description</span><textarea data-fwf="description" rows="2" ${dis}>${esc(x.description||'')}</textarea></label>
      ${A.length?`<div class="fh">Attributes</div><div class="rk-g3">${A.map(f=>fwAttrInput(f,at[f.id],dis)).join('')}</div>`:(fwCanStruct()?'<p class="muted">Add your own fields — sector, region, contract type, budget — under <button type="button" class="link" data-fw="attrs">Attributes</button>.</p>':'')}
      ${can?`<div class="adm-acts"><button class="btn primary">Save</button>${s.k==='prog'?'<button type="button" class="btn" data-fw="addproj">Add a project to it</button>':''}<span class="sp"></span><button type="button" class="link danger" data-fw="del">Delete ${s.k==='prog'?'programme':'project'}</button></div>`:'<p class="muted">You can view but not change this.</p>'}</form>
    <div class="fw-uses"><div class="fh">Used by</div>
      <div class="fw-use"><b>Schedule Workbench</b>${s.k==='proj'?(sm?`<span>${sm.count||0} update${sm.count===1?'':'s'} · latest ${esc(sm.label||'')} · data date ${fmtD(sm.dd)}</span><button type="button" class="link" data-fw="opensched">Open schedule</button>`:'<span class="muted">No schedule updates yet</span>'):`<span>${PER.projects.filter(p=>p.programmeId===x.id&&p.summary).length} of ${PER.projects.filter(p=>p.programmeId===x.id).length} projects have schedules</span>`}</div>
      <div class="fw-use"><b>Risk Workbench</b><span>${U.R.length} live risk${U.R.length===1?'':'s'}${U.R.length?` · worst ${rkChip(Math.max(0,...U.R.map(r=>rkCurScore(r)||0))||null,{short:1})}`:''}</span><button type="button" class="link" data-fw="openrisk">Open register</button></div>
      <div class="fw-use"><b>Interface register</b><span>${U.I.length} interface${U.I.length===1?'':'s'}${U.I.length?': '+U.I.slice(0,5).map(i=>esc(i.code)).join(', '):''}</span></div></div>`; }

/* ---- Structures ---- */
function fwStrHtml(){ const L=FW.structs.filter(s=>FWK[s.kind]&&FWK[s.kind].tree), can=fwCanStruct();
  if(FW.sid&&!FW.structs.some(s=>s.id===FW.sid)&&!(FW.work&&!FW.work.id)) FW.sid=null; if(!FW.sid&&!FW.work&&L[0]) FW.sid=L[0].id;
  if(FW.sid&&(!FW.work||FW.work.id!==FW.sid)){ const s=FW.structs.find(x=>x.id===FW.sid); if(s) FW.work=Object.assign(fwClone(s),{dirty:false}); }
  const grp=(t,ks)=>{ const xs=L.filter(s=>ks.includes(s.kind)); return `<div class="fw-tg">${t}</div>${xs.map(s=>`<button class="fw-ti${FW.work&&FW.work.id===s.id?' on':''}" data-fwsid="${esc(s.id)}"><span class="fw-kb">${esc(FWK[s.kind].s)}</span><span class="fw-tn"><b>${esc(s.name)}</b><span class="muted">${(s.data.nodes||[]).length} item${(s.data.nodes||[]).length===1?'':'s'}</span></span></button>`).join('')||'<p class="muted fw-none">None yet</p>'}`; };
  const list=`<div class="card fw-tree">${grp('Breakdown structures',['wbs','obs','rbs','cbs'])}${grp('Activity codes',['code'])}${L.some(s=>s.kind==='other')?grp('Other',['other']):''}
    ${can?`<div class="fw-new"><select id="fwNewK" aria-label="Kind">${Object.entries(FWK).filter(([k,v])=>v.tree).map(([k,v])=>`<option value="${k}">${esc(v.l)}</option>`).join('')}</select><button class="btn sm" data-fw="newstr">New</button></div>`:''}</div>`;
  if(!L.length&&!FW.work) return `<div class="card pempty big"><h3>No structures yet</h3><p class="muted">Keep your standard WBS, organisation (OBS), risk (RBS) and cost (CBS) breakdowns and your P6 activity code dictionaries here. The Risk Workbench uses the RBS for categories and the OBS for owners; Conformance checks schedules against the WBS and codes.</p>${can?'<div class="prow"><button class="btn primary" data-fw="std">Load standard structures</button><button class="btn" data-fw="newstr0">Start an empty one</button></div>':'<p class="muted">Ask an admin to set these up.</p>'}</div>`;
  return `<div class="fw-port">${list}<div class="card fw-det">${FW.work?fwEdHtml():'<p class="muted">Choose a structure.</p>'}</div></div>`; }
function fwEdHtml(){ const W=FW.work, can=fwCanStruct(), K=FWK[W.kind], rows=fwTree(W.data.nodes||[]), dis=can?'':'disabled';
  const sched=rkAiSchedOpen&&rkAiSchedOpen(), codeTypes=sched?fwSchedCodeTypes():[];
  const used={wbs:'Conformance checks schedule WBS against it.',obs:'Risk and action owners in the Risk Workbench pick from it.',rbs:'Its top level is the category list in every risk register.',cbs:'Kept for cost reporting.',code:'Conformance checks the matching P6 code type against it.',other:''}[W.kind];
  return `<div class="fw-dh"><span class="fw-kb">${esc(K.s)}</span><input class="fw-name" data-fwname value="${esc(W.name)}" aria-label="Structure name" ${dis}>${W.dirty?'<span class="pill">Unsaved</span>':''}</div>
    <p class="muted">${esc(K.d)} ${esc(used)}</p>
    ${can?`<div class="fw-bar"><button class="btn sm" data-fwop="addtop">Add item</button><button class="btn sm ghost" data-fw="simport">Import</button>${W.kind==='wbs'&&sched?'<button class="btn sm ghost" data-fw="harvest">From open schedule</button>':''}${W.kind==='code'&&sched?`<select id="fwHarvT" aria-label="Code type">${codeTypes.map(t=>`<option${t.toLowerCase()===W.name.toLowerCase()?' selected':''}>${esc(t)}</option>`).join('')}</select><button class="btn sm ghost" data-fw="harvest">From open schedule</button>`:''}${W.kind==='obs'&&typeof RK!=='undefined'&&RK.risks.length?'<button class="btn sm ghost" data-fw="harvobs">From risk owners</button>':''}${W.kind==='rbs'?'<button class="btn sm ghost" data-fw="harvrbs">From risk categories</button>':''}
      <button class="btn sm aionly" data-fw="aidraft" ${typeof rkAiOk==='function'&&rkAiOk()?'':'disabled'}>${AISPARK} Draft with AI</button><span class="sp"></span>${W.id?'<button class="link danger" data-fw="sdel">Delete</button>':''}</div>`:''}
    <div class="fw-ns"><div class="fw-nh"><span>Code</span><span>Name</span><span>Description</span><span></span></div>
    ${rows.map(({n,dep,kids})=>`<div class="fw-n" style="--dep:${dep}" data-fwn="${esc(n.id)}"><span class="fw-nc"><span class="fw-nd">${kids?'▾':'·'}</span><input data-fwnf="code" data-fwni="${esc(n.id)}" value="${esc(n.code||'')}" aria-label="Code" ${dis}></span><input data-fwnf="name" data-fwni="${esc(n.id)}" value="${esc(n.name||'')}" aria-label="Name" ${dis}><input data-fwnf="desc" data-fwni="${esc(n.id)}" value="${esc(n.desc||'')}" aria-label="Description" ${dis}>
      ${can?`<span class="fw-nb"><button class="fx" data-fwop="child" title="Add a child">+</button><button class="fx" data-fwop="up" title="Move up">↑</button><button class="fx" data-fwop="down" title="Move down">↓</button><button class="fx" data-fwop="out" title="Outdent">←</button><button class="fx" data-fwop="in" title="Indent">→</button><button class="fx" data-fwop="del" title="Delete with its children">×</button></span>`:'<span></span>'}</div>`).join('')||'<p class="muted fw-none">No items yet.</p>'}</div>
    ${can?`<div class="adm-acts rk-cfga"><button class="btn primary" data-fw="ssave" ${W.dirty?'':'disabled'}>Save</button><button class="btn" data-fw="srevert" ${W.dirty&&W.id?'':'disabled'}>Discard changes</button><span class="muted">${rows.length} item${rows.length===1?'':'s'} · ${Math.max(0,...rows.map(r=>r.dep+1))} level${Math.max(0,...rows.map(r=>r.dep+1))===1?'':'s'}</span></div>`:''}`; }
function fwNodeOp(op,id){ const W=FW.work, N=W.data.nodes=W.data.nodes||[], i=N.findIndex(n=>n.id===id), n=N[i];
  const sibs=x=>N.filter(y=>(y.p||null)===(x.p||null)), desc=x=>{ const out=[], st=[x.id]; while(st.length){ const p=st.pop(); N.forEach(y=>{ if(y.p===p){ out.push(y); st.push(y.id); } }); } return out; };
  const nextCode=p=>{ const par=N.find(x=>x.id===p), ks=N.filter(x=>(x.p||null)===(p||null)).length+1; return par&&par.code?`${par.code}.${ks}`:String(ks); };
  if(op==='addtop'){ N.push({id:fwId(),p:null,code:nextCode(null),name:'',desc:''}); }
  else if(!n) return;
  else if(op==='child'){ N.push({id:fwId(),p:n.id,code:nextCode(n.id),name:'',desc:''}); }
  else if(op==='up'||op==='down'){ const s=sibs(n), k=s.indexOf(n), o=s[op==='up'?k-1:k+1]; if(!o) return; const a=N.indexOf(n), b=N.indexOf(o); N[a]=o; N[b]=n; }
  else if(op==='in'){ const s=sibs(n), k=s.indexOf(n); if(k<1) return; n.p=s[k-1].id; N.splice(i,1); N.push(n); }
  else if(op==='out'){ if(!n.p) return; const par=N.find(x=>x.id===n.p); n.p=par?par.p||null:null; N.splice(i,1); N.splice(N.indexOf(par)+1,0,n); }
  else if(op==='del'){ const d=new Set([n.id,...desc(n).map(x=>x.id)]); W.data.nodes=N.filter(x=>!d.has(x.id)); }
  W.dirty=true; fwRender();
  if(op==='addtop'||op==='child'){ const L=document.querySelectorAll('#fwWrap [data-fwnf="name"]'); const last=[...L].find(x=>x.dataset.fwni===W.data.nodes[W.data.nodes.length-1].id); if(last) last.focus(); } }
function fwSchedFiles(){ return (S.files||[]).filter(f=>!f.error&&f.role==='live'&&f.tables); }
function fwSchedCodeTypes(){ return [...new Set(fwSchedFiles().flatMap(f=>(f.tables.ACTVTYPE||[]).map(t=>t.actv_code_type)))].sort(); }
function fwSchedWbs(){ const out=new Map(); fwSchedFiles().forEach(f=>{ const W=f.tables.PROJWBS||[], by=new Map(W.map(w=>[w.wbs_id,w]));
  const path=w=>{ const p=[]; let x=w, g=0; while(x&&x.proj_node_flag!=='Y'&&g++<20){ p.unshift(x); x=by.get(x.parent_wbs_id); } return p; };
  W.filter(w=>w.proj_node_flag!=='Y').forEach(w=>{ const pa=path(w), code=pa.map(x=>x.wbs_short_name).join('.'); if(!out.has(code)) out.set(code,{code,name:w.wbs_name||w.wbs_short_name,parent:pa.length>1?pa.slice(0,-1).map(x=>x.wbs_short_name).join('.'):null,proj:f.name}); }); }); return [...out.values()]; }
function fwSchedCodes(type){ const out=new Map(); fwSchedFiles().forEach(f=>{ const T=f.tables, tid=new Set((T.ACTVTYPE||[]).filter(t=>t.actv_code_type===type).map(t=>t.actv_code_type_id)), C=(T.ACTVCODE||[]).filter(c=>tid.has(c.actv_code_type_id)), by=new Map(C.map(c=>[c.actv_code_id,c]));
  C.forEach(c=>{ const k=c.short_name||c.actv_code_name; if(!out.has(k)) out.set(k,{code:k,name:c.actv_code_name||k,parent:(by.get(c.parent_actv_code_id)||{}).short_name||null}); }); }); return [...out.values()]; }
function fwFromFlat(rows){ const N=[], byCode=new Map(); rows.forEach(r=>{ const code=String(r.code??'').trim(), name=String(r.name??'').trim(); if(!code&&!name) return; const n={id:fwId(),p:null,code,name:name||code,desc:String(r.desc??'').trim()}; N.push(n); if(code) byCode.set(code.toLowerCase(),n); r._n=n; });
  rows.forEach(r=>{ if(!r._n) return; let pc=r.parent!=null&&String(r.parent).trim()?String(r.parent).trim():null; if(!pc&&r._n.code.includes('.')) pc=r._n.code.split('.').slice(0,-1).join('.'); const p=pc&&byCode.get(pc.toLowerCase()); if(p&&p!==r._n) r._n.p=p.id; }); return N; }
function fwFromNested(list,p,out){ out=out||[]; (list||[]).forEach(x=>{ if(!x) return; const n={id:fwId(),p:p||null,code:String(x.code||''),name:String(x.name||''),desc:String(x.desc||x.description||'')}; out.push(n); fwFromNested(x.children,n.id,out); }); return out; }

/* ---- Interfaces ---- */
function fwIfcHtml(){ const s=fwOne('ifc'); if(!FW.ifc||FW.ifc.sid!==(s?s.id:null)) FW.ifc={sid:s?s.id:null,items:fwClone(s?s.data.items||[]:[]),dirty:false};
  const I=FW.ifc, can=fwCanStruct(), dis=can?'':'disabled', P=PER.projects||[], G=PER.programmes||[];
  const projOpts=v=>`<option value="">—</option>${G.map(g=>`<optgroup label="${esc(g.name)}">${P.filter(p=>p.programmeId===g.id).map(p=>`<option value="${esc(p.id)}"${v===p.id?' selected':''}>${esc(p.code||p.name)}</option>`).join('')}</optgroup>`).join('')}${P.filter(p=>!p.programmeId||!G.some(g=>g.id===p.programmeId)).map(p=>`<option value="${esc(p.id)}"${v===p.id?' selected':''}>${esc(p.code||p.name)}</option>`).join('')}`;
  const sched=new Set(), schedT=rkAiSchedOpen&&rkAiSchedOpen()?fwSchedCodeTypes().find(t=>/interface|\bifc\b|i\/f/i.test(t)):null; if(schedT) fwSchedCodes(schedT).forEach(c=>sched.add(c.code.toLowerCase()));
  const rc=c=>typeof RK!=='undefined'?RK.risks.filter(r=>rkLive(r)&&((r.d.ifc||{}).code||'').toLowerCase()===String(c).toLowerCase()):[];
  const unreg=schedT?[...sched].filter(c=>!I.items.some(x=>String(x.code).toLowerCase()===c)):[];
  return `<div class="card fw-ifc">${can?`<div class="fw-bar"><button class="btn sm" data-fwi="add">Add interface</button>${schedT?`<button class="btn sm ghost" data-fwi="harvest">Add ${unreg.length} from open schedule</button>`:''}<button class="btn sm ghost" data-fwi="harvrisk">Add from risks</button><button class="btn sm ghost" data-fw="iimport">Import</button><span class="sp"></span>${I.dirty?'<span class="pill">Unsaved</span>':''}<button class="btn sm primary" data-fwi="save" ${I.dirty?'':'disabled'}>Save</button></div>`:''}
    <p class="muted">Interface IDs are shared: the Risk Workbench offers them on interface risks and Conformance checks schedules and risks against them.${schedT?` The open schedule uses the code type “${esc(schedT)}”.`:' Open a schedule to see which interfaces it carries.'}</p>
    <div class="ptw"><table class="ptab fw-it"><thead><tr><th>ID</th><th style="min-width:220px">Interface</th><th>Giver</th><th>Receiver</th><th>Type</th><th>Need by</th><th>Status</th><th class="num">Risks</th><th>Schedule</th><th></th></tr></thead><tbody>
    ${I.items.map((x,i)=>{ const R=rc(x.code); return `<tr><td><input data-fwii="${i}" data-fwik="code" value="${esc(x.code||'')}" ${dis} aria-label="ID" class="fw-w8"></td><td><input data-fwii="${i}" data-fwik="title" value="${esc(x.title||'')}" ${dis} aria-label="Interface"></td>
      <td><select data-fwii="${i}" data-fwik="g" ${dis} aria-label="Giver">${projOpts(x.g)}</select></td><td><select data-fwii="${i}" data-fwik="r" ${dis} aria-label="Receiver">${projOpts(x.r)}</select></td>
      <td><select data-fwii="${i}" data-fwik="type" ${dis} aria-label="Type">${FW_IFT.map(t=>`<option${x.type===t?' selected':''}>${esc(t)}</option>`).join('')}</select></td><td><input type="date" data-fwii="${i}" data-fwik="need" value="${x.need?xD(x.need):''}" ${dis} aria-label="Need by"></td>
      <td><select data-fwii="${i}" data-fwik="status" ${dis} aria-label="Status">${Object.entries(FW_IFS).map(([k,v])=>`<option value="${k}"${(x.status||'open')===k?' selected':''}>${v}</option>`).join('')}</select></td>
      <td class="num">${R.length?`<button class="link" data-fwir="${esc(x.code)}" title="${esc(R.map(r=>r.ref).join(', '))}">${R.length}</button>`:'—'}</td><td>${schedT?(sched.has(String(x.code).toLowerCase())?'<span class="st pass">In schedule</span>':'<span class="st na">Not found</span>'):'—'}</td><td>${can?`<button class="fx" data-fwidel="${i}" aria-label="Remove">×</button>`:''}</td></tr>`; }).join('')||'<tr><td colspan="10" class="muted">No interfaces in the register yet.</td></tr>'}</tbody></table></div></div>`; }

/* ---- Conformance ---- */
function fwConfHtml(){ const sec=[], pct=(a,b)=>b?Math.round(a/b*100):null, bar=p=>p==null?'<span class="muted">—</span>':`<span class="fw-pb"><i style="width:${p}%;background:${p>=90?'var(--early)':p>=70?'#D99A00':'var(--late)'}"></i></span><b>${p}%</b>`;
  const card=(title,sub,p,list,more)=>`<div class="card fw-cc"><div class="fw-cch"><div><h3>${esc(title)}</h3><span class="muted">${sub}</span></div><div class="fw-ccp">${bar(p)}</div></div>${list&&list.length?`<details${list.length<=6?' open':''}><summary>${list.length} to look at</summary><ul>${list.slice(0,60).map(x=>`<li>${x}</li>`).join('')}${list.length>60?`<li class="muted">and ${list.length-60} more</li>`:''}</ul></details>`:list?'<p class="fw-ok">All good.</p>':''}${more||''}</div>`;
  const P=PER.projects||[], G=PER.programmes||[], req=fwAttrs().filter(f=>f.req);
  const pIss=[]; let bad=0; G.forEach(g=>{ const m=[]; if(!g.code) m.push('code'); fwAttrs('programme').filter(f=>f.req).forEach(f=>{ const v=(g.attrs||{})[f.id]; if(v==null||v==='') m.push(f.l); }); if(m.length){ bad++; pIss.push(`Programme <b>${esc(g.name)}</b> is missing ${esc(m.join(', '))}`); } });
  P.forEach(p=>{ const m=[]; if(!p.code) m.push('code'); if(!p.manager) m.push('manager'); fwAttrs('project').filter(f=>f.req).forEach(f=>{ const v=(p.attrs||{})[f.id]; if(v==null||v==='') m.push(f.l); }); if(m.length){ bad++; pIss.push(`<b>${esc(p.name)}</b> is missing ${esc(m.join(', '))}`); } });
  const codes=[...G,...P].map(x=>(x.code||'').toLowerCase()).filter(Boolean), dupC=[...new Set(codes.filter((c,i)=>codes.indexOf(c)!==i))]; dupC.forEach(c=>pIss.push(`Code <b>${esc(c.toUpperCase())}</b> is used more than once`));
  const okP=G.length+P.length-bad;
  sec.push(card('Portfolio data',`${G.length} programmes · ${P.length} projects${req.length?` · ${req.length} required attribute${req.length===1?'':'s'}`:''}`,pct(okP,G.length+P.length),pIss));
  const sched=rkAiSchedOpen&&rkAiSchedOpen();
  if(sched){ const nm=esc(rkAiSchedName()), W=fwOne('wbs');
    if(W){ const std=fwTree(W.data.nodes||[]), byCode=new Set(std.map(x=>String(x.n.code).toLowerCase())), byName=new Set(std.map(x=>String(x.n.name).toLowerCase())), sw=fwSchedWbs(), bad=sw.filter(w=>!byCode.has(w.code.toLowerCase())&&!byCode.has(w.code.split('.').pop().toLowerCase())&&!byName.has(String(w.name).toLowerCase()));
      sec.push(card(`Schedule WBS against “${W.name}”`,`${nm} · ${sw.length} WBS elements`,pct(sw.length-bad.length,sw.length),bad.map(w=>`<code>${esc(w.code)}</code> ${esc(w.name)} <span class="muted">· ${esc(w.proj)}</span>`))); }
    else sec.push(card('Schedule WBS',`${nm}`,null,null,'<p class="muted">Add a WBS under Structures (or build one from the open schedule) to check against it.</p>'));
    const types=fwSchedCodeTypes(), dicts=fwOf('code');
    types.forEach(t=>{ const d=dicts.find(x=>x.name.toLowerCase()===t.toLowerCase()), vals=fwSchedCodes(t); let n=0; try{ n=(M.codeCount||{})[t]||0; }catch(_){}
      if(!d){ if(/interface|\bifc\b/i.test(t)) return; sec.push(card(`Activity code “${t}”`,`${vals.length} values in the schedule`,null,null,`<p class="muted">No standard for this code type yet.${fwCanStruct()?` <button class="link" data-fw="mkcode" data-fwt2="${esc(t)}">Create one from the schedule</button>`:''}</p>`)); return; }
      const ok=new Set((d.data.nodes||[]).flatMap(x=>[String(x.code).toLowerCase(),String(x.name).toLowerCase()])), bad=vals.filter(v=>!ok.has(String(v.code).toLowerCase()));
      let unc=0; try{ unc=M.rows.filter(r=>r.L&&!r.codes[t]).length; }catch(_){}
      sec.push(card(`Activity code “${t}”`,`${vals.length} values in the schedule · ${unc} live activit${unc===1?'y has':'ies have'} no value`,pct(vals.length-bad.length,vals.length),bad.map(v=>`<code>${esc(v.code)}</code> ${esc(v.name)} isn’t in the standard`))); });
    dicts.filter(d=>!types.some(t=>t.toLowerCase()===d.name.toLowerCase())).forEach(d=>sec.push(card(`Activity code “${d.name}”`,'standard',0,[`The open schedule doesn’t use the code type “${esc(d.name)}”`])));
    const it=types.find(t=>/interface|\bifc\b|i\/f/i.test(t)); if(it){ const reg=new Set(fwIfcItems().map(x=>String(x.code).toLowerCase())), vals=fwSchedCodes(it), bad=vals.filter(v=>!reg.has(v.code.toLowerCase()));
      sec.push(card('Schedule interfaces against the register',`${vals.length} interface IDs in the schedule`,pct(vals.length-bad.length,vals.length),bad.map(v=>`<code>${esc(v.code)}</code> ${esc(v.name)} isn’t in the interface register`))); } }
  else sec.push(card('Schedules','no schedule open',null,null,'<p class="muted">Open a project’s schedule in the Schedule Workbench to check its WBS, activity codes and interfaces against your standards.</p>'));
  if(typeof RK!=='undefined'&&RK.risks.length){ const L=RK.risks.filter(rkLive), cats=fwRbsCats(), obs=new Set(fwObsNames().map(x=>x.toLowerCase())), reg=new Set(fwIfcItems().map(x=>String(x.code).toLowerCase()));
    if(cats.length){ const cs=new Set(cats.map(x=>x.toLowerCase())), bad=L.filter(r=>!cs.has(String(r.d.cat||'').toLowerCase())); sec.push(card('Risk categories against the RBS',`${L.length} live risks`,pct(L.length-bad.length,L.length),bad.map(r=>`<b>${esc(r.ref)}</b> ${esc(r.title)} · category “${esc(r.d.cat||'none')}”`))); }
    else sec.push(card('Risk categories','no RBS yet',null,null,'<p class="muted">Add a Risk Breakdown Structure to standardise categories across every register.</p>'));
    if(obs.size){ const bad=L.filter(r=>r.d.owner&&!obs.has(String(r.d.owner).toLowerCase())), none=L.filter(r=>!r.d.owner); sec.push(card('Risk owners against the OBS',`${L.length} live risks`,pct(L.length-bad.length-none.length,L.length),none.map(r=>`<b>${esc(r.ref)}</b> has no owner`).concat(bad.map(r=>`<b>${esc(r.ref)}</b> owner “${esc(r.d.owner)}” isn’t in the OBS`)))); }
    const I=L.filter(rkIsIfc); if(I.length){ const bad=I.filter(r=>!(r.d.ifc||{}).code||!reg.has(String(r.d.ifc.code).toLowerCase())); sec.push(card('Interface risks against the register',`${I.length} interface risks`,pct(I.length-bad.length,I.length),bad.map(r=>`<b>${esc(r.ref)}</b> ${esc(r.title)} · ${(r.d.ifc||{}).code?`ID “${esc(r.d.ifc.code)}” isn’t registered`:'no interface ID'}`))); } }
  return `<div class="fw-conf">${sec.join('')}</div>`; }

/* ---- events ---- */
async function fwClick(e){ const t=e.target;
  const sel=t.closest('[data-fwsel]'); if(sel){ const [k,id]=sel.dataset.fwsel.split(':'); FW.sel={k,id}; fwRender(); return; }
  const sid=t.closest('[data-fwsid]'); if(sid){ if(FW.work&&FW.work.dirty&&FW.work.id!==sid.dataset.fwsid&&!confirm('Discard unsaved changes to this structure?')) return; FW.sid=sid.dataset.fwsid; FW.work=null; fwRender(); return; }
  const op=t.closest('[data-fwop]'); if(op){ const row=op.closest('[data-fwn]'); fwNodeOp(op.dataset.fwop,row?row.dataset.fwn:null); return; }
  const ii=t.closest('[data-fwidel]'); if(ii){ FW.ifc.items.splice(+ii.dataset.fwidel,1); FW.ifc.dirty=true; fwRender(); return; }
  const ir=t.closest('[data-fwir]'); if(ir){ const r=RK.risks.find(x=>((x.d.ifc||{}).code||'').toLowerCase()===ir.dataset.fwir.toLowerCase()); if(r){ rkApp('risk'); rkOpen(r,'links'); } return; }
  const fi=t.closest('[data-fwi]'); if(fi) return fwIfcAct(fi.dataset.fwi,fi);
  const b=t.closest('[data-fw]'); if(!b) return; const k=b.dataset.fw;
  if(k==='signin'){ if(!document.getElementById('auth')) authStart(); }
  else if(k==='addprog') portProgDialog(); else if(k==='addproj') portProjectDialog(null,{programmeId:FW.sel&&FW.sel.k==='prog'?FW.sel.id:null,after:id=>{ FW.sel={k:'proj',id}; }});
  else if(k==='del'){ const s=FW.sel; if(s.k==='prog') portProgDialog(rkProg(s.id)); else portProjectDialog(rkProj(s.id)); setTimeout(()=>{ const d=document.querySelector('.modal [data-del-prog],.modal [data-del-proj]'); if(d) d.click(); },30); }
  else if(k==='opensched'){ const id=FW.sel.id; rkApp('schedule'); portOpen(id); }
  else if(k==='openrisk'){ const s=FW.sel; rkSetScope(s.k==='prog'?{lv:'programme',id:s.id}:{lv:'project',id:s.id}); rkApp('risk'); }
  else if(k==='attrs') fwAttrsOpen(); else if(k==='import') fwImportPortfolio(); else if(k==='xls') fwExport();
  else if(k==='std') fwStandard(); else if(k==='newstr'||k==='newstr0'){ const kind=k==='newstr0'?'wbs':document.getElementById('fwNewK').value; if(FW.work&&FW.work.dirty&&!confirm('Discard unsaved changes to this structure?')) return; FW.sid=null; FW.work={id:null,kind,name:kind==='code'?'Discipline':FWK[kind].l,data:{nodes:[]},dirty:true}; fwRender(); }
  else if(k==='ssave'){ const W=FW.work; if(!W.name.trim()){ perToast('Give the structure a name.','err'); return; } b.disabled=true; try{ W.data.nodes=fwTree(W.data.nodes).map(x=>x.n); const id=await fwSave({id:W.id,kind:W.kind,name:W.name.trim(),data:W.data,sort:W.sort||0}); FW.sid=id; W.id=id; W.dirty=false; perToast(`Saved ${W.name}.`); fwRender(); }catch(er){ b.disabled=false; perToast(perErr(er),'err'); } }
  else if(k==='srevert'){ FW.work=null; fwRender(); }
  else if(k==='sdel'){ if(!confirmIn(b,'Click again to delete')) return; try{ await PER.store.deleteStructure(FW.work.id); FW.work=null; FW.sid=null; perToast('Structure deleted.'); }catch(er){ perToast(perErr(er),'err'); } }
  else if(k==='simport') fwImportNodes(); else if(k==='aidraft') fwAiDraft();
  else if(k==='harvest'){ const W=FW.work, rows=W.kind==='wbs'?fwSchedWbs():fwSchedCodes((document.getElementById('fwHarvT')||{}).value||W.name); if(!rows.length){ perToast('Nothing found in the open schedule.','err'); return; } fwMerge(fwFromFlat(rows),`${rows.length} item${rows.length===1?'':'s'} from the open schedule`); }
  else if(k==='harvobs'){ const own=[...new Set(RK.risks.flatMap(r=>[r.d.owner,(r.d.resp||{}).owner,...rkActs(r).map(a=>a.owner)]).filter(Boolean))].sort(); fwMerge(own.map((n,i)=>({id:fwId(),p:null,code:'R'+String(i+1).padStart(2,'0'),name:n,desc:''})),`${own.length} owners from the risk registers`); }
  else if(k==='harvrbs'){ const c=[...new Set(rkCfg().cats.concat(RK.risks.map(r=>r.d.cat)).filter(Boolean))]; fwMerge(c.map((n,i)=>({id:fwId(),p:null,code:'R'+(i+1),name:n,desc:''})),`${c.length} categories`); }
  else if(k==='mkcode'){ const tname=b.dataset.fwt2; try{ await fwSave({kind:'code',name:tname,data:{nodes:fwFromFlat(fwSchedCodes(tname))}}); perToast(`Created the “${tname}” standard from the open schedule.`); }catch(er){ perToast(perErr(er),'err'); } } }
function fwMerge(nodes,what){ const W=FW.work, have=new Set((W.data.nodes||[]).map(n=>(String(n.code)+'|'+String(n.name)).toLowerCase())), add=nodes.filter(n=>!have.has((String(n.code)+'|'+String(n.name)).toLowerCase()));
  const ids=new Set(add.map(n=>n.id)); add.forEach(n=>{ if(n.p&&!ids.has(n.p)){ const orig=nodes.find(x=>x.id===n.p), ex=orig&&(W.data.nodes||[]).find(x=>String(x.code).toLowerCase()===String(orig.code).toLowerCase()); n.p=ex?ex.id:null; } });
  W.data.nodes=(W.data.nodes||[]).concat(add); W.dirty=true; perToast(add.length?`Added ${add.length} of ${what}. Save to keep them.`:`Nothing new in ${what}.`); fwRender(); }
async function fwChange(e){ const t=e.target;
  if(t.dataset.fwii!=null){ const x=FW.ifc.items[+t.dataset.fwii], k=t.dataset.fwik; x[k]=k==='need'?(t.value?Date.parse(t.value+'T00:00:00Z'):null):t.value; FW.ifc.dirty=true; if(t.tagName==='SELECT'||t.type==='date') fwRender(); return; }
  if(t.id==='fwHarvT') return; }
function fwInput(e){ const t=e.target;
  if(t.id==='fwQ'){ clearTimeout(fwInput._t); fwInput._t=setTimeout(()=>{ FW.q=t.value; fwRender(); },180); return; }
  if(t.dataset.fwnf){ const n=(FW.work.data.nodes||[]).find(x=>x.id===t.dataset.fwni); if(n){ n[t.dataset.fwnf]=t.value; if(!FW.work.dirty){ FW.work.dirty=true; fwRender(); } } return; }
  if(t.dataset.fwname!=null){ FW.work.name=t.value; if(!FW.work.dirty){ FW.work.dirty=true; fwRender(); } return; }
  if(t.dataset.fwii!=null&&t.tagName==='INPUT'&&t.type!=='date'){ FW.ifc.items[+t.dataset.fwii][t.dataset.fwik]=t.value; if(!FW.ifc.dirty){ FW.ifc.dirty=true; fwRender(); } } }
document.addEventListener('submit',async e=>{ const f=e.target; if(!f.dataset||!f.dataset.fwform) return; e.preventDefault(); const [k,id]=f.dataset.fwform.split(':'), x=k==='prog'?rkProg(id):rkProj(id); if(!x) return;
  const o={}; f.querySelectorAll('[data-fwf]').forEach(i=>{ if(i.type==='radio'){ if(i.checked) o[i.dataset.fwf]=i.value; return; } o[i.dataset.fwf]=i.dataset.fwf==='programmeId'?(i.value||null):i.value.trim(); });
  const at=Object.assign({},x.attrs||{}); f.querySelectorAll('[data-fwattr]').forEach(i=>{ const fd=fwAttrs().find(a=>a.id===i.dataset.fwattr); at[i.dataset.fwattr]=i.value===''?'':fd&&fd.type==='number'?+i.value:fd&&fd.type==='date'?Date.parse(i.value+'T00:00:00Z'):i.value; }); o.attrs=at;
  if(!o.name){ perToast('Give it a name.','err'); return; }
  const miss=fwAttrs(k==='prog'?'programme':'project').filter(a=>a.req&&(at[a.id]==null||at[a.id]===''));
  await perRun('Saving…',async()=>{ if(k==='prog') await PER.store.updateProgramme(id,o); else await PER.store.updateProject(id,o); perToast(miss.length?`Saved. Still missing: ${miss.map(a=>a.l).join(', ')}.`:'Saved.'); }); });
async function fwIfcAct(k,b){ const I=FW.ifc;
  if(k==='add'){ I.items.push({id:fwId(),code:'',title:'',g:'',r:'',type:FW_IFT[1],need:null,status:'open'}); I.dirty=true; fwRender(); const ins=document.querySelectorAll('#fwWrap [data-fwik="code"]'); if(ins.length) ins[ins.length-1].focus(); }
  else if(k==='harvest'){ const t=fwSchedCodeTypes().find(x=>/interface|\bifc\b|i\/f/i.test(x)), have=new Set(I.items.map(x=>String(x.code).toLowerCase())); let n=0; fwSchedCodes(t).forEach(c=>{ if(!have.has(c.code.toLowerCase())){ I.items.push({id:fwId(),code:c.code,title:c.name,g:'',r:'',type:FW_IFT[1],need:null,status:'open'}); n++; } }); I.dirty=!!n||I.dirty; perToast(n?`Added ${n} interface${n===1?'':'s'}. Set giver and receiver, then Save.`:'Nothing new in the schedule.'); fwRender(); }
  else if(k==='harvrisk'){ const have=new Set(I.items.map(x=>String(x.code).toLowerCase())); let n=0; (typeof RK!=='undefined'?RK.risks:[]).filter(rkIsIfc).forEach(r=>{ const c=(r.d.ifc||{}).code, P=rkIfcPids(r); if(c&&!have.has(c.toLowerCase())){ have.add(c.toLowerCase()); I.items.push({id:fwId(),code:c,title:r.title,g:P[0]||'',r:P[1]||'',type:FW_IFT[1],need:null,status:'open'}); n++; } }); I.dirty=!!n||I.dirty; perToast(n?`Added ${n} from interface risks. Save to keep them.`:'No new interface IDs on risks.'); fwRender(); }
  else if(k==='save'){ const bad=I.items.filter(x=>!String(x.code).trim()); if(bad.length){ perToast('Every interface needs an ID.','err'); return; } const codes=I.items.map(x=>String(x.code).trim().toLowerCase()); if(new Set(codes).size!==codes.length){ perToast('Interface IDs must be unique.','err'); return; }
    b.disabled=true; try{ const s=fwOne('ifc'); await fwSave({id:s?s.id:null,kind:'ifc',name:'Interface register',data:{items:I.items.map(x=>Object.assign({},x,{code:String(x.code).trim()}))}}); I.dirty=false; FW.ifc=null; perToast('Interface register saved.'); fwRender(); }catch(er){ b.disabled=false; perToast(perErr(er),'err'); } } }

/* ---- attributes ---- */
function fwAttrsOpen(){ if(!fwCanStruct()) return; const s=fwOne('attrs'); FW.af=fwClone(s?s.data.fields||[]:[]); const d=coModal('fwAttrM','wide'); d.addEventListener('click',fwAttrClick); d.addEventListener('change',fwAttrChange); fwAttrRender(); }
function fwAttrRender(){ const d=document.getElementById('fwAttrM'); if(!d) return; const F=FW.af;
  d.querySelector('.mcard').innerHTML=`<div class="mh"><h2>Programme and project attributes</h2><button class="fx" data-cox aria-label="Close">×</button></div><p>Fields every programme or project carries — sector, region, contract type, client, budget, key dates. They appear on the Portfolio tab, in Excel exports and imports, and Conformance flags missing required ones.</p>
    <div class="rk-fl">${F.map((f,i)=>`<div class="fw-af"><input data-fwa="${i}" data-k="l" value="${esc(f.l)}" aria-label="Name"><select data-fwa="${i}" data-k="type" aria-label="Type">${[['text','Text'],['number','Number'],['date','Date'],['choice','Choice']].map(([v,l])=>`<option value="${v}"${f.type===v?' selected':''}>${l}</option>`).join('')}</select><select data-fwa="${i}" data-k="on" aria-label="Applies to">${[['project','Projects'],['programme','Programmes'],['both','Both']].map(([v,l])=>`<option value="${v}"${(f.on||'project')===v?' selected':''}>${l}</option>`).join('')}</select>${f.type==='choice'?`<input data-fwa="${i}" data-k="opts" value="${esc((f.opts||[]).join(', '))}" placeholder="Options, separated by commas" aria-label="Options">`:'<span></span>'}<label class="tg"><input type="checkbox" data-fwa="${i}" data-k="req" ${f.req?'checked':''}> Required</label><button type="button" class="fx" data-fwadel="${i}" aria-label="Remove">×</button></div>`).join('')}<button type="button" class="btn sm" data-fwaadd>Add a field</button></div>
    <div class="mrow"><span class="sp"></span><button class="btn" data-cox>Cancel</button><button class="btn primary" data-fwasave>Save</button></div>`; }
function fwAttrClick(e){ const t=e.target; if(t.closest('[data-fwaadd]')){ FW.af.push({id:'a'+Date.now().toString(36),l:'New field',type:'text',on:'project',req:false}); fwAttrRender(); }
  else if(t.closest('[data-fwadel]')){ FW.af.splice(+t.closest('[data-fwadel]').dataset.fwadel,1); fwAttrRender(); }
  else if(t.closest('[data-fwasave]')){ const s=fwOne('attrs'); fwSave({id:s?s.id:null,kind:'attrs',name:'Project attributes',data:{fields:FW.af.filter(f=>String(f.l).trim())}}).then(()=>{ perToast('Attributes saved.'); const m=document.getElementById('fwAttrM'); if(m) m.remove(); }).catch(er=>perToast(perErr(er),'err')); } }
function fwAttrChange(e){ const t=e.target, i=t.dataset.fwa; if(i==null) return; const f=FW.af[+i], k=t.dataset.k; f[k]=k==='req'?t.checked:k==='opts'?t.value.split(',').map(s=>s.trim()).filter(Boolean):t.value; if(k==='type') fwAttrRender(); }

/* ---- import / export ---- */
function fwPickFile(accept){ return new Promise(res=>{ const i=document.createElement('input'); i.type='file'; i.accept=accept; i.onchange=()=>res(i.files[0]||null); i.click(); }); }
async function fwReadRows(f){ const ext=(f.name.split('.').pop()||'').toLowerCase(); let aoa;
  if(/^xls/.test(ext)){ await loadScript(LIB.xlsx); const wb=window.XLSX.read(await f.arrayBuffer(),{type:'array'}); aoa=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,blankrows:false,raw:false}); }
  else { const txt=await f.text(), out=[]; let row=[], cell='', q=false; for(let i=0;i<txt.length;i++){ const c=txt[i]; if(q){ if(c==='"'){ if(txt[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=c; } else if(c==='"') q=true; else if(c===','||c==='\t'){ row.push(cell); cell=''; } else if(c==='\n'||c==='\r'){ if(c==='\r'&&txt[i+1]==='\n') i++; row.push(cell); cell=''; if(row.some(x=>x.trim())) out.push(row); row=[]; } else cell+=c; } row.push(cell); if(row.some(x=>x.trim())) out.push(row); aoa=out; }
  const head=(aoa[0]||[]).map(h=>String(h||'').trim().toLowerCase()); return {head,rows:aoa.slice(1)}; }
async function fwImportNodes(){ const f=await fwPickFile('.xlsx,.xls,.csv,.txt'); if(!f) return;
  try{ const {head,rows}=await fwReadRows(f), col=re=>head.findIndex(h=>re.test(h)); const ci=col(/^(code|id|wbs|ref)/), ni=col(/name|title|description of|label/), di=col(/desc|notes/), pi=col(/parent/), li=col(/^level|depth/);
    if(ci<0&&ni<0) throw new Error('Use columns Code, Name and optionally Parent, Level or Description.');
    let list=rows.map(r=>({code:ci>=0?r[ci]:'',name:ni>=0?r[ni]:'',desc:di>=0&&di!==ni?r[di]:'',parent:pi>=0?r[pi]:null,level:li>=0?+r[li]:null}));
    if(li>=0&&pi<0){ const st=[]; list.forEach(x=>{ const lv=Math.max(1,x.level||1); st.length=lv-1; x.parent=st[lv-2]?st[lv-2].code:null; st[lv-1]=x; }); }
    fwMerge(fwFromFlat(list),`${list.length} rows from ${f.name}`); }catch(er){ perToast(er.message||'Could not read that file.','err'); } }
async function fwImportPortfolio(){ const f=await fwPickFile('.xlsx,.xls,.csv,.txt'); if(!f) return;
  try{ const {head,rows}=await fwReadRows(f), col=re=>head.findIndex(h=>re.test(h));
    const gN=col(/^programme( name)?$|^program( name)?$/), gC=col(/^programme code|^program code/), pN=col(/^project( name)?$/), pC=col(/^project code|^code$/), mg=col(/manager/), stt=col(/status/), ds=col(/desc/), cl=col(/client/);
    if(pN<0&&gN<0) throw new Error('Use columns Programme, Programme code, Project, Project code, Manager, Status, Description, and any attribute names.');
    const A=fwAttrs(), ac=A.map(a=>({a,i:head.indexOf(a.l.toLowerCase())})).filter(x=>x.i>=0);
    const plan={g:new Map(),p:[]};
    rows.forEach(r=>{ const gname=gN>=0?String(r[gN]||'').trim():'', gcode=gC>=0?String(r[gC]||'').trim():''; if(gname&&!plan.g.has(gname.toLowerCase())) plan.g.set(gname.toLowerCase(),{name:gname,code:gcode,client:cl>=0?String(r[cl]||'').trim():''});
      const pname=pN>=0?String(r[pN]||'').trim():''; if(pname){ const at={}; ac.filter(x=>['project','both'].includes(x.a.on||'project')).forEach(x=>{ const v=r[x.i]; if(v!=null&&v!=='') at[x.a.id]=x.a.type==='number'?+v:x.a.type==='date'?Date.parse(String(v).slice(0,10)+'T00:00:00Z')||'':String(v); });
        const st=String(stt>=0?r[stt]||'':'').toLowerCase(), sk=Object.keys(PSTAT).find(k=>k===st.replace(/\s+/g,'_')||PSTAT[k].toLowerCase()===st)||'active';
        plan.p.push({prog:gname.toLowerCase(),name:pname,code:pC>=0?String(r[pC]||'').trim():'',manager:mg>=0?String(r[mg]||'').trim():'',status:sk,description:ds>=0?String(r[ds]||'').trim():'',attrs:at}); } });
    const findG=x=>PER.programmes.find(g=>(x.code&&g.code&&g.code.toLowerCase()===x.code.toLowerCase())||g.name.toLowerCase()===x.name.toLowerCase());
    const findP=x=>PER.projects.find(p=>(x.code&&p.code&&p.code.toLowerCase()===x.code.toLowerCase())||p.name.toLowerCase()===x.name.toLowerCase());
    const newG=[...plan.g.values()].filter(x=>!findG(x)).length, newP=plan.p.filter(x=>!findP(x)).length, upP=plan.p.length-newP;
    perDialog('Import portfolio',`<p>From <b>${esc(f.name)}</b>: create <b>${newG}</b> programme${newG===1?'':'s'} and <b>${newP}</b> project${newP===1?'':'s'}, and update <b>${upP}</b> existing project${upP===1?'':'s'} (matched by code, then name).${ac.length?` Attributes read: ${ac.map(x=>esc(x.a.l)).join(', ')}.`:''}</p>`,'Import',async()=>{
      await perRun('Importing…',async()=>{ const gid={}; for(const [k,x] of plan.g){ const g=findG(x); gid[k]=g?g.id:await PER.store.createProgramme({name:x.name,code:x.code,client:x.client,colour:PCOL[Object.keys(gid).length%PCOL.length]}); if(g&&(x.code&&!g.code)) await PER.store.updateProgramme(g.id,{code:x.code}); }
        let n=0; for(const x of plan.p){ const p=findP(x), f2={programmeId:gid[x.prog]||(p?p.programmeId:null),code:x.code,manager:x.manager,status:x.status,description:x.description};
          if(p){ const o={}; Object.entries(f2).forEach(([k,v])=>{ if(v) o[k]=v; }); o.attrs=Object.assign({},p.attrs||{},x.attrs); await PER.store.updateProject(p.id,o); } else { const id=await PER.store.createProject(x.name,f2); if(Object.keys(x.attrs).length) await PER.store.updateProject(id,{attrs:x.attrs}); } n++; }
        perToast(`Imported ${n} project${n===1?'':'s'}.`); }); }); }catch(er){ perToast(er.message||'Could not read that file.','err'); } }
function fwExport(){ const A=fwAttrs(), sheets=[];
  sheets.push({name:'Portfolio',rows:[['Programme','Programme code','Client','Project','Project code','Manager','Status','Description'].concat(A.map(a=>a.l))].concat((PER.projects||[]).map(p=>{ const g=rkProg(p.programmeId)||{}; return [g.name||'',g.code||'',g.client||'',p.name,p.code||'',p.manager||'',PSTAT[p.status]||p.status||'',p.description||''].concat(A.map(a=>{ const v=(p.attrs||{})[a.id]; return a.type==='date'?xD(v):v??''; })); }))});
  FW.structs.filter(s=>FWK[s.kind]&&FWK[s.kind].tree).forEach(s=>{ const T=fwTree(s.data.nodes||[]); sheets.push({name:`${FWK[s.kind].s} ${s.name}`.replace(/[\\/?*[\]:]/g,' ').slice(0,31),rows:[['Code','Name','Parent code','Level','Description']].concat(T.map(x=>[x.n.code,x.n.name,(x.path[x.path.length-2]||{}).code||'',x.dep+1,x.n.desc||'']))}); });
  const I=fwIfcItems(); if(I.length) sheets.push({name:'Interfaces',rows:[['ID','Interface','Giver','Receiver','Type','Need by','Status']].concat(I.map(x=>[x.code,x.title||'',(rkProj(x.g)||{}).code||(rkProj(x.g)||{}).name||'',(rkProj(x.r)||{}).code||(rkProj(x.r)||{}).name||'',x.type||'',xD(x.need),FW_IFS[x.status||'open']]))});
  xlsSave(`Framework ${new Date().toISOString().slice(0,10)}`,sheets); }

/* ---- standard set ---- */
async function fwStandard(){ if(!fwCanStruct()) return; const have=k=>fwOf(k).length;
  const T=(rows)=>fwFromNested(rows.map(r=>({code:r[0],name:r[1],children:(r[2]||[]).map(c=>({code:c[0],name:c[1],children:(c[2]||[]).map(d=>({code:d[0],name:d[1]}))}))})));
  const S0=[];
  if(!have('wbs')) S0.push({kind:'wbs',name:'Standard WBS',data:{nodes:T([['1','Programme management',[['1.1','Project management'],['1.2','Consents & stakeholders'],['1.3','Health, safety & environment']]],['2','Design',[['2.1','Concept & preliminary design'],['2.2','Detailed design'],['2.3','Design assurance']]],['3','Procurement',[['3.1','Long-lead equipment'],['3.2','Subcontract packages']]],['4','Enabling works',[['4.1','Utilities diversions'],['4.2','Site establishment']]],['5','Civil & structural works',[['5.1','Earthworks & drainage'],['5.2','Structures'],['5.3','Buildings & stations']]],['6','Systems',[['6.1','Track & power'],['6.2','Signalling & control'],['6.3','MEP & communications']]],['7','Testing & commissioning',[['7.1','Static testing'],['7.2','Integrated testing']]],['8','Handover & close-out',[['8.1','Operational readiness'],['8.2','Close-out']]],['KD','Key dates & interfaces']])}});
  if(!have('obs')) S0.push({kind:'obs',name:'Delivery organisation',data:{nodes:T([['CL','Client',[['CL-SRO','Senior Responsible Owner']]],['PF','Portfolio',[['PF-DIR','Portfolio Director'],['PF-COM','Commercial Director'],['PF-PMO','PMO Lead'],['PF-RSK','Head of Risk'],['PF-UTL','Head of Utilities'],['PF-ASR','Head of Assurance']]],['PG','Programme',[['PG-DIR','Programme Director'],['PG-IFM','Interface Manager'],['PG-COM','Commercial Lead']]],['PJ','Project',[['PJ-PM','Project Manager'],['PJ-DM','Design Manager'],['PJ-PKG','Package Manager'],['PJ-SM','Site Manager'],['PJ-CM','Cost Manager']]],['SC','Supply chain',[['SC-TJV','Tier 1 contractors'],['SC-SYS','Systems contractors']]]])}});
  if(!have('rbs')){ const cats=rkCfg().cats; const sub={Commercial:['Inflation & market','Contract & claims','Funding'],Design:['Design maturity','Design change','Approvals'],Construction:['Ground conditions','Productivity','Temporary works'],Interfaces:['Physical interfaces','Access & handovers','Information'],'Stakeholder & consents':['Planning & consents','Community','Regulation'],Environmental:['Contamination','Ecology','Weather'],'Health & safety':['Construction safety','Operational safety'],'Third parties & utilities':['Utilities','Network operators','Neighbours'],'Supply chain':['Capacity & labour','Long-lead equipment','Insolvency'],'Operational readiness':['Testing & commissioning','Operator readiness'],'Funding & governance':['Approvals & governance','Scope change']};
    S0.push({kind:'rbs',name:'Risk Breakdown Structure',data:{nodes:fwFromNested(cats.map((c,i)=>({code:'R'+(i+1),name:c,children:(sub[c]||[]).map((s,j)=>({code:`R${i+1}.${j+1}`,name:s}))})))}}); }
  if(!have('cbs')) S0.push({kind:'cbs',name:'Cost Breakdown Structure',data:{nodes:T([['C1','Construction',[['C1.1','Direct works'],['C1.2','Preliminaries']]],['C2','Design & engineering'],['C3','Client costs',[['C3.1','Project management'],['C3.2','Land & consents']]],['C4','Risk & contingency',[['C4.1','Quantified risk'],['C4.2','Management reserve']]],['C5','Inflation']])}});
  const sample=typeof SP_DEFS!=='undefined'&&(PER.programmes||[]).some(g=>SP_DEFS[g.code]);
  if(!have('code')&&!sample) S0.push({kind:'code',name:'Discipline',data:{nodes:fwFromNested([['ENB','Enabling works'],['CIV','Civils & earthworks'],['STR','Structures'],['ARC','Architecture & fit-out'],['MEP','Mechanical & electrical'],['TRK','Track'],['SYS','Systems'],['TNC','Testing & commissioning'],['KEY','Key dates']].map(([c,n])=>({code:c,name:n})))}});
  if(!have('code')&&sample){ const u=k=>{ const m=new Map(); Object.values(SP_DEFS).forEach(D=>(D[k]||[]).forEach(([c,n])=>{ if(!m.has(c)) m.set(c,n); })); return [...m].map(([c,n])=>({code:c,name:n})); };
    S0.push({kind:'code',name:'Discipline',data:{nodes:fwFromNested(u('disc'))}}); S0.push({kind:'code',name:'Contractor',data:{nodes:fwFromNested(u('ctr'))}}); }
  if(!have('attrs')) S0.push({kind:'attrs',name:'Project attributes',data:{fields:[{id:'sector',l:'Sector',type:'choice',on:'both',opts:['Rail & metro','Highways','Buildings & regeneration','Data centres','Energy & utilities','Water'],req:true},{id:'region',l:'Region',type:'text',on:'both'},{id:'contract',l:'Contract type',type:'choice',on:'project',opts:['NEC4 ECC A','NEC4 ECC C','NEC4 ECC E','FIDIC Red','FIDIC Yellow','Design & build','Alliance','Other'],req:true},{id:'bac',l:'Budget (BAC)',type:'number',on:'project'},{id:'start',l:'Planned start',type:'date',on:'project'},{id:'finish',l:'Planned finish',type:'date',on:'project'}]}});
  if(!have('ifc')&&sample){ const pc=c=>(PER.projects.find(p=>p.code===c)||{}).id||''; const map={'IF-07':['NXR-DP2',''],'IF-WS-01':['WSQ-PR','WSQ-A'],'IF-WS-02':['WSQ-A','WSQ-PR'],'IF-HL-01':['HLM-TS','HLM-RS'],'IF-HL-02':['HLM-TS','HLM-RS'],'IF-HL-03':['HLM-TS','HLM-RS'],'IF-HL-11':['HLM-TS','HLM-RS'],'IF-HL-12':['HLM-TS','HLM-RS'],'IF-HL-13':['HLM-TS','HLM-RS'],'IF-HL-14':['HLM-TS','HLM-RS'],'IF-HL-30':['HLM-TS','HLM-RS'],'IF-DC-01':['NDC-SC','NDC-ME'],'IF-DC-02':['NDC-SC','NDC-ME'],'IF-DC-03':['NDC-SC','NDC-ME']};
    const items=[]; Object.values(SP_DEFS).forEach(D=>(D.ifc||[]).forEach(([c,n])=>{ if(!map[c]) return; items.push({id:fwId(),code:c,title:n,g:pc(map[c][0]),r:pc(map[c][1]),type:/power/i.test(n)?'Utility / power':/access|road/i.test(n)?'Access':'Handover',need:null,status:'open'}); }));
    if(items.length) S0.push({kind:'ifc',name:'Interface register',data:{items}}); }
  if(!S0.length){ perToast('The standard structures are already here.'); return; }
  await perRun('Adding standard structures…',async()=>{ for(const s of S0) await fwSave(s); perToast(`Added ${S0.length} structure${S0.length===1?'':'s'}. Edit them to match your standards.`); }); }

/* ---- AI drafting of a structure ---- */
async function fwAiDraft(){ if(!rkAiOk()) return; const W=FW.work, K=FWK[W.kind];
  const d=perDialog(`Draft ${K.l.toLowerCase()} with AI`,`<label class="pfl"><span>What should it cover?</span><textarea id="fwAiB" rows="4" placeholder="e.g. A WBS for an 8 km metro with four underground stations, tunnels by TBM, and a systems contract. Three levels."></textarea></label><p class="muted">Claude uses your portfolio${rkAiSchedOpen()?' and the open schedule':''} and the items already in “${esc(W.name)}”. The draft is added to this structure for you to edit and save.</p><p class="muted" data-st></p>`,'Draft',async dd=>{
    const brief=dd.querySelector('#fwAiB').value.trim(), st=dd.querySelector('[data-st]'); st.textContent='Drafting…';
    try{ const js=await AI.sample.json(`You are a senior project controls lead setting company standards for major infrastructure programmes.
Draft a ${K.l} (${W.kind.toUpperCase()}) named "${W.name}". ${K.d}
${W.kind==='code'?`It is the allowed value list for the P6 activity code type "${W.name}". Use short codes (2-5 characters).`:'Use hierarchical codes (1, 1.1, 1.1.1) unless the existing items use another style. Two or three levels.'}
${brief?`Brief: ${brief}`:''}

${rkAiStructure()}
${W.data.nodes&&W.data.nodes.length?`\nEXISTING ITEMS (keep consistent, do not repeat)\n${fwTree(W.data.nodes).map(x=>'  '.repeat(x.dep)+x.n.code+' '+x.n.name).join('\n')}`:''}
${rkAiSchedOpen()&&(W.kind==='wbs'||W.kind==='code')?`\nOPEN SCHEDULE WBS AND CODES\n${fwSchedWbs().slice(0,150).map(w=>w.code+' '+w.name).join('\n')}\n${fwSchedCodeTypes().map(t=>t+': '+fwSchedCodes(t).slice(0,40).map(c=>c.code+' '+c.name).join('; ')).join('\n')}`:''}

Reply with JSON only: {"nodes":[{"code":"…","name":"…","desc":"one line, optional","children":[…]}]}`,{modelTier:'default',cache:false});
      const N=fwFromNested(js&&js.nodes); if(!N.length) throw {code:'invalid_json'}; fwMerge(N,'the AI draft'); }
    catch(e){ st.textContent=e&&e.code==='invalid_json'?'The draft could not be read. Try again.':(AI_ERR[e&&e.code]||AI_ERR.upstream_error); return false; } }); }
