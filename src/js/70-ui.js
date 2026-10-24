/* ---------------- legend & notes ---------------- */
function setNote(h){ document.getElementById('note').innerHTML=h; }
function renderLegend(){
  const by=S.tab==='gantt'?S.colorBy:S.tld.colorBy, el=document.getElementById('legend'); const parts=[];
  if(S.tab==='tld'&&M){ const cls=styleClasses(); cls.slice(0,14).forEach(c=>{ const st=styleOf(c.r); parts.push([c.label,st.color,st.hatch]); }); if(cls.length>14) parts.push([`+${cls.length-14} more`,null]); }
  else
  if(by==='crit') parts.push(['Critical',C.accent],['Non-critical',C.bar],['Complete',C.done]);
  else if(by==='status') parts.push(['Not started',C.bar],['In progress',C.active],['Complete',C.done]);
  else { const t=by.slice(5), present=new Set(S.rows.map(r=>r.codes[t]).filter(v=>v!=null)); const ord=(M.codeOrder[t]||[]).filter(o=>present.has(o.short));
    ord.slice(0,14).forEach(o=>parts.push([o.name===o.short?o.short:`${o.short} ${o.name}`,codeColor(t,o.short)])); if(ord.length>14) parts.push([`+${ord.length-14} more`,null]); }
  let h=parts.map(([l,c,ht])=>c?`<span><i style="background:${c}${ht&&ht!=='none'?';background-image:repeating-linear-gradient(45deg,transparent 0 2px,rgba(255,255,255,.7) 2px 3.5px)':''}"></i>${esc(l)}</span>`:`<span>${esc(l)}</span>`).join('');
  if(cpOn()&&(S.tab==='gantt'||S.tab==='tld')){ const set=cpSet(), inf=cpCache.info, fin=inf.fin; h=`<span class="cpinfo"><i style="background:var(--accent)"></i><b>Critical path</b> · ${set.size} activities${S.cp.by==='float'?` with total float ≤ ${S.cp.thr}d`:inf.end?` driving ${esc(inf.end.code)}`:''}${fin?` · finishes ${fmtD(fin.f)}${fin.tf!=null?`, float ${Math.round(fin.tf)}d`:''}`:''}</span>`+h; }
  if(S.tab==='gantt'&&S.logic!=='off') h+=`<span><i style="background:none;border-top:2px solid var(--ink2);height:0;width:16px;vertical-align:3px"></i>Driving link</span><span><i style="background:none;border-top:2px dashed var(--ink3);height:0;width:16px;vertical-align:3px"></i>Non-driving</span>`;
  if(S.showBase) h+=S.tab==='gantt'?`<span><i style="background:var(--base);height:5px;vertical-align:1px"></i>Baseline</span>`:`<span><i style="background:none;border:2px dashed var(--base);height:10px"></i>Baseline</span>`;
  h+=`<span class="hint">${S.tab==='gantt'?'Ctrl + scroll to zoom · drag to pan · drag column edges to resize · click a header to sort':'Scroll to zoom · drag to pan · double-click to fit · open circles mark progress at the data date'}</span>`;
  el.innerHTML=h;
}

/* ---------------- sidebar filters ---------------- */
function renderFilters(){
  const side=document.getElementById('sideF'), F=S.F;
  const cnt=k=>M.rows.filter(r=>stat(r)===k).length, ccnt=k=>M.rows.filter(r=>r.cmp===k).length;
  const chip=(f,v,l,n,extra='')=>`<button class="chip${(f==='status'?F.status:f==='cmp'?F.cmp:F.proj).has(v)?' on':''}" data-f="${f}" data-v="${esc(v)}" ${extra}><span>${esc(l)}</span><em>${n}</em></button>`;
  const tree=n=>{ let h=`<button class="tn${F.wbs.has(n.key)?' on':''}" data-wbs="${esc(n.key)}" style="padding-left:${6+n.depth*14}px" title="${esc(n.label)}"><span class="bx"></span><span class="lb">${n.depth?esc(n.label):esc(n.short+' · '+n.label)}</span><em>${n.n}</em></button>`; n.children.forEach(c=>h+=tree(c)); return h; };
  let h=`${F.ids?`<div class="fids"><span><b>${esc(F.ids.label)}</b><br>${F.ids.set.size} activities</span><button class="fx" id="fIdsX" aria-label="Clear quality check filter">×</button></div>`:''}
  <label class="search"><input id="fq" type="search" placeholder="Search activity ID or name" value="${esc(F.q)}" autocomplete="off"></label>
  <div class="fsec"><div class="fh">Status</div><div class="chips">${chip('status','ns','Not started',cnt('ns'))}${chip('status','ip','In progress',cnt('ip'))}${chip('status','cp','Complete',cnt('cp'))}</div></div>
  <div class="fsec"><div class="fh">Versus baseline</div><div class="chips">${chip('cmp','late','Behind',ccnt('late'))}${chip('cmp','ontime','On or ahead',ccnt('ontime'))}${chip('cmp','added','Added',ccnt('added'))}${chip('cmp','removed','Removed',ccnt('removed'))}</div></div>
  <div class="fsec"><label class="tg"><input type="checkbox" id="fcrit" ${F.crit?'checked':''}> Critical only</label></div>`;
  if(M.projs.length>1) h+=`<div class="fsec"><div class="fh">Project</div><div class="chips">${M.projs.map(p=>chip('proj',p,p,M.rows.filter(r=>r.proj===p).length)).join('')}</div></div>`;
  h+=`<details class="fsec" open><summary><div class="fh">WBS <span class="on-n">${F.wbs.size||''}</span></div></summary><div class="tree">${M.roots.map(tree).join('')}</div></details>`;
  M.codeTypes.forEach(t=>{ const set=F.codes[t]||new Set(), counts=M.codeCount[t]||{};
    const vals=(M.codeOrder[t]||[]).filter(o=>counts[o.short]);
    h+=`<details class="fsec"${set.size?' open':''}><summary><div class="fh">${esc(t)} <span class="on-n">${set.size||''}</span></div></summary><div class="chips">${vals.map(o=>`<button class="chip${set.has(o.short)?' on':''}" data-code="${esc(t)}" data-v="${esc(o.short)}" title="${esc(o.name)}"><span>${esc(o.name===o.short?o.short:o.short+' · '+o.name)}</span><em>${counts[o.short]}</em></button>`).join('')}</div></details>`; });
  side.innerHTML=h;
}
function updateBadge(){ const n=activeFilterCount(), b=document.getElementById('fBadge'); b.hidden=!n; b.textContent=n; const s=document.getElementById('sbFiltN'); if(s){ s.hidden=!n; s.textContent=n; } }
// Collapsible sidebar sections, remembered per browser.
function sbInit(){ let st={}; try{ st=JSON.parse(localStorage.getItem('pacer.sb')||'{}'); }catch(_){}
  const apply=()=>document.querySelectorAll('#side .sbt').forEach(b=>{ const k=b.dataset.sb, closed=!!st[k]; b.setAttribute('aria-expanded',String(!closed)); b.closest('.sbox').classList.toggle('closed',closed); });
  document.getElementById('side').addEventListener('click',e=>{ const b=e.target.closest('.sbt'); if(!b) return; st[b.dataset.sb]=!st[b.dataset.sb]; try{ localStorage.setItem('pacer.sb',JSON.stringify(st)); }catch(_){} apply(); });
  apply(); }

/* ---------------- controls ---------------- */
function renderControls(){
  const el=document.getElementById('controls'), ct=M.codeTypes;
  const colorOpts=cur=>[['crit','Critical path'],['status','Status']].concat(ct.map(t=>['code:'+t,t])).map(([v,l])=>`<option value="${esc(v)}"${cur===v?' selected':''}>${esc(l)}</option>`).join('');
  if(S.tab==='gantt'){
    const gOpts=[['wbs','WBS'],['none','None']].concat(ct.map(t=>['code:'+t,t])).map(([v,l])=>`<option value="${esc(v)}"${S.group===v?' selected':''}>${esc(l)}</option>`).join('');
    el.innerHTML=`<button class="btn sm" id="cCols" aria-haspopup="dialog">Columns <span class="cbadge">${gCols().length}</span></button>
      <label class="ctl"><span>Group</span><select id="cGroup">${gOpts}</select></label>
      <label class="ctl"><span>Colour</span><select id="cColor">${colorOpts(S.colorBy)}</select></label>
      <div class="sg"><button data-z="out" aria-label="Zoom out">−</button><button data-z="fit">Fit</button><button data-z="in" aria-label="Zoom in">+</button></div>
      <div class="sg"><button data-x="expand">Expand</button><button data-x="collapse">Collapse</button></div>
      <label class="tg"><input type="checkbox" id="cBase" ${S.showBase?'checked':''}> Baseline</label>
      <span class="ctl">Logic</span><div class="sg" role="group" aria-label="Relationship lines">${[['off','Off'],['sel','Selected'],['all','All']].map(([v,l])=>`<button data-lg="${v}" class="${S.logic===v?'on':''}">${l}</button>`).join('')}</div>
      <span class="ctl">Critical path</span><div class="sg" role="group" aria-label="Critical path">${[['off','Off'],['hi','Highlight'],['only','Only']].map(([v,l])=>`<button data-cp="${v}" class="${S.cp.mode===v?'on':''}">${l}</button>`).join('')}</div>${S.cp.mode!=='off'?`<label class="ctl"><select id="cCpBy" aria-label="Critical path definition"><option value="float"${S.cp.by==='float'?' selected':''}>Total float ≤</option><option value="long"${S.cp.by==='long'?' selected':''}>Longest path</option></select></label>${S.cp.by==='float'?`<span class="chwin"><input id="cCpThr" value="${S.cp.thr}" inputmode="decimal" aria-label="Float threshold in days" style="width:52px"><span class="muted">days</span></span>`:''}`:''}`;
  } else if(S.tab==='dq'){
    el.innerHTML=`<span class="ctl">Assess</span><div class="sg" role="group" aria-label="Schedule to assess"><button data-dqr="live" class="${S.dq.role==='live'?'on':''}">Live</button><button data-dqr="base" class="${S.dq.role==='base'?'on':''}">Baseline</button></div>
      <span class="ctl">Scope</span><div class="sg" role="group" aria-label="Scope"><button data-dqs="all" class="${S.dq.scope==='all'?'on':''}">Whole schedule</button><button data-dqs="filtered" class="${S.dq.scope==='filtered'?'on':''}">Current filters</button></div>
      ${(()=>{ const av=qAvail(), cur=qCurrent(); return av.length>1?`<span class="ctl">Checks</span><div class="sg" role="group" aria-label="Quality framework">${av.map(k=>`<button data-qfw="${k}" class="${cur===k?'on':''}">${esc(qFwName(k))}</button>`).join('')}</div>`:`<span class="ctl">Checks</span><span class="pill">${esc(qFwName(cur))}</span>`; })()}
      ${qAdmin()?'<button class="btn sm" data-qcfg title="Choose the checks, limits and default framework for everyone">Configure checks</button>':''}`;
  } else {
    const numUdfs=M.udfs, ct2=M.codeTypes;
    const cur=S.tld.src==='udf'?'udf':S.tld.src==='name'?'name':S.tld.src==='map'?'map:'+S.tld.mapType:'code:'+S.tld.locType;
    const opt=(v,l)=>`<option value="${esc(v)}"${cur===v?' selected':''}>${esc(l)}</option>`;
    const locOpts=`<optgroup label="By chainage">${numUdfs.length?opt('udf','Chainage UDFs'):''}${ct2.map(t=>opt('map:'+t,t+' → chainage map')).join('')}${opt('name','Read from activity names')}</optgroup><optgroup label="By location bands">${ct2.map(t=>opt('code:'+t,t+' (equal bands)')).join('')}</optgroup>`;
    const uo=c=>numUdfs.map(u=>`<option${u===c?' selected':''}>${esc(u)}</option>`).join('');
    const isCh=S.tld.src!=='code';
    el.innerHTML=`<label class="ctl"><span>Location</span><select id="cLoc">${locOpts}</select></label>
      ${S.tld.src==='udf'?`<label class="ctl"><span>From</span><select id="cUs">${uo(S.tld.udfS)}</select></label><label class="ctl"><span>To</span><select id="cUe">${uo(S.tld.udfE)}</select></label>`:''}
      ${S.tld.src==='map'?`<button class="btn sm" id="cChMap">Chainage map</button>`:''}
      ${isCh?`<label class="ctl"><span>Values in</span><select id="cInU">${['km','m','mi','ft'].map(u=>`<option value="${u}"${S.tld.inUnit===u?' selected':''}>${u}</option>`).join('')}</select></label>
      <label class="ctl"><span>Show as</span><select id="cFmt">${Object.entries(FMT).map(([k,v])=>`<option value="${k}"${S.tld.fmt===k?' selected':''}>${v.label}</option>`).join('')}</select></label>
      <span class="chwin"><span class="ctl">Window</span><input id="cChF" aria-label="Chainage from" placeholder="from"><span class="muted">to</span><input id="cChT" aria-label="Chainage to" placeholder="to"></span>
      <label class="ctl"><span>Overlay</span><select id="cOv"><option value="">None</option>${ct2.map(t=>`<option value="${esc(t)}"${S.tld.overlay===t?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`:''}
      <label class="ctl"><span>Colour</span><select id="cTColor">${colorOpts(S.tld.colorBy)}</select></label>
      <div class="sg" role="group" aria-label="Time axis"><button data-o="v" class="${S.tld.orient==='v'?'on':''}">Time ↓</button><button data-o="h" class="${S.tld.orient==='h'?'on':''}">Time →</button></div>
      <div class="sg"><button data-tz="fit">Fit</button></div>
      <span class="ctl">Critical path</span><div class="sg" role="group" aria-label="Critical path">${[['off','Off'],['hi','Highlight'],['only','Only']].map(([v,l])=>`<button data-cp="${v}" class="${S.cp.mode===v?'on':''}">${l}</button>`).join('')}</div>${S.cp.mode!=='off'?`<label class="ctl"><select id="cCpBy" aria-label="Critical path definition"><option value="float"${S.cp.by==='float'?' selected':''}>Total float ≤</option><option value="long"${S.cp.by==='long'?' selected':''}>Longest path</option></select></label>${S.cp.by==='float'?`<span class="chwin"><input id="cCpThr" value="${S.cp.thr}" inputmode="decimal" aria-label="Float threshold in days" style="width:52px"><span class="muted">days</span></span>`:''}`:''}
      <div class="sg"><button data-pop="tvPanel">Display</button><button data-pop="stylePanel">Styles</button>${isCh?`<button data-pop="sitePanel">Site</button>`:''}</div>
      <label class="tg"><input type="checkbox" id="cBase" ${S.showBase?'checked':''}> Baseline</label>`;
  }
}

/* ---------------- drawer ---------------- */
function openDrawer(k){
  const r=M.byKey.get(k); if(!r) return; S.sel=k;
  const dr=document.getElementById('drawer'), a=r.L||r.B;
  const st=r.status==='TK_Complete'?'Complete':r.status==='TK_Active'?`In progress · ${Math.round(r.L.pct)}%`:r.L?'Not started':'Removed from live';
  const tags=[`<span class="tag">${esc(st)}</span>`];
  if(r.crit) tags.push('<span class="tag crit">Critical</span>');
  if(r.cmp==='late') tags.push(`<span class="tag lt">${sgn(r.varF)} d late</span>`); else if(r.cmp==='ontime'&&r.varF<0) tags.push(`<span class="tag ok">${sgn(r.varF)} d early</span>`);
  if(r.cmp==='added') tags.push('<span class="tag crit">New in live</span>');
  if(r.ms) tags.push('<span class="tag">Milestone</span>');
  const lo=Math.min(...[r.s,r.bs].filter(x=>x!=null)), hi=Math.max(...[r.f,r.bf].filter(x=>x!=null)), sp=(hi-lo)||DAY;
  const bar=(s,f,col)=>s==null?'<div class="tr"></div>':`<div class="tr"><i style="left:${(s-lo)/sp*100}%;width:${Math.max(0.8,(f-s)/sp*100)}%;background:${col}"></i></div>`;
  const dur=(s,f)=>s==null?'—':(r.ms?'0':Math.max(1,Math.round((f-s)/DAY)))+'d';
  const rel=(list,lbl)=>{ const items=list.filter(p=>p.a.R).map(p=>{ const q=p.a.R; return `<button class="rel${q.crit?' c':''}" data-k="${esc(q.k)}"><b>${esc(q.code)}</b><span>${esc(q.name)}</span><em>${p.type}${p.lag?(p.lag>0?' +':' ')+Math.round(p.lag)+'d':''}${q.proj!==r.proj?' · '+esc(q.proj):''}</em></button>`; });
    return `<div class="dh">${lbl} · ${items.length}</div>`+(items.length?`<div class="rels">${items.join('')}</div>`:'<div class="muted" style="font-size:13px">None</div>'); };
  const codes=Object.entries(r.codes).map(([t,v])=>{ const o=(M.codeOrder[t]||[]).find(x=>x.short===v); return `<dt>${esc(t)}</dt><dd>${esc(o&&o.name!==v?v+' · '+o.name:v)}</dd>`; }).join('');
  const udfs=Object.entries(a.udf).map(([t,v])=>`<dt>${esc(t)}</dt><dd>${esc(v)}</dd>`).join('');
  dr.innerHTML=`<button class="dx" id="dClose" aria-label="Close">×</button>
    <div class="eyebrow">${esc(r.proj)} · ${esc(r.code)}</div>
    <h2>${esc(r.name)}</h2>
    <div class="dw">${esc(r.wp.map(p=>p.n).join(' › '))}</div>
    <div class="tags">${tags.join('')}</div>
    <div class="dstats">
      <div class="stat"><div class="sl">${r.status==='TK_NotStart'||!r.L?'Start':'Actual start'}</div><div class="sv">${fmtD(r.s)}</div><div class="ss">${r.varS!=null?`${sgn(r.varS)} d vs BL`:'&nbsp;'}</div></div>
      <div class="stat"><div class="sl">${r.status==='TK_Complete'?'Actual finish':'Forecast finish'}</div><div class="sv">${fmtD(r.f)}</div><div class="ss">BL ${fmtD(r.bf)}</div></div>
      <div class="stat"><div class="sl">Finish variance</div><div class="sv ${r.varF>0?'late':r.varF<0?'early':''}">${r.varF==null?'—':sgn(r.varF)+'<small>d</small>'}</div><div class="ss">live vs baseline</div></div>
      <div class="stat"><div class="sl">Total float</div><div class="sv ${r.crit?'acc':''}">${r.tf==null?'—':Math.round(r.tf)+'<small>d</small>'}</div><div class="ss">${r.crit?'On critical path':r.status==='TK_Complete'?'Complete':'&nbsp;'}</div></div>
    </div>
    <div class="dh">Baseline vs live</div>
    <div class="segc"><span>Baseline</span>${bar(r.bs,r.bf,'var(--base)')}<span class="r">${dur(r.bs,r.bf)}</span>
      <span>Live</span>${bar(r.s,r.f,r.L?colorOf(r,'crit'):'var(--base)')}<span class="r">${dur(r.s,r.f)}</span></div>
    <div class="segd"><span>${fmtD(lo)}</span><span>${fmtD(hi)}</span></div>
    ${codes?`<div class="dh">Activity codes</div><dl class="kv">${codes}</dl>`:''}
    ${udfs?`<div class="dh">User fields</div><dl class="kv">${udfs}</dl>`:''}
    ${rel(a.preds,'Predecessors')}${rel(a.succs,'Successors')}`;
  dr.hidden=false; requestAnimationFrame(()=>dr.classList.add('open'));
  redraw();
}
function hideDrawer(){ const dr=document.getElementById('drawer'); dr.classList.remove('open'); setTimeout(()=>{ if(!dr.classList.contains('open')) dr.hidden=true; },240); }
function selectAct(k,scroll){ if(!M.byKey.has(k)) return; if(S.tab==='gantt'){ S.sel=k; hideDrawer(); renderDock(); if(scroll) scrollToRow(k); drawGantt(); } else openDrawer(k); }
function closeDock(){ S.sel=null; renderDock(); drawGantt(); }
function closeDrawer(){ const dr=document.getElementById('drawer'); dr.classList.remove('open'); S.sel=null; setTimeout(()=>{ if(!dr.classList.contains('open')) dr.hidden=true; },240); redraw(); }

/* ---------------- TLD panels: display, styles, site ---------------- */
const POPS=['tvPanel','stylePanel','sitePanel','chPanel'];
function togglePop(id){ const el=document.getElementById(id), open=el.hidden; POPS.forEach(p=>document.getElementById(p).hidden=true); if(!open) return; ({tvPanel:renderTv,stylePanel:renderStyles,sitePanel:renderSite,chPanel:()=>renderChPanel()})[id](); el.hidden=false; }
function saveTld(){ try{ const {labels,spans,progress,weekends,site,clash,bufM,bufD}=S.tld; localStorage.setItem('pacer.tilos',JSON.stringify({labels,spans,progress,weekends,site,clash,bufM,bufD,styles:S.styles})); if(!S.site.sample) localStorage.setItem('pacer.site',JSON.stringify(S.site)); }catch(_){} }
function renderTv(){
  const t=S.tld, seg=(k,opts)=>`<div class="sg">${opts.map(([v,l])=>`<button data-tv="${k}" data-v="${v}" class="${String(t[k])===String(v)?'on':''}">${l}</button>`).join('')}</div>`;
  const tg=(k,l)=>`<label class="tg"><input type="checkbox" data-tvc="${k}" ${t[k]?'checked':''}> ${l}</label>`;
  document.getElementById('tvPanel').innerHTML=`<div class="cph"><strong>Display</strong><span class="sp"></span><button class="fx" data-close="tvPanel" aria-label="Close">×</button></div>
    <div class="tvg"><div class="tvr"><span class="ctl">Labels</span>${seg('labels',[['off','Off'],['id','ID'],['name','Name'],['both','ID + name']])}</div>
    <div class="tvr"><span class="ctl">Spans drawn as</span>${seg('spans',[['line','Lines'],['block','Blocks']])}</div>
    <div class="tvr">${tg('progress','Split progress at the data date')}</div>
    <div class="tvr">${tg('weekends','Shade weekends when zoomed in')}</div>
    <div class="tvr">${tg('site','Site band (stations, structures, ground profile)')}</div>
    <div class="tvr">${tg('clash','Check clashes between crews')}</div>
    <div class="tvr"><span class="ctl">Distance buffer</span><input class="tvi" data-tvn="bufM" value="${esc(t.bufM)}" inputmode="decimal" aria-label="Distance buffer in metres"> <span class="muted">m</span>
      <span class="ctl" style="margin-left:10px">Time buffer</span><input class="tvi" data-tvn="bufD" value="${esc(t.bufD)}" inputmode="decimal" aria-label="Time buffer in days"> <span class="muted">days</span></div></div>
    <p class="muted" style="font-size:12.5px;margin:12px 0 0">A 0 m buffer flags only crews that physically overlap or cross. Spans set to Auto in Styles follow the Lines or Blocks choice. Activities at a single chainage always draw as bars.</p>`;
}
function renderStyles(){
  const cls=styleClasses(), SH=[['auto','Auto'],['line','Line'],['block','Block'],['bar','Bar']], HT=[['none','None'],['diag','Diagonal'],['cross','Cross'],['horiz','Horizontal'],['vert','Vertical'],['dots','Dots']];
  const toHex=c=>{ if(/^#[0-9a-f]{6}$/i.test(c)) return c; const cv=document.createElement('canvas').getContext('2d'); cv.fillStyle=c; return /^#/.test(cv.fillStyle)?cv.fillStyle:'#888888'; };
  document.getElementById('stylePanel').innerHTML=`<div class="cph"><strong>Activity styles</strong><span class="sp"></span><button class="link" id="stReset">Reset</button><button class="fx" data-close="stylePanel" aria-label="Close">×</button></div>
    <p class="muted" style="font-size:13px;margin:0 0 10px">One style per <b>${esc(S.tld.colorBy==='crit'?'critical path class':S.tld.colorBy==='status'?'status':S.tld.colorBy.slice(5))}</b> value. Change the grouping with Colour in the toolbar.</p>
    <div class="tw chtab"><table class="rt"><thead><tr><th>Colour</th><th>Class</th><th>Shape</th><th>Hatch</th><th>Weight</th></tr></thead><tbody>
    ${cls.map(c=>{ const st=styleOf(c.r); return `<tr><td><input type="color" data-sk="${esc(c.k)}" data-sf="color" value="${toHex(st.color)}" aria-label="${esc(c.label)} colour"></td><td class="nm">${esc(c.label)} <em class="muted">${c.n}</em></td>
      <td><select data-sk="${esc(c.k)}" data-sf="shape">${SH.map(([v,l])=>`<option value="${v}"${st.shape===v?' selected':''}>${l}</option>`).join('')}</select></td>
      <td><select data-sk="${esc(c.k)}" data-sf="hatch">${HT.map(([v,l])=>`<option value="${v}"${st.hatch===v?' selected':''}>${l}</option>`).join('')}</select></td>
      <td><select data-sk="${esc(c.k)}" data-sf="width">${[[2,'Thin'],[3.5,'Normal'],[5,'Bold'],[7,'Heavy']].map(([v,l])=>`<option value="${v}"${+st.width===v?' selected':''}>${l}</option>`).join('')}</select></td></tr>`; }).join('')}</tbody></table></div>`;
}
const KINDS=[['station','Station'],['section','Section'],['bridge','Bridge / viaduct'],['tunnel','Tunnel / cutting'],['crossing','Crossing'],['other','Other']];
function renderSite(msg){
  const m=S.site.marks;
  document.getElementById('sitePanel').innerHTML=`<div class="cph"><strong>Site band</strong><span class="sp"></span><button class="fx" data-close="sitePanel" aria-label="Close">×</button></div>
    <p class="muted" style="font-size:13px;margin:0 0 10px">Landmarks and ground levels drawn along the chainage axis, as in a TILOS site layout. Chainage accepts <code>2+500</code> or a number in ${esc(S.tld.inUnit)}.</p>
    <div class="chtools"><button class="btn sm" id="siAdd">Add landmark</button><button class="btn sm" id="siPts">Add structures from point activities</button>${S.tld.mapType||S.tld.overlay?`<button class="btn sm" id="siMap">Add sections from ${esc(S.tld.overlay||S.tld.mapType)} map</button>`:''}<button class="link" id="siClear">Clear all</button></div>
    ${msg?`<div class="chmsg">${esc(msg)}</div>`:''}
    <div class="tw chtab" style="max-height:32vh"><table class="rt"><thead><tr><th>Name</th><th>Type</th><th class="n">From</th><th class="n">To</th><th></th></tr></thead><tbody>
    ${m.map((x,i)=>`<tr><td><input class="wide" data-si="${i}" data-sf="name" value="${esc(x.name)}" aria-label="Landmark name"></td><td><select data-si="${i}" data-sf="kind">${KINDS.map(([v,l])=>`<option value="${v}"${x.kind===v?' selected':''}>${l}</option>`).join('')}</select></td>
      <td class="n"><input data-si="${i}" data-sf="a" value="${isFinite(x.a)?esc(fmtCh(x.a)):''}" aria-label="From"></td><td class="n"><input data-si="${i}" data-sf="b" value="${isFinite(x.b)&&x.b!==x.a?esc(fmtCh(x.b)):''}" aria-label="To"></td><td><button class="fx" data-sidel="${i}" aria-label="Remove ${esc(x.name)}">×</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">No landmarks yet.</td></tr>'}
    </tbody></table></div>
    <div class="dh" style="margin-top:14px">Ground profile</div>
    <textarea id="siProf" rows="4" placeholder="One point per line: chainage, level&#10;0+000, 42.5&#10;1+250, 47.0" aria-label="Ground profile">${esc(S.site.profile.map(p=>fmtCh(p[0])+', '+p[1]).join('\n'))}</textarea>
    <div class="chtools" style="margin-top:8px"><button class="btn sm" id="siProfApply">Apply profile</button><span class="muted" style="font-size:12.5px">${S.site.profile.length} points</span></div>`;
}
function wireTlPanels(){
  POPS.forEach(id=>{ const el=document.getElementById(id); el.addEventListener('click',e=>{ const c=e.target.closest('[data-close]'); if(c) el.hidden=true; }); });
  document.addEventListener('click',e=>{ POPS.forEach(id=>{ const el=document.getElementById(id); if(!el.hidden&&!el.contains(e.target)&&!e.target.closest('[data-pop],#cChMap')) el.hidden=true; }); });
  const tv=document.getElementById('tvPanel');
  tv.addEventListener('click',e=>{ const b=e.target.closest('[data-tv]'); if(!b) return; S.tld[b.dataset.tv]=b.dataset.v; saveTld(); renderTv(); drawTLD(); });
  tv.addEventListener('change',e=>{ const c=e.target.dataset.tvc, n=e.target.dataset.tvn; if(c){ S.tld[c]=e.target.checked; if(c==='site'||c==='clash') T.clashSel=null; } if(n){ const v=parseFloat(e.target.value); S.tld[n]=isFinite(v)&&v>=0?v:0; e.target.value=S.tld[n]; } saveTld(); drawTLD(); });
  const sp=document.getElementById('stylePanel');
  const setSt=e=>{ const k=e.target.dataset.sk, f=e.target.dataset.sf; if(!k) return; S.styles[k]={...(S.styles[k]||{}),[f]:f==='width'?+e.target.value:e.target.value}; saveTld(); drawTLD(); renderLegend(); };
  sp.addEventListener('input',e=>{ if(e.target.type==='color') setSt(e); }); sp.addEventListener('change',setSt);
  sp.addEventListener('click',e=>{ if(e.target.id==='stReset'){ S.styles={}; saveTld(); renderStyles(); drawTLD(); renderLegend(); } });
  const si=document.getElementById('sitePanel');
  const siDone=msg=>{ S.site.sample=false; saveTld(); renderSite(msg); T.view=null; drawTLD(); };
  si.addEventListener('click',e=>{ const id=e.target.id;
    if(id==='siAdd'){ const V=T.view; const mid=V?(V.l0+V.l1)/2:0; S.site.marks.push({name:'New landmark',kind:'station',a:Math.round(mid/100)*100,b:Math.round(mid/100)*100+200}); siDone(); }
    else if(id==='siPts'){ const acc=locAcc(); let n=0; if(acc&&acc.kind==='num') S.rows.forEach(r=>{ const a=r.L||r.B, g=acc.get(a); if(g&&Math.abs(g[1]-g[0])<1e-6&&!r.ms&&!S.site.marks.some(m=>m.name===a.name)){ S.site.marks.push({name:a.name.replace(/\s*Ch\.?\s*\d+\+\d+.*/i,''),kind:'bridge',a:g[0],b:g[0]}); n++; } }); siDone(n?`Added ${n} structure${n===1?'':'s'}.`:'No activities at a single chainage were found.'); }
    else if(id==='siMap'){ const t=S.tld.overlay||S.tld.mapType, map=chMapFor(t); let n=0; (M.codeOrder[t]||[]).forEach(v=>{ const g=map[v.short]; if(g&&isFinite(g[0])&&Math.abs(g[1]-g[0])<0.9*12e6&&!S.site.marks.some(m=>m.name===v.name)){ S.site.marks.push({name:v.name.replace(/\s*Ch\.?\s*\d+\+\d+.*/i,''),kind:'section',a:g[0],b:g[1]}); n++; } }); siDone(`Added ${n} section${n===1?'':'s'}.`); }
    else if(id==='siClear'){ S.site={marks:[],profile:[]}; siDone(); }
    else if(id==='siProfApply'){ const pts=[]; document.getElementById('siProf').value.split(/\n/).forEach(l=>{ const m=l.split(/[,\t;]/); if(m.length<2) return; const c=parseChText(m[0],S.tld.inUnit), z=parseFloat(m[1]); if(c!=null&&isFinite(z)) pts.push([c,z]); }); S.site.profile=pts; siDone(pts.length?`Ground profile set with ${pts.length} points.`:'No valid points found. Use one "chainage, level" pair per line.'); }
    const d=e.target.closest('[data-sidel]'); if(d){ S.site.marks.splice(+d.dataset.sidel,1); siDone(); } });
  si.addEventListener('change',e=>{ const i=e.target.dataset.si, f=e.target.dataset.sf; if(i==null) return; const m=S.site.marks[+i];
    if(f==='a'||f==='b'){ const v=parseChText(e.target.value,S.tld.inUnit); if(f==='a'){ if(v!=null) m.a=v; } else m.b=v??m.a; e.target.value=f==='b'&&m.b===m.a?'':fmtCh(m[f]); } else m[f]=e.target.value;
    S.site.sample=false; saveTld(); drawTLD(); });
  document.getElementById('clashList').addEventListener('click',e=>{ const b=e.target.closest('[data-clash]'); if(!b) return; const i=+b.dataset.clash, c=T.clashes[i]; if(!c) return; T.clashSel=i;
    const V=T.view, dl=(V.l1-V.l0), dt=(V.t1-V.t0); if(c.l<V.l0+dl*.1||c.l>V.l1-dl*.1){ V.l0=c.l-dl/2; V.l1=c.l+dl/2; } if(c.t<V.t0+dt*.1||c.t>V.t1-dt*.1){ V.t0=c.t-dt/2; V.t1=c.t+dt/2; }
    openDrawer(c.a.k); });
}
function sampleStyles(){ return {'c:Discipline:STN':{shape:'block',hatch:'diag'},'c:Discipline:TNC':{shape:'block',hatch:'none'},'c:Discipline:STR':{width:5}}; }
function sampleSite(){ return {sample:true,marks:[{name:'Depot',kind:'station',a:0,b:450},{name:'Riverside UB',kind:'bridge',a:3200,b:3200},{name:'Westfield Stn',kind:'station',a:4600,b:5000},{name:'Calder Viaduct',kind:'bridge',a:6200,b:7800},{name:'Hollins Culvert',kind:'bridge',a:8800,b:8800},{name:'Moor Lane LC',kind:'crossing',a:9600,b:9600},{name:'Northgate Terminus',kind:'station',a:11500,b:12000},{name:'Riverside Cutting',kind:'tunnel',a:2300,b:3000}],
  profile:[[0,41.2],[800,42.8],[1600,46.5],[2300,52.1],[3000,49.0],[3200,38.5],[3600,43.0],[4800,47.2],[6000,44.1],[6400,31.5],[7200,29.8],[7800,33.0],[8800,40.2],[9600,44.6],[10600,48.9],[12000,47.5]]}; }

/* ---------------- chainage map ---------------- */
function ensureMap(type){ const map=chMapFor(type); if(!Object.keys(map).length) detectMap(type); }
function applyWindow(){ const f=parseChText(document.getElementById('cChF').value,S.tld.fmt==='sta'?'ft':S.tld.fmt==='mi'?'mi':S.tld.fmt==='m'?'m':'km'), t=parseChText(document.getElementById('cChT').value,S.tld.fmt==='sta'?'ft':S.tld.fmt==='mi'?'mi':S.tld.fmt==='m'?'m':'km');
  if(f==null||t==null||f===t||!T.view) return; T.view.l0=Math.min(f,t); T.view.l1=Math.max(f,t); drawTLD(); }
function renderChPanel(msg){
  const type=S.tld.mapType, map=chMapFor(type), vals=M.codeOrder[type]||[], n=vals.filter(v=>map[v.short]).length;
  document.getElementById('chPanel').innerHTML=`<div class="cph"><strong>Chainage map</strong><span class="sp"></span><button class="fx" id="chClose" aria-label="Close">×</button></div>
    <p class="muted" style="margin:0 0 10px;font-size:13px">Give each <b>${esc(type)}</b> value a chainage range, so activities coded to it plot at true chainage. Type <code>2+500</code> or a number in ${esc(S.tld.inUnit)}. ${n} of ${vals.length} values set.</p>
    <div class="chtools"><button class="btn sm" id="chDetect">Detect from names</button><span class="chsp"><input id="chLen" value="${esc(fmtCh(12000))}" aria-label="Route length"><button class="btn sm" id="chSpread">Spread evenly</button></span><button class="link" id="chClear">Clear</button></div>
    ${msg?`<div class="chmsg">${esc(msg)}</div>`:''}
    <div class="tw chtab"><table class="rt"><thead><tr><th>Code</th><th>Description</th><th class="n">From</th><th class="n">To</th></tr></thead><tbody>
    ${vals.map(v=>{ const g=map[v.short]||[]; return `<tr><td><b>${esc(v.short)}</b></td><td class="nm">${esc(v.name)}</td><td class="n"><input data-chv="${esc(v.short)}" data-end="0" value="${g[0]!=null?esc(fmtCh(g[0])):''}" aria-label="${esc(v.short)} from"></td><td class="n"><input data-chv="${esc(v.short)}" data-end="1" value="${g[1]!=null?esc(fmtCh(g[1])):''}" aria-label="${esc(v.short)} to"></td></tr>`; }).join('')}</tbody></table></div>`;
}

/* ---------------- details dock (Gantt) ---------------- */
function renderDock(){
  const el=document.getElementById('dock'); if(!el) return;
  const r=S.tab==='gantt'&&S.sel&&M&&M.byKey.get(S.sel);
  gWrap.classList.toggle('docked',!!r);
  if(!r){ if(!el.hidden){ el.hidden=true; requestAnimationFrame(drawGantt); } return; }
  const a=r.L||r.B, wasHidden=el.hidden;
  const st=r.status==='TK_Complete'?'Complete':r.status==='TK_Active'?`In progress · ${Math.round(r.L.pct)}%`:r.L?'Not started':'Removed from live';
  const tags=[`<span class="tag">${esc(st)}</span>`]; if(r.crit) tags.push('<span class="tag crit">Critical</span>');
  if(r.cmp==='late') tags.push(`<span class="tag lt">${sgn(r.varF)} d late</span>`); else if(r.varF<0) tags.push(`<span class="tag ok">${sgn(r.varF)} d early</span>`);
  if(r.cmp==='added') tags.push('<span class="tag crit">New in live</span>');
  // relationships with baseline comparison
  const relRows=(dir)=>{
    const live=r.L?r.L[dir]:[], base=r.B?r.B[dir]:[];
    const key=p=>p.a.code+'|'+p.type, bKeys=new Set(base.map(key)), lKeys=new Set(live.map(key));
    const rows=(r.L?live:base).map(p=>({p,state:r.L&&r.B&&!bKeys.has(key(p))?'new':'',drv:dir==='preds'?(r.L&&isDrv(p.a,r.L,p.type)):(r.L&&p.a.status!==undefined&&isDrv(r.L,p.a,p.type))}));
    if(r.L&&r.B) base.filter(p=>!lKeys.has(key(p))).forEach(p=>rows.push({p,state:'gone',drv:false}));
    rows.sort((x,y)=>(y.drv-x.drv)||((x.p.a.s??0)-(y.p.a.s??0)));
    return rows; };
  const relTable=(dir,title)=>{ const rows=relRows(dir);
    const body=rows.map(({p,state,drv})=>{ const q=p.a.R, o=p.a, lag=Math.round(p.lag*10)/10;
      return `<tr data-k="${esc(q?q.k:'')}" class="${state==='gone'?'gone':''}${q&&q.k===S.sel?' me':''}"><td class="c"><b class="${o.crit?'acc':''}">${esc(o.code)}</b></td><td class="nm">${esc(o.name)}${state==='new'?' <span class="tg2 new">New link</span>':state==='gone'?' <span class="tg2">Removed link</span>':''}${o.proj!==a.proj?` <span class="tg2">${esc(o.proj)}</span>`:''}</td>
        <td>${p.type}</td><td class="n">${lag?(lag>0?'+':'−')+Math.abs(lag)+'d':'0'}</td><td>${drv?'<span class="drv">Driving</span>':''}</td><td class="n">${fmtD(o.s)}</td><td class="n">${fmtD(o.f)}</td><td class="n">${o.tf==null?'—':Math.round(o.tf)+'d'}</td></tr>`; }).join('');
    return `<section><div class="dh">${title} · ${rows.filter(x=>x.state!=='gone').length}</div>${rows.length?`<div class="tw"><table class="rt"><thead><tr><th>ID</th><th>Activity name</th><th>Type</th><th class="n">Lag</th><th>Driving</th><th class="n">Start</th><th class="n">Finish</th><th class="n">TF</th></tr></thead><tbody>${body}</tbody></table></div>`:`<p class="muted" style="font-size:13px;margin:0">None${dir==='preds'?', so nothing drives this activity':', so this activity is an open end'}.</p>`}</section>`; };
  const raw=f=>{ const x=a.raw[f]!==undefined?fmtRaw(f,a.raw[f],a):null; return x?esc(x.s):'—'; };
  const kv=list=>`<dl class="kv">${list.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  let body='';
  if(S.dockTab==='rel') body=`<div class="rel2">${relTable('preds','Predecessors')}${relTable('succs','Successors')}</div>`;
  else if(S.dockTab==='gen') body=`<div class="gen">
      <div><div class="dh">Dates</div>${kv([['Start',fmtD(r.L?r.s:null)],['Finish',fmtD(r.L?r.f:null)],['BL start',fmtD(r.bs)],['BL finish',fmtD(r.bf)],['Actual start',raw('act_start_date')],['Actual finish',raw('act_end_date')]])}</div>
      <div><div class="dh">CPM dates</div>${kv([['Early start',raw('early_start_date')],['Early finish',raw('early_end_date')],['Late start',raw('late_start_date')],['Late finish',raw('late_end_date')],['Constraint',raw('cstr_type')],['Constraint date',raw('cstr_date')]])}</div>
      <div><div class="dh">Duration &amp; float</div>${kv([['Original duration',raw('target_drtn_hr_cnt')],['Remaining duration',raw('remain_drtn_hr_cnt')],['Total float',raw('total_float_hr_cnt')],['Free float',raw('free_float_hr_cnt')],['Start variance',r.varS==null?'—':sgn(r.varS)+'d'],['Finish variance',r.varF==null?'—':sgn(r.varF)+'d']])}</div>
      <div><div class="dh">Activity</div>${kv([['Type',raw('task_type')],['% complete',r.L?Math.round(r.L.pct)+'%':'—'],['Calendar',esc(a.calName||'—')],['Project',esc(r.proj)],['WBS',esc(r.wp.map(p=>p.k).join('.'))],['WBS name',esc(r.wp[r.wp.length-1].n)]])}</div></div>`;
  else { const codes=Object.entries(r.codes).map(([t,v])=>{ const o=(M.codeOrder[t]||[]).find(x=>x.short===v); return [esc(t),esc(o&&o.name!==v?v+' · '+o.name:v)]; });
    const udfs=Object.entries(a.udf).map(([t,v])=>[esc(t),esc(v)]);
    body=`<div class="gen"><div><div class="dh">Activity codes</div>${codes.length?kv(codes):'<p class="muted">No activity codes assigned.</p>'}</div><div><div class="dh">User-defined fields</div>${udfs.length?kv(udfs):'<p class="muted">No user-defined field values.</p>'}</div></div>`; }
  const np=(a.preds||[]).length, ns=(a.succs||[]).length;
  el.innerHTML=`<div class="dock-h">
      <div class="dk-t"><div class="eyebrow">${esc(r.proj)} · ${esc(r.code)}</div><div class="dk-n">${esc(r.name)}</div><div class="tags">${tags.join('')}</div></div>
      <div class="dk-a"><div class="sg"><button data-nav="prev" aria-label="Previous activity">↑</button><button data-nav="next" aria-label="Next activity">↓</button></div><button class="fx" id="dkClose" aria-label="Close details">×</button></div>
      <div class="dtabs" role="tablist">${[['rel',`Relationships <em>${np+ns}</em>`],['gen','General'],['codes','Codes &amp; fields']].map(([k,l])=>`<button role="tab" data-dt="${k}" aria-selected="${S.dockTab===k}">${l}</button>`).join('')}</div>
    </div><div class="dock-b">${body}</div>`;
  if(wasHidden){ el.hidden=false; requestAnimationFrame(drawGantt); }
}

/* ---------------- tooltip ---------------- */
function tipHTML(r){
  const st=r.status==='TK_Complete'?'Complete':r.status==='TK_Active'?`In progress ${Math.round(r.L.pct)}%`:r.L?'Not started':'Removed';
  return `<div class="tt">${esc(r.name)}</div><div class="tc">${esc(r.proj)} · ${esc(r.code)} · ${st}</div><table>
    ${r.L?`<tr><td>Live</td><td>${fmtD(r.s)} → ${fmtD(r.f)}</td></tr>`:''}
    ${r.B?`<tr><td>Baseline</td><td>${fmtD(r.bs)} → ${fmtD(r.bf)}</td></tr>`:''}
    ${r.varF!=null?`<tr><td>Variance</td><td>${sgn(r.varF)} d</td></tr>`:''}
    ${r.tf!=null?`<tr><td>Float</td><td>${Math.round(r.tf)} d${r.crit?' · critical':''}</td></tr>`:''}
    ${S.tab==='tld'&&T.acc&&T.acc.kind==='num'&&r.L&&T.acc.get(r.L)?(g=>`<tr><td>Chainage</td><td>${fmtCh(g[0])}${g[1]!==g[0]?' → '+fmtCh(g[1]):''}</td></tr>${g[1]!==g[0]&&r.f>r.s?`<tr><td>Rate</td><td>${Math.round(Math.abs(g[1]-g[0])/Math.max(1,(r.f-r.s)/DAY))} m/day</td></tr>`:''}`)(T.acc.get(r.L)):''}</table>`;
}
function showTip(r,e){ if(!r){ tip.hidden=true; return; } tip.innerHTML=tipHTML(r); tip.hidden=false; const w=tip.offsetWidth,h=tip.offsetHeight; let x=e.clientX+14,y=e.clientY+14; if(x+w>innerWidth-8) x=e.clientX-w-14; if(y+h>innerHeight-8) y=e.clientY-h-14; tip.style.left=Math.max(8,x)+'px'; tip.style.top=Math.max(8,y)+'px'; }

/* ---------------- files modal ---------------- */
function renderFiles(){
  document.getElementById('fileCnt').textContent=S.files.length;
  const fl=document.getElementById('flist');
  fl.innerHTML=S.files.map(f=>f.error?`<div class="ferr">${esc(f.name)}: ${esc(f.error)} <button class="link" data-rm="${f.id}">Dismiss</button></div>`:
    `<div class="frow"><div style="min-width:0"><div class="fname">${esc(f.name)}</div><div class="fmeta">${esc(f.info.projs.join(', ')||'No project')} · ${f.info.acts.toLocaleString()} activities · ${f.info.links.toLocaleString()} links · data date ${fmtD(f.info.dd)}</div></div>
     <div class="sg" role="group" aria-label="Role">${['baseline','live','off'].map(r=>`<button data-role="${r}" data-id="${f.id}" class="${f.role===r?'on':''}">${r==='baseline'?'Baseline':r==='live'?'Live':'Off'}</button>`).join('')}</div>
     <button class="fx" data-rm="${f.id}" aria-label="Remove ${esc(f.name)}">×</button></div>`).join('');
  const ls=document.getElementById('lsum');
  if(M&&S.files.some(f=>!f.error)){ const s=(lab,x)=>`<span><b>${lab}</b> · ${x.files} file${x.files===1?'':'s'} · ${x.acts.size.toLocaleString()} activities · ${x.links.toLocaleString()} links, ${x.xlinks.toLocaleString()} between files</span>`;
    ls.innerHTML=s('Live',M.live)+s('Baseline',M.base); } else ls.innerHTML='';
  document.getElementById('matchSel').value=S.match;
}
async function addFiles(list){
  for(const file of list){
    try{ const buf=await file.arrayBuffer(); let text; try{ text=new TextDecoder('utf-8',{fatal:true}).decode(buf); }catch(_){ text=new TextDecoder('windows-1252').decode(buf); }
      const T=parseXER(text); if(!T.TASK) throw new Error('no TASK table found. Export the project from P6 as an XER file.');
      const name=file.name, isBL=/base|(^|[^a-z])bl\d*([^a-z]|$)|target/i.test(name);
      S.files.push({id:uid(),name,role:isBL?'baseline':'live',tables:T,info:fileInfo(T)});
    }catch(err){ S.files.push({id:uid(),name:file.name,error:err.message||String(err)}); }
  }
  S.files=S.files.filter(f=>(!f.sample&&!f.builder)||f.error); if(B.st&&B.st.sync){ B.st.sync=false; bSave(); } if(S.site.sample) S.site={marks:[],profile:[]};
  rebuild(true);
}


