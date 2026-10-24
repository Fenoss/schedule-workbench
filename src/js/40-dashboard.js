/* ---------------- profile (cumulative finishes) ---------------- */
function drawProfile(){
  const cv=document.getElementById('prof'), W=cv.clientWidth, H=cv.clientHeight; if(!W) return;
  const ctx=setupCanvas(cv,W,H); ctx.clearRect(0,0,W,H);
  const lf=[],bf=[]; S.rows.forEach(r=>{ if(r.ms) return; if(r.L&&r.f!=null) lf.push(r.f); if(r.B&&r.bf!=null) bf.push(r.bf); });
  lf.sort((a,b)=>a-b); bf.sort((a,b)=>a-b);
  const note=document.getElementById('profNote');
  if(!lf.length&&!bf.length){ note.textContent=''; return; }
  const all=lf.concat(bf), t0=Math.min(...S.rows.map(r=>Math.min(r.s??Infinity,r.bs??Infinity))), t1=Math.max(...all);
  const n=Math.max(lf.length,bf.length), pad={l:2,r:2,t:6,b:16};
  const X=t=>pad.l+(t-t0)/(t1-t0||1)*(W-pad.l-pad.r), Y=c=>H-pad.b-c/n*(H-pad.t-pad.b);
  const path=(arr)=>{ ctx.beginPath(); ctx.moveTo(X(t0),Y(0)); arr.forEach((t,i)=>{ ctx.lineTo(X(t),Y(i)); ctx.lineTo(X(t),Y(i+1)); }); ctx.lineTo(X(t1),Y(arr.length)); };
  ctx.strokeStyle=C.grid; ctx.lineWidth=1; [0.5,1].forEach(f=>{ const y=Math.round(Y(n*f))+.5; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke(); });
  if(bf.length){ path(bf); ctx.lineTo(X(t1),Y(0)); ctx.closePath(); ctx.fillStyle=C.base; ctx.globalAlpha=.45; ctx.fill(); ctx.globalAlpha=1; path(bf); ctx.strokeStyle=C.base; ctx.lineWidth=1.5; ctx.stroke(); }
  if(lf.length){ path(lf); ctx.lineTo(X(t1),Y(0)); ctx.closePath(); ctx.fillStyle=C.accent; ctx.globalAlpha=.10; ctx.fill(); ctx.globalAlpha=1; path(lf); ctx.strokeStyle=C.accent; ctx.lineWidth=2; ctx.stroke(); }
  ctx.font=FONT(500,10.5); ctx.fillStyle=C.ink3;
  const yrs=monthTicks(t0,t1,(t1-t0)/DAY>500?6:3).filter(t=>t>t0);
  yrs.forEach(t=>{ const x=X(t); if(x>W-30) return; const d=new Date(t); ctx.fillText(MON[d.getUTCMonth()]+' '+String(d.getUTCFullYear()).slice(2),x+2,H-3); ctx.fillRect(Math.round(x),H-pad.b,1,4); });
  if(M.dd!=null&&M.dd>t0&&M.dd<t1){ const x=Math.round(X(M.dd))+.5; ctx.strokeStyle=C.accent; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,pad.t-2); ctx.lineTo(x,H-pad.b); ctx.stroke(); }
  if(M.dd!=null){ const planned=bf.filter(t=>t<=M.dd).length, actual=S.rows.filter(r=>!r.ms&&r.L&&r.status==='TK_Complete').length;
    const pp=bf.length?Math.round(planned/bf.length*100):null, ap=lf.length?Math.round(actual/lf.length*100):null;
    note.innerHTML=`At data date · planned <b>${pp??'–'}%</b> · actual <b>${ap??'–'}%</b> complete`; }
}

/* ---------------- summary tiles ---------------- */
function renderStats(){
  const R=S.rows, L=R.filter(r=>r.L), B=R.filter(r=>r.B);
  const lf=L.length?Math.max(...L.map(r=>r.f??-Infinity)):null, bf=B.length?Math.max(...B.map(r=>r.bf??-Infinity)):null;
  const v=(lf!=null&&bf!=null&&isFinite(lf)&&isFinite(bf))?dd(lf-bf):null;
  const late=R.filter(r=>r.cmp==='late'), avg=late.length?Math.round(late.reduce((a,r)=>a+r.varF,0)/late.length):0;
  const crit=R.filter(r=>r.crit).length, done=L.filter(r=>r.status==='TK_Complete').length, ip=L.filter(r=>r.status==='TK_Active').length;
  const add=R.filter(r=>r.cmp==='added').length, rem=R.filter(r=>r.cmp==='removed').length;
  const pct=L.length?Math.round(done/L.length*100):0;
  const tiles=[
    ['Forecast finish', lf!=null&&isFinite(lf)?fmtD(lf):'—', v==null?'No baseline loaded':v===0?'On baseline finish':`${sgn(v)} d vs baseline`, v>0?'late':v<0?'early':''],
    ['Activities', R.length.toLocaleString(), `of ${M.rows.length.toLocaleString()} loaded`, ''],
    ['Behind baseline', late.length.toLocaleString(), late.length?`avg ${sgn(avg)} d finish slip`:'None slipping', late.length?'late':''],
    ['Critical', crit.toLocaleString(), 'total float ≤ 0', crit?'acc':''],
    ['Complete', `${pct}<small>%</small>`, `${done} done · ${ip} in progress`, ''],
    ['Scope changes', `+${add} <small>/ −${rem}</small>`, 'added / removed', '']
  ];
  document.getElementById('stats').innerHTML=tiles.map(([l,val,s,c])=>`<div class="stat"><div class="sl">${l}</div><div class="sv">${val}</div><div class="ss ${c}">${esc(s)}</div></div>`).join('');
}

/* ---------------- dashboard ---------------- */
const DASH={hist:[]};
function renderDash(){
  if(document.getElementById('dashWrap').hidden||!M) return;
  renderStats(); drawProfile();
  const R=S.rows;
  // variance spread
  const B=[['≤ −10d',v=>v<=-10,'early'],['−9 to −1d',v=>v<0&&v>-10,'early'],['On baseline',v=>v===0,'zero'],['+1 to +10d',v=>v>0&&v<=10,'late'],['+11 to +30d',v=>v>10&&v<=30,'late'],['+31 to +60d',v=>v>30&&v<=60,'late'],['> +60d',v=>v>60,'late']];
  DASH.hist=B.map(([label,fn,cls])=>({label,cls,keys:R.filter(r=>r.varF!=null&&fn(r.varF)).map(r=>r.k)}));
  const hmax=Math.max(1,...DASH.hist.map(b=>b.keys.length)), nv=R.filter(r=>r.varF==null).length;
  document.getElementById('dHist').innerHTML=`<div class="hb">${DASH.hist.map((b,i)=>`<button class="hrow" data-hist="${i}" ${b.keys.length?'':'disabled'}><span class="hl">${b.label}</span><span class="ht"><i class="${b.cls}" style="width:${(b.keys.length/hmax*100).toFixed(1)}%"></i></span><span class="hn">${b.keys.length}</span></button>`).join('')}</div>${nv?`<div class="note">${nv} without a baseline match (added or removed).</div>`:''}`;
  // milestones
  const ms=R.filter(r=>r.ms).sort((a,b)=>((a.f??a.bf)-(b.f??b.bf)));
  document.getElementById('dMsN').textContent=ms.length?`${ms.filter(r=>r.status==='TK_Complete').length} of ${ms.length} achieved`:'';
  document.getElementById('dMs').innerHTML=ms.length?`<div class="tw"><table class="rt dt"><thead><tr><th>ID</th><th>Milestone</th><th class="n">Baseline</th><th class="n">Forecast</th><th class="n">Var</th><th>Status</th></tr></thead><tbody>${ms.slice(0,14).map(r=>`<tr data-k="${esc(r.k)}"><td><b class="${r.crit?'acc':''}">${esc(r.code)}</b></td><td class="nm">${esc(r.name)}</td><td class="n">${fmtD(r.bf)}</td><td class="n">${r.L?fmtD(r.f):'—'}</td><td class="n"><b class="${r.varF>0?'late':r.varF<0?'early':''}">${r.cmp==='added'?'NEW':r.cmp==='removed'?'DEL':r.varF==null?'–':sgn(r.varF)+'d'}</b></td><td>${r.status==='TK_Complete'?'<span class="tg2 ok">Achieved</span>':r.crit?'<span class="tg2 new">Critical</span>':r.L?'<span class="tg2">Forecast</span>':'<span class="tg2">Removed</span>'}</td></tr>`).join('')}</tbody></table></div>${ms.length>14?`<div class="note">Showing 14 of ${ms.length}. Filter by WBS or code to narrow down.</div>`:''}`:'<p class="muted">No milestones in the current filter.</p>';
  // biggest slips
  const top=R.filter(r=>!r.ms&&r.varF>0).sort((a,b)=>b.varF-a.varF).slice(0,10), tmax=top.length?top[0].varF:1;
  document.getElementById('dTop').innerHTML=top.length?`<div class="sl2">${top.map(r=>`<button class="srow" data-k="${esc(r.k)}"><span class="sc">${esc(r.code)}</span><span class="sn">${esc(r.name)}</span><span class="sb"><i style="width:${(r.varF/tmax*100).toFixed(1)}%"></i></span><span class="sv2">${sgn(r.varF)}d</span></button>`).join('')}</div>`:'<p class="muted">Nothing is behind its baseline finish.</p>';
  // slip by WBS (second level, or top level when shallow)
  const depth=M.roots.some(n=>n.children.length)?1:0, agg=new Map();
  R.forEach(r=>{ const k=r.wkeys[Math.min(depth,r.wkeys.length-1)]; if(!agg.has(k)) agg.set(k,[]); agg.get(k).push(r); });
  const wrows=[...agg].map(([k,sub])=>{ const n=M.wbs.get(k), sm=summ(sub); return {k,label:n?(n.depth?`${n.short} · ${n.label}`:n.label):k,proj:k.split(' › ')[0],sm,worst:Math.max(0,...sub.map(r=>r.varF||0))}; })
    .sort((a,b)=>((b.sm.varF??-1e9)-(a.sm.varF??-1e9)));
  const wmax=Math.max(1,...wrows.map(w=>Math.abs(w.sm.varF||0)));
  document.getElementById('dWbs').innerHTML=wrows.length?`<div class="tw"><table class="rt dt wt"><thead><tr><th>WBS</th><th class="n">Activities</th><th class="n">Behind</th><th class="n">Forecast finish</th><th class="n">BL finish</th><th>Finish variance</th><th class="n">Worst activity</th></tr></thead><tbody>${wrows.map(w=>`<tr data-wbsf="${esc(w.k)}" class="${S.F.wbs.has(w.k)?'me':''}"><td class="nm"><b>${esc(w.label)}</b>${depth?` <span class="tg2">${esc(w.proj)}</span>`:''}</td><td class="n">${w.sm.n}</td><td class="n">${w.sm.late}</td><td class="n">${isFinite(w.sm.f)?fmtD(w.sm.f):'—'}</td><td class="n">${isFinite(w.sm.bf)?fmtD(w.sm.bf):'—'}</td><td><span class="vb"><span class="vbt"><i class="${(w.sm.varF||0)>0?'late':'early'}" style="width:${(Math.abs(w.sm.varF||0)/wmax*100).toFixed(1)}%"></i></span><b class="${(w.sm.varF||0)>0?'late':(w.sm.varF||0)<0?'early':''}">${w.sm.varF==null?'–':sgn(w.sm.varF)+'d'}</b></span></td><td class="n">${w.worst?'+'+w.worst+'d':'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No activities in the current filter.</p>';
}


