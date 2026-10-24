/* ---------------- Interfaces ---------------- */
const HARDC=new Set(['CS_MSO','CS_MEO','CS_MSOB','CS_MEOB','CS_MANDSTART','CS_MANDFIN']);
function ifcSave(){ try{ localStorage.setItem('pacer.ifc',JSON.stringify({code:S.ifc.code,manual:S.ifc.manual,days:S.ifc.days,amber:S.ifc.amber})); }catch(_){} }
function ifcLoad(){ try{ const x=JSON.parse(localStorage.getItem('pacer.ifc')||'null'); if(x) Object.assign(S.ifc,x); }catch(_){} }
function ifcCodeDefault(){ return M.codeTypes.find(t=>/interface|\bifc\b|i\/f/i.test(t))||''; }
function ifcList(){
  if(S.ifc.code===null||(S.ifc.code&&!M.codeTypes.includes(S.ifc.code))) S.ifc.code=ifcCodeDefault();
  const out=[], used=new Set(), t=S.ifc.code;
  if(t){ const groups=new Map(); M.rows.forEach(r=>{ const v=r.codes[t]; if(v==null) return; if(!groups.has(v)) groups.set(v,[]); groups.get(v).push(r); });
    groups.forEach((mem,v)=>{ if(mem.length<2) return; let pairs=[];
      mem.forEach(a=>mem.forEach(b=>{ if(a!==b&&a.L&&b.L&&b.L.preds.some(p=>p.a===a.L)) pairs.push([a,b]); }));
      if(!pairs.length){ const so=mem.slice().sort((a,b)=>(((a.L||a.B).type==='TT_FinMile')?0:1)-(((b.L||b.B).type==='TT_FinMile')?0:1)||((a.bf??a.f??0)-(b.bf??b.f??0))); pairs=[[so[0],so[1]]]; }
      const o=(M.codeOrder[t]||[]).find(x=>x.short===v);
      pairs.forEach(([g,r])=>{ out.push({id:v,desc:o&&o.name!==v?o.name:'',g,r,src:'code'}); used.add(g.k+'>'+r.k); }); }); }
  else { M.rows.forEach(r=>{ if(!r.L||!r.ms) return; r.L.preds.forEach(p=>{ const g=p.a.R; if(g&&g.ms&&p.a.proj!==r.L.proj&&!used.has(g.k+'>'+r.k)){ used.add(g.k+'>'+r.k); out.push({id:g.code+'→'+r.code,desc:'',g,r,src:'link'}); } }); }); }
  S.ifc.manual.forEach(m=>{ const g=M.byKey.get(m.g), r=M.byKey.get(m.r); if(g&&r&&!used.has(g.k+'>'+r.k)) out.push({id:m.id||g.code+'→'+r.code,desc:m.desc||'',g,r,src:'manual',mid:m.mid}); });
  return out.sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
}
function ifcEval(I){
  const g=I.g, r=I.r, gL=g.L, rL=r.L, gF=gL?g.f:null, need=r.bf!=null?r.bf:(rL?r.f:null), margin=(gF!=null&&need!=null)?dd(need-gF):null;
  const link=gL&&rL?rL.preds.find(p=>p.a===gL):null, blLink=g.B&&r.B?r.B.preds.find(p=>p.a===g.B):null;
  const C2=[
    ['link',!!link,link?`Receiver ${r.code} is driven by giver ${g.code}`:`Receiver ${r.code} has no relationship from giver ${g.code}`],
    ['type',!!link&&link.type==='FS'&&Math.abs(link.lag)<0.01,!link?'No link to check':link.type==='FS'&&Math.abs(link.lag)<0.01?'Finish-to-start with no lag':`Link is ${link.type}${link.lag?(link.lag>0?' +':' ')+Math.round(link.lag)+'d':''}; interfaces should be FS with no lag`],
    ['gdrv',!!(gL&&gL.preds.some(p=>p.a.proj===gL.proj)),gL&&gL.preds.some(p=>p.a.proj===gL.proj)?`Giver is driven by work in ${gL.proj}`:`Giver has no predecessor in its own project, so its date is not earned by work`],
    ['rdrv',!!(rL&&rL.succs.some(p=>p.a.proj===rL.proj)),rL&&rL.succs.some(p=>p.a.proj===rL.proj)?`Receiver drives work in ${rL.proj}`:`Receiver has no successor in its own project, so a late handover would not move anything`],
    ['cstr',!(gL&&(HARDC.has(gL.raw.cstr_type)||HARDC.has(gL.raw.cstr_type2)))&&!(rL&&(HARDC.has(rL.raw.cstr_type)||HARDC.has(rL.raw.cstr_type2))),'No hard constraints on either milestone'],
    ['proj',!!(gL&&rL&&gL.proj!==rL.proj),gL&&rL&&gL.proj!==rL.proj?`Crosses ${gL.proj} → ${rL.proj}`:'Giver and receiver are in the same project'],
    ['bl',!(g.B&&r.B)||!!blLink,!(g.B&&r.B)?'Not in the baseline':blLink?'Same link exists in the baseline':'Link was not in the baseline']];
  if(!C2[4][1]) C2[4][2]='A hard constraint on the giver or receiver overrides the logic';
  const issues=C2.filter(c=>!c[1]&&c[0]!=='bl').length+(C2[6][1]?0:1);
  const rag=margin==null?'na':margin<0?'r':margin<S.ifc.amber?'a':'g';
  return {gF,need,margin,link,checks:C2,issues,rag};
}
function ifcBypass(set){ const out=[]; M.rows.forEach(r=>{ if(!r.L) return; r.L.preds.forEach(p=>{ const a=p.a; if(a.proj===r.L.proj) return; const k=a.R?a.R.k:null; if(set.has(k)||set.has(r.k)) return; out.push({p:a,s:r.L,type:p.type,lag:p.lag,drv:isDrv(a,r.L,p.type)}); }); }); return out; }
function ifcWhatIf(act,days){ const delta=new Map([[act,days]]), q=[act]; let n=0;
  while(q.length&&n++<200000){ const a=q.shift(), da=delta.get(a); a.succs.forEach(p=>{ const s2=p.a; if(s2.status==='TK_Complete'||s2.s==null||a.f==null) return; const gap=Math.max(0,Math.floor(gapOf(a,s2,p.type,p.lag)/DAY+0.01)), ds=Math.max(0,da-gap); if(ds>0.01&&(delta.get(s2)||0)<ds-0.01){ delta.set(s2,ds); q.push(s2); } }); }
  return delta; }
function renderIfc(){
  const el=document.getElementById('ifcWrap'); if(el.hidden||!M) return;
  if(!M.live.acts.size){ el.innerHTML='<div class="card dq-empty"><h3>No live schedule loaded</h3><p>Add XER files to review interface milestones.</p><button class="btn primary" data-open-files>Open files</button></div>'; return; }
  const list=ifcList().map(I=>({...I,ev:ifcEval(I)})), set=new Set(); list.forEach(I=>{ set.add(I.g.k); set.add(I.r.k); });
  const bypass=ifcBypass(set), cnt={g:0,a:0,r:0,na:0}; list.forEach(I=>cnt[I.ev.rag]++); const iss=list.filter(I=>I.ev.issues).length;
  if(S.ifc.sel&&!list.some(I=>I.g.k+'>'+I.r.k===S.ifc.sel)) S.ifc.sel=null; if(!S.ifc.sel&&list.length){ const open=list.filter(I=>I.g.status!=='TK_Complete'); const w=open.find(I=>I.ev.issues)||open.find(I=>I.ev.rag==='r')||open[0]||list[0]; S.ifc.sel=w.g.k+'>'+w.r.k; }
  const RAGC={g:'var(--early)',a:'#E0A100',r:'var(--late)',na:'var(--ink3)'}, LAB={g:'On track',a:'Tight',r:'Late',na:'No date'};
  // shared scale for row strips
  let t0=Infinity,t1=-Infinity; list.forEach(I=>[I.ev.gF,I.ev.need,I.g.bf].forEach(t=>{ if(t!=null){ t0=Math.min(t0,t); t1=Math.max(t1,t); } })); if(M.dd!=null){ t0=Math.min(t0,M.dd); t1=Math.max(t1,M.dd); } const pd2=(t1-t0)*0.04||DAY*5; t0-=pd2; t1+=pd2;
  const SW=150, XS=t=>6+(t-t0)/(t1-t0||1)*(SW-12);
  const strip=I=>{ const e=I.ev, c=RAGC[e.rag]; let h=`<svg class="ifs" viewBox="0 0 ${SW} 26" width="${SW}" height="26" aria-hidden="true">`;
    if(M.dd!=null) h+=`<line x1="${XS(M.dd)}" x2="${XS(M.dd)}" y1="2" y2="24" stroke="var(--accent)" stroke-dasharray="2 2"/>`;
    if(e.gF!=null&&e.need!=null) h+=`<line x1="${XS(e.gF)}" x2="${XS(e.need)}" y1="13" y2="13" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
    if(I.g.bf!=null&&I.g.L&&Math.abs(I.g.bf-e.gF)>DAY) h+=`<path d="M${XS(I.g.bf)} 8L${XS(I.g.bf)+5} 13L${XS(I.g.bf)} 18L${XS(I.g.bf)-5} 13Z" fill="var(--surface)" stroke="var(--base)" stroke-width="1.4"/>`;
    if(e.need!=null) h+=`<rect x="${XS(e.need)-1.5}" y="4" width="3" height="18" rx="1.5" fill="var(--ink)"/>`;
    if(e.gF!=null) h+=`<path d="M${XS(e.gF)} 7L${XS(e.gF)+6} 13L${XS(e.gF)} 19L${XS(e.gF)-6} 13Z" fill="${c}" stroke="var(--surface)" stroke-width="1.2"/>`;
    return h+'</svg>'; };
  const chk=e=>e.checks.slice(0,4).map(([k,ok,txt])=>`<i class="ck ${ok?'ok':'no'}" title="${esc(txt)}">${{link:'L',type:'FS',gdrv:'G',rdrv:'R'}[k]}</i>`).join('');
  // matrix
  const projs=[...new Set(list.flatMap(I=>[I.g.proj,I.r.proj]))].sort(), cell=(a,b)=>list.filter(I=>I.g.proj===a&&I.r.proj===b);
  const worst=arr=>arr.some(I=>I.ev.rag==='r')?'r':arr.some(I=>I.ev.rag==='a')?'a':arr.length?'g':'na';
  const matrix=projs.length?`<div class="tw"><table class="rt ifm"><thead><tr><th>From ↓ To →</th>${projs.map(p=>`<th class="n">${esc(p)}</th>`).join('')}</tr></thead><tbody>${projs.map(a=>`<tr><td><b>${esc(a)}</b></td>${projs.map(b=>{ const c=cell(a,b); return `<td class="n">${c.length?`<span class="ifcell" style="--c:${RAGC[worst(c)]}">${c.length}</span>`:'<span class="muted">·</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`:'';
  const sel=list.find(I=>I.g.k+'>'+I.r.k===S.ifc.sel);
  const codeOpts=`<option value="">None (pair milestones linked across projects)</option>`+M.codeTypes.map(t=>`<option value="${esc(t)}"${S.ifc.code===t?' selected':''}>${esc(t)}</option>`).join('');
  const opts=M.rows.filter(r=>r.L).sort((a,b)=>(b.ms-a.ms)||a.code.localeCompare(b.code)).slice(0,4000).map(r=>`<option value="${esc(r.code)} — ${esc(r.name)}"></option>`).join('');
  el.innerHTML=`
  <div class="card stats ifstats">
    <div class="stat"><div class="sl">Interfaces</div><div class="sv">${list.length}</div><div class="ss">${S.ifc.code?`paired by ${esc(S.ifc.code)}`:'paired by cross-project links'}${S.ifc.manual.length?` · ${S.ifc.manual.length} added`:''}</div></div>
    <div class="stat"><div class="sl">Late handovers</div><div class="sv ${cnt.r?'late':''}">${cnt.r}</div><div class="ss">giver after need date</div></div>
    <div class="stat"><div class="sl">Tight</div><div class="sv">${cnt.a}</div><div class="ss">under ${S.ifc.amber} days margin</div></div>
    <div class="stat"><div class="sl">Logic issues</div><div class="sv ${iss?'late':''}">${iss}</div><div class="ss">interfaces failing a check</div></div>
    <div class="stat"><div class="sl">Bypass links</div><div class="sv ${bypass.length?'acc':''}">${bypass.length}</div><div class="ss">cross-project links without an interface</div></div>
  </div>
  <div class="ifgrid">
  <div class="iftools card">
    <label class="ctl"><span>Pair by code</span><select id="ifCode">${codeOpts}</select></label>
    <span class="ctl">Tight under</span><input id="ifAmber" class="tvi" value="${S.ifc.amber}" inputmode="numeric" aria-label="Amber threshold in days"><span class="muted">days</span>
    <span class="sp"></span>
    <span class="ifadd"><input id="ifG" list="ifOpts" placeholder="Giver milestone" aria-label="Giver"><span class="muted">→</span><input id="ifR" list="ifOpts" placeholder="Receiver milestone" aria-label="Receiver"><input id="ifId" placeholder="ID" aria-label="Interface ID" style="width:84px"><button class="btn sm primary" id="ifAdd">Add interface</button></span>
    <datalist id="ifOpts">${opts}</datalist>
  </div>
    <div class="card ifmat"><div class="ph"><span class="sl">Interface matrix</span><span class="pn">worst status per pair</span></div>${matrix||'<p class="muted">No interfaces yet.</p>'}</div>
  </div>
    <div class="card ifreg"><div class="ph"><span class="sl">Interface register</span><span class="pn">L link · FS type · G giver driven · R receiver drives</span></div>
      ${list.length?`<div class="tw" tabindex="0" role="region" aria-label="Interface register table"><table class="rt ift"><thead><tr><th>ID</th><th>Giver</th><th>Receiver</th><th class="n">Giver forecast</th><th class="n">Need by</th><th class="n">Margin</th><th>Handover vs need</th><th>Logic</th><th>Status</th></tr></thead><tbody>
      ${list.map(I=>{ const e=I.ev, key=I.g.k+'>'+I.r.k; return `<tr data-ifk="${esc(key)}" class="${S.ifc.sel===key?'me':''}"><td><b>${esc(I.id)}</b>${I.src==='manual'?' <span class="tg2">Added</span>':''}${I.desc?`<br><span class="muted ifd">${esc(I.desc)}</span>`:''}</td>
        <td class="nm"><span class="tg2">${esc(I.g.proj)}</span> <b>${esc(I.g.code)}</b><br><span class="ifd">${esc(I.g.name)}</span></td><td class="nm"><span class="tg2">${esc(I.r.proj)}</span> <b>${esc(I.r.code)}</b><br><span class="ifd">${esc(I.r.name)}</span></td>
        <td class="n">${fmtD(e.gF)}${I.g.varF?`<br><span class="${I.g.varF>0?'late':'early'} ifd">${sgn(I.g.varF)}d</span>`:''}</td><td class="n">${fmtD(e.need)}</td><td class="n"><b class="${e.rag==='r'?'late':e.rag==='g'?'early':''}">${e.margin==null?'—':sgn(e.margin)+'d'}</b></td>
        <td>${strip(I)}</td><td><span class="cks">${chk(e)}</span></td><td><span class="st ${e.rag==='r'?'fail':e.rag==='g'?'pass':'na'}" ${e.rag==='a'?'style="background:color-mix(in srgb,#E0A100 16%,transparent);color:#B07D00"':''}>${I.g.status==='TK_Complete'?(e.margin!=null&&e.margin<0?'Handed over late':'Handed over'):LAB[e.rag]}</span>${e.issues?` <span class="tg2 new">${e.issues} issue${e.issues===1?'':'s'}</span>`:''}</td></tr>`; }).join('')}</tbody></table></div>`:`<p class="muted">No interfaces found. Choose the activity code that pairs giver and receiver milestones, or add pairs with the fields above.</p>`}
    </div>
  ${sel?ifcDetail(sel):''}
  <div class="card ifby"><div class="ph"><span class="sl">Cross-project links that bypass interface milestones · ${bypass.length}</span><span class="pn">Route these through a giver/receiver pair so the handover is visible and controlled</span></div>
    ${bypass.length?`<div class="tw"><table class="rt"><thead><tr><th>From</th><th></th><th>To</th><th>Type</th><th class="n">Lag</th><th>Driving</th><th></th></tr></thead><tbody>${bypass.slice(0,300).map(b=>`<tr><td class="nm"><span class="tg2">${esc(b.p.proj)}</span> <b>${esc(b.p.code)}</b> ${esc(b.p.name)}</td><td>→</td><td class="nm"><span class="tg2">${esc(b.s.proj)}</span> <b>${esc(b.s.code)}</b> ${esc(b.s.name)}</td><td>${b.type}</td><td class="n">${b.lag?(b.lag>0?'+':'−')+Math.abs(Math.round(b.lag))+'d':'0'}</td><td>${b.drv?'<span class="drv">Driving</span>':''}</td><td><button class="link" data-ifbg="${esc(b.s.R?b.s.R.k:'')}" data-ifbp="${esc(b.p.R?b.p.R.k:'')}">Show in Gantt</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Every cross-project relationship runs through an interface pair.</p>'}
  </div>`;
}
function ifcDetail(I){
  const e=I.ev, g=I.g, r=I.r, wi=S.ifc.wi&&S.ifc.wi.key===g.k+'>'+r.k?S.ifc.wi:null;
  const side=(x,role)=>{ const a=x.L, own=a?(role==='g'?a.preds:a.succs).filter(p=>p.a.proj===a.proj):[], cross=a?(role==='g'?a.succs:a.preds).filter(p=>p.a.proj!==a.proj):[];
    return `<div class="ifside"><div class="eyebrow">${role==='g'?'Giver':'Receiver'} · ${esc(x.proj)}</div><h4><button class="link" data-ifopen="${esc(x.k)}">${esc(x.code)}</button> ${esc(x.name)}</h4>
      <dl class="kv"><dt>${role==='g'?'Forecast':'Forecast'}</dt><dd>${fmtL(x.L?x.f:null)}</dd><dt>Baseline</dt><dd>${fmtL(x.bf)}</dd><dt>Variance</dt><dd>${x.varF==null?'—':sgn(x.varF)+'d'}</dd><dt>Total float</dt><dd>${x.tf==null?'—':Math.round(x.tf)+'d'}</dd>
      <dt>${role==='g'?'Driven by':'Drives'}</dt><dd>${own.length?own.slice(0,4).map(p=>esc(p.a.code)).join(', ')+(own.length>4?` +${own.length-4}`:''):'<span class="late">nothing in '+esc(x.proj)+'</span>'}</dd>
      <dt>${role==='g'?'Hands to':'Received from'}</dt><dd>${cross.length?cross.slice(0,4).map(p=>`${esc(p.a.code)} (${esc(p.a.proj)})`).join(', '):'<span class="muted">—</span>'}</dd></dl></div>`; };
  let wiH='';
  if(wi){ const fin=wi.fin, recv=wi.recv;
    wiH=`<div class="ifwi-r"><div class="ifwi-s"><div><div class="sl">Activities pushed</div><div class="sv">${wi.n}</div></div><div><div class="sl">Interfaces hit</div><div class="sv ${recv.length?'late':''}">${recv.length}</div></div><div><div class="sl">Finish moves</div><div class="sv ${fin>0?'late':''}">${fin>0?'+'+Math.round(fin)+'d':'0d'}</div></div></div>
      ${recv.length?`<div class="ifwl">${recv.map(x=>`<span class="tg2 new">${esc(x.id)} +${Math.round(x.d)}d</span>`).join(' ')}</div>`:''}
      ${wi.top.length?`<div class="tw"><table class="rt"><thead><tr><th>Activity</th><th>Project</th><th class="n">Pushed</th><th class="n">New finish</th></tr></thead><tbody>${wi.top.map(([a,d])=>`<tr data-ifopenrow="${esc(a.R?a.R.k:'')}"><td class="nm"><b>${esc(a.code)}</b> ${esc(a.name)}</td><td>${esc(a.proj)}</td><td class="n late">+${Math.round(d)}d</td><td class="n">${fmtD(a.f+d*DAY)}</td></tr>`).join('')}</tbody></table></div>`:''}
      <p class="muted" style="font-size:12px;margin:8px 0 0">Calendar-day estimate through the relationships and lags in the live schedule; float absorbs delay before it passes on. Recalculate in P6 to confirm.</p></div>`; }
  return `<div class="card ifdet"><div class="ph"><span class="sl">Interface ${esc(I.id)}${I.desc?' · '+esc(I.desc):''}</span><span class="sp" style="flex:1"></span><button class="btn sm" data-ifpop="${esc(I.g.k+'>'+I.r.k)}">${(S.ex.ifcs||[]).includes(I.g.k+'>'+I.r.k)?'On Plan on a Page ✓':'Add to Plan on a Page'}</button>${I.src==='manual'?`<button class="link" data-ifdel="${esc(I.mid||'')}">Remove interface</button>`:''}</div>
    <div class="ifdg">${side(g,'g')}<div class="ifmid"><div class="ifarrow ${e.rag}"><span>${e.margin==null?'—':sgn(e.margin)+'d'}</span><em>margin to need date</em></div></div>${side(r,'r')}</div>
    <div class="ifdg2"><div><div class="dh">Logic checks</div><ul class="ifck">${e.checks.map(([k,ok,txt])=>`<li class="${ok?'ok':'no'}"><i>${ok?'✓':'!'}</i>${esc(txt)}</li>`).join('')}</ul></div>
      <div><div class="dh">What if the giver slips?</div>${g.status==='TK_Complete'?`<p class="muted" style="font-size:13px;margin:0">${esc(g.code)} was achieved on ${fmtL(g.f)}, so it can no longer slip. Pick an open interface to test a delay.</p>`:`<div class="ifwi"><span class="ctl">Delay ${esc(g.code)} by</span><input id="ifDays" class="tvi" value="${S.ifc.days}" inputmode="numeric" aria-label="Delay in days"><span class="muted">days</span><button class="btn sm primary" id="ifRun">Run</button>${wi?`<button class="btn sm" id="ifWiGantt">Show impact in Gantt</button>`:''}</div>${wiH}`}</div></div></div>`;
}
function wireIfc(){
  const el=document.getElementById('ifcWrap');
  el.addEventListener('click',e=>{
    const row=e.target.closest('[data-ifk]'); if(row&&!e.target.closest('button')){ S.ifc.sel=row.dataset.ifk; S.ifc.wi=null; renderIfc(); document.querySelector('.ifdet')?.scrollIntoView({block:'nearest',behavior:'smooth'}); return; }
    const op=e.target.closest('[data-ifopen],[data-ifopenrow]'); if(op){ const k=op.dataset.ifopen||op.dataset.ifopenrow; if(k) openDrawer(k); return; }
    const b=e.target.closest('button'); if(!b) return;
    if(b.id==='ifAdd'){ const code=v=>String(v||'').split(' — ')[0].trim(), find=c=>M.rows.find(r=>r.code===c&&r.L);
      const g=find(code(document.getElementById('ifG').value)), r=find(code(document.getElementById('ifR').value)), msg=document.getElementById('note');
      if(!g||!r||g===r){ msg.textContent='Pick a giver and a receiver from the list. They must be two different activities.'; return; }
      S.ifc.manual.push({mid:uid()+Date.now(),id:document.getElementById('ifId').value.trim()||`${g.code}→${r.code}`,g:g.k,r:r.k}); S.ifc.sel=g.k+'>'+r.k; ifcSave(); setNote(''); renderIfc(); return; }
    if(b.dataset.ifpop){ const k=b.dataset.ifpop; S.ex.ifcs=S.ex.ifcs||[]; const i=S.ex.ifcs.indexOf(k); i<0?S.ex.ifcs.push(k):S.ex.ifcs.splice(i,1); exSave(); renderIfc(); return; }
    if(b.dataset.ifdel){ S.ifc.manual=S.ifc.manual.filter(m=>m.mid!==b.dataset.ifdel); S.ifc.sel=null; ifcSave(); renderIfc(); return; }
    if(b.id==='ifRun'){ const list=ifcList(), I=list.find(x=>x.g.k+'>'+x.r.k===S.ifc.sel); if(!I||!I.g.L) return; const d=Math.max(0,parseFloat(document.getElementById('ifDays').value)||0); S.ifc.days=d; ifcSave();
      const delta=ifcWhatIf(I.g.L,d); delta.delete(I.g.L); let maxF=-Infinity,maxF2=-Infinity; for(const a of M.live.acts.values()){ if(a.f==null) continue; maxF=Math.max(maxF,a.f); maxF2=Math.max(maxF2,a.f+(delta.get(a)||0)*DAY); }
      const recv=list.filter(x=>x.r.L&&delta.has(x.r.L)).map(x=>({id:x.id,d:delta.get(x.r.L)}));
      S.ifc.wi={key:S.ifc.sel,n:delta.size,fin:(maxF2-maxF)/DAY,recv,top:[...delta].sort((a,b)=>b[1]-a[1]).slice(0,12),keys:[I.g.k,...[...delta.keys()].map(a=>a.R&&a.R.k).filter(Boolean)]}; renderIfc(); return; }
    if(b.id==='ifWiGantt'&&S.ifc.wi){ S.F.ids={label:'Delay impact',set:new Set(S.ifc.wi.keys)}; renderFilters(); setTab('gantt'); applyFilters(); fitGantt(); return; }
    if(b.dataset.ifbg!=null){ const ks=[b.dataset.ifbg,b.dataset.ifbp].filter(Boolean); S.F.ids={label:'Cross-project link',set:new Set(ks)}; renderFilters(); setTab('gantt'); applyFilters(); fitGantt(); S.logic='all'; renderControls(); drawGantt(); } });
  el.addEventListener('change',e=>{ if(e.target.id==='ifCode'){ S.ifc.code=e.target.value; S.ifc.sel=null; S.ifc.wi=null; ifcSave(); renderIfc(); }
    if(e.target.id==='ifAmber'){ const n=parseInt(e.target.value,10); S.ifc.amber=isFinite(n)?Math.max(0,n):10; ifcSave(); renderIfc(); } });
}


