/* ================= Risk Workbench: shell, views and editor ================= */
const RLOGO='<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)"/><rect x="6" y="6" width="6" height="6" rx="1.5" fill="#fff" opacity=".45"/><rect x="13" y="6" width="6" height="6" rx="1.5" fill="#fff" opacity=".7"/><rect x="20" y="6" width="6" height="6" rx="1.5" fill="#fff"/><rect x="6" y="13" width="6" height="6" rx="1.5" fill="#fff" opacity=".3"/><rect x="13" y="13" width="6" height="6" rx="1.5" fill="#fff" opacity=".45"/><rect x="20" y="13" width="6" height="6" rx="1.5" fill="#fff" opacity=".7"/><rect x="6" y="20" width="6" height="6" rx="1.5" fill="#fff" opacity=".2"/><rect x="13" y="20" width="6" height="6" rx="1.5" fill="#fff" opacity=".3"/><rect x="20" y="20" width="6" height="6" rx="1.5" fill="#fff" opacity=".45"/></svg>';
const RTABS=[['over','Overview'],['reg','Register'],['tree','Hierarchy'],['ifc','Interfaces'],['resp','Responses']];

/* ---- switching between the Schedule, Risk and Framework workbenches ---- */
const FLOGO='<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)"/><rect x="12" y="5.5" width="8" height="6" rx="1.5" fill="#fff"/><rect x="4.5" y="20.5" width="8" height="6" rx="1.5" fill="#fff" opacity=".8"/><rect x="19.5" y="20.5" width="8" height="6" rx="1.5" fill="#fff" opacity=".8"/><path d="M16 11.5v4.5M8.5 20.5V16h15v4.5" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
const APPS={schedule:{n:'Schedule',d:'P6 schedules, updates, quality and reporting',hash:''},risk:{n:'Risk',d:'Risk registers, interfaces and responses',hash:'#risk'},frame:{n:'Framework',d:'Portfolio set-up, breakdown structures, codes and standards',hash:'#framework'}};
const appLogo=a=>a==='risk'?RLOGO:a==='frame'?FLOGO:((document.querySelector('.top .brand')||{})._slogo||LOGO);
function rkBrand(){ const br=document.querySelector('.top .brand'); if(!br) return; const A=APPS[RK.app]||APPS.schedule, nm=br.querySelector('.bname'), b=(typeof PER!=='undefined'&&PER.mode==='supa'&&PER.company&&PER.company.branding)||{};
  const svg=br.querySelector('svg'); if(svg&&!b.logo){ if(!br._slogo) br._slogo=svg.outerHTML; svg.outerHTML=appLogo(RK.app); }
  if(nm){ if(b.title){ nm.innerHTML=esc(b.title)+`<em class="apptag">${A.n}</em>`; } else nm.innerHTML=`${A.n} <span>Workbench</span>`; }
  br.setAttribute('aria-label',A.n+' Workbench. Switch workbench'); document.title=A.n+' Workbench'; }
function rkApp(app,o){ o=o||{}; app=APPS[app]?app:'schedule'; const prev=RK.app; RK.app=app; try{ localStorage.setItem('pacer.app',app); }catch(_){}
  if(!o.keepHash){ try{ history.replaceState(null,'',APPS[app].hash||location.pathname+location.search); }catch(_){} }
  document.body.classList.toggle('app-risk',app==='risk'); document.body.classList.toggle('app-frame',app==='frame'); document.body.classList.toggle('app-alt',app!=='schedule'); rkBrand();
  document.getElementById('rkNav').hidden=app!=='risk'; document.getElementById('rkScopeW').hidden=app!=='risk'; document.getElementById('riskWrap').hidden=app!=='risk';
  document.getElementById('fwNav').hidden=app!=='frame'; document.getElementById('fwWrap').hidden=app!=='frame';
  if(app!=='risk'&&typeof rkAiPanel==='function'&&RKAI.open) rkAiPanel(false);
  if(app!=='schedule'){ if(S.tab==='admin') setTab('port'); if(typeof aiPanel==='function'&&!document.getElementById('aiWrap').hidden) aiPanel(false); hideDrawer&&hideDrawer(); if(app==='risk') rkRender(); else fwRender(); window.scrollTo(0,0); }
  else redraw(); }
function rkAppMenu(){ const m=document.getElementById('appMenu'); const it=k=>`<button class="appi${RK.app===k?' cur':''}" data-app="${k}" role="menuitemradio" aria-checked="${RK.app===k}"><span class="appic">${appLogo(k)}</span><span><b>${APPS[k].n} Workbench</b><span class="muted">${APPS[k].d}</span></span>${RK.app===k?'<span class="appok" aria-hidden="true">✓</span>':''}</button>`;
  m.innerHTML=`<div class="cxm-h">Switch workbench</div>${Object.keys(APPS).map(it).join('')}`; }
function wireRk(){
  const top=document.querySelector('.top .brand'), m=document.getElementById('appMenu'); if(!top||!m) return;
  const close=()=>{ m.hidden=true; top.setAttribute('aria-expanded','false'); };
  top.onclick=e=>{ e.stopPropagation(); if(!m.hidden){ close(); return; } rkAppMenu(); m.hidden=false; top.setAttribute('aria-expanded','true'); const c=m.querySelector('.appi.cur'); if(c) c.focus(); };
  m.addEventListener('click',e=>{ const b=e.target.closest('[data-app]'); if(!b) return; close(); if(b.dataset.app!==RK.app) rkApp(b.dataset.app); });
  document.addEventListener('click',e=>{ if(!m.hidden&&!m.contains(e.target)&&!top.contains(e.target)) close(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!m.hidden){ close(); top.focus(); } });
  document.getElementById('rkNav').addEventListener('click',e=>{ const b=e.target.closest('[data-rkt]'); if(b) rkGo(b.dataset.rkt); });
  const sb=document.getElementById('rkScope'), sm=document.getElementById('rkScopeMenu'), sclose=()=>{ sm.hidden=true; sb.setAttribute('aria-expanded','false'); };
  sb.onclick=e=>{ e.stopPropagation(); if(!sm.hidden){ sclose(); return; } sm.dataset.q=''; rkScopeMenu(); sm.hidden=false; sb.setAttribute('aria-expanded','true'); const q=document.getElementById('rkScQ'); if(q) q.focus(); };
  sm.addEventListener('input',e=>{ if(e.target.id==='rkScQ'){ sm.dataset.q=e.target.value; const pos=e.target.selectionStart; rkScopeMenu(); const q=document.getElementById('rkScQ'); if(q){ q.focus(); try{ q.setSelectionRange(pos,pos); }catch(_){} } } });
  sm.addEventListener('click',e=>{ const b=e.target.closest('[data-sc]'); if(!b) return; sclose(); const [lv,id]=b.dataset.sc.split(':'); rkSetScope({lv,id:id||null}); });
  document.addEventListener('click',e=>{ if(!sm.hidden&&!sm.contains(e.target)&&!sb.contains(e.target)) sclose(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!sm.hidden){ sclose(); sb.focus(); } });
  const w=document.getElementById('riskWrap'); w.addEventListener('click',rkClick); w.addEventListener('change',rkChange); w.addEventListener('input',rkInput);
  document.addEventListener('click',rkCfgClick); document.addEventListener('change',rkCfgChange);
  try{ const sc=JSON.parse(localStorage.getItem('pacer.rkscope')||'null'); if(sc&&RLV.includes(sc.lv)) RK.scope=sc; const t=localStorage.getItem('pacer.rktab'); if(RTABS.some(x=>x[0]===t)) RK.tab=t; RK.roll=localStorage.getItem('pacer.rkroll')!=='0'; }catch(_){}
  if(typeof wireFw==='function') wireFw();
  let want='schedule'; try{ want=location.hash==='#risk'?'risk':location.hash==='#framework'?'frame':(localStorage.getItem('pacer.app')||'schedule'); }catch(_){}
  if(want!=='schedule'&&APPS[want]) rkApp(want,{keepHash:true}); else rkBrand();
}
function rkGo(t){ RK.tab=t; try{ localStorage.setItem('pacer.rktab',t); }catch(_){} if(S.tab==='admin') setTab('port'); rkRender(); window.scrollTo(0,0); }
function rkSetScope(sc){ RK.scope={lv:sc.lv,id:sc.lv==='portfolio'?null:sc.id}; RK.cell=null; RK.ifcPair=null; try{ localStorage.setItem('pacer.rkscope',JSON.stringify(RK.scope)); }catch(_){} rkRender(); }
function rkScopeValid(){ const sc=RK.scope; if(sc.lv==='programme'&&!rkProg(sc.id)) RK.scope={lv:'portfolio',id:null}; if(sc.lv==='project'&&!rkProj(sc.id)) RK.scope={lv:'portfolio',id:null}; }
function rkScopeBtn(){ const b=document.getElementById('rkScope'); if(!b) return; const sc=RK.scope, n=RK.risks.filter(r=>rkLive(r)&&rkIn(r,sc,RK.roll)).length;
  const g=sc.lv==='project'?rkProg((rkProj(sc.id)||{}).programmeId):null;
  b.innerHTML=`<span class="cx-t"><span class="cx-1">${g?`<span class="cx-g">${esc(g.name)}</span><span class="cx-s" aria-hidden="true">/</span>`:''}<b>${esc(rkScopeName(sc))}</b><span class="pill">${RLV_L[sc.lv]}</span></span><span class="cx-2">${n} live risk${n===1?'':'s'}${sc.lv!=='project'?(RK.roll?' · includes lower registers':' · this register only'):''} · ${esc(rkColSource(sc))}</span></span><svg class="cx-c" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
  b.setAttribute('aria-label','Register: '+rkScopeName(sc)+'. Choose register'); }
function rkScopeMenu(){ const m=document.getElementById('rkScopeMenu'), q=(m.dataset.q||'').toLowerCase(), cnt=sc=>RK.risks.filter(r=>rkLive(r)&&rkIn(r,sc,false)).length, cur=RK.scope;
  const it=(sc,name,sub,cls)=>{ const on=cur.lv===sc.lv&&(cur.id||null)===(sc.id||null); return `<button class="cxm-i ${cls||''}${on?' cur':''}" data-sc="${sc.lv}:${sc.id||''}"><span class="cxm-n">${esc(name)}${on?' <em>Open</em>':''}</span><span class="cxm-d">${esc(sub)}</span></button>`; };
  const match=s=>!q||String(s).toLowerCase().includes(q);
  let h=match(rkPortName())?it({lv:'portfolio'},rkPortName(),`Portfolio register · ${cnt({lv:'portfolio'})} live`,'rk-l0'):'';
  const G=PER.programmes||[], P=PER.projects||[];
  G.forEach(g=>{ const ps=P.filter(p=>p.programmeId===g.id), gm=match(g.name)||match(g.code); const pm=ps.filter(p=>gm||match(p.name)||match(p.code));
    if(gm||pm.length){ h+=it({lv:'programme',id:g.id},g.name,`Programme register${g.code?' · '+g.code:''} · ${cnt({lv:'programme',id:g.id})} live`,'rk-l1'); pm.forEach(p=>h+=it({lv:'project',id:p.id},p.name,`Project register${p.code?' · '+p.code:''} · ${cnt({lv:'project',id:p.id})} live`,'rk-l2')); } });
  const loose=P.filter(p=>!p.programmeId||!G.some(g=>g.id===p.programmeId)).filter(p=>match(p.name)||match(p.code));
  if(loose.length){ h+='<div class="cxm-h">Not in a programme</div>'; loose.forEach(p=>h+=it({lv:'project',id:p.id},p.name,`Project register · ${cnt({lv:'project',id:p.id})} live`,'rk-l1')); }
  m.innerHTML=`<div class="cxm-h">Choose a register</div><input class="cxm-q" id="rkScQ" type="search" placeholder="Search programmes and projects" value="${esc(m.dataset.q||'')}" aria-label="Search registers"><div class="cxm-l">${h||'<p class="muted" style="padding:8px 10px">Nothing matches.</p>'}</div>`; }

/* ---- page frame ---- */
function rkRender(){
  if(RK.app!=='risk') return; const el=document.getElementById('riskWrap'); if(!el) return;
  document.querySelectorAll('#rkNav [data-rkt]').forEach(b=>b.setAttribute('aria-selected',b.dataset.rkt===RK.tab));
  if(typeof PER==='undefined'||!PER.mode){ document.getElementById('rkScopeW').hidden=true; el.innerHTML='<div class="card pempty big"><h3>Sign in to manage risk</h3><p class="muted">Risk registers live alongside your programmes and projects, so sign in (or work offline on this device) to open them.</p><button class="btn primary" data-rk="signin">Sign in</button></div>'; return; }
  document.getElementById('rkScopeW').hidden=false; rkScopeValid(); rkScopeBtn();
  if(RK.schemaOld&&PER.mode==='supa'){ el.innerHTML=`<div class="card pwarn portold"><b>One database step left.</b> The Risk Workbench needs the latest <code>supabase/schema.sql</code>. Open Supabase → SQL Editor → New query, paste the whole file from the GitHub repo and click Run, then reload this page.</div>`; return; }
  if(!RK.loaded){ el.innerHTML='<div class="card pempty"><p class="muted">Loading risk registers…</p></div>'; return; }
  const sy=window.scrollY, act=document.activeElement, aid=act&&act.id, apos=act&&act.selectionStart;
  const body=RK.tab==='reg'?rkRegHtml():RK.tab==='tree'?rkTreeHtml():RK.tab==='ifc'?rkIfcHtml():RK.tab==='resp'?rkRespHtml():rkOverHtml();
  el.innerHTML=rkHeadHtml()+(RK.risks.length?body:rkEmptyHtml());
  if(aid){ const n=document.getElementById(aid); if(n&&n!==document.body){ n.focus(); try{ if(apos!=null) n.setSelectionRange(apos,apos); }catch(_){} } }
  if(Math.abs(window.scrollY-sy)>2) window.scrollTo(0,sy);
  if(RKAI.open) rkAiCtx();
}
function rkHeadHtml(){ const sc=RK.scope, ed=rkCanEdit();
  const sub={over:'Exposure, hot spots and what needs attention',reg:'Every risk in this register',tree:'Parent and child risks across portfolio, programme and project',ifc:'Risks that sit between projects',resp:'Response actions and who owns them'}[RK.tab];
  return `<div class="card porthead rk-head"><div class="ph-t"><h2>${esc(rkScopeName(sc))}</h2><span class="pspace">${RLV_L[sc.lv]} register · ${esc(sub)}</span></div>
    <div class="ph-c">${sc.lv!=='project'?`<label class="tg" title="Show risks from the programme and project registers below this one"><input type="checkbox" data-rkf="roll" ${RK.roll?'checked':''}> Include lower registers</label>`:''}
      ${RK.risks.length?'<button class="btn sm ghost" data-rk="xls" title="Download this register as an Excel workbook">Excel</button><button class="btn sm ghost" data-rk="print">Print / PDF</button>':''}
      ${rkAdmin()?'<button class="btn sm ghost" data-rk="cfg" title="Columns, scoring matrix and how registers line up">Configure</button>':''}
      <button class="btn sm aibtn aionly${RKAI.open?' on':''}" data-rk="ai" aria-expanded="${RKAI.open}" aria-controls="rkAiWrap">${AISPARK}<span>Ask AI</span></button>${ed?`<button class="btn sm aionly" data-rk="identify" title="Identify risks from the schedule, documents and a brief">${AISPARK} Identify risks</button>`:''}
      ${ed?`<button class="btn sm primary" data-rk="new">New risk</button>`:''}</div></div>`; }
function rkEmptyHtml(){ const ed=rkCanEdit();
  return `<div class="card pempty big"><h3>Start your risk registers</h3><p class="muted">Each programme and project has its own register, and the portfolio has one above them. Risks can be escalated to a parent at a higher level, shared between projects as interface risks, and scored both qualitatively and with three-point estimates.</p>
    <div class="prow">${ed?`<button class="btn primary aionly" data-rk="identify">${AISPARK} Identify risks with AI</button><button class="btn" data-rk="new">Add the first risk</button>${(typeof PER!=='undefined'&&PER.mode==='supa'&&PER.site&&PER.site.samples===false)?'':'<button class="btn" data-rk="sample">Load sample risks</button>'}`:''}${rkAdmin()?'<button class="btn" data-rk="cfg">Configure registers</button>':''}</div>
    ${ed?'':'<p class="muted">You have view-only access, so ask a contributor or admin to add risks.</p>'}</div>`; }
function rkVis(){ return RK.risks.filter(r=>rkIn(r,RK.scope,RK.roll)); }

/* ---- Overview ---- */
function rkPos(r,k){ const st=r.d&&r.d.q&&(r.d.q[k]||(k==='cur'?r.d.q.pre:null)); if(!st||!st.p) return null; const I=Object.values(st.i||{}).map(Number).filter(x=>x>0); if(!I.length) return null; return {p:st.p,i:Math.max(...I)}; }
function rkHeat(list,k,o){ o=o||{}; const c=rkCfg(), N={}; list.forEach(r=>{ const p=rkPos(r,k); if(p){ const key=p.p+'-'+p.i; N[key]=(N[key]||0)+1; } });
  let h='<div class="rk-heat'+(o.sm?' sm':'')+'" role="grid" aria-label="Probability and impact matrix">';
  for(let p=5;p>=1;p--){ h+=`<div class="rk-hl" role="rowheader">${o.sm?p:esc(c.prob[p-1].l)}</div>`; for(let i=1;i<=5;i++){ const n=N[p+'-'+i]||0, b=rkBand(p*i), on=RK.cell&&RK.cell.p===p&&RK.cell.i===i&&RK.cell.k===k;
    h+=o.sm?`<div class="rk-hc" style="--rc:${b.c}">${o.mark&&o.mark[p+'-'+i]?o.mark[p+'-'+i]:''}</div>`:`<button class="rk-hc${n?' has':''}${on?' on':''}" style="--rc:${b.c}" data-heat="${k}:${p}:${i}" title="${esc(c.prob[p-1].l)} probability × ${esc(c.ilab[i-1])} impact = ${p*i} (${b.l}) · ${n} risk${n===1?'':'s'}">${n||''}</button>`; } }
  h+=`<div></div>${[1,2,3,4,5].map(i=>`<div class="rk-hx">${o.sm?i:esc(c.ilab[i-1])}</div>`).join('')}</div>`;
  return h+(o.sm?'':'<div class="rk-hax"><span>Probability ↑</span><span>Impact →</span></div>'); }
function rkOverHtml(){ const V=rkVis(), L=V.filter(rkLive), c=rkCfg(), hi=c.bands[1].max, T=rkToday();
  const sum=(f)=>L.reduce((n,r)=>n+f(r),0);
  const evC={cur:rkTot(L,false,'cost'),tgt:rkTot(L,true,'cost')}, evT={cur:rkTot(L,false,'time'),tgt:rkTot(L,true,'time')}, opC=rkOppTot(L,false,'cost'), opT=rkOppTot(L,false,'time');
  const thr=L.filter(r=>(r.d.type||'threat')==='threat'), opp=L.filter(r=>r.d.type==='opp'), high=thr.filter(r=>(rkCurScore(r)||0)>hi);
  const acts=L.flatMap(r=>rkOpenActs(r).map(a=>({a,r}))), od=acts.filter(x=>rkOverdue(x.a)), rv=L.filter(rkReviewDue);
  const tiles=`<div class="card stats rk-stats">
    <div class="stat"><div class="sl">Live risks</div><div class="sv">${L.length}</div><div class="ss">${thr.length} threat${thr.length===1?'':'s'} · ${opp.length} opportunit${opp.length===1?'y':'ies'}</div></div>
    <div class="stat"><div class="sl">High or above</div><div class="sv ${high.length?'late':''}">${high.length}</div><div class="ss">current score over ${hi}</div></div>
    <div class="stat"><div class="sl">Cost exposure</div><div class="sv">${rkMoney(evC.cur)}</div><div class="ss">threats · ${rkMoney(evC.tgt)} after responses</div></div>
    <div class="stat"><div class="sl">Schedule exposure</div><div class="sv">${rkDays(evT.cur)}</div><div class="ss">threats · ${rkDays(evT.tgt)} after responses</div></div>
    <div class="stat"><div class="sl">Actions overdue</div><div class="sv ${od.length?'late':''}">${od.length}</div><div class="ss">of ${acts.length} open action${acts.length===1?'':'s'}</div></div>
    <div class="stat"><div class="sl">Reviews due</div><div class="sv ${rv.length?'amber':''}">${rv.length}</div><div class="ss">past their review date</div></div></div>`;
  const heat=`<div class="card dpanel rk-pheat"><div class="ph"><span class="sl">Risk matrix</span><div class="sg" role="group" aria-label="Which score">${RQ.map(k=>`<button data-rkheat="${k}" class="${RK.heat===k?'on':''}">${RQ_L[k]}</button>`).join('')}</div></div>${rkHeat(L,RK.heat)}<p class="pn">${esc(RQ_S[RK.heat])}. Click a square to list its risks.</p></div>`;
  const mx=Math.max(evC.cur,evC.tgt,opC,1), mt=Math.max(evT.cur,evT.tgt,opT,1);
  const bar=(l,v,m,f,cls)=>`<div class="rk-xb"><span>${l}</span><div class="rk-xt"><i class="${cls}" style="width:${Math.max(.5,v/m*100).toFixed(1)}%"></i></div><b>${f(v)}</b></div>`;
  const expo=`<div class="card dpanel"><div class="ph"><span class="sl">Exposure</span><span class="pn">probability × mean of the three-point estimate</span></div>
    <div class="rk-xg"><div class="rk-xh">Cost</div>${bar('Threats now',evC.cur,mx,rkMoney,'cur')}${bar('After responses',evC.tgt,mx,rkMoney,'tgt')}${opC?bar('Opportunities',opC,mx,rkMoney,'opp'):''}</div>
    <div class="rk-xg"><div class="rk-xh">Schedule</div>${bar('Threats now',evT.cur,mt,rkDays,'cur')}${bar('After responses',evT.tgt,mt,rkDays,'tgt')}${opT?bar('Opportunities',opT,mt,rkDays,'opp'):''}</div>
    <p class="pn">Ready for Monte Carlo: ${L.filter(r=>rkQt(r).cost!=null||rkQt(r).time!=null).length} of ${L.length} live risks have a three-point estimate.</p></div>`;
  const top=L.slice().sort((a,b)=>(rkCurScore(b)||0)-(rkCurScore(a)||0)||rkEV(b,false,'cost')-rkEV(a,false,'cost')).slice(0,8);
  const topH=`<div class="card dpanel span2"><div class="ph"><span class="sl">Top risks</span><span class="pn">by current score, then cost exposure</span></div>${top.length?`<table class="ptab rk-mini"><tbody>${top.map(r=>`<tr data-rid="${esc(r.id)}"><td class="rk-ref">${esc(r.ref)}</td><td>${rkTitleCell(r)}</td><td class="muted">${esc(rkScopeName(rkScopeOf(r)))}</td><td>${rkChip(rkCurScore(r),{short:1})}</td><td class="num">${rkMoney(rkEV(r,false,'cost'))}</td><td class="num">${rkDays(rkEV(r,false,'time'))}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">No live risks.</p>'}</div>`;
  const cats=[...new Set(L.map(r=>r.d.cat||'Uncategorised'))].map(k=>({k,R:L.filter(r=>(r.d.cat||'Uncategorised')===k)})).sort((a,b)=>b.R.length-a.R.length), cm=Math.max(1,...cats.map(x=>x.R.length));
  const catH=`<div class="card dpanel"><div class="ph"><span class="sl">By category</span><span class="pn">coloured by current rating</span></div>${cats.map(x=>`<button class="rk-cat" data-rkcat="${esc(x.k)}"><span>${esc(x.k)}</span><span class="rk-cb">${c.bands.map(b=>{ const n=x.R.filter(r=>{ const s=rkCurScore(r); return s!=null&&rkBand(s).l===b.l; }).length; return n?`<i style="width:${n/cm*100}%;background:${b.c}" title="${n} ${esc(b.l)}"></i>`:''; }).join('')}${(()=>{ const n=x.R.filter(r=>rkCurScore(r)==null).length; return n?`<i class="na" style="width:${n/cm*100}%" title="${n} not scored"></i>`:''; })()}</span><b>${x.R.length}</b></button>`).join('')||'<p class="muted">No live risks.</p>'}</div>`;
  const kids=rkChildRegs(), brk=kids.length?`<div class="card dpanel span3"><div class="ph"><span class="sl">Registers below this one</span><span class="pn">each includes its lower registers · click to open</span></div><div class="ptw"><table class="ptab rk-brk"><thead><tr><th>Register</th><th class="num">Live</th><th class="num">High+</th><th>Worst</th><th class="num">Cost exposure</th><th class="num">Schedule exposure</th><th class="num">Overdue actions</th><th class="num">Reviews due</th><th class="num">Escalated up</th></tr></thead><tbody>${kids.map(k=>{ const R=RK.risks.filter(r=>rkLive(r)&&rkIn(r,k.sc,k.roll)), w=Math.max(0,...R.map(r=>rkCurScore(r)||0));
      return `<tr data-rksc="${k.sc.lv}:${k.sc.id||''}"><td><b>${esc(k.name)}</b><div class="muted">${esc(k.sub)}</div></td><td class="num">${R.length}</td><td class="num${R.filter(r=>(rkCurScore(r)||0)>hi).length?' late':''}">${R.filter(r=>(rkCurScore(r)||0)>hi).length}</td><td>${w?rkChip(w,{short:1}):'—'}</td><td class="num">${rkMoney(rkTot(R,false,'cost'))}</td><td class="num">${rkDays(rkTot(R,false,'time'))}</td><td class="num${R.flatMap(rkOpenActs).filter(rkOverdue).length?' late':''}">${R.flatMap(rkOpenActs).filter(rkOverdue).length}</td><td class="num">${R.filter(rkReviewDue).length}</td><td class="num">${R.filter(r=>r.parentId).length}</td></tr>`; }).join('')}</tbody></table></div></div>`:'';
  const escs=L.map(r=>({r,lv:rkEscTo(r)})).filter(x=>x.lv);
  const escH=escs.length?`<div class="card dpanel span3 rk-esc"><div class="ph"><span class="sl">Escalation suggested</span><span class="pn">over the thresholds your admin set, with no parent risk at that level yet</span></div><table class="ptab rk-mini"><tbody>${escs.slice(0,8).map(({r,lv})=>`<tr data-rid="${esc(r.id)}"><td class="rk-ref">${esc(r.ref)}</td><td>${rkTitleCell(r)}</td><td class="muted">${esc(rkScopeName(rkScopeOf(r)))}</td><td>${rkChip(rkCurScore(r),{short:1})}</td><td class="num">${rkMoney(rkEV(r,false,'cost'))}</td><td>${rkCanEdit()?`<button class="btn sm" data-rkesc="${esc(r.id)}:${lv}">Escalate to ${lv}</button>`:`<span class="muted">to ${lv}</span>`}</td></tr>`).join('')}</tbody></table></div>`:'';
  const od5=od.slice().sort((a,b)=>a.a.due-b.a.due).slice(0,6);
  const actH=`<div class="card dpanel"><div class="ph"><span class="sl">Overdue actions</span><button class="btn sm ghost" data-rkgo2="resp">All responses</button></div>${od5.length?od5.map(x=>`<button class="rk-oa" data-rid="${esc(x.r.id)}" data-rtab="resp"><span><b>${esc(x.a.t)}</b><span class="muted">${esc(x.r.ref)} · ${esc(x.a.owner||'no owner')}</span></span><span class="late num">${Math.round((T-x.a.due)/DAY)} d late</span></button>`).join(''):'<p class="muted">Nothing overdue.</p>'}</div>`;
  return tiles+escH+`<div class="dgrid rk-grid">${heat}${topH}${expo}${catH}${actH}${brk}</div>`;
}
function rkChildRegs(){ const sc=RK.scope, out=[];
  if(sc.lv==='portfolio'){ out.push({sc:{lv:'portfolio'},roll:false,name:'Portfolio register',sub:'risks owned at portfolio level'}); (PER.programmes||[]).forEach(g=>out.push({sc:{lv:'programme',id:g.id},roll:true,name:g.name,sub:(n=>`Programme register and its ${n} project register${n===1?'':'s'}`)(PER.projects.filter(p=>p.programmeId===g.id).length)})); }
  else if(sc.lv==='programme'){ const g=rkProg(sc.id); out.push({sc:{lv:'programme',id:sc.id},roll:false,name:(g?g.name:'Programme')+' register',sub:'risks owned at programme level'}); PER.projects.filter(p=>p.programmeId===sc.id).forEach(p=>out.push({sc:{lv:'project',id:p.id},roll:false,name:p.name,sub:'Project register'+(p.code?' · '+p.code:'')})); }
  return out; }
function rkTitleCell(r){ const k=rkKids(r).length, ifc=rkIsIfc(r); const ai=r.d.ai&&(r.d.ai.src||r.d.ai.assisted||r.d.ai.edited);
  return `<span class="rk-tt">${r.d.type==='opp'?'<span class="rk-opp" title="Opportunity">Opp</span>':''}${esc(r.title)}${ai?`<span class="rk-aitag" title="${r.d.ai.src?'Identified with AI':'Updated with AI help'}">AI</span>`:''}</span>${k||ifc||r.parentId?`<span class="rk-tags">${r.parentId?`<span class="rk-tag up" title="Has a parent risk">↑ ${esc((rkById(r.parentId)||{}).ref||'parent')}</span>`:''}${k?`<span class="rk-tag" title="Child risks">${k} child${k===1?'':'ren'}</span>`:''}${ifc?'<span class="rk-tag ifc" title="Interface risk">Interface</span>':''}</span>`:''}`; }

/* ---- Register ---- */
function rkCell(r,k){ const d=r.d||{}, c=rkCfg();
  switch(k){
    case 'ref': return `<span class="rk-ref">${esc(r.ref)}</span>`;
    case 'title': return rkTitleCell(r);
    case 'type': return d.type==='opp'?'Opportunity':'Threat';
    case 'level': return RLV_L[r.level];
    case 'scope': return esc(rkScopeName(rkScopeOf(r)));
    case 'category': return esc(d.cat||'');
    case 'owner': return esc(d.owner||'');
    case 'status': return `<span class="rk-st ${r.status}">${esc(RST[r.status]||r.status)}</span>`;
    case 'cause': case 'event': case 'effect': return `<span class="rk-long">${esc(d[k]||'')}</span>`;
    case 'pre': case 'tgt': return rkChip(rkQS(r,k),{short:1});
    case 'cur': return rkChip(rkCurScore(r),{short:1});
    case 'trend': return rkTrendHtml(rkTrend(r));
    case 'prob': { const q=d.qt||{}; return q.p!=null&&q.p!==''?`${+q.p}%`:'—'; }
    case 'cost3': { const t=(d.qt||{}).cost; return t&&[t.min,t.ml,t.max].some(x=>x!==''&&x!=null)?[t.min,t.ml,t.max].map(x=>x===''||x==null?'—':rkMoney(+x)).join(' / '):'—'; }
    case 'time3': { const t=(d.qt||{}).time; return t&&[t.min,t.ml,t.max].some(x=>x!==''&&x!=null)?[t.min,t.ml,t.max].map(x=>x===''||x==null?'—':Math.round(+x)).join(' / '):'—'; }
    case 'costEV': { const v=rkEV(r,false,'cost'); return (d.qt||{}).fromKids?`<span title="Rolled up from child risks">Σ ${rkMoney(v)}</span>`:rkMoney(v); }
    case 'timeEV': { const v=rkEV(r,false,'time'); return (d.qt||{}).fromKids?`<span title="Rolled up from child risks">Σ ${rkDays(v)}</span>`:rkDays(v); }
    case 'strategy': { const s=(d.resp||{}).strat, L=RSTRAT[d.type==='opp'?'opp':'threat'].find(x=>x[0]===s); return L?L[1]:'—'; }
    case 'respOwner': return esc((d.resp||{}).owner||'');
    case 'actions': { const A=rkActs(r).filter(a=>a.status!=='dropped'), dn=A.filter(a=>a.status==='done').length, od=A.filter(rkOverdue).length; return A.length?`${dn}/${A.length}${od?` <span class="late" title="${od} overdue">●</span>`:''}`:'—'; }
    case 'nextdue': { const n=rkOpenActs(r).filter(a=>a.due).sort((a,b)=>a.due-b.due)[0]; return n?`<span class="${rkOverdue(n)?'late':''}">${fmtD(n.due)}</span>`:'—'; }
    case 'prox': return d.prox?fmtD(d.prox):'—';
    case 'review': return d.review?`<span class="${rkReviewDue(r)?'late':''}">${fmtD(d.review)}</span>`:'—';
    case 'raised': return d.raised?fmtD(d.raised):'—';
    case 'updated': return r.updatedAt?fmtD(r.updatedAt):'—';
    case 'parent': { const p=rkById(r.parentId); return p?`<span title="${esc(p.title)}">${esc(p.ref)} · ${esc(p.title)}</span>`:'—'; }
    case 'children': { const n=rkKids(r).length; return n||'—'; }
    case 'ifc': { const P=rkIfcPids(r).map(id=>rkProj(id)).filter(Boolean); return P.length?P.map(p=>`<span class="rk-pj">${esc(p.code||p.name)}</span>`).join(' ')+((d.ifc||{}).code?` <span class="muted">${esc(d.ifc.code)}</span>`:''):'—'; }
    case 'acts': return esc((d.qt||{}).acts||'');
    case 'cont': { const ct=(d.resp||{}).cont; return ct!=null&&ct!==''?rkMoney(+ct):'—'; }
  }
  if(k.startsWith('f:')){ const f=c.fields.find(x=>'f:'+x.id===k), v=(d.f||{})[k.slice(2)]; if(v==null||v==='') return ''; return f&&f.type==='date'?fmtD(v):f&&f.type==='number'?esc((+v).toLocaleString()):esc(v); }
  return ''; }
function rkCellX(r,k){ const d=r.d||{};
  switch(k){ case 'ref': return r.ref; case 'title': return r.title; case 'type': return d.type==='opp'?'Opportunity':'Threat'; case 'level': return RLV_L[r.level]; case 'scope': return rkScopeName(rkScopeOf(r));
    case 'category': return d.cat||''; case 'owner': return d.owner||''; case 'status': return RST[r.status]||r.status; case 'cause': case 'event': case 'effect': return d[k]||'';
    case 'pre': case 'tgt': return rkQS(r,k)??''; case 'cur': return rkCurScore(r)??''; case 'trend': return ({1:'Up','-1':'Down',0:'No change'})[rkTrend(r)];
    case 'prob': return (d.qt||{}).p??''; case 'cost3': { const t=(d.qt||{}).cost||{}; return [t.min,t.ml,t.max].map(x=>x??'').join(' / '); } case 'time3': { const t=(d.qt||{}).time||{}; return [t.min,t.ml,t.max].map(x=>x??'').join(' / '); }
    case 'costEV': return Math.round(rkEV(r,false,'cost')); case 'timeEV': return Math.round(rkEV(r,false,'time')*10)/10;
    case 'strategy': { const s=(d.resp||{}).strat, L=RSTRAT[d.type==='opp'?'opp':'threat'].find(x=>x[0]===s); return L?L[1]:''; } case 'respOwner': return (d.resp||{}).owner||'';
    case 'actions': { const A=rkActs(r).filter(a=>a.status!=='dropped'); return A.length?`${A.filter(a=>a.status==='done').length}/${A.length}`:''; }
    case 'nextdue': { const n=rkOpenActs(r).filter(a=>a.due).sort((a,b)=>a.due-b.due)[0]; return n?xD(n.due):''; }
    case 'prox': return xD(d.prox); case 'review': return xD(d.review); case 'raised': return xD(d.raised); case 'updated': return xD(r.updatedAt);
    case 'parent': { const p=rkById(r.parentId); return p?p.ref+' '+p.title:''; } case 'children': return rkKids(r).length||'';
    case 'ifc': return rkIfcPids(r).map(id=>(rkProj(id)||{}).name).filter(Boolean).join(', '); case 'acts': return (d.qt||{}).acts||''; case 'cont': return (d.resp||{}).cont??''; }
  if(k.startsWith('f:')){ const v=(d.f||{})[k.slice(2)]; const f=rkCfg().fields.find(x=>'f:'+x.id===k); return v==null?'':f&&f.type==='date'?xD(v):v; }
  return ''; }
function rkSortV(r,k){ switch(k){ case 'pre': case 'tgt': return rkQS(r,k)??-1; case 'cur': return rkCurScore(r)??-1; case 'costEV': return rkEV(r,false,'cost'); case 'timeEV': return rkEV(r,false,'time');
  case 'prob': return +((r.d.qt||{}).p)||0; case 'trend': return rkTrend(r); case 'children': return rkKids(r).length; case 'actions': return rkOpenActs(r).length;
  case 'nextdue': { const n=rkOpenActs(r).filter(a=>a.due).sort((a,b)=>a.due-b.due)[0]; return n?n.due:Infinity; } case 'review': return r.d.review||Infinity; case 'prox': return r.d.prox||Infinity; case 'raised': return r.d.raised||0; case 'updated': return r.updatedAt||0;
  case 'status': return Object.keys(RST).indexOf(r.status); case 'level': return rkRank(r.level); case 'ref': return r.ref; }
  return String(rkCellX(r,k)||'').toLowerCase(); }
function rkFiltered(){ const f=RK.f, q=RK.q.trim().toLowerCase();
  return rkVis().filter(r=>{ const d=r.d||{};
    if(f.st==='live'&&!rkLive(r)) return false; if(f.st&&f.st!=='live'&&f.st!=='all'&&r.status!==f.st) return false;
    if(f.cat&&(d.cat||'')!==f.cat) return false; if(f.type&&(d.type||'threat')!==f.type) return false; if(f.owner&&(d.owner||'')!==f.owner) return false; if(f.ifc&&!rkIsIfc(r)) return false;
    if(f.rt){ const s=rkCurScore(r), b=s==null?null:rkBand(s); if(f.rt==='none'?s!=null:!b||b.l!==f.rt) return false; }
    if(RK.cell){ const p=rkPos(r,RK.cell.k); if(!p||p.p!==RK.cell.p||p.i!==RK.cell.i) return false; }
    if(q&&![r.ref,r.title,d.cat,d.owner,d.cause,d.event,d.effect,d.desc,(d.ifc||{}).code].some(x=>String(x||'').toLowerCase().includes(q))) return false;
    return true; }); }
function rkRegCols(){ let cols=rkColsFor(RK.scope); if(RK.roll&&RK.scope.lv!=='project'&&!cols.includes('scope')) cols=cols.slice(0,2).concat(['scope'],cols.slice(2)); return cols; }
function rkRegHtml(){ const V=rkVis(), c=rkCfg(), f=RK.f, cols=rkRegCols(), defs=rkColDefs(), R=rkFiltered();
  const {k,d}=RK.sort; R.sort((a,b)=>{ const x=rkSortV(a,k), y=rkSortV(b,k); return (x<y?-1:x>y?1:0)*d||String(a.ref).localeCompare(String(b.ref)); });
  const owners=[...new Set(V.map(r=>r.d.owner).filter(Boolean))].sort(), cats=[...new Set(c.cats.concat(V.map(r=>r.d.cat).filter(Boolean)))];
  const bar=`<div class="card rk-fbar"><input type="search" id="rkQ" placeholder="Search risks, causes, owners, refs" value="${esc(RK.q)}" aria-label="Search risks">
    <label class="ctl"><span>Status</span><select data-rkf="st"><option value="live"${f.st==='live'?' selected':''}>Live</option><option value="all"${f.st==='all'?' selected':''}>All</option>${Object.entries(RST).map(([v,l])=>`<option value="${v}"${f.st===v?' selected':''}>${l}</option>`).join('')}</select></label>
    <label class="ctl"><span>Category</span><select data-rkf="cat"><option value="">All</option>${cats.map(x=>`<option${f.cat===x?' selected':''}>${esc(x)}</option>`).join('')}</select></label>
    <label class="ctl"><span>Rating</span><select data-rkf="rt"><option value="">All</option>${c.bands.slice().reverse().map(b=>`<option${f.rt===b.l?' selected':''}>${esc(b.l)}</option>`).join('')}<option value="none"${f.rt==='none'?' selected':''}>Not scored</option></select></label>
    <label class="ctl"><span>Type</span><select data-rkf="type"><option value="">All</option><option value="threat"${f.type==='threat'?' selected':''}>Threats</option><option value="opp"${f.type==='opp'?' selected':''}>Opportunities</option></select></label>
    <label class="ctl"><span>Owner</span><select data-rkf="owner"><option value="">Anyone</option>${owners.map(o=>`<option${f.owner===o?' selected':''}>${esc(o)}</option>`).join('')}</select></label>
    <label class="ctl"><span>Group</span><select data-rkf="group"><option value="">None</option>${[['scope','Register'],['cat','Category'],['owner','Owner'],['status','Status'],['parent','Parent risk']].map(([v,l])=>`<option value="${v}"${RK.group===v?' selected':''}>${l}</option>`).join('')}</select></label>
    <label class="tg"><input type="checkbox" data-rkf="ifc" ${f.ifc?'checked':''}> Interface risks only</label>
    ${RK.cell?`<span class="rk-pf">${esc(RQ_L[RK.cell.k])} P${RK.cell.p} × I${RK.cell.i}<button class="fx" data-rk="cellx" aria-label="Clear matrix filter">×</button></span>`:''}
    <span class="sp"></span>${rkCanEdit()&&V.some(r=>rkLive(r)&&!(r.d.qt||{}).fromKids&&rkQt(r).cost==null&&rkQt(r).time==null)?`<button class="btn sm aionly" data-rk="bq" title="Propose three-point estimates for live risks without one">${AISPARK} Quantify with AI</button>`:''}<span class="muted">${R.length} of ${V.length}</span></div>`;
  const th=cols.map(k=>`<th class="${RCOL[k]&&RCOL[k].num?'num':''}" style="min-width:${(RCOL[k]||{w:120}).w}px"><button class="rk-sort" data-rksort="${esc(k)}">${esc(defs[k])}${RK.sort.k===k?(RK.sort.d>0?' ▲':' ▼'):''}</button></th>`).join('');
  const row=r=>`<tr data-rid="${esc(r.id)}" class="${rkLive(r)?'':'rk-dead'}">${cols.map(k=>`<td class="${RCOL[k]&&RCOL[k].num?'num':''} rk-c-${k.replace(':','_')}">${rkCell(r,k)}</td>`).join('')}</tr>`;
  let body='';
  if(RK.group){ const key=r=>RK.group==='scope'?rkScopeName(rkScopeOf(r)):RK.group==='cat'?(r.d.cat||'Uncategorised'):RK.group==='owner'?(r.d.owner||'No owner'):RK.group==='status'?(RST[r.status]||r.status):(r.parentId?((rkById(r.parentId)||{}).ref||'')+' '+((rkById(r.parentId)||{}).title||''):'No parent');
    const G=new Map(); R.forEach(r=>{ const g=key(r); if(!G.has(g)) G.set(g,[]); G.get(g).push(r); });
    [...G.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([g,rs])=>{ body+=`<tr class="rk-gh"><td colspan="${cols.length}"><b>${esc(g)}</b> <span class="muted">${rs.length} risk${rs.length===1?'':'s'} · threat exposure ${rkMoney(rkTot(rs,false,'cost'))}</span></td></tr>`+rs.map(row).join(''); }); }
  else body=R.map(row).join('');
  return bar+`<div class="card rk-tw"><div class="ptw rk-regw"><table class="ptab rk-reg"><thead><tr>${th}</tr></thead><tbody>${body||`<tr><td colspan="${cols.length}" class="muted">No risks match these filters.</td></tr>`}</tbody></table></div></div>`; }

/* ---- Hierarchy ---- */
function rkTreeHtml(){ const V=rkVis(), vis=new Set(V.map(r=>r.id)), sc=RK.scope;
  const roots=V.filter(r=>!r.parentId||!vis.has(r.parentId)).sort((a,b)=>rkRank(a.level)-rkRank(b.level)||(rkCurScore(b)||0)-(rkCurScore(a)||0));
  const node=(r,dep,seen)=>{ if(seen.has(r.id)) return ''; seen.add(r.id); const K=rkKids(r).filter(k=>vis.has(k.id)).sort((a,b)=>(rkCurScore(b)||0)-(rkCurScore(a)||0)), outside=r.parentId&&!vis.has(r.parentId)?rkById(r.parentId):null, ed=rkCanEdit(), esc2=rkEscTo(r);
    return `<div class="rk-node${rkLive(r)?'':' rk-dead'}" style="--dep:${dep}" data-rid="${esc(r.id)}"><span class="rk-lv l${rkRank(r.level)}">${RLV_L[r.level]}</span><span class="rk-ref">${esc(r.ref)}</span><span class="rk-nt">${rkTitleCell(r)}<span class="muted rk-ns">${esc(rkScopeName(rkScopeOf(r)))}${outside?` · feeds <b>${esc(outside.ref)}</b> ${esc(outside.title)} (${esc(rkScopeName(rkScopeOf(outside)))})`:''}</span></span>
      ${rkChip(rkCurScore(r),{short:1})}<span class="num rk-nev" title="${(r.d.qt||{}).fromKids?'Rolled up from child risks':'Own estimate'}">${(r.d.qt||{}).fromKids?'Σ ':''}${rkMoney(rkEV(r,false,'cost'))}</span>
      <span class="rk-nb">${ed&&r.level!=='project'?`<button class="btn sm ghost" data-rkchild="${esc(r.id)}" title="Add a risk in a lower register that rolls up to this one">+ Child</button>`:''}${ed&&r.level!=='portfolio'&&!r.parentId?`<button class="btn sm ghost${esc2?' rk-hot':''}" data-rkesc="${esc(r.id)}:${r.level==='project'?(esc2||'programme'):'portfolio'}" title="Create a parent risk at a higher level">Escalate${esc2?' ⚑':''}</button>`:''}</span></div>${K.map(k=>node(k,dep+1,seen)).join('')}`; };
  const seen=new Set(), tree=roots.map(r=>node(r,0,seen)).join('');
  const regs=`<div class="card rk-regs"><div class="ph"><span class="sl">Registers</span></div>${rkRegTree()}</div>`;
  const help=`<p class="pn">Parent risks sit in a higher register and roll up their children: a programme risk can be the parent of project risks in that programme, and a portfolio risk can be the parent of any programme or project risk. A parent marked Σ takes its exposure from its children, so totals count each estimate once.</p>`;
  return `<div class="rk-treew">${regs}<div class="card rk-tree"><div class="ph"><span class="sl">Risk hierarchy</span><span class="pn">${V.length} risk${V.length===1?'':'s'} in view${RK.roll||sc.lv==='project'?'':' · tick “Include lower registers” to see children'}</span></div>${help}${tree||'<p class="muted">No risks in this register yet.</p>'}</div></div>`; }
function rkRegTree(){ const cnt=sc=>RK.risks.filter(r=>rkLive(r)&&rkIn(r,sc,false)).length, cur=RK.scope;
  const it=(sc,name,dep)=>{ const on=cur.lv===sc.lv&&(cur.id||null)===(sc.id||null); return `<button class="rk-rt${on?' on':''}" style="--dep:${dep}" data-rksc="${sc.lv}:${sc.id||''}"><span>${esc(name)}</span><b>${cnt(sc)}</b></button>`; };
  let h=it({lv:'portfolio'},'Portfolio',0); (PER.programmes||[]).forEach(g=>{ h+=it({lv:'programme',id:g.id},g.name,1); PER.projects.filter(p=>p.programmeId===g.id).forEach(p=>h+=it({lv:'project',id:p.id},p.name,2)); });
  PER.projects.filter(p=>!p.programmeId||!PER.programmes.some(g=>g.id===p.programmeId)).forEach(p=>h+=it({lv:'project',id:p.id},p.name,1)); return h; }

/* ---- Interfaces ---- */
function rkIfcProjects(){ const sc=RK.scope; if(sc.lv==='programme') return PER.projects.filter(p=>p.programmeId===sc.id);
  if(sc.lv==='project'){ const me=rkProj(sc.id); const ids=new Set([sc.id]); RK.risks.filter(r=>rkIfcPids(r).includes(sc.id)).forEach(r=>rkIfcPids(r).forEach(id=>ids.add(id))); return PER.projects.filter(p=>ids.has(p.id)).sort((a,b)=>(a.id===sc.id?-1:b.id===sc.id?1:0)); }
  const G=PER.programmes||[]; return PER.projects.slice().sort((a,b)=>G.findIndex(g=>g.id===a.programmeId)-G.findIndex(g=>g.id===b.programmeId)||String(a.name).localeCompare(b.name)); }
function rkIfcHtml(){ const P=rkIfcProjects(), ids=new Set(P.map(p=>p.id)), I=RK.risks.filter(r=>rkIsIfc(r)&&rkIfcPids(r).some(id=>ids.has(id))&&(RK.f.st==='all'||rkLive(r)));
  const pair=(a,b)=>I.filter(r=>rkIfcPids(r).includes(a)&&rkIfcPids(r).includes(b));
  const short=p=>p.code||p.name.split(/\s+/).map(w=>w[0]).join('').slice(0,5);
  let mx='';
  if(P.length>=2){ mx=`<div class="rk-mx" style="--n:${P.length}"><div></div>${P.map(p=>`<div class="rk-mxh" title="${esc(p.name)}">${esc(short(p))}</div>`).join('')}`;
    P.forEach((a,i)=>{ mx+=`<div class="rk-mxl" title="${esc(a.name)}"><b>${esc(short(a))}</b><span>${esc(a.name)}</span></div>`; P.forEach((b,j)=>{ if(j<=i){ mx+=`<div class="rk-mxc x"></div>`; return; } const R=pair(a.id,b.id), w=Math.max(0,...R.map(r=>rkCurScore(r)||0)), on=RK.ifcPair&&RK.ifcPair.includes(a.id)&&RK.ifcPair.includes(b.id), sameG=a.programmeId&&a.programmeId===b.programmeId;
      mx+=R.length?`<button class="rk-mxc has${on?' on':''}" style="--rc:${w?rkBand(w).c:'var(--ink3)'}" data-rkpair="${esc(a.id)}|${esc(b.id)}" title="${esc(a.name)} ↔ ${esc(b.name)}: ${R.length} interface risk${R.length===1?'':'s'}${w?' · worst '+rkBand(w).l:''}">${R.length}</button>`:`<div class="rk-mxc${sameG?' g':''}"></div>`; }); });
    mx+='</div>'; }
  const L=RK.ifcPair?I.filter(r=>RK.ifcPair.every(id=>rkIfcPids(r).includes(id))):I;
  const list=`<table class="ptab rk-ifl"><thead><tr><th>Ref</th><th style="min-width:260px">Interface risk</th><th style="min-width:220px">Between</th><th>Interface ID</th><th>Owned by</th><th>Current</th><th class="num">Cost exposure</th><th class="num">Schedule exposure</th><th class="num">Actions</th><th>Status</th></tr></thead><tbody>${L.sort((a,b)=>(rkCurScore(b)||0)-(rkCurScore(a)||0)).map(r=>`<tr data-rid="${esc(r.id)}" class="${rkLive(r)?'':'rk-dead'}"><td>${rkCell(r,'ref')}</td><td>${rkTitleCell(r)}</td><td>${rkIfcPids(r).map(id=>rkProj(id)).filter(Boolean).map(p=>`<span class="rk-pj" title="${esc(p.name)}">${esc(p.name)}</span>`).join(' ')}</td><td>${esc((r.d.ifc||{}).code||'')}</td><td class="muted">${esc(rkScopeName(rkScopeOf(r)))}</td><td>${rkChip(rkCurScore(r),{short:1})}</td><td class="num">${rkMoney(rkEV(r,false,'cost'))}</td><td class="num">${rkDays(rkEV(r,false,'time'))}</td><td class="num">${rkCell(r,'actions')}</td><td>${rkCell(r,'status')}</td></tr>`).join('')||'<tr><td colspan="10" class="muted">No interface risks here yet.</td></tr>'}</tbody></table>`;
  const unowned=I.filter(r=>{ const gs=new Set(rkIfcPids(r).map(id=>(rkProj(id)||{}).programmeId||'-')); const need=gs.size>1?'portfolio':'programme'; return rkLive(r)&&rkRank(r.level)>rkRank(need); });
  return `<div class="rk-ifcw"><div class="card dpanel"><div class="ph"><span class="sl">Interface matrix</span><span class="pn">${P.length} project${P.length===1?'':'s'} · ${I.length} interface risk${I.length===1?'':'s'} · click a square to filter</span>${rkCanEdit()?'<button class="btn sm" data-rk="newifc">New interface risk</button>':''}</div>
    ${P.length>=2?mx:`<p class="muted">${RK.scope.lv==='project'?'This project has no interface risks with other projects yet.':'Add at least two projects to this register to manage interfaces between them.'}</p>`}
    <p class="pn">Interface risks sit between two or more projects. Own them in the register above both projects — the programme, or the portfolio when they cross programmes — so neither side carries them alone.</p></div>
    <div class="card dpanel"><div class="ph"><span class="sl">Interface risks</span>${RK.ifcPair?`<span class="rk-pf">${RK.ifcPair.map(id=>esc((rkProj(id)||{}).name||'')).join(' ↔ ')}<button class="fx" data-rk="pairx" aria-label="Clear">×</button></span>`:''}<label class="tg"><input type="checkbox" data-rkf="ifcall" ${RK.f.st==='all'?'checked':''}> Include closed</label></div>
    ${unowned.length?`<p class="pwarn">${unowned.length} interface risk${unowned.length===1?' is':'s are'} owned in a project register. Consider moving ${unowned.length===1?'it':'them'} up so both sides see ${unowned.length===1?'it':'them'}: ${unowned.slice(0,4).map(r=>`<b>${esc(r.ref)}</b>`).join(', ')}.</p>`:''}
    <div class="ptw">${list}</div></div></div>`; }

/* ---- Responses ---- */
function rkRespHtml(){ const V=rkVis().filter(r=>rkLive(r)||r.status==='occurred'), T=rkToday(), F=RK.act;
  const all=V.flatMap(r=>rkActs(r).map((a,i)=>({a,r,i})));
  const open=all.filter(x=>x.a.status!=='done'&&x.a.status!=='dropped'), od=open.filter(x=>rkOverdue(x.a)), soon=open.filter(x=>x.a.due&&x.a.due>=T&&x.a.due<=T+30*DAY), done=all.filter(x=>x.a.status==='done');
  const owners=[...new Set(all.map(x=>x.a.owner).filter(Boolean))].sort();
  let L=F.f==='overdue'?od:F.f==='soon'?soon:F.f==='done'?done:F.f==='all'?all:open; if(F.owner) L=L.filter(x=>(x.a.owner||'')===F.owner);
  L=L.slice().sort((x,y)=>(x.a.due||Infinity)-(y.a.due||Infinity));
  const noResp=V.filter(r=>rkLive(r)&&(r.d.type||'threat')==='threat'&&(rkCurScore(r)||0)>rkCfg().bands[0].max&&!rkOpenActs(r).length&&(r.d.resp||{}).strat!=='accept');
  const strat={}; V.filter(rkLive).forEach(r=>{ const s=(r.d.resp||{}).strat||'none'; strat[s]=(strat[s]||0)+1; });
  const SL=Object.assign({none:'Not set'},Object.fromEntries(RSTRAT.threat.concat(RSTRAT.opp)));
  const tiles=`<div class="card stats rk-stats"><div class="stat"><div class="sl">Open actions</div><div class="sv">${open.length}</div><div class="ss">across ${new Set(open.map(x=>x.r.id)).size} risks</div></div>
    <div class="stat"><div class="sl">Overdue</div><div class="sv ${od.length?'late':''}">${od.length}</div><div class="ss">past their due date</div></div>
    <div class="stat"><div class="sl">Due in 30 days</div><div class="sv">${soon.length}</div><div class="ss">to ${fmtD(T+30*DAY)}</div></div>
    <div class="stat"><div class="sl">Done</div><div class="sv">${done.length}</div><div class="ss">${all.length?Math.round(done.length/all.length*100):0}% of all actions</div></div>
    <div class="stat"><div class="sl">Action cost</div><div class="sv">${rkMoney(open.reduce((n,x)=>n+(+x.a.cost||0),0))}</div><div class="ss">still to spend on open actions</div></div>
    <div class="stat"><div class="sl">No response yet</div><div class="sv ${noResp.length?'amber':''}">${noResp.length}</div><div class="ss">threats above ${esc(rkCfg().bands[0].l)} with no action</div></div></div>`;
  const mix=`<div class="rk-mix">${Object.entries(strat).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<span class="rk-mixi"><b>${n}</b> ${esc(SL[k]||k)}</span>`).join('')}</div>`;
  const ed=rkCanEdit();
  const tbl=`<table class="ptab rk-acts"><thead><tr><th style="min-width:260px">Action</th><th style="min-width:220px">Risk</th><th>Register</th><th>Owner</th><th class="num">Due</th><th>Status</th><th class="num">Cost</th></tr></thead><tbody>${L.map(x=>`<tr data-rid="${esc(x.r.id)}" data-rtab="resp"><td><b>${esc(x.a.t||'')}</b></td><td><span class="rk-ref">${esc(x.r.ref)}</span> ${esc(x.r.title)}</td><td class="muted">${esc(rkScopeName(rkScopeOf(x.r)))}</td><td>${esc(x.a.owner||'')}</td><td class="num ${rkOverdue(x.a)?'late':''}">${x.a.due?fmtD(x.a.due):'—'}</td>
    <td>${ed?`<select class="rk-asel" data-rkact="${esc(x.r.id)}:${x.i}" aria-label="Action status">${Object.entries(RACT).map(([v,l])=>`<option value="${v}"${x.a.status===v?' selected':''}>${l}</option>`).join('')}</select>`:esc(RACT[x.a.status]||'')}</td><td class="num">${x.a.cost?rkMoney(+x.a.cost):'—'}</td></tr>`).join('')||'<tr><td colspan="7" class="muted">No actions here.</td></tr>'}</tbody></table>`;
  return tiles+`<div class="card rk-fbar"><div class="sg" role="group" aria-label="Which actions">${[['open','Open'],['overdue','Overdue'],['soon','Due in 30 days'],['done','Done'],['all','All']].map(([k,l])=>`<button data-rkaf="${k}" class="${F.f===k?'on':''}">${l}</button>`).join('')}</div>
    <label class="ctl"><span>Owner</span><select data-rkf="aowner"><option value="">Anyone</option>${owners.map(o=>`<option${F.owner===o?' selected':''}>${esc(o)}</option>`).join('')}</select></label><span class="sp"></span><span class="muted">Responses chosen:</span>${mix}</div>
    ${noResp.length?`<div class="card pwarn">Threats with no response action: ${noResp.slice(0,6).map(r=>`<button class="link" data-rid="${esc(r.id)}" data-rtab="resp">${esc(r.ref)}</button>`).join(' ')}${noResp.length>6?` and ${noResp.length-6} more`:''}.</div>`:''}
    <div class="card rk-tw"><div class="ptw rk-regw">${tbl}</div></div>`; }

/* ---- events ---- */
function rkClick(e){
  const t=e.target;
  if(t.closest('select,input,textarea,label.tg')) return;
  const b=t.closest('[data-rk]'); if(b){ const k=b.dataset.rk;
    if(k==='ai'){ rkAiPanel(); return; } if(k==='identify'){ rkIdOpen(); return; } if(k==='bq'){ rkBqOpen(); return; }
    if(k==='new') rkNew({}); else if(k==='newifc') rkNew({ifc:true}); else if(k==='cfg') rkCfgOpen(); else if(k==='sample') rkSample(); else if(k==='xls') rkExport(); else if(k==='print') repPrint(rkScopeName(RK.scope)+' risk register');
    else if(k==='cellx'){ RK.cell=null; rkRender(); } else if(k==='pairx'){ RK.ifcPair=null; rkRender(); } else if(k==='signin'){ if(!document.getElementById('auth')) authStart(); } return; }
  const h=t.closest('[data-heat]'); if(h){ const [k,p,i]=h.dataset.heat.split(':'); RK.cell={k,p:+p,i:+i}; RK.f.st='live'; rkGo('reg'); return; }
  const hm=t.closest('[data-rkheat]'); if(hm){ RK.heat=hm.dataset.rkheat; rkRender(); return; }
  const ct=t.closest('[data-rkcat]'); if(ct){ RK.f.cat=ct.dataset.rkcat==='Uncategorised'?'':ct.dataset.rkcat; rkGo('reg'); return; }
  const so=t.closest('[data-rksort]'); if(so){ const k=so.dataset.rksort; RK.sort=RK.sort.k===k?{k,d:-RK.sort.d}:{k,d:['ref','title','scope','category','owner','level','status'].includes(k)?1:-1}; rkRender(); return; }
  const sc=t.closest('[data-rksc]'); if(sc){ const [lv,id]=sc.dataset.rksc.split(':'); rkSetScope({lv,id:id||null}); return; }
  const es=t.closest('[data-rkesc]'); if(es){ e.stopPropagation(); const [id,lv]=es.dataset.rkesc.split(':'); rkEscalate(rkById(id),lv); return; }
  const ch=t.closest('[data-rkchild]'); if(ch){ e.stopPropagation(); rkNewChild(rkById(ch.dataset.rkchild)); return; }
  const pr=t.closest('[data-rkpair]'); if(pr){ const ids=pr.dataset.rkpair.split('|'); RK.ifcPair=RK.ifcPair&&ids.every(i=>RK.ifcPair.includes(i))?null:ids; rkRender(); return; }
  const g2=t.closest('[data-rkgo2]'); if(g2){ rkGo(g2.dataset.rkgo2); return; }
  const af=t.closest('[data-rkaf]'); if(af){ RK.act.f=af.dataset.rkaf; rkRender(); return; }
  const row=t.closest('[data-rid]'); if(row){ const r=rkById(row.dataset.rid); if(r) rkOpen(r,row.dataset.rtab||'det'); }
}
function rkChange(e){ const t=e.target, k=t.dataset.rkf;
  if(k){ if(k==='roll'){ RK.roll=t.checked; try{ localStorage.setItem('pacer.rkroll',t.checked?'1':'0'); }catch(_){} }
    else if(k==='group') RK.group=t.value; else if(k==='ifc') RK.f.ifc=t.checked; else if(k==='ifcall') RK.f.st=t.checked?'all':'live'; else if(k==='aowner') RK.act.owner=t.value; else RK.f[k]=t.value;
    rkRender(); return; }
  if(t.dataset.rkact){ const [id,i]=t.dataset.rkact.split(':'), r=rkById(id); if(!r) return; const d=JSON.parse(JSON.stringify(r.d)), a=d.actions[+i]; a.status=t.value; if(t.value==='done') a.doneAt=Date.now();
    rkUpdate(Object.assign({},r,{d}),r).then(()=>perToast('Action updated.')).catch(er=>perToast(perErr(er),'err')); }
}
let rkQT; function rkInput(e){ if(e.target.id==='rkQ'){ clearTimeout(rkQT); rkQT=setTimeout(()=>{ RK.q=e.target.value; rkRender(); },180); } }

/* ---- create, escalate, cascade ---- */
function rkBlank(sc){ const c=rkCfg(); sc=sc||RK.scope; return {id:null,level:sc.lv,programmeId:sc.lv==='programme'?sc.id:null,projectId:sc.lv==='project'?sc.id:null,parentId:null,ref:'',title:'',status:'open',
  d:{type:'threat',cat:'',owner:'',cause:'',event:'',effect:'',desc:'',raised:rkToday(),review:rkToday()+c.review*DAY,prox:null,q:{pre:{p:0,i:{}},cur:{p:0,i:{}},tgt:{p:0,i:{}}},qt:{p:'',dist:'tri',cost:{min:'',ml:'',max:''},time:{min:'',ml:'',max:''},acts:'',fromKids:false,post:{p:'',cost:{min:'',ml:'',max:''},time:{min:'',ml:'',max:''}}},resp:{strat:'',owner:'',plan:'',trigger:'',fallback:'',cont:''},actions:[],ifc:{on:false,pids:[],code:''},f:{}}}; }
function rkNew(o){ o=o||{}; if(!rkCanEdit()) return; const r=rkBlank(o.scope);
  if(o.ifc){ r.d.ifc.on=true; if(RK.scope.lv==='project'){ const p=rkProj(RK.scope.id); r.d.ifc.pids=[RK.scope.id]; if(p&&p.programmeId){ r.level='programme'; r.programmeId=p.programmeId; r.projectId=null; } }
    if(RK.ifcPair){ r.d.ifc.pids=RK.ifcPair.slice(); const gs=new Set(RK.ifcPair.map(id=>(rkProj(id)||{}).programmeId)); if(gs.size===1&&[...gs][0]){ r.level='programme'; r.programmeId=[...gs][0]; r.projectId=null; } else { r.level='portfolio'; r.programmeId=r.projectId=null; } }
    r.d.cat=rkCfg().cats.includes('Interfaces')?'Interfaces':''; }
  Object.assign(r,o.patch||{}); rkOpen(r,'det',true); }
function rkNewChild(p){ if(!p||!rkCanEdit()) return; let sc;
  if(p.level==='portfolio'){ sc=RK.scope.lv!=='portfolio'?RK.scope:(PER.programmes[0]?{lv:'programme',id:PER.programmes[0].id}:PER.projects[0]?{lv:'project',id:PER.projects[0].id}:null); }
  else { const ps=PER.projects.filter(x=>x.programmeId===p.programmeId); sc=RK.scope.lv==='project'&&ps.some(x=>x.id===RK.scope.id)?RK.scope:ps[0]?{lv:'project',id:ps[0].id}:null; }
  if(!sc){ perToast(p.level==='portfolio'?'Add a programme or project first.':'Add a project to this programme first.','err'); return; }
  const r=rkBlank(sc); r.parentId=p.id; r.title=p.title; r.d.cat=p.d.cat||''; r.d.type=p.d.type||'threat'; ['cause','event','effect'].forEach(k=>r.d[k]=p.d[k]||'');
  rkOpen(r,'det',true); }
async function rkEscalate(r,lv){ if(!r||!rkCanEdit()) return; lv=lv||(r.level==='project'?'programme':'portfolio');
  const g=rkProgOf(r); if(lv==='programme'&&!g) lv='portfolio';
  const sc=lv==='programme'?{lv,id:g}:{lv:'portfolio',id:null};
  const p=rkBlank(sc); p.title=r.title; p.status='open'; p.ref=rkNextRef(sc); Object.assign(p.d,{type:r.d.type||'threat',cat:r.d.cat||'',cause:r.d.cause||'',event:r.d.event||'',effect:r.d.effect||'',desc:`Escalated from ${r.ref} (${rkScopeName(rkScopeOf(r))}).`,q:JSON.parse(JSON.stringify(r.d.q||{})),qt:Object.assign(p.d.qt,{fromKids:true})});
  try{ perBusy('Escalating…'); const id=await rkCreate(p); await PER.store.updateRisk(r.id,{parentId:id});
    perToast(`Escalated to the ${lv} register as ${p.ref||'a new risk'}. Its exposure rolls up from ${r.ref}.`);
    setTimeout(()=>{ const x=rkById(id); if(x) rkOpen(x,'links'); },350); }
  catch(e){ perToast(perErr(e),'err'); } finally{ perBusy(''); } }

/* ---- export ---- */
function rkExport(){ const cols=rkRegCols(), defs=rkColDefs(), R=rkFiltered(), c=rkCfg();
  const reg=[cols.map(k=>defs[k])].concat(R.map(r=>cols.map(k=>rkCellX(r,k))));
  const dims=c.dims; const ass=[['Ref','Risk','Register','Level','Type','Status'].concat(...RQ.map(k=>[`${RQ_L[k]} P`,...dims.map(d=>`${RQ_L[k]} ${d.l}`),`${RQ_L[k]} score`,`${RQ_L[k]} rating`]),['Probability %','Distribution','Cost min','Cost likely','Cost max','Cost exposure','Days min','Days likely','Days max','Schedule exposure','Post-response probability %','Post cost min','Post cost likely','Post cost max','Post days min','Post days likely','Post days max','Rolls up from children','Schedule activities','Parent','Interface projects'])]
    .concat(R.map(r=>{ const q=r.d.q||{}, t=r.d.qt||{}, po=t.post||{}; return [r.ref,r.title,rkScopeName(rkScopeOf(r)),RLV_L[r.level],r.d.type==='opp'?'Opportunity':'Threat',RST[r.status]].concat(...RQ.map(k=>{ const s=q[k]||{}, sc=rkScore(s); return [s.p||'',...dims.map(d=>(s.i||{})[d.id]||''),sc??'',sc!=null?rkBand(sc).l:'']; }),
      [t.p??'',RDIST[t.dist||'tri'],...['min','ml','max'].map(x=>(t.cost||{})[x]??''),Math.round(rkEV(r,false,'cost')),...['min','ml','max'].map(x=>(t.time||{})[x]??''),Math.round(rkEV(r,false,'time')*10)/10,po.p??'',...['min','ml','max'].map(x=>(po.cost||{})[x]??''),...['min','ml','max'].map(x=>(po.time||{})[x]??''),t.fromKids?'Yes':'',t.acts||'',(rkById(r.parentId)||{}).ref||'',rkIfcPids(r).map(id=>(rkProj(id)||{}).name).filter(Boolean).join(', ')]); }));
  const acts=[['Risk ref','Risk','Action','Owner','Due','Status','Cost','Completed']].concat(R.flatMap(r=>rkActs(r).map(a=>[r.ref,r.title,a.t||'',a.owner||'',xD(a.due),RACT[a.status]||'',a.cost||'',xD(a.doneAt)])));
  const resp=[['Risk ref','Risk','Response','Response owner','Plan','Trigger / early warning','Fallback','Contingency']].concat(R.map(r=>{ const p=r.d.resp||{}, L=RSTRAT[r.d.type==='opp'?'opp':'threat'].find(x=>x[0]===p.strat); return [r.ref,r.title,L?L[1]:'',p.owner||'',p.plan||'',p.trigger||'',p.fallback||'',p.cont||'']; }));
  xlsSave(`${rkScopeName(RK.scope)} risk register ${new Date().toISOString().slice(0,10)}`,[{name:'Register',rows:reg},{name:'Assessment',rows:ass},{name:'Responses',rows:resp},{name:'Actions',rows:acts}]); }
