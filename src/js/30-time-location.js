/* ---------------- Time-location ---------------- */
const T={view:null,shapes:[],plot:null,vert:true};
const UNIT_M={km:1000,m:1,mi:1609.344,ft:0.3048};
const FMT={kmm:{label:'km + m',scale:1000,title:'Chainage (km+m)'},km:{label:'Kilometres',scale:1000,title:'Chainage (km)'},m:{label:'Metres',scale:1,title:'Chainage (m)'},mi:{label:'Miles',scale:1609.344,title:'Chainage (miles)'},sta:{label:'Stations (ft)',scale:30.48,title:'Station (ft)'}};
function fmtCh(m,step){
  if(m==null||!isFinite(m)) return '—'; const f=S.tld.fmt, neg=m<0?'−':''; const a=Math.abs(m);
  if(f==='kmm'){ let k=Math.floor(a/1000), r=Math.round(a-k*1000); if(r===1000){k++;r=0;} return `${neg}${k}+${String(r).padStart(3,'0')}`; }
  if(f==='km'){ const dp=step!=null?(step>=1000?0:step>=100?1:step>=10?2:3):3; return neg+(a/1000).toFixed(dp); }
  if(f==='m') return neg+Math.round(a).toLocaleString();
  if(f==='mi'){ const dp=step!=null?(step>=1609?0:step>=160?1:2):2; return neg+(a/1609.344).toFixed(dp); }
  const ft=a/0.3048; let h=Math.floor(ft/100), r=Math.round(ft-h*100); if(r===100){h++;r=0;} return `${neg}${h}+${String(r).padStart(2,'0')}`;
}
function parseChText(t,unit){ // returns metres or null; accepts 2+500, 125+00 (stations when unit ft), 2.5 km, 2500 m, plain numbers in `unit`
  if(t==null) return null; t=String(t).trim().replace(/,/g,''); if(!t) return null;
  let m=/^(-?\d+)\+(\d+(?:\.\d+)?)$/.exec(t); if(m){ const hi=+m[1], lo=+m[2]; return unit==='ft'?(hi*100+lo)*0.3048:hi*1000+(hi<0?-lo:lo); }
  m=/^(-?\d+(?:\.\d+)?)\s*(km|m|mi|ft)?$/i.exec(t); if(m){ return +m[1]*UNIT_M[(m[2]||unit).toLowerCase()]; }
  return null;
}
function chFromName(name,unit){
  const out=[]; const re=/(?:\b(?:ch|chainage|km|sta|station)\.?\s*)?(\d{1,4})\+(\d{2,3}(?:\.\d+)?)|\b(?:ch|chainage)\.?\s*(\d+(?:\.\d+)?)\s*(km|m)?\b|\bkm\s*(\d+(?:\.\d+)?)/gi; let m;
  while((m=re.exec(name))&&out.length<2){
    if(m[1]!=null){ const isSta=m[2].length===2&&!/\.\d/.test(m[2]); out.push(isSta?(+m[1]*100+ +m[2])*0.3048:+m[1]*1000+ +m[2]); }
    else if(m[3]!=null) out.push(+m[3]*UNIT_M[(m[4]||unit).toLowerCase()]);
    else if(m[5]!=null) out.push(+m[5]*1000); }
  return out.length?[out[0],out[1]??out[0]]:null;
}
function chMapFor(type){ return S.chmap[type]||(S.chmap[type]={}); }
function detectMap(type){ const map=chMapFor(type); let n=0; (M.codeOrder[type]||[]).forEach(v=>{ const g=chFromName(v.name+' '+v.short,S.tld.inUnit); if(g){ map[v.short]=[g[0],g[1]]; n++; } }); saveCh(); return n; }
function spreadMap(type,lenM){ const vals=(M.codeOrder[type]||[]), map=chMapFor(type), step=lenM/Math.max(1,vals.length); vals.forEach((v,i)=>map[v.short]=[i*step,(i+1)*step]); saveCh(); }
function saveCh(){ try{ localStorage.setItem('pacer.chmap',JSON.stringify(S.chmap)); localStorage.setItem('pacer.chfmt',JSON.stringify({fmt:S.tld.fmt})); }catch(_){} }
function mapGetter(type){ const map=chMapFor(type); return a=>{ if(!a) return null; const v=a.codes[type]; const g=v!=null?map[v]:null; return g&&isFinite(g[0])?[g[0],isFinite(g[1])?g[1]:g[0]]:null; }; }
function locAcc(){
  const num=v=>typeof v==='number'?v:parseFloat(v), f=UNIT_M[S.tld.inUnit]||1000;
  if(S.tld.src==='udf'){ const s=S.tld.udfS, e=S.tld.udfE; if(!s) return null;
    return {kind:'num',label:FMT[S.tld.fmt].title,get:a=>{ if(!a) return null; let x=num(a.udf[s]), y=num(a.udf[e||s]); if(!isFinite(x)&&!isFinite(y)) return null; if(!isFinite(x)) x=y; if(!isFinite(y)) y=x; return [x*f,y*f]; }}; }
  if(S.tld.src==='map'&&S.tld.mapType) return {kind:'num',label:FMT[S.tld.fmt].title,get:mapGetter(S.tld.mapType)};
  if(S.tld.src==='name'){ const cache=new Map(); return {kind:'num',label:FMT[S.tld.fmt].title,get:a=>{ if(!a) return null; if(!cache.has(a)) cache.set(a,chFromName(a.name,S.tld.inUnit)); return cache.get(a); }}; }
  if(S.tld.src==='code'&&S.tld.locType){ const type=S.tld.locType, vals=M.codeOrder[type]||[]; const ix=new Map(vals.map((v,i)=>[v.short,i]));
    return {kind:'band',vals,label:type,get:a=>{ if(!a) return null; const v=a.codes[type]; if(v==null||!ix.has(v)) return null; const i=ix.get(v); return [i,i+1]; }}; }
  return null;
}
function tMsg(ctx,W,H,h,p){ ctx.textAlign='center'; ctx.font=FONT(700,22,true); ctx.fillStyle=C.ink; ctx.fillText(h.toUpperCase(),W/2,H/2-8); ctx.font=FONT(500,14); ctx.fillStyle=C.ink2; ctx.fillText(p,W/2,H/2+18); ctx.textAlign='left'; }
function niceStep(raw){ const m=Math.pow(10,Math.floor(Math.log10(raw))); for(const k of [1,2,2.5,5,10]) if(k*m>=raw) return k*m; return 10*m; }
/* ---------------- TILOS-style time-location ---------------- */
function styleKey(r,by){ if(by.startsWith('code:')){ const t=by.slice(5); return 'c:'+t+':'+(r.codes[t]??'∅'); } if(by==='crit') return 'k:'+(r.status==='TK_Complete'?'done':r.crit?'crit':'non'); if(by==='status') return 's:'+(r.status||''); return 'x'; }
function styleOf(r){ const by=S.tld.colorBy, k=styleKey(r,by), st=S.styles[k]||{}; return {key:k,color:st.color||colorOf(r,by),shape:st.shape||'auto',hatch:st.hatch||'none',width:+st.width||3.5}; }
function styleClasses(){
  const by=S.tld.colorBy, seen=new Map(); S.rows.forEach(r=>{ if(!r.L) return; const k=styleKey(r,by); if(!seen.has(k)) seen.set(k,{k,r,n:0}); seen.get(k).n++; });
  const t=by.startsWith('code:')?by.slice(5):null, ord=t?(M.codeOrder[t]||[]).map(o=>o.short):[];
  const FIX={'k:crit':'Critical','k:non':'Non-critical','k:done':'Complete','s:TK_NotStart':'Not started','s:TK_Active':'In progress','s:TK_Complete':'Complete'};
  return [...seen.values()].map(x=>{ let label=FIX[x.k]||x.k, pos=0; if(t){ const v=x.r.codes[t]; pos=v==null?1e9:ord.indexOf(v); const o=(M.codeOrder[t]||[]).find(z=>z.short===v); label=v==null?`No ${t}`:(o&&o.name!==v?`${v} · ${o.name}`:v); } else pos=Object.keys(FIX).indexOf(x.k); return {...x,label,pos}; }).sort((a,b)=>a.pos-b.pos);
}
function shapeOf(g,ms,st,band){ if(ms) return 'ms'; if(band) return st.shape==='line'?'line':st.shape==='bar'?'bar':'block'; if(Math.abs(g[1]-g[0])<1e-9) return 'bar'; if(st.shape==='auto') return S.tld.spans==='block'?'block':'line'; return st.shape; }
const patCache=new Map();
function hatchPat(ctx,type,col){ const key=type+col; if(patCache.has(key)) return patCache.get(key); const c=document.createElement('canvas'); c.width=c.height=9; const x=c.getContext('2d'); x.strokeStyle=col; x.fillStyle=col; x.lineWidth=1.3;
  const dg=()=>{ x.beginPath(); x.moveTo(0,9); x.lineTo(9,0); x.moveTo(-3,3); x.lineTo(3,-3); x.moveTo(6,12); x.lineTo(12,6); x.stroke(); };
  if(type==='diag') dg(); else if(type==='cross'){ dg(); x.beginPath(); x.moveTo(0,0); x.lineTo(9,9); x.stroke(); } else if(type==='dots'){ x.beginPath(); x.arc(4.5,4.5,1.4,0,7); x.fill(); } else if(type==='horiz') x.fillRect(0,4,9,1.3); else if(type==='vert') x.fillRect(4,0,1.3,9);
  const p=ctx.createPattern(c,'repeat'); patCache.set(key,p); return p; }
function tldInterval(it,t){ const r=it.r, g=it.gl; if(it.sh==='block') return [Math.min(g[0],g[1]),Math.max(g[0],g[1])]; if(it.sh==='bar'||g[0]===g[1]){ const m=(g[0]+g[1])/2; return [m,m]; } const tt=Math.min(Math.max(t,r.s),r.f), x=g[0]+(g[1]-g[0])*(tt-r.s)/((r.f-r.s)||1); return [x,x]; }
function computeClashes(items,ext){
  const bufM=Math.max(0,+S.tld.bufM||0), bufD=Math.max(0,+S.tld.bufD||0)*DAY, out=[];
  const c=items.filter(it=>it.gl&&it.r.L&&!it.r.L.ms&&it.r.status!=='TK_Complete'&&it.r.s!=null&&it.r.f>it.r.s&&Math.abs(it.gl[1]-it.gl[0])<0.9*ext).sort((a,b)=>a.r.s-b.r.s);
  const linked=(a,b)=>a.preds.some(p=>p.a===b)||b.preds.some(p=>p.a===a);
  for(let i=0;i<c.length&&out.length<1000;i++){ const A=c[i], ea=[Math.min(...A.gl),Math.max(...A.gl)];
    for(let j=i+1;j<c.length;j++){ const B=c[j]; if(B.r.s>A.r.f+bufD) break;
      const eb=[Math.min(...B.gl),Math.max(...B.gl)]; if(Math.max(0,eb[0]-ea[1],ea[0]-eb[1])>bufM) continue;
      const lo=Math.max(A.r.s,B.r.s)-bufD, hi=Math.min(A.r.f,B.r.f)+bufD; if(hi<lo||linked(A.r.L,B.r.L)) continue;
      let best=Infinity,bt=0,bl=0,prev=null;
      const pt=X=>X[1]-X[0]<1e-6;
      for(let k=0;k<=24;k++){ const t=lo+(hi-lo)*k/24; const I=tldInterval(A,t), J=tldInterval(B,t); let d=Math.max(0,J[0]-I[1],I[0]-J[1]);
        if(d===0){ const ov=Math.min(I[1],J[1])-Math.max(I[0],J[0]); if(ov<=1){ if(!(pt(I)&&pt(J))){ const P=pt(I)?I[0]:pt(J)?J[0]:null, R=pt(I)?J:I; d=(P!=null&&P>R[0]+1&&P<R[1]-1)?0:1; } } }
        let loc=d===0?(Math.max(I[0],J[0])+Math.min(I[1],J[1]))/2:(I[1]<J[0]?(I[1]+J[0])/2:(J[1]+I[0])/2), tt=t;
        if(pt(I)&&pt(J)){ const sd=I[0]-J[0]; if(prev&&Math.sign(sd)!==Math.sign(prev.sd)&&prev.sd!==0&&sd!==0){ const f=prev.sd/(prev.sd-sd); d=0; tt=prev.t+(t-prev.t)*f; loc=prev.x+(I[0]-prev.x)*f; } prev={sd,t,x:I[0]}; }
        if(d<best){ best=d; bt=tt; bl=loc; } }
      if(best<=bufM&&(bufM>0||best===0)) out.push({a:A.r,b:B.r,t:Math.min(Math.max(bt,Math.max(A.r.s,B.r.s)),Math.max(Math.min(A.r.f,B.r.f),Math.max(A.r.s,B.r.s))),l:bl,d:best}); } }
  return out;
}
function drawSite(ctx,lx,xa,xb,Hb){ // local coords: x along chainage, y 0 (outer) .. Hb (next to plot)
  const marks=S.site.marks.filter(m=>isFinite(m.a)), prof=S.site.profile, hasP=prof.length>=2, laneH=hasP?32:Hb;
  ctx.fillStyle=C.surface; ctx.fillRect(xa,0,xb-xa,Hb);
  ctx.save(); ctx.beginPath(); ctx.rect(xa,0,xb-xa,Hb); ctx.clip();
  if(!marks.length&&!hasP){ ctx.font=FONT(500,11); ctx.fillStyle=C.ink3; ctx.fillText('Add stations, structures or a ground profile under Site',xa+8,Hb/2+4); }
  if(hasP){ const y0=laneH+4, y1=Hb-4, pts=prof.slice().sort((a,b)=>a[0]-b[0]), zs=pts.map(p=>p[1]), zmin=Math.min(...zs), zmax=Math.max(...zs), zr=(zmax-zmin)||1;
    const Y=z=>y1-(z-zmin)/zr*(y1-y0);
    ctx.beginPath(); ctx.moveTo(lx(pts[0][0]),y1); pts.forEach(p=>ctx.lineTo(lx(p[0]),Y(p[1]))); ctx.lineTo(lx(pts[pts.length-1][0]),y1); ctx.closePath();
    ctx.fillStyle=C.band; ctx.fill(); ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(lx(p[0]),Y(p[1])):ctx.moveTo(lx(p[0]),Y(p[1]))); ctx.strokeStyle=C.ink2; ctx.lineWidth=1.3; ctx.stroke();
    ctx.font=FONT(600,10); ctx.fillStyle=C.ink3; ctx.fillText(`GROUND ${zmax.toFixed(1)} / ${zmin.toFixed(1)} m`,xa+6,y0+10); }
  const geo=marks.map(m=>{ const a=lx(Math.min(m.a,m.b??m.a)), b=lx(Math.max(m.a,m.b??m.a)); return {m,a:Math.min(a,b),b:Math.max(a,b),k:m.kind||'station'}; });
  const y=6, h=Math.min(18,laneH-10), placed=[];
  geo.forEach(({m,a,b,k})=>{ const w=b-a, cx=(a+b)/2; ctx.lineWidth=1.5; ctx.strokeStyle=C.ink; ctx.fillStyle=C.ink;
    if(k==='station'){ rr(ctx,a,y,Math.max(4,w),h,3); ctx.fill(); }
    else if(k==='section'){ ctx.strokeStyle=C.ink2; rr(ctx,a,y,Math.max(4,w),h,3); ctx.stroke(); }
    else if(k==='tunnel'){ ctx.fillStyle=hatchPat(ctx,'diag',C.ink); ctx.fillRect(a,y,Math.max(4,w),h); ctx.strokeRect(a,y,Math.max(4,w),h); }
    else if(k==='bridge'){ ctx.beginPath(); if(w>12){ ctx.moveTo(a,y+h); ctx.lineTo(a,y+4); ctx.lineTo(b,y+4); ctx.lineTo(b,y+h); const n=Math.max(1,Math.round(w/40)); for(let i=0;i<n;i++){ const s0=a+w*i/n, s1=a+w*(i+1)/n; ctx.moveTo(s0,y+h); ctx.quadraticCurveTo((s0+s1)/2,y+6,s1,y+h); } } else { ctx.moveTo(cx-8,y+h); ctx.quadraticCurveTo(cx,y,cx+8,y+h); ctx.moveTo(cx-10,y+3); ctx.lineTo(cx+10,y+3); } ctx.stroke(); }
    else if(k==='crossing'){ ctx.beginPath(); ctx.moveTo(cx-6,y+2); ctx.lineTo(cx+6,y+h-2); ctx.moveTo(cx+6,y+2); ctx.lineTo(cx-6,y+h-2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(cx,y+6,4,0,7); ctx.fill(); ctx.fillRect(cx-0.75,y+8,1.5,h-8); }
    placed.push(w>12?[a-1,b+1]:[cx-11,cx+11]); });
  ctx.font=FONT(700,11,true); setLS(ctx,'0.3px');
  const free=(x0,x1,self)=>x0>=xa&&x1<=xb&&!placed.some(p=>p!==self&&x0<p[1]&&x1>p[0]);
  geo.forEach(({m,a,b,k},gi)=>{ const lab=String(m.name||'').toUpperCase(), tw=ctx.measureText(lab).width, w=b-a, self=placed[gi];
    if(k==='station'&&w>tw+10){ ctx.fillStyle=C.surface; ctx.fillText(lab,(a+b)/2-tw/2,y+h-5); return; }
    const right=Math.max(b,w>12?b:(a+b)/2+11)+5, left=Math.min(a,w>12?a:(a+b)/2-11)-5-tw;
    let x=null; if(free(right,right+tw,self)) x=right; else if(free(left,left+tw,self)) x=left;
    else { const short=fit(ctx,lab,Math.max(0,(placed.filter(p=>p[0]>b).map(p=>p[0])[0]??xb)-right-4)); if(short&&short.length>3){ ctx.fillStyle=C.ink2; ctx.fillText(short,right,y+h-5); placed.push([right,right+ctx.measureText(short).width]); } return; }
    ctx.fillStyle=C.ink2; ctx.fillText(lab,x,y+h-5); placed.push([x,x+tw]); });
  setLS(ctx,'0px');
  ctx.restore();
}
function drawTLD(){
  if(!M||tWrap.hidden) return;
  const W=tWrap.clientWidth,H=tWrap.clientHeight; if(!W||!H) return;
  const ctx=setupCanvas(tCv,W,H); ctx.fillStyle=C.surface; ctx.fillRect(0,0,W,H); T.shapes=[]; T.clashes=[];
  const acc=locAcc(); let miss=0;
  if(!acc){ tMsg(ctx,W,H,'No location data','Add chainage UDFs or a location activity code, then choose it under Location.'); setNote(''); renderClashes(); return; }
  const band=acc.kind==='band', items=[]; let l0=Infinity,l1=-Infinity,t0=Infinity,t1=-Infinity;
  const cpS=cpOn()?cpSet():null;
  for(const r of S.rows){ if(S.cp.mode==='only'&&!cpS.has(r.k)) continue; const gl=r.L?acc.get(r.L):null, gb=(r.B&&S.showBase)?acc.get(r.B):null;
    if(!gl&&!gb){ miss++; continue; } const it={r,gl,gb}; if(gl&&r.L){ it.st=styleOf(r); it.sh=shapeOf(gl,r.L.ms,it.st,band); } items.push(it);
    for(const g of [gl,gb]) if(g){ l0=Math.min(l0,g[0],g[1]); l1=Math.max(l1,g[0],g[1]); }
    if(gl&&r.s!=null){ t0=Math.min(t0,r.s); t1=Math.max(t1,r.f); } if(gb&&r.bs!=null){ t0=Math.min(t0,r.bs); t1=Math.max(t1,r.bf); } }
  T.acc=acc;
  setNote(miss?`${miss} filtered ${miss===1?'activity has':'activities have'} no ${band?esc(acc.label)+' code':'chainage'} and ${miss===1?'is':'are'} not plotted.${S.tld.src==='map'?' Set chainages for each code value under <b>Chainage map</b>.':''}`:'');
  if(!items.length||!isFinite(t0)){ tMsg(ctx,W,H,'Nothing to plot','None of the filtered activities have a location value.'); renderClashes(); return; }
  const ext=band?acc.vals.length:(l1-l0)||1;
  if(band){ l0=0; l1=acc.vals.length; } else { const p=(l1-l0)*0.03||0.5; l0=l0>=0&&l0-p<0?0:l0-p; l1+=p; }
  const tp=(t1-t0)*0.03||7*DAY; t0-=tp; t1+=tp;
  if(!T.view) T.view={l0,l1,t0,t1};
  const V=T.view, vert=S.tld.orient==='v';
  const site=!band&&S.tld.site, hasP=S.site.profile.length>=2, SB=site?(S.site.marks.length?34:0)+(hasP?48:0)||30:0, GAP=site?6:0;
  const pl=vert?{x0:66,x1:W-16,y0:(band?60:48)+SB+GAP,y1:H-14}:{x0:(band?Math.min(190,Math.round(W*0.32)):70)+SB+GAP,x1:W-16,y0:44,y1:H-14};
  T.plot=pl; T.vert=vert;
  const P=(l,t)=>vert?[pl.x0+(l-V.l0)/(V.l1-V.l0)*(pl.x1-pl.x0),pl.y0+(t-V.t0)/(V.t1-V.t0)*(pl.y1-pl.y0)]:[pl.x0+(t-V.t0)/(V.t1-V.t0)*(pl.x1-pl.x0),pl.y0+(l-V.l0)/(V.l1-V.l0)*(pl.y1-pl.y0)];
  const rectLT=(la,lb,ta,tb)=>{ const [ax,ay]=P(la,ta),[bx,by]=P(lb,tb); return [Math.min(ax,bx),Math.min(ay,by),Math.abs(bx-ax),Math.abs(by-ay)]; };
  // site band
  if(site){ ctx.save();
    if(vert){ ctx.translate(0,pl.y0-SB-GAP); drawSite(ctx,l=>P(l,V.t0)[0],pl.x0,pl.x1,SB); }
    else { ctx.translate(pl.x0-SB-GAP,0); ctx.rotate(-Math.PI/2); drawSite(ctx,l=>-P(l,V.t0)[1],-pl.y1,-pl.y0,SB); }
    ctx.restore(); ctx.strokeStyle=C.line; ctx.lineWidth=1; if(vert) ctx.strokeRect(pl.x0+.5,pl.y0-SB-GAP+.5,pl.x1-pl.x0-1,SB-1); else ctx.strokeRect(pl.x0-SB-GAP+.5,pl.y0+.5,SB-1,pl.y1-pl.y0-1); }
  // plot background
  ctx.fillStyle=C.surface2; ctx.fillRect(pl.x0,pl.y0,pl.x1-pl.x0,pl.y1-pl.y0);
  ctx.save(); ctx.beginPath(); ctx.rect(pl.x0,pl.y0,pl.x1-pl.x0,pl.y1-pl.y0); ctx.clip();
  if(band){ acc.vals.forEach((v,i)=>{ if(i%2){ const [x,y,w,h]=rectLT(i,i+1,V.t0,V.t1); ctx.fillStyle=C.band; ctx.fillRect(x,y,w,h); } }); }
  const ovT=!band&&S.tld.overlay, ovMap=ovT?chMapFor(ovT):null, ovVals=ovT?(M.codeOrder[ovT]||[]).filter(v=>ovMap[v.short]&&isFinite(ovMap[v.short][0])):[];
  ovVals.forEach((v,i)=>{ const g=ovMap[v.short]; if(i%2===0){ const [x,y,w,h]=rectLT(Math.min(g[0],g[1]),Math.max(g[0],g[1]),V.t0,V.t1); ctx.fillStyle=C.band; ctx.fillRect(x,y,w,h); } });
  const tLen=vert?pl.y1-pl.y0:pl.x1-pl.x0, pxDay=tLen/((V.t1-V.t0)/DAY);
  if(S.tld.weekends&&pxDay>=2.5){ ctx.fillStyle=C.band; ctx.globalAlpha=.75; for(let t=Math.floor(V.t0/DAY)*DAY,n=0;t<V.t1&&n<6000;t+=DAY,n++){ const d=new Date(t).getUTCDay(); if(d===0||d===6){ const [x,y,w,h]=rectLT(V.l0,V.l1,t,t+DAY); ctx.fillRect(x,y,w,h); } } ctx.globalAlpha=1; }
  const step=[1,2,3,6,12,24].find(s=>s*30.4*pxDay>=46)||24;
  const mts=monthTicks(V.t0,V.t1,step).filter(t=>t>=V.t0);
  ctx.lineWidth=1;
  mts.forEach(t=>{ const [ax,ay]=P(V.l0,t),[bx,by]=P(V.l1,t); ctx.strokeStyle=new Date(t).getUTCMonth()===0?C.line:C.grid; ctx.beginPath(); ctx.moveTo(Math.round(ax)+.5,Math.round(ay)+.5); ctx.lineTo(Math.round(bx)+.5,Math.round(by)+.5); ctx.stroke(); });
  let lts=[], lst=1;
  if(!band){ const lLen=vert?pl.x1-pl.x0:pl.y1-pl.y0, sc=FMT[S.tld.fmt].scale; let su=niceStep((V.l1-V.l0)/sc/Math.max(2,lLen/(S.tld.fmt==='kmm'||S.tld.fmt==='sta'?100:90))); if(S.tld.fmt==='sta') su=Math.max(1,Math.round(su)); lst=su*sc;
    for(let v=Math.ceil(V.l0/lst)*lst;v<=V.l1+1e-6;v+=lst) lts.push(+v.toFixed(4));
    ctx.strokeStyle=C.grid; lts.forEach(v=>{ const [ax,ay]=P(v,V.t0),[bx,by]=P(v,V.t1); ctx.beginPath(); ctx.moveTo(Math.round(ax)+.5,Math.round(ay)+.5); ctx.lineTo(Math.round(bx)+.5,Math.round(by)+.5); ctx.stroke(); }); }
  else { ctx.strokeStyle=C.line; for(let i=0;i<=acc.vals.length;i++){ const [ax,ay]=P(i,V.t0),[bx,by]=P(i,V.t1); ctx.beginPath(); ctx.moveTo(Math.round(ax)+.5,Math.round(ay)+.5); ctx.lineTo(Math.round(bx)+.5,Math.round(by)+.5); ctx.stroke(); } }
  // site landmarks as faint guides through the plot
  if(site) S.site.marks.forEach(m=>{ if(!isFinite(m.a)) return; [m.a,m.b].filter((v,i)=>isFinite(v)&&(i===0||v!==m.a)).forEach(v=>{ const [ax,ay]=P(v,V.t0),[bx,by]=P(v,V.t1); ctx.strokeStyle=C.line; ctx.setLineDash([2,4]); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]); }); });
  // geometry helpers for an activity drawn with a given shape
  const geo=(sh,g,s,f)=>{ if(sh==='ms'){ const m=band?(g[0]+g[1])/2:g[0]; const [x,y]=P(m,s); return {k:'pt',x1:x,y1:y,x2:x,y2:y}; }
    if(sh==='block'){ const pad=band?0.12:0; const [x,y,w,h]=rectLT(Math.min(g[0],g[1])+pad,Math.max(g[0],g[1])-pad,s,f); return {k:'rect',x,y,w:Math.max(2,w),h:Math.max(2,h)}; }
    if(sh==='bar'){ const m=(g[0]+g[1])/2, [ax,ay]=P(m,s),[bx,by]=P(m,f); return vert?{k:'rect',x:ax-5,y:Math.min(ay,by),w:10,h:Math.max(2,Math.abs(by-ay)),bar:1}:{k:'rect',x:Math.min(ax,bx),y:ay-5,w:Math.max(2,Math.abs(bx-ax)),h:10,bar:1}; }
    const [x1,y1]=P(g[0],s),[x2,y2]=P(g[1],f); return {k:'line',x1,y1,x2,y2}; };
  // baseline ghosts
  if(S.showBase){ ctx.setLineDash([5,4]); ctx.strokeStyle=C.base; ctx.lineWidth=1.6;
    items.forEach(it=>{ if(!it.gb||it.r.bs==null) return; const st=it.st||styleOf(it.r), sh=shapeOf(it.gb,it.r.B.ms,st,band), G=geo(sh,it.gb,it.r.bs,it.r.bf);
      if(G.k==='pt'){ diamond(ctx,G.x1,G.y1,6); ctx.stroke(); } else if(G.k==='rect') ctx.strokeRect(G.x+.5,G.y+.5,G.w-1,G.h-1); else { ctx.beginPath(); ctx.moveTo(G.x1,G.y1); ctx.lineTo(G.x2,G.y2); ctx.stroke(); } });
    ctx.setLineDash([]); }
  // live activities
  const dd=M.dd;
  items.forEach(it=>{ const r=it.r; if(!it.gl||!r.L||r.s==null) return; const st=it.st, onCp=cpS&&cpS.has(r.k), col=onCp?C.accent:st.color, dimA=cpS&&!onCp?0.2:1, G=geo(it.sh,it.gl,r.s,r.f); G.r=r; G.sh=it.sh; T.shapes.push(G);
    const prog=S.tld.progress&&r.status==='TK_Active'&&dd!=null&&dd>r.s&&dd<r.f, frac=prog?(dd-r.s)/(r.f-r.s):1, faded=S.tld.progress&&r.status==='TK_NotStart';
    if(G.k==='pt'){ ctx.globalAlpha=dimA; ctx.fillStyle=col; diamond(ctx,G.x1,G.y1,6.5); ctx.fill(); ctx.strokeStyle=C.surface; ctx.lineWidth=1.5; ctx.stroke(); ctx.globalAlpha=1; return; }
    if(G.k==='rect'){ const fill=(x,y,w,h,alpha)=>{ ctx.globalAlpha=alpha*dimA; ctx.fillStyle=col; ctx.fillRect(x,y,w,h); ctx.globalAlpha=dimA; if(st.hatch!=='none'){ ctx.fillStyle=hatchPat(ctx,st.hatch,col); ctx.fillRect(x,y,w,h); } };
      const base=G.bar?.8:.22;
      if(prog){ const tw=vert?G.h*frac:G.w*frac; fill(G.x,G.y,G.w,G.h,base*.6); if(vert) fill(G.x,G.y,G.w,tw,G.bar?.95:.42); else fill(G.x,G.y,tw,G.h,G.bar?.95:.42); }
      else fill(G.x,G.y,G.w,G.h,faded?base*.75:r.status==='TK_Complete'?base*1.4:base);
      ctx.strokeStyle=col; ctx.lineWidth=(onCp||r.crit)?2.6:1.4; ctx.globalAlpha=dimA; ctx.strokeRect(G.x+.5,G.y+.5,G.w-1,G.h-1); ctx.globalAlpha=1; return; }
    const lw=st.width+((onCp||r.crit)?1.5:0); ctx.globalAlpha=dimA; ctx.lineCap='round'; ctx.strokeStyle=col; ctx.lineWidth=lw;
    if(prog){ const mx=G.x1+(G.x2-G.x1)*frac, my=G.y1+(G.y2-G.y1)*frac; ctx.beginPath(); ctx.moveTo(G.x1,G.y1); ctx.lineTo(mx,my); ctx.stroke();
      ctx.globalAlpha=.4*dimA; ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(G.x2,G.y2); ctx.stroke(); ctx.globalAlpha=dimA;
      ctx.fillStyle=C.surface; ctx.beginPath(); ctx.arc(mx,my,lw/2+2.5,0,7); ctx.fill(); ctx.lineWidth=2; ctx.stroke(); }
    else { ctx.globalAlpha=(faded?.8:1)*dimA; ctx.beginPath(); ctx.moveTo(G.x1,G.y1); ctx.lineTo(G.x2,G.y2); ctx.stroke(); ctx.globalAlpha=dimA; }
    if(st.hatch!=='none'&&lw>=5){ ctx.strokeStyle=C.surface; ctx.lineWidth=1; ctx.setLineDash([2,3]); ctx.beginPath(); ctx.moveTo(G.x1,G.y1); ctx.lineTo(G.x2,G.y2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.lineCap='butt'; ctx.globalAlpha=1; });
  // selection halo
  const sel=T.shapes.find(s=>s.r.k===S.sel);
  if(sel){ ctx.strokeStyle=C.accent; ctx.globalAlpha=.35;
    if(sel.k==='rect'){ ctx.lineWidth=4; ctx.strokeRect(sel.x-2,sel.y-2,sel.w+4,sel.h+4); }
    else { ctx.lineWidth=14; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(sel.x1,sel.y1); ctx.lineTo(sel.x2,sel.y2); ctx.stroke(); ctx.lineCap='butt'; }
    ctx.globalAlpha=1; }
  // labels along the work
  if(S.tld.labels!=='off'){ const placed=[], hit=(b)=>placed.some(q=>b.x<q.x+q.w&&b.x+b.w>q.x&&b.y<q.y+q.h&&b.y+b.h>q.y);
    ctx.font=FONT(600,11); ctx.lineJoin='round';
    const txt=r=>S.tld.labels==='id'?r.code:S.tld.labels==='name'?r.name:`${r.code} ${r.name}`;
    const order=T.shapes.slice().sort((a,b)=>(b.r.crit-a.r.crit)||(b.r.k===S.sel)-(a.r.k===S.sel));
    order.forEach(G=>{ const t=txt(G.r); let w=ctx.measureText(t).width; const h=12;
      const put=(cx,cy,ang,maxW)=>{ let s2=t; if(w>maxW){ s2=fit(ctx,t,maxW); if(!s2||s2.length<3) return; } const ww=ctx.measureText(s2).width, c=Math.abs(Math.cos(ang)), sn=Math.abs(Math.sin(ang));
        const bb={x:cx-(ww*c+h*sn)/2,y:cy-(ww*sn+h*c)/2,w:ww*c+h*sn,h:ww*sn+h*c}; if(hit(bb)) return; placed.push(bb);
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang); ctx.strokeStyle=C.surface2; ctx.lineWidth=3; ctx.strokeText(s2,-ww/2,4); ctx.fillStyle=G.r.crit?C.accent:C.ink; ctx.fillText(s2,-ww/2,4); ctx.restore(); };
      if(G.k==='line'){ const dx=G.x2-G.x1, dy=G.y2-G.y1, len=Math.hypot(dx,dy); if(len<30) return; let ang=Math.atan2(dy,dx); if(ang>Math.PI/2) ang-=Math.PI; if(ang<-Math.PI/2) ang+=Math.PI;
        const nx=-Math.sin(ang), ny=Math.cos(ang), off=-(G.r.L?styleOf(G.r).width/2+8:9); put((G.x1+G.x2)/2+nx*off,(G.y1+G.y2)/2+ny*off,ang,len-12); }
      else if(G.k==='rect'){ if(G.bar){ if(vert){ if(G.h>40) put(G.x+G.w+9,G.y+G.h/2,-Math.PI/2,G.h-6); } else if(G.w>40) put(G.x+G.w/2,G.y-7,0,G.w-6); }
        else if(G.w>34&&G.h>16) put(G.x+Math.min(G.w,w+8)/2+2,G.y+10,0,G.w-8); }
      else if(G.k==='pt') put(G.x1+10+Math.min(w,120)/2,G.y1,0,120); }); }
  // clashes
  if(S.tld.clash&&!band){ T.clashes=computeClashes(items,ext); T.clashes.forEach((c,i)=>{ const [x,y]=P(c.l,c.t); c.x=x; c.y=y; const on=T.clashSel===i;
      ctx.strokeStyle=C.late; ctx.lineWidth=on?3:2; ctx.fillStyle=C.surface; ctx.beginPath(); ctx.arc(x,y,on?11:8,0,7); ctx.globalAlpha=.9; ctx.fill(); ctx.globalAlpha=1; ctx.stroke();
      ctx.fillStyle=C.late; ctx.font=FONT(800,11); ctx.textAlign='center'; ctx.fillText('!',x,y+4); ctx.textAlign='left'; }); }
  if(dd!=null){ const [ax,ay]=P(V.l0,dd),[bx,by2]=P(V.l1,dd); ctx.strokeStyle=C.accent; ctx.lineWidth=1.5; ctx.setLineDash([6,4]); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by2); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  // axes
  mts.forEach(t=>{ const d=new Date(t), jan=d.getUTCMonth()===0, lab=jan||step>=12?String(d.getUTCFullYear()):MON[d.getUTCMonth()]+' '+String(d.getUTCFullYear()).slice(2);
    ctx.font=FONT(jan?700:500,11); ctx.fillStyle=jan?C.ink:C.ink2;
    if(vert){ const [,y]=P(V.l0,t); if(y>=pl.y0-2&&y<=pl.y1){ ctx.textAlign='right'; ctx.fillText(lab,pl.x0-8,y+4); } }
    else { const [x]=P(V.l0,t); if(x>=pl.x0-2&&x<=pl.x1-20){ ctx.textAlign='left'; ctx.fillText(lab,x+4,pl.y0-10); } } });
  ctx.textAlign='left';
  const AX=vert?pl.y0-SB-GAP:pl.x0-SB-GAP;
  if(band){ acc.vals.forEach((v,i)=>{ const [ax,ay]=P(i,V.t0),[bx,by2]=P(i+1,V.t0);
      if(vert){ const x0=Math.max(ax,pl.x0), x1=Math.min(bx,pl.x1), w=x1-x0; if(w<14) return; const cx=(x0+x1)/2; ctx.textAlign='center';
        ctx.font=FONT(700,12,true); ctx.fillStyle=C.ink; setLS(ctx,'0.5px'); ctx.fillText(fit(ctx,v.short.toUpperCase(),w-6),cx,AX-30); setLS(ctx,'0px');
        ctx.font=FONT(500,11); ctx.fillStyle=C.ink2; ctx.fillText(fit(ctx,v.name,w-6),cx,AX-14); }
      else { const y0=Math.max(ay,pl.y0), y1=Math.min(by2,pl.y1), h=y1-y0; if(h<12) return; const cy=(y0+y1)/2; ctx.textAlign='right';
        ctx.font=FONT(700,12,true); ctx.fillStyle=C.ink; const sw=ctx.measureText(v.short).width; ctx.fillText(v.short,AX-8,cy+4);
        ctx.font=FONT(500,11); ctx.fillStyle=C.ink2; ctx.fillText(fit(ctx,v.name,AX-28-sw),AX-14-sw,cy+4); } });
    ctx.textAlign='left'; }
  else { ctx.font=FONT(500,11); ctx.fillStyle=C.ink2;
    lts.forEach(v=>{ const [x,y]=P(v,V.t0); const lab=fmtCh(v,lst);
      if(vert){ if(x<pl.x0-1||x>pl.x1+1) return; ctx.textAlign='center'; ctx.fillText(lab,x,AX-10); }
      else { if(y<pl.y0-1||y>pl.y1+1) return; ctx.textAlign='right'; ctx.fillText(lab,AX-8,y+4); } });
    ctx.textAlign='left'; ctx.font=FONT(700,11); ctx.fillStyle=C.ink3; setLS(ctx,'0.8px');
    const ttl=(acc.label||'Location').toUpperCase();
    if(vert) ctx.fillText(fit(ctx,ttl+' →',pl.x1-pl.x0),pl.x0,Math.max(14,AX-28)); else ctx.fillText(fit(ctx,ttl,Math.max(40,AX-12)),8,16);
    setLS(ctx,'0px');
    ctx.save(); ctx.beginPath(); ctx.rect(pl.x0,pl.y0,pl.x1-pl.x0,pl.y1-pl.y0); ctx.clip();
    ovVals.forEach(v=>{ const g=ovMap[v.short], lo=Math.min(g[0],g[1]), hi=Math.max(g[0],g[1]); const [ax,ay]=P(lo,V.t0),[bx,by2]=P(hi,V.t0);
      ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.setLineDash([2,3]); const [ex,ey]=P(lo,V.t1); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ex,ey); ctx.stroke(); ctx.setLineDash([]);
      ctx.font=FONT(700,11,true); ctx.fillStyle=C.ink3; setLS(ctx,'0.4px');
      if(vert){ const x0=Math.max(ax,pl.x0), x1=Math.min(bx,pl.x1); if(x1-x0>18){ ctx.textAlign='center'; ctx.fillText(fit(ctx,v.short.toUpperCase(),x1-x0-6),(x0+x1)/2,pl.y1-8); } }
      else { const y0=Math.max(ay,pl.y0), y1=Math.min(by2,pl.y1); if(y1-y0>12){ ctx.textAlign='right'; ctx.fillText(fit(ctx,v.short.toUpperCase(),80),pl.x1-6,(y0+y1)/2+4); } }
      setLS(ctx,'0px'); ctx.textAlign='left'; });
    ctx.restore(); }
  if(dd!=null){ const [x,y]=P(V.l0,dd); ctx.font=FONT(700,10); const lab='DD '+fmtD(dd).toUpperCase(), w=ctx.measureText(lab).width+10;
    if(vert&&y>pl.y0&&y<pl.y1){ ctx.fillStyle=C.accent; rr(ctx,pl.x0+4,y-17,w,15,7.5); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText(lab,pl.x0+9,y-6); }
    if(!vert&&x>pl.x0&&x<pl.x1){ ctx.fillStyle=C.accent; rr(ctx,x+4,pl.y0+4,w,15,7.5); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText(lab,x+9,pl.y0+15); } }
  ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.strokeRect(pl.x0+.5,pl.y0+.5,pl.x1-pl.x0-1,pl.y1-pl.y0-1);
  const fI=document.getElementById('cChF'), tI=document.getElementById('cChT');
  if(fI&&!band&&document.activeElement!==fI) fI.value=fmtCh(V.l0,lst/10); if(tI&&!band&&document.activeElement!==tI) tI.value=fmtCh(V.l1,lst/10);
  renderClashes();
}
function renderClashes(){
  const el=document.getElementById('clashList'); if(!el) return;
  const on=S.tab==='tld'&&S.tld.clash&&T.acc&&T.acc.kind==='num'; el.hidden=!on; if(!on) return;
  const cl=T.clashes||[], bm=+S.tld.bufM||0;
  el.innerHTML=`<div class="clh"><span class="sl">Clashes</span><b class="${cl.length?'late':'early'}">${cl.length}</b><span class="pn">Incomplete activities with no direct logic link that ${bm>0?`come within ${Math.round(bm)} m of each other`:'overlap or cross at the same place and time'}${+S.tld.bufD?`, allowing a ${S.tld.bufD}-day time buffer`:''}. Route-wide activities are skipped.</span></div>
    ${cl.length?`<div class="cll">${cl.slice(0,200).map((c,i)=>`<button class="clr${T.clashSel===i?' on':''}" data-clash="${i}"><span class="cli">!</span><span class="clp"><b>${esc(c.a.code)}</b> ${esc(c.a.name)}<br><b>${esc(c.b.code)}</b> ${esc(c.b.name)}</span><span class="clm">${fmtCh(c.l)}<br>${fmtD(c.t)}</span><span class="clm">${c.d<1?'Overlap':Math.round(c.d)+' m'}</span></button>`).join('')}</div>${cl.length>200?`<div class="note">Showing 200 of ${cl.length}.</div>`:''}`:'<p class="muted" style="margin:6px 0 0;font-size:13px">No crews within the buffer. Increase the buffer under Display to test tighter working.</p>'}`;
}
function dseg(px,py,x1,y1,x2,y2){ const dx=x2-x1,dy=y2-y1,L=dx*dx+dy*dy; let t=L?((px-x1)*dx+(py-y1)*dy)/L:0; t=Math.max(0,Math.min(1,t)); const X=x1+t*dx-px,Y=y1+t*dy-py; return Math.hypot(X,Y); }
function tHit(x,y){ for(let i=T.shapes.length-1;i>=0;i--){ const s=T.shapes[i]; if(s.k==='rect'){ if(x>=s.x-2&&x<=s.x+s.w+2&&y>=s.y-2&&y<=s.y+s.h+2) return s.r; } else if(dseg(x,y,s.x1,s.y1,s.x2,s.y2)<=(s.k==='pt'?8:6)) return s.r; } return null; }
function tFrac(x,y){ const p=T.plot; const fx=(x-p.x0)/(p.x1-p.x0), fy=(y-p.y0)/(p.y1-p.y0); return T.vert?{fl:fx,ft:fy}:{fl:fy,ft:fx}; }

