/* ================= Reports: programme dashboard, exports, set-up checklist, phone activity list ================= */

/* ---- exports: Excel (SheetJS, loaded on first use) with CSV fallback, and print / save as PDF ---- */
let XLSXP=null;
function xlsxLib(){ if(window.XLSX) return Promise.resolve(window.XLSX); if(XLSXP) return XLSXP;
  XLSXP=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=()=>res(window.XLSX); s.onerror=()=>{ XLSXP=null; rej(new Error('Excel export could not load')); }; document.head.appendChild(s); }); return XLSXP; }
// sheets: [{name, rows:[[...header],[...]...], widths?}]
async function xlsSave(base,sheets){
  const safe=base.replace(/[^\w\- ]+/g,'').trim()||'export';
  try{ const X=await xlsxLib(), wb=X.utils.book_new();
    sheets.forEach(sh=>{ const ws=X.utils.aoa_to_sheet(sh.rows); ws['!cols']=(sh.widths||sh.rows[0].map((h,i)=>Math.min(60,Math.max(10,...sh.rows.slice(0,200).map(r=>String(r[i]??'').length))+2))).map(w=>({wch:w})); X.utils.book_append_sheet(wb,ws,sh.name.slice(0,31)); });
    const out=X.write(wb,{bookType:'xlsx',type:'array'});
    await repSave(safe+'.xlsx',new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  }catch(e){ console.warn(e); const sh=sheets[0], q=v=>`"${String(v??'').replace(/"/g,'""')}"`; await repSave(safe+'.csv',sh.rows.map(r=>r.map(q).join(',')).join('\n')); perToast('Excel export wasn’t available here, so this was saved as a CSV file.'); }
}
async function repSave(fn,data){
  try{ const dl=window.claude?await window.claude.use('downloads'):null; if(dl){ await dl.save({filename:fn,data}); return; } }catch(e){ if(e&&e.code==='declined') return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(data instanceof Blob?data:new Blob([data])); a.download=fn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
}
function repPrint(title){ const t=document.title; if(title) document.title=title; document.body.classList.add('printing'); setTimeout(()=>{ window.print(); document.body.classList.remove('printing'); document.title=t; },60); }
const xD=t=>t==null?'':new Date(t).toISOString().slice(0,10), xN=(v,d=2)=>v==null||!isFinite(v)?'':Math.round(v*10**d)/10**d, xP=v=>v==null?'':Math.round(v*1000)/10;

function portExportRows(list){ const P=list||PER.projects;
  const head=['Programme','Project','Code','Status','Manager','Latest update','Data date','Forecast finish','Baseline finish','Variance (d)','Moved this period (d)','Actual %','Planned %','BEI','Critical','Negative float','Updates saved'];
  return [head].concat(P.map(p=>{ const s=p.summary||{}, g=PER.programmes.find(x=>x.id===p.programmeId), vb=s.finish!=null&&s.blFinish!=null?Math.round((s.finish-s.blFinish)/DAY):'', mv=s.finish!=null&&s.prevFinish!=null?Math.round((s.finish-s.prevFinish)/DAY):'';
    return [g?g.name:'',p.name,p.code||'',PSTAT[p.status]||p.status||'',p.manager||'',s.label||'',xD(s.dd),xD(s.finish),xD(s.blFinish),vb,mv,xP(s.pctA),xP(s.pctP),xN(s.bei),s.crit??'',s.neg??'',s.count||0]; })); }
function perExportRows(){ const P=PER.periods;
  const head=['Update','Data date','Forecast finish','Baseline finish','Variance (d)','Moved (d)','Actual %','Planned %','BEI','Hit rate %','Critical','Negative float','Open ends','Budget','Planned value','Earned value','Actual cost','SPI','CPI','Estimate at completion','Notes','What changed','Causes','Recovery','Risks'];
  return [head].concat(P.map((p,i)=>{ const s=p.stats||{}, pr=i?P[i-1].stats||{}:{}, c=s.cost||{}, n=p.narrative||{}, rel=s.rel&&s.rel.pf?s.rel.hf/s.rel.pf:null;
    return [p.label,xD(p.dd),xD(s.finish),xD(s.blFinish),s.finish!=null&&s.blFinish!=null?Math.round((s.finish-s.blFinish)/DAY):'',i&&s.finish!=null&&pr.finish!=null?Math.round((s.finish-pr.finish)/DAY):'',xP(s.pctA),xP(s.pctP),xN(s.bei),xP(rel),s.crit??'',s.neg??'',s.open??'',xN(c.bac,0),xN(c.pv,0),xN(c.ev,0),xN(c.ac,0),xN(c.spi),xN(c.cpi),xN(c.eac,0),p.notes||'',n.changed||'',n.cause||'',n.recovery||'',n.risks||'']; })); }

/* ---- programme dashboard ---- */
const PD={cache:new Map()};
async function pdPeriods(p){ const k=p.id+'|'+(p.updatedAt||0)+'|'+((p.summary||{}).count||0); if(PD.cache.has(k)) return PD.cache.get(k);
  const L=(await PER.store.listPeriods(p.id)).sort((a,b)=>(a.dd||0)-(b.dd||0)||(a.savedAt||0)-(b.savedAt||0)); PD.cache.set(k,L); return L; }
function pdOpen(gid){ PORT.prog=gid; renderPort(); scrollTo(0,0); }
async function renderProgDash(el){
  const g=PER.programmes.find(x=>x.id===PORT.prog); if(!g){ PORT.prog=null; return renderPort(); }
  const projs=PER.projects.filter(p=>p.programmeId===g.id), withS=projs.filter(p=>p.summary);
  el.innerHTML=`<div class="card porthead"><div class="ph-t"><button class="btn sm ghost" data-pd="back">← Portfolio</button><h2>${esc(g.name)}</h2><span class="pspace">${esc([g.client,`${projs.length} project${projs.length===1?'':'s'}`].filter(Boolean).join(' · '))}</span></div>
    <div class="ph-c">${withS.length>1?`<button class="btn sm primary" data-w data-po="openprog" data-id="${esc(g.id)}">Open all in workbench</button>`:''}<button class="btn sm" data-pd="xls">Excel</button><button class="btn sm" data-pd="print">Print / PDF</button></div></div><div id="pdBody" class="pdb2"><div class="card pempty">Loading the programme’s updates…</div></div>`;
  const tok=(PD.tok=(PD.tok||0)+1);
  let per; try{ per=await Promise.all(withS.map(pdPeriods)); }catch(e){ document.getElementById('pdBody').innerHTML=`<div class="card pempty">${esc(perErr(e))}</div>`; return; }
  if(tok!==PD.tok||!document.getElementById('pdBody')) return;
  const PAL=['var(--accent)','#3B6FE0','#14A37F','#9B5DE5','#D99A00','#E04F8C','#1BA1C4','#6DAA1A'];
  const xs=[...new Set(per.flat().map(p=>p.dd).filter(x=>x!=null))].sort((a,b)=>a-b), xl=v=>fmtD(v).slice(3);
  const at=(L,d)=>{ let r=null; for(const p of L){ if(p.dd!=null&&p.dd<=d) r=p; } return r; };
  const roll=d=>{ let n=0,a=0,pl=0,np=0,done=0,due=0,c=null; per.forEach(L=>{ const p=at(L,d); if(!p) return; const s=p.stats||{}, w=s.n||1; n+=w; a+=(s.pctA||0)*w; if(s.pctP!=null){ pl+=s.pctP*w; np+=w; } done+=s.done||0; due+=s.due||0; if(s.cost){ c=c||{pv:0,ev:0,ac:0,bac:0,eac:0}; ['pv','ev','ac','bac','eac'].forEach(k=>c[k]+=s.cost[k]||0); } }); return {a:n?a/n:null,p:np?pl/np:null,bei:due?done/due:null,c}; };
  const R=xs.map(roll), last=R[R.length-1]||{}, fins=withS.map(p=>p.summary.finish).filter(x=>x!=null), bls=withS.map(p=>p.summary.blFinish).filter(x=>x!=null);
  const pf=fins.length?Math.max(...fins):null, pbl=bls.length?Math.max(...bls):null, pv=pf!=null&&pbl!=null?Math.round((pf-pbl)/DAY):null;
  const stale=projs.filter(p=>p.status==='active'&&(!p.summary||(Date.now()-(p.summary.dd||0))/DAY>staleDays())).length;
  const tiles=`<div class="card stats">
    <div class="stat"><div class="sl">Programme finish</div><div class="sv">${fmtD(pf)}</div><div class="ss">${pv!=null?`<span class="${dCls(pv)}">${dS(pv)}</span> vs baseline`:'no baseline'}</div></div>
    <div class="stat"><div class="sl">Progress</div><div class="sv">${pctS(last.a)}</div><div class="ss">planned ${pctS(last.p)} · activity-weighted</div></div>
    <div class="stat"><div class="sl">BEI</div><div class="sv ${last.bei!=null&&last.bei<.95?'late':''}">${last.bei!=null?last.bei.toFixed(2):'—'}</div><div class="ss">all projects</div></div>
    <div class="stat"><div class="sl">Cost (CPI · SPI)</div><div class="sv">${last.c&&last.c.ac?(last.c.ev/last.c.ac).toFixed(2):'—'} · ${last.c&&last.c.pv?(last.c.ev/last.c.pv).toFixed(2):'—'}</div><div class="ss">${last.c?`EAC ${moneyK(last.c.eac)} of ${moneyK(last.c.bac)}`:'no costs in the schedules'}</div></div>
    <div class="stat"><div class="sl">Projects behind</div><div class="sv ${withS.some(p=>p.summary.finish>p.summary.blFinish)?'late':''}">${withS.filter(p=>p.summary.blFinish!=null&&p.summary.finish>p.summary.blFinish).length}</div><div class="ss">of ${withS.length} with updates</div></div>
    <div class="stat"><div class="sl">Updates due</div><div class="sv ${stale?'amber':''}">${stale}</div><div class="ss">none in ${staleDays()} days</div></div></div>`;
  const c1=perChart({x:xs,yDate:true,xLab:xl,h:260,label:'Forecast finish by project',series:withS.map((p,i)=>({name:p.name,c:PAL[i%PAL.length],pts:xs.map(d=>{ const r=per[i].find(q=>q.dd===d); return [d,r&&r.stats?r.stats.finish:null]; })}))});
  const c2=perChart({x:xs,xLab:xl,y0:0,y1:1,yFmt:v=>Math.round(v*100)+'%',label:'Programme progress',series:[{name:'Planned',c:'var(--ink3)',dash:true,hollow:true,pts:R.map((r,i)=>[xs[i],r.p])},{name:'Actual',c:perC.live,pts:R.map((r,i)=>[xs[i],r.a])}]});
  const hasC=R.some(r=>r.c);
  const c3=hasC?perChart({x:xs,xLab:xl,y0:0,ml:62,yFmt:v=>moneyK(v),label:'Programme earned value',series:[{name:'Planned value',c:'var(--ink3)',dash:true,hollow:true,tip:p=>moneyK(p[1]),pts:R.map((r,i)=>[xs[i],r.c?r.c.pv:null])},{name:'Earned value',c:perC.blue,tip:p=>moneyK(p[1]),pts:R.map((r,i)=>[xs[i],r.c?r.c.ev:null])},{name:'Actual cost',c:perC.live,tip:p=>moneyK(p[1]),pts:R.map((r,i)=>[xs[i],r.c?r.c.ac:null])}]}):'';
  const tbl=`<div class="card dpanel span3"><div class="ph"><span class="sl">Projects</span><span class="pn">latest update of each</span></div><div class="tw"><table class="rt"><thead><tr><th>Project</th><th>Latest update</th><th class="n">Forecast finish</th><th class="n">Vs baseline</th><th class="n">This period</th><th class="n">Progress</th><th class="n">BEI</th><th class="n">CPI</th><th>Status</th></tr></thead><tbody>
    ${projs.map((p,i)=>{ const s=p.summary, j=withS.indexOf(p), L=j>=0?per[j]:[], lp=L[L.length-1], c=lp&&lp.stats&&lp.stats.cost, vb=s&&s.finish!=null&&s.blFinish!=null?Math.round((s.finish-s.blFinish)/DAY):null, mv=s&&s.finish!=null&&s.prevFinish!=null?Math.round((s.finish-s.prevFinish)/DAY):null;
      return `<tr><td><i class="pdk" style="background:${j>=0?PAL[j%PAL.length]:'var(--line)'}"></i><b>${esc(p.name)}</b>${p.manager?`<div class="muted">${esc(p.manager)}</div>`:''}</td><td>${s?esc(s.label||fmtD(s.dd)):'<span class="muted">No update yet</span>'}</td><td class="n">${s?fmtD(s.finish):'—'}</td><td class="n ${dCls(vb)}">${dS(vb)}</td><td class="n ${dCls(mv)}">${s?dS(mv):'—'}</td><td class="n">${s?pctS(s.pctA)+' / '+pctS(s.pctP):'—'}</td><td class="n">${s&&s.bei!=null?(+s.bei).toFixed(2):'—'}</td><td class="n">${c&&c.cpi!=null?c.cpi.toFixed(2):'—'}</td><td>${esc(PSTAT[p.status]||'')}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  const nar=withS.map((p,i)=>{ const L=per[i], lp=L[L.length-1]; return lp&&narHas(lp.narrative)?`<div class="pdn"><div class="pdn-h"><b>${esc(p.name)}</b><span class="muted">${esc(lp.label)}</span></div>${NAR.filter(([k])=>lp.narrative[k]).map(([k,l])=>`<div class="sl">${l}</div><p>${esc(lp.narrative[k])}</p>`).join('')}</div>`:''; }).join('');
  document.getElementById('pdBody').innerHTML=tiles+`<div class="dgrid pgrid">
    <div class="card dpanel span2"><div class="ph"><span class="sl">Forecast finish by project</span><span class="pn">at each data date</span></div>${c1}${perKeyLeg(withS.map((p,i)=>[PAL[i%PAL.length],p.name]))}</div>
    <div class="card dpanel"><div class="ph"><span class="sl">Programme progress</span><span class="pn">activity-weighted</span></div>${c2}${perKeyLeg([['var(--ink3)','Planned',1],[perC.live,'Actual']])}</div>
    ${hasC?`<div class="card dpanel span3"><div class="ph"><span class="sl">Programme earned value</span><span class="pn">all projects’ resource and expense costs</span></div>${c3}${perKeyLeg([['var(--ink3)','Planned value',1],[perC.blue,'Earned value'],[perC.live,'Actual cost']])}</div>`:''}
    ${tbl}
    <div class="card dpanel span3"><div class="ph"><span class="sl">Latest narrative</span><span class="pn">from each project’s most recent update</span></div>${nar||'<div class="pempty">No narratives yet. Add one when saving an update, or from a period on the Periods tab.</div>'}</div></div>`;
  PD.last={g,projs,per,withS};
}
function pdExport(){ const d=PD.last; if(!d) return; const rows=portExportRows(d.projs);
  const nar=[['Project','Update','Data date','What changed','Causes','Recovery','Risks']].concat(d.withS.map((p,i)=>{ const L=d.per[i], lp=L[L.length-1]||{}, n=lp.narrative||{}; return [p.name,lp.label||'',xD(lp.dd),n.changed||'',n.cause||'',n.recovery||'',n.risks||'']; }));
  const hist=[['Project','Update','Data date','Forecast finish','Baseline finish','Actual %','Planned %','BEI','Earned value','Actual cost','CPI','SPI']].concat(d.withS.flatMap((p,i)=>d.per[i].map(q=>{ const s=q.stats||{}, c=s.cost||{}; return [p.name,q.label,xD(q.dd),xD(s.finish),xD(s.blFinish),xP(s.pctA),xP(s.pctP),xN(s.bei),xN(c.ev,0),xN(c.ac,0),xN(c.cpi),xN(c.spi)]; })));
  xlsSave(`${d.g.name} programme ${new Date().toISOString().slice(0,10)}`,[{name:'Projects',rows},{name:'History',rows:hist},{name:'Narrative',rows:nar,widths:[28,24,12,50,50,50,50]}]); }

/* ---- set-up checklist for a company's admins ---- */
function setupSteps(){ const c=PER.company||{}, b=c.branding||{}, k=PER.coCounts||{};
  return [
    ['name','Name your company',!!c.name&&c.name!=='My company','co-access','Company name and sign-in rules'],
    ['brand','Add your branding',!!(b.title||b.accent||b.logo),'co-brand','Title, colour and logo'],
    ['people','Invite your team',(k.people||0)>1||(k.invites||0)>0||!!c.auto_approve_domain,'co-invites','Invitations or an auto-join email domain'],
    ['quality','Choose your quality checks',!!(Q.cfg&&Q.cfg.at),'co-quality','DCMA, AACE or your own set'],
    ['programme','Create a programme',PER.programmes.length>0,'port','Group your projects on the Portfolio'],
    ['update','Save the first schedule update',PER.projects.some(p=>p.summary),'port','Upload XER files to a project']]; }
function setupCard(full){ const S2=setupSteps(), done=S2.filter(s=>s[2]).length; if(done===S2.length&&!full) return '';
  return `<div class="card setup${full?' full':''}"><div class="su-h"><div><b>${done===S2.length?'Your workbench is set up':'Get your workbench ready'}</b><span class="muted">${done} of ${S2.length} done</span></div><span class="su-bar"><i style="width:${(done/S2.length*100).toFixed(0)}%"></i></span>${!full?'<button class="link" data-su="hide">Hide</button>':''}</div>
    <div class="su-l">${S2.map(([k,l,ok,go,sub])=>`<button class="su-i${ok?' ok':''}" data-su="${go}"><span class="su-c" aria-hidden="true">${ok?'✓':''}</span><span><b>${l}</b><em>${sub}</em></span></button>`).join('')}</div></div>`; }
function setupBanner(){ if(PER.mode!=='supa'||!PER.companyId||PER.srole!=='admin'||(PER.site&&PER.site.hideSetup)) return ''; return setupCard(false); }
document.addEventListener('click',e=>{ const b=e.target.closest('[data-su]'); if(!b) return; const v=b.dataset.su;
  if(v==='hide'){ PER.site={...(PER.site||{}),hideSetup:true}; PER.sb.from('company_settings').upsert({company_id:PER.companyId,site:PER.site,updated_by:PER.uid,updated_at:new Date().toISOString()}).then(()=>{}); renderPort(); return; }
  if(v==='port') setTab('port'); else admGo(v); });

/* ---- phone: an activity list instead of the Gantt chart ---- */
const ML={n:150};
function mobileList(){ const host=document.getElementById('mList'); if(!host) return; const on=S.tab==='gantt'&&innerWidth<=600&&M; host.hidden=!on; gWrap.classList.toggle('m-hide',!!on); if(!on) return;
  const rows=(S.rows||[]).slice(0,ML.n);
  host.innerHTML=`<div class="ml-h"><b>${(S.rows||[]).length} activities</b><span class="muted">Turn your phone sideways or use a larger screen for the Gantt chart.</span></div>${rows.map(r=>{ const st=stat(r);
    return `<button class="ml-i ${r.crit?'crit':''}" data-k="${esc(r.k)}"><span class="ml-c">${esc(r.code)}</span><span class="ml-n">${esc(r.name)}</span><span class="ml-d">${fmtD(r.s)} → ${fmtD(r.f)}</span><span class="ml-s">${st==='cp'?'Complete':st==='ip'?'In progress':st==='ns'?'Not started':'Removed'}${r.tf!=null&&st!=='cp'?` · TF ${Math.round(r.tf)}d`:''}${r.varF!=null?` · <span class="${dCls(r.varF)}">${dS(r.varF)}</span>`:''}</span></button>`; }).join('')}
    ${(S.rows||[]).length>ML.n?`<button class="btn sm ml-more" data-ml-more>Show ${Math.min(150,(S.rows||[]).length-ML.n)} more</button>`:''}`; }
document.addEventListener('click',e=>{ const m=e.target.closest('#mList [data-ml-more]'); if(m){ ML.n+=150; mobileList(); return; } const i=e.target.closest('#mList .ml-i'); if(i) openDrawer(i.dataset.k); });
addEventListener('resize',()=>{ if(S.tab==='gantt') mobileList(); });
