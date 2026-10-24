/* ---------------- time ticks ---------------- */
function monthTicks(t0,t1,step){ const d=new Date(t0); let y=d.getUTCFullYear(), m=d.getUTCMonth(); m-=m%step; const out=[]; for(let g=0;g<2000;g++){ const t=Date.UTC(y,m,1); if(t>t1) break; out.push(t); m+=step; if(m>11){ y+=Math.floor(m/12); m%=12; } } return out; }
function dayTicks(t0,t1){ const out=[]; let t=Math.floor(t0/DAY)*DAY; for(;t<=t1&&out.length<4000;t+=DAY) out.push(t); return out; }
function weekTicks(t0,t1){ let t=Math.floor(t0/DAY)*DAY; while(new Date(t).getUTCDay()!==1) t+=DAY; const out=[]; for(;t<=t1&&out.length<2000;t+=7*DAY) out.push(t); return out; }
function scaleFor(ppd){
  if(ppd>=16) return {top:(a,b)=>monthTicks(a,b,1),bot:dayTicks,ft:t=>MON[new Date(t).getUTCMonth()]+' '+new Date(t).getUTCFullYear(),fb:t=>String(new Date(t).getUTCDate())};
  if(ppd>=3.2) return {top:(a,b)=>monthTicks(a,b,1),bot:weekTicks,ft:t=>MON[new Date(t).getUTCMonth()]+' '+new Date(t).getUTCFullYear(),fb:t=>p2(new Date(t).getUTCDate())};
  if(ppd>=0.9) return {top:(a,b)=>monthTicks(a,b,12),bot:(a,b)=>monthTicks(a,b,1),ft:t=>String(new Date(t).getUTCFullYear()),fb:t=>MON[new Date(t).getUTCMonth()]};
  return {top:(a,b)=>monthTicks(a,b,12),bot:(a,b)=>monthTicks(a,b,3),ft:t=>String(new Date(t).getUTCFullYear()),fb:t=>'Q'+(new Date(t).getUTCMonth()/3+1)};
}

/* ---------------- Gantt ---------------- */
const G={items:[],idx:new Map(),RH:30,HEAD:50,hover:-1};
let gWrap,gCv,gSc,gSp,tWrap,tCv,tip;
function tableW(){ const W=gWrap.clientWidth, sum=colsW(); const auto=Math.min(sum,Math.round(W*(W<720?0.5:0.55))); return Math.round(Math.max(120,Math.min(S.tw!=null?S.tw:auto,W-120,sum))); }
function summ(sub){ const o={s:Infinity,f:-Infinity,bs:Infinity,bf:-Infinity,n:sub.length,late:0}; sub.forEach(r=>{ if(r.L&&r.s!=null){o.s=Math.min(o.s,r.s);o.f=Math.max(o.f,r.f);} if(r.B&&r.bs!=null){o.bs=Math.min(o.bs,r.bs);o.bf=Math.max(o.bf,r.bf);} if(r.cmp==='late') o.late++; });
  o.varF=(isFinite(o.f)&&isFinite(o.bf))?dd(o.f-o.bf):null; return o; }
function buildItems(){
  const cpS=S.cp.mode==='only'?cpSet():null, rows=cpS?S.rows.filter(r=>cpS.has(r.k)):S.rows.slice(), items=[];
  const sd=S.sort&&colDef(S.sort.id);
  const sortFn=sd?(a,b)=>{ const x=sd.sv(a), y=sd.sv(b); if(x==null&&y==null) return a.code.localeCompare(b.code); if(x==null) return 1; if(y==null) return -1; return ((x<y?-1:x>y?1:0)*S.sort.dir)||a.code.localeCompare(b.code); }
    :(a,b)=>((a.s??0)-(b.s??0))||a.code.localeCompare(b.code);
  if(S.group==='none'){ rows.sort(sortFn).forEach(r=>items.push({t:'a',r,d:0})); }
  else if(S.group==='wbs'){
    const own=new Map(), agg=new Map();
    rows.forEach(r=>{ const k=r.wkeys[r.wkeys.length-1]; if(!own.has(k)) own.set(k,[]); own.get(k).push(r); r.wkeys.forEach(w=>{ if(!agg.has(w)) agg.set(w,[]); agg.get(w).push(r); }); });
    const walk=(n,d)=>{ const sub=agg.get(n.key); if(!sub) return; items.push({t:'g',key:n.key,label:n.label,short:n.short,d,sum:summ(sub)}); if(S.collapsed.has(n.key)) return;
      (own.get(n.key)||[]).sort(sortFn).forEach(r=>items.push({t:'a',r,d:d+1})); n.children.forEach(c=>walk(c,d+1)); };
    M.roots.forEach(n=>walk(n,0));
  } else {
    const type=S.group.slice(5), groups=new Map();
    rows.forEach(r=>{ const v=r.codes[type]??'∅'; if(!groups.has(v)) groups.set(v,[]); groups.get(v).push(r); });
    const ord=(M.codeOrder[type]||[]).map(o=>o.short); const keys=[...groups.keys()].sort((a,b)=>{ const ia=ord.indexOf(a),ib=ord.indexOf(b); return (ia<0?1e9:ia)-(ib<0?1e9:ib); });
    keys.forEach(v=>{ const sub=groups.get(v), info=(M.codeOrder[type]||[]).find(o=>o.short===v); const key='code:'+type+':'+v;
      items.push({t:'g',key,label:v==='∅'?`No ${type}`:(info&&info.name!==v?`${v} · ${info.name}`:v),short:v,d:0,sum:summ(sub),color:v==='∅'?null:codeColor(type,v)});
      if(!S.collapsed.has(key)) sub.sort(sortFn).forEach(r=>items.push({t:'a',r,d:1})); });
  }
  G.items=items; G.idx=new Map(); items.forEach((it,i)=>{ if(it.t==='a') G.idx.set(it.r.k,i); });
}
function gX(t){ return tableW()+(t-M.t0g)/DAY*S.ppd-gSc.scrollLeft; }
function drawGantt(){
  if(!M||gWrap.hidden) return;
  const W=gWrap.clientWidth,H=gWrap.clientHeight; if(!W||!H) return;
  const ctx=setupCanvas(gCv,W,H), TW=tableW(), HD=G.HEAD, RH=G.RH, ppd=S.ppd;
  const span=(M.t1g-M.t0g)/DAY;
  gSp.style.width=(TW+span*ppd)+'px'; gSp.style.height=(HD+G.items.length*RH+24)+'px';
  const sx=gSc.scrollLeft, sy=gSc.scrollTop, X=t=>TW+(t-M.t0g)/DAY*ppd-sx;
  ctx.fillStyle=C.surface; ctx.fillRect(0,0,W,H);
  const i0=Math.max(0,Math.floor(sy/RH)), i1=Math.min(G.items.length-1,Math.ceil((sy+H-HD)/RH));
  // row backgrounds
  let relSet=null; const selR=S.sel&&M.byKey.get(S.sel);
  if(selR){ const a=selR.L||selR.B; relSet=new Map(); a.preds.forEach(p=>p.a.R&&relSet.set(p.a.R.k,'p')); a.succs.forEach(p=>p.a.R&&relSet.set(p.a.R.k,'s')); }
  for(let i=i0;i<=i1;i++){ const it=G.items[i], y=HD+i*RH-sy;
    if(it.t==='g'){ ctx.fillStyle=C.band; ctx.fillRect(0,y,W,RH); }
    else if(S.sel===it.r.k){ ctx.fillStyle=C.accentSoft; ctx.fillRect(0,y,W,RH); ctx.fillStyle=C.accent; ctx.fillRect(0,y,3,RH); }
    else if(relSet&&relSet.has(it.r.k)){ ctx.fillStyle=C.surface2; ctx.fillRect(0,y,W,RH); ctx.fillStyle=relSet.get(it.r.k)==='p'?C.ink3:C.ink2; ctx.fillRect(0,y+8,3,RH-16); }
    else if(G.hover===i){ ctx.fillStyle=C.surface2; ctx.fillRect(0,y,W,RH); } }
  // grid + bars
  ctx.save(); ctx.beginPath(); ctx.rect(TW,HD,W-TW,H-HD); ctx.clip();
  const tA=M.t0g+sx/ppd*DAY, tB=tA+(W-TW)/ppd*DAY, sc=scaleFor(ppd);
  ctx.lineWidth=1;
  ctx.strokeStyle=C.grid; sc.bot(tA-100*DAY,tB).forEach(t=>{ const x=Math.round(X(t))+.5; ctx.beginPath(); ctx.moveTo(x,HD); ctx.lineTo(x,H); ctx.stroke(); });
  ctx.strokeStyle=C.line; sc.top(tA-400*DAY,tB).forEach(t=>{ const x=Math.round(X(t))+.5; ctx.beginPath(); ctx.moveTo(x,HD); ctx.lineTo(x,H); ctx.stroke(); });
  for(let i=i0;i<=i1;i++){ const it=G.items[i], y=HD+i*RH-sy; if(it.t==='g') drawSummary(ctx,it,y,X); else drawAct(ctx,it.r,y,X); }
  if(S.logic!=='off') drawLinks(ctx,i0,i1,X,sy);
  if(cpOn()) drawCpLinks(ctx,i0,i1,X,sy);
  if(M.dd!=null){ const x=Math.round(X(M.dd))+.5; ctx.strokeStyle=C.accent; ctx.lineWidth=1.5; ctx.setLineDash([5,4]); ctx.beginPath(); ctx.moveTo(x,HD); ctx.lineTo(x,H); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  // table text
  const maxX=Math.max(0,colsW()-TW); if(S.tblX>maxX) S.tblX=maxX; if(S.tblX<0) S.tblX=0;
  const lay=colLayout(), varO=lay.find(o=>o.c.id==='d:varF');
  ctx.save(); ctx.beginPath(); ctx.rect(0,HD,TW,H-HD); ctx.clip();
  for(let i=i0;i<=i1;i++){ const it=G.items[i], y=HD+i*RH-sy, cy=y+RH/2+4;
    if(it.t==='g'){ const x=10+Math.min(it.d,8)*12;
      ctx.fillStyle=C.ink2; const open=!S.collapsed.has(it.key); ctx.beginPath();
      if(open){ ctx.moveTo(x,cy-7); ctx.lineTo(x+8,cy-7); ctx.lineTo(x+4,cy-2); } else { ctx.moveTo(x+1,cy-9); ctx.lineTo(x+6,cy-5); ctx.lineTo(x+1,cy-1); }
      ctx.closePath(); ctx.fill();
      let tx=x+14; if(it.color){ ctx.fillStyle=it.color; rr(ctx,tx,cy-10,8,8,2); ctx.fill(); tx+=13; }
      const lab=(it.d===0&&S.group==='wbs'?`${it.short} · ${it.label}`:it.label)+`  (${it.sum.n})`;
      const showVar=varO&&varO.x>tx+60&&varO.x<TW;
      ctx.font=FONT(700,13); ctx.fillStyle=C.ink; ctx.fillText(fit(ctx,lab,(showVar?varO.x:TW)-tx-10),tx,cy);
      if(showVar){ ctx.textAlign='right'; varText(ctx,it.sum.varF,varO.x+varO.w-12,cy,null); ctx.textAlign='left'; }
    } else { const r=it.r;
      for(const o of lay){ if(o.x+o.w<0||o.x>TW) continue; const v=o.c.get(r); if(v==null||v==='') continue;
        ctx.font=FONT(o.c.bold?700:500,o.c.id==='d:name'?13:12);
        ctx.fillStyle=!r.L&&!o.c.color?C.ink3:o.c.color?o.c.color(r):C.ink;
        const t=fit(ctx,String(v),o.w-14); if(!t) continue;
        if(o.c.align==='r'){ ctx.textAlign='right'; ctx.fillText(t,o.x+o.w-12,cy); ctx.textAlign='left'; } else ctx.fillText(t,o.x,cy);
        if(!r.L&&o.c.id==='d:name') ctx.fillRect(o.x,cy-4,ctx.measureText(t).width,1);
      } } }
  ctx.restore();
  ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(TW+.5,0); ctx.lineTo(TW+.5,H); ctx.stroke();
  // header
  ctx.fillStyle=C.surface; ctx.fillRect(0,0,W,HD);
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,TW,HD); ctx.clip();
  ctx.font=FONT(700,10.5); setLS(ctx,'0.6px');
  for(const o of lay){ if(o.x+o.w<0||o.x>TW) continue;
    const sorted=S.sort&&S.sort.id===o.c.id, aw=sorted?12:0, w=o.w-14-aw;
    ctx.fillStyle=sorted?C.accent:C.ink3;
    const words=o.c.label.toUpperCase().split(' '), lines=['']; for(const wd of words){ const tryL=(lines[lines.length-1]+' '+wd).trim(); if(ctx.measureText(tryL).width<=w||!lines[lines.length-1]) lines[lines.length-1]=tryL; else lines.push(wd); }
    const L2=lines.length>2?[lines[0],lines.slice(1).join(' ')]:lines;
    L2.forEach((ln,li)=>{ const t=fit(ctx,ln,w), yy=HD-12-(L2.length-1-li)*13;
      if(o.c.align==='r'){ ctx.textAlign='right'; ctx.fillText(t,o.x+o.w-12-aw,yy); ctx.textAlign='left'; } else ctx.fillText(t,o.x,yy); });
    if(sorted){ const ax=o.c.align==='r'?o.x+o.w-18:o.x+Math.min(w,ctx.measureText(L2[L2.length-1]).width)+5, ay=HD-16; ctx.beginPath();
      if(S.sort.dir>0){ ctx.moveTo(ax,ay+3); ctx.lineTo(ax+6,ay+3); ctx.lineTo(ax+3,ay-2); } else { ctx.moveTo(ax,ay-2); ctx.lineTo(ax+6,ay-2); ctx.lineTo(ax+3,ay+3); } ctx.closePath(); ctx.fill(); }
    ctx.fillStyle=C.grid; ctx.fillRect(Math.round(o.x+o.w-6),10,1,HD-18); }
  setLS(ctx,'0px'); ctx.restore();
  if(maxX>0){ const tw=TW-16, bw=Math.max(30,tw*TW/(TW+maxX)), bx=8+(tw-bw)*(S.tblX/maxX); ctx.fillStyle=C.line; rr(ctx,bx,H-6,bw,3,1.5); ctx.fill(); }
  ctx.save(); ctx.beginPath(); ctx.rect(TW,0,W-TW,HD); ctx.clip();
  const tops=sc.top(tA-400*DAY,tB+DAY), bots=sc.bot(tA-100*DAY,tB+DAY);
  ctx.strokeStyle=C.line;
  tops.forEach((t,i)=>{ const x=X(t), nx=i<tops.length-1?X(tops[i+1]):W+400; ctx.beginPath(); ctx.moveTo(Math.round(x)+.5,0); ctx.lineTo(Math.round(x)+.5,24); ctx.stroke();
    ctx.font=FONT(700,13,true); ctx.fillStyle=C.ink; const lx=Math.max(x,TW)+6; if(nx-lx>24){ setLS(ctx,'0.5px'); ctx.fillText(fit(ctx,sc.ft(t).toUpperCase(),nx-lx-6),lx,17); setLS(ctx,'0px'); } });
  ctx.font=FONT(500,11); ctx.fillStyle=C.ink2;
  bots.forEach((t,i)=>{ const x=X(t), nx=i<bots.length-1?X(bots[i+1]):x+999; const lab=sc.fb(t); const w=ctx.measureText(lab).width; if(nx-x>w+6) ctx.fillText(lab,x+3,HD-10); });
  if(M.dd!=null){ const x=X(M.dd); if(x>TW&&x<W){ ctx.font=FONT(700,10); const lab='DATA DATE'; const w=ctx.measureText(lab).width+10; ctx.fillStyle=C.accent; rr(ctx,x-w/2,26,w,15,7.5); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText(lab,x-w/2+5,37); } }
  ctx.restore();
  ctx.strokeStyle=C.line; ctx.beginPath(); ctx.moveTo(0,HD+.5); ctx.lineTo(W,HD+.5); ctx.stroke();
  if(!G.items.length){ ctx.font=FONT(500,14); ctx.fillStyle=C.ink2; ctx.textAlign='center'; ctx.fillText('No activities match these filters.',W/2,HD+60); ctx.textAlign='left'; }
}
function varText(ctx,v,x,y,cmp){
  ctx.font=FONT(700,12);
  if(cmp==='added'){ ctx.fillStyle=C.accent; ctx.fillText('NEW',x,y); return; }
  if(cmp==='removed'){ ctx.fillStyle=C.ink3; ctx.fillText('DEL',x,y); return; }
  if(v==null){ ctx.fillStyle=C.ink3; ctx.fillText('–',x,y); return; }
  ctx.fillStyle=v>0?C.late:v<0?C.early:C.ink3; ctx.fillText(sgn(v),x,y);
}
function drawSummary(ctx,it,y,X){
  const s=it.sum;
  if(S.showBase&&isFinite(s.bs)){ ctx.fillStyle=C.base; const x1=X(s.bs),x2=X(s.bf); ctx.fillRect(x1,y+20,Math.max(2,x2-x1),3); }
  if(isFinite(s.s)){ const x1=X(s.s),x2=X(s.f); ctx.fillStyle=it.color||C.ink; ctx.fillRect(x1,y+9,Math.max(2,x2-x1),5);
    ctx.beginPath(); ctx.moveTo(x1,y+9); ctx.lineTo(x1+5,y+9); ctx.lineTo(x1,y+18); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x2,y+9); ctx.lineTo(x2-5,y+9); ctx.lineTo(x2,y+18); ctx.closePath(); ctx.fill(); }
}
function drawAct(ctx,r,y,X){
  let endX=-1e9; const cp=cpOn(), onCp=cp&&cpSet().has(r.k), dim=cp&&!onCp?0.25:1; ctx.globalAlpha=dim;
  if(S.showBase&&r.B&&r.bs!=null){ const x1=X(r.bs),x2=X(r.bf); ctx.fillStyle=C.base;
    if(r.B.ms){ diamond(ctx,x1,y+22,4); ctx.fill(); endX=Math.max(endX,x1+5); }
    else { rr(ctx,x1,y+19,Math.max(2,x2-x1),5,2); ctx.fill(); endX=Math.max(endX,x2); } }
  if(r.L&&r.s!=null){ const col=onCp?C.accent:colorOf(r,S.colorBy), x1=X(r.s), x2=X(r.f);
    if(r.L.ms){ ctx.fillStyle=col; diamond(ctx,x1,y+12,6.5); ctx.fill(); endX=Math.max(endX,x1+8); }
    else { const w=Math.max(3,x2-x1);
      if(r.status==='TK_Active'&&M.dd!=null&&M.dd>r.s&&M.dd<r.f){ const xd=X(M.dd); ctx.fillStyle=col; ctx.globalAlpha=.42*dim; rr(ctx,x1,y+6,w,12,3); ctx.fill(); ctx.globalAlpha=dim; rr(ctx,x1,y+6,Math.max(3,xd-x1),12,3); ctx.fill(); }
      else { ctx.fillStyle=col; rr(ctx,x1,y+6,w,12,3); ctx.fill(); }
      endX=Math.max(endX,x2); } }
  if(r.varF){ ctx.font=FONT(700,11); ctx.fillStyle=r.varF>0?C.late:C.early; ctx.fillText(sgn(r.varF)+'d',endX+6,y+17); }
  else if(r.cmp==='added'){ ctx.font=FONT(700,10); ctx.fillStyle=C.accent; ctx.fillText('NEW',endX+6,y+16); }
  else if(r.cmp==='removed'){ ctx.font=FONT(700,10); ctx.fillStyle=C.ink3; ctx.fillText('REMOVED',endX+6,y+25); }
  ctx.globalAlpha=1;
}
function drawCpLinks(ctx,i0,i1,X,sy){
  const HD=G.HEAD,RH=G.RH, set=cpSet(); ctx.strokeStyle=C.accent; ctx.fillStyle=C.accent; ctx.lineWidth=1.8;
  const pts=(r,type,isPred)=>{ if(type==='SS') return r.s; if(type==='FF') return r.f; if(type==='SF') return isPred?r.s:r.f; return isPred?r.f:r.s; };
  const lo=Math.max(0,i0-400), hi=Math.min(G.items.length-1,i1+400);
  for(let i=lo;i<=hi;i++){ const it=G.items[i]; if(it.t!=='a'||!it.r.L||!set.has(it.r.k)) continue; const r=it.r;
    r.L.preds.forEach(p=>{ const pr=p.a.R; if(!pr||!set.has(pr.k)) return; const j=G.idx.get(pr.k); if(j==null) return; if((i<i0&&j<i0)||(i>i1&&j>i1)) return;
      if(S.cp.by==='long'&&!isDrv(p.a,r.L,p.type)) return; if(pr.s==null||r.s==null) return;
      const xa=X(pts(pr,p.type,true)), xb=X(pts(r,p.type,false)), ya=HD+j*RH-sy+12, yb=HD+i*RH-sy+12, ex=(p.type==='FF'||p.type==='SF')?Math.max(xa,xb)+8:xa+6;
      ctx.beginPath(); ctx.moveTo(xa,ya); ctx.lineTo(ex,ya); ctx.lineTo(ex,yb); ctx.lineTo(xb,yb); ctx.stroke();
      const dir=xb>=ex?1:-1; ctx.beginPath(); ctx.moveTo(xb,yb); ctx.lineTo(xb-5*dir,yb-3.5); ctx.lineTo(xb-5*dir,yb+3.5); ctx.closePath(); ctx.fill(); }); }
  ctx.lineWidth=1;
}
let cpCache=null;
function cpSet(){ if(!M) return new Set(); const key=S.cp.by+'|'+S.cp.thr; if(cpCache&&cpCache.key===key&&cpCache.M===M) return cpCache.set;
  const set=new Set(), info={};
  if(S.cp.by==='float'){ M.rows.forEach(r=>{ if(r.L&&r.status!=='TK_Complete'&&r.tf!=null&&r.tf<=S.cp.thr+1e-6) set.add(r.k); }); }
  else { let end=null; for(const a of M.live.acts.values()){ if(a.status==='TK_Complete'||a.f==null||a.type==='TT_LOE') continue; if(!end||a.f>end.f||(a.f===end.f&&a.type==='TT_FinMile')) end=a; }
    if(end){ const q=[end], seen=new Set([end]); while(q.length){ const a=q.shift(); if(a.R) set.add(a.R.k); drivingSet(a).forEach(p=>{ const b=p.a; if(b.status==='TK_Complete'||seen.has(b)) return; seen.add(b); q.push(b); }); } info.end=end; } }
  let fin=null; set.forEach(k=>{ const r=M.byKey.get(k); if(r&&r.f!=null&&(!fin||r.f>fin.f)) fin=r; }); info.fin=fin;
  cpCache={key,M,set,info}; return set; }
const cpOn=()=>S.cp.mode!=='off';
const inCp=r=>cpOn()&&cpSet().has(r.k);
function gapOf(p,q,type,lag){ const L=lag*DAY; return type==='SS'?q.s-(p.s+L):type==='FF'?q.f-(p.f+L):type==='SF'?q.f-(p.s+L):q.s-(p.f+L); }
let drvCache=new WeakMap();
function drivingSet(a){ if(drvCache.has(a)) return drvCache.get(a); const set=new Set();
  if(a.s!=null&&a.status!=='TK_Complete'){ const gaps=a.preds.filter(p=>p.a.s!=null).map(p=>[p,gapOf(p.a,a,p.type,p.lag)]);
    if(gaps.length){ const m=Math.min(...gaps.map(g=>g[1])); if(m<=4*DAY) gaps.forEach(g=>{ if(g[1]<=m+0.5*DAY) set.add(g[0]); }); } }
  drvCache.set(a,set); return set; }
const isDrv=(pa,sa,type)=>{ for(const p of drivingSet(sa)) if(p.a===pa&&p.type===type) return true; return false; };
function drawLinks(ctx,i0,i1,X,sy){
  const HD=G.HEAD,RH=G.RH, selMode=S.logic==='sel';
  const pts=(r,type,isPred)=>{ if(type==='SS') return r.s; if(type==='FF') return r.f; if(type==='SF') return isPred?r.s:r.f; return isPred?r.f:r.s; };
  const done=new Set();
  const draw=(pr,sr,type,j,i)=>{ const key=pr.k+'>'+sr.k+type; if(done.has(key)||pr.s==null||sr.s==null) return; done.add(key);
    const drv=pr.L&&sr.L&&isDrv(pr.L,sr.L,type);
    const xa=X(pts(pr,type,true)), xb=X(pts(sr,type,false)), ya=HD+j*RH-sy+12, yb=HD+i*RH-sy+12;
    ctx.strokeStyle=(pr.crit&&sr.crit)?C.accent:selMode?C.ink2:C.ink3; ctx.globalAlpha=selMode?1:.85;
    ctx.lineWidth=drv?(selMode?2:1.4):1; ctx.setLineDash(drv?[]:[3,3]);
    const ex=(type==='FF'||type==='SF')?Math.max(xa,xb)+8:xa+6;
    ctx.beginPath(); ctx.moveTo(xa,ya); ctx.lineTo(ex,ya); ctx.lineTo(ex,yb); ctx.lineTo(xb,yb); ctx.stroke(); ctx.setLineDash([]);
    const dir=xb>=ex?1:-1; ctx.fillStyle=ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(xb,yb); ctx.lineTo(xb-5*dir,yb-3.5); ctx.lineTo(xb-5*dir,yb+3.5); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; ctx.lineWidth=1; };
  if(selMode){ const i=G.idx.get(S.sel); if(i==null) return; const r=G.items[i].r, a=r.L||r.B;
    a.preds.forEach(p=>{ const pr=p.a.R; if(!pr) return; const j=G.idx.get(pr.k); if(j!=null) draw(pr,r,p.type,j,i); });
    a.succs.forEach(p=>{ const sr=p.a.R; if(!sr) return; const j=G.idx.get(sr.k); if(j!=null) draw(r,sr,p.type,i,j); });
    return; }
  for(let i=i0;i<=i1;i++){ const it=G.items[i]; if(it.t!=='a'||!it.r.L) continue; const r=it.r;
    r.L.preds.forEach(p=>{ const pr=p.a.R; if(!pr) return; const j=G.idx.get(pr.k); if(j!=null) draw(pr,r,p.type,j,i); });
    r.L.succs.forEach(p=>{ const sr=p.a.R; if(!sr) return; const j=G.idx.get(sr.k); if(j!=null&&(j<i0||j>i1)) draw(r,sr,p.type,i,j); }); }
}
function gHit(e){ const rc=gSc.getBoundingClientRect(), x=e.clientX-rc.left, y=e.clientY-rc.top; if(y<G.HEAD||x>gSc.clientWidth||y>gSc.clientHeight) return {i:-1,x,y}; const i=Math.floor((y-G.HEAD+gSc.scrollTop)/G.RH); return {i:i<G.items.length?i:-1,x,y}; }
function zoomGantt(f,anchorX){
  const TW=tableW(), W=gWrap.clientWidth, ax=anchorX??(TW+(W-TW)/2);
  const tAt=M.t0g+(ax-TW+gSc.scrollLeft)/S.ppd*DAY;
  S.ppd=Math.max(0.15,Math.min(60,S.ppd*f));
  gSp.style.width=(TW+(M.t1g-M.t0g)/DAY*S.ppd)+'px';
  gSc.scrollLeft=(tAt-M.t0g)/DAY*S.ppd-(ax-TW);
  drawGantt();
}
function fitGantt(){
  if(!gWrap.clientWidth){ G.needFit=true; return; } G.needFit=false;
  const TW=tableW(), W=gWrap.clientWidth; let a=Infinity,b=-Infinity;
  S.rows.forEach(r=>{ for(const t of [r.s,r.f,S.showBase?r.bs:null,S.showBase?r.bf:null]) if(t!=null){a=Math.min(a,t);b=Math.max(b,t);} });
  if(!isFinite(a)){ a=M.t0; b=M.t1; }
  S.ppd=Math.max(0.15,Math.min(60,(W-TW-70)/Math.max(1,(b-a)/DAY)));
  gSp.style.width=(TW+(M.t1g-M.t0g)/DAY*S.ppd)+'px';
  gSc.scrollLeft=Math.max(0,(a-M.t0g)/DAY*S.ppd-20);
  drawGantt();
}
function scrollToRow(k){ const i=G.idx.get(k); if(i==null) return; const H=gWrap.clientHeight; const y=i*G.RH; if(y<gSc.scrollTop||y>gSc.scrollTop+H-G.HEAD-G.RH*2) gSc.scrollTop=Math.max(0,y-H/3);
  const r=M.byKey.get(k), t=r&&(r.s??r.bs); if(t!=null){ const TW=tableW(), x=(t-M.t0g)/DAY*S.ppd; if(x<gSc.scrollLeft||x>gSc.scrollLeft+gWrap.clientWidth-TW-80) gSc.scrollLeft=Math.max(0,x-60); } }

