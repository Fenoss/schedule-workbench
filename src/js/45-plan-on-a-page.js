/* ---------------- Executive plan on a page ---------------- */
const EX_SIZES={
  fit:{label:'Fit to screen',note:'grows with your window'},
  ppt169:{label:'PowerPoint 16:9',w:1280,h:720,in:'13.33 × 7.5 in',note:'fills a widescreen slide (13.33 × 7.5 in)'},
  ppt43:{label:'PowerPoint 4:3',w:960,h:720,in:'10 × 7.5 in',note:'fills a standard slide (10 × 7.5 in)'},
  wa4p:{label:'Word A4 portrait',w:602,h:930,note:'fits the page inside 2.54 cm margins (15.9 × 24.6 cm)'},
  wa4l:{label:'Word A4 landscape',w:930,h:602,note:'fits the page inside 2.54 cm margins (24.6 × 15.9 cm)'},
  wltp:{label:'Word Letter portrait',w:624,h:864,note:'fits the page inside 1 in margins (6.5 × 9 in)'},
  wltl:{label:'Word Letter landscape',w:864,h:624,note:'fits the page inside 1 in margins (9 × 6.5 in)'},
  a3l:{label:'A3 landscape',w:1588,h:1123,note:'full sheet, 420 × 297 mm'},
  a4l:{label:'A4 landscape',w:1123,h:794,note:'full sheet, 297 × 210 mm'},
  tabl:{label:'Tabloid 11 × 17 landscape',w:1632,h:1056,note:'full sheet, 17 × 11 in'}};
function exSave(){ try{ localStorage.setItem('pacer.exec',JSON.stringify(S.ex)); }catch(_){} }
function exLoad(){ try{ const e=JSON.parse(localStorage.getItem('pacer.exec')||'null'); if(e&&Array.isArray(e.rows)) Object.assign(S.ex,e); }catch(_){} }
function exMembers(row){ const R=row.rule; if(!R) return [];
  if(R.type==='wbs') return M.rows.filter(r=>r.wkeys.includes(R.key));
  if(R.type==='code') return M.rows.filter(r=>r.codes[R.t]===R.v);
  if(R.type==='keys'){ const set=new Set(R.keys); return M.rows.filter(r=>set.has(r.k)); }
  return []; }
function exSources(){ const out=[]; const maxD=Math.max(0,...[...M.wbs.values()].map(n=>n.depth)); for(let d=0;d<=Math.min(maxD,4);d++) out.push(['wbs:'+d,d===0?'WBS: projects':`WBS level ${d+1}`]); M.codeTypes.forEach(t=>out.push(['code:'+t,'Code: '+t])); return out; }
function exDefaultSource(){ const t=M.codeTypes.find(x=>/disc|workstream|package|trade|phase|area/i.test(x)); if(t) return 'code:'+t; const maxD=Math.max(0,...[...M.wbs.values()].map(n=>n.depth)); return 'wbs:'+Math.min(1,maxD); }
function exBuild(src){
  const rows=[]; let i=0;
  if(src.startsWith('wbs:')){ const d=+src.slice(4); const walk=(n,root)=>{ if(n.depth===d){ rows.push({id:uid(),label:n.label,group:d>0?root.label:'',rule:{type:'wbs',key:n.key},color:PAL[i++%PAL.length]}); return; } n.children.forEach(c=>walk(c,root)); }; M.roots.forEach(r=>walk(r,r)); }
  else { const t=src.slice(5), cnt=M.codeCount[t]||{}; (M.codeOrder[t]||[]).forEach(o=>{ if(!cnt[o.short]) return; const mem=M.rows.filter(r=>r.codes[t]===o.short); if(mem.every(r=>r.ms)) return; rows.push({id:uid(),label:o.name||o.short,group:'',rule:{type:'code',t,v:o.short},color:PAL[i++%PAL.length]}); }); }
  return rows; }
function exInit(){ if(S.ex.init&&S.ex.rows.length) return; S.ex.rows=exBuild(exDefaultSource()); const ms=M.rows.filter(r=>r.ms&&!/interface/i.test(r.name)&&!Object.keys(r.codes).some(t=>/interface/i.test(t))); S.ex.ms=(ms.length<=8?ms:ms.filter(r=>r.L&&r.L.type==='TT_FinMile').slice(0,8)).map(r=>r.k);
  if(!S.ex.title) S.ex.title=(M.projs.length===1?M.projs[0]:'Programme')+' plan on a page'; S.ex.init=true; exSave(); }
function exStats(mem){ const o={n:mem.length,s:Infinity,f:-Infinity,bs:Infinity,bf:-Infinity,w:0,wd:0,done:0};
  mem.forEach(r=>{ if(r.L&&r.s!=null){ o.s=Math.min(o.s,r.s); o.f=Math.max(o.f,r.f); const dur=Math.max(1,(r.f-r.s)/DAY); if(!r.ms){ o.w+=dur; o.wd+=dur*(r.status==='TK_Complete'?1:(r.L.pct||0)/100); } if(r.status==='TK_Complete') o.done++; }
    if(r.B&&r.bs!=null){ o.bs=Math.min(o.bs,r.bs); o.bf=Math.max(o.bf,r.bf); } });
  o.pct=o.w?Math.round(o.wd/o.w*100):null; o.hasL=isFinite(o.s); o.hasB=isFinite(o.bs); o.varF=o.hasL&&o.hasB?dd(o.f-o.bf):null; return o; }
function exRag(v){ if(v==null) return 'na'; return v<=S.ex.green?'g':v<=S.ex.amber?'a':'r'; }
function renderExec(){
  if(document.getElementById('execWrap').hidden||!M) return;
  if(!M.rows.length){ document.getElementById('exPage').innerHTML='<div class="dq-empty"><h3>No schedule loaded</h3><p>Add XER files to build a plan on a page.</p><button class="btn primary" data-open-files>Open files</button></div>'; return; }
  exInit(); exRenderPage(); if(!document.getElementById('exBuild').hidden) exRenderBuilder();
}
function exRenderPage(){
  const host=document.getElementById('exPage'), E=S.ex, RAGC={g:C.early,a:'#E0A100',r:C.late,na:C.ink3};
  const rows=E.rows.map(row=>({row,mem:exMembers(row)})).map(x=>({...x,st:exStats(x.mem)}));
  const msRows=E.ms.map(k=>M.byKey.get(k)).filter(Boolean);
  let t0=Infinity,t1=-Infinity; rows.forEach(({st})=>{ [st.s,st.f,E.showBase?st.bs:NaN,E.showBase?st.bf:NaN].forEach(t=>{ if(isFinite(t)){ t0=Math.min(t0,t); t1=Math.max(t1,t); } }); });
  msRows.forEach(r=>{ [r.L?r.f:NaN,E.showBase?r.bf:NaN].forEach(t=>{ if(isFinite(t)){ t0=Math.min(t0,t); t1=Math.max(t1,t); } }); });
  const ifKeys=new Set(E.ifcs||[]), ifSel=ifKeys.size?ifcList().filter(I=>ifKeys.has(I.g.k+'>'+I.r.k)).map(I=>({...I,ev:ifcEval(I)})):[];
  ifSel.forEach(I=>[I.ev.gF,I.ev.need].forEach(t=>{ if(t!=null){ t0=Math.min(t0,t); t1=Math.max(t1,t); } }));
  if(!isFinite(t0)){ t0=M.t0; t1=M.t1; }
  t0=Date.UTC(new Date(t0).getUTCFullYear(),new Date(t0).getUTCMonth(),1); t1=Date.UTC(new Date(t1).getUTCFullYear(),new Date(t1).getUTCMonth()+1,1);
  const TL=E.tl||(E.tl={from:'',to:'',scale:'auto'}), tf=parseDay(TL.from), tt=parseDay(TL.to);
  if(tf!=null) t0=tf*DAY; if(tt!=null) t1=(tt+1)*DAY; if(t1-t0<14*DAY){ t1=t0+14*DAY; }
  const vis=(a,b)=>a!=null&&b!=null&&b>=t0&&a<=t1, inR=t=>t!=null&&t>=t0&&t<=t1, CLt=t=>Math.max(t0,Math.min(t1,t));
  const CP=E.cp?cpSet():null, cpInfo=E.cp?cpCache.info:null;
  const mergeIv=list=>{ const iv=list.filter(r=>r.L&&r.s!=null&&!r.ms).map(r=>[r.s,r.f]).sort((a,b)=>a[0]-b[0]), m=[]; iv.forEach(([a,b])=>{ const l=m[m.length-1]; if(l&&a<=l[1]+DAY*1.5) l[1]=Math.max(l[1],b); else m.push([a,b]); }); return m; };
  const cpAll=CP?M.rows.filter(r=>CP.has(r.k)):[];
  document.getElementById('exCpOpt').innerHTML=E.cp?`<select id="exCpBy" aria-label="Critical path definition" class="exsel"><option value="float"${S.cp.by==='float'?' selected':''}>Total float ≤</option><option value="long"${S.cp.by==='long'?' selected':''}>Longest path</option></select>${S.cp.by==='float'?` <input id="exCpThr" class="tvi" value="${S.cp.thr}" inputmode="decimal" aria-label="Float threshold in days"> <span class="muted">days</span>`:''}`:'';
  const build=(W,Hfix,rowH)=>{
  const pad=24, LW=Math.round(Math.min(290,W*0.25)), RW=150, x0=pad+LW, x1=W-pad-RW, X=t=>x0+(t-t0)/(t1-t0)*(x1-x0);
  const F="Barlow, 'Segoe UI', system-ui, sans-serif", FC="'Barlow Condensed','Arial Narrow', system-ui, sans-serif";
  const chw=(sz,str)=>String(str).length*sz*0.52;
  const clip=(str,sz,w)=>{ str=String(str); if(chw(sz,str)<=w) return str; let n=Math.max(1,Math.floor(w/(sz*0.52))-1); return str.slice(0,n)+'…'; };
  // milestone tiers
  const rowIds=new Set(E.rows.map(r=>r.id)), placedOn=k=>{ const id=(E.msRow||{})[k]; return id&&rowIds.has(id)?id:null; };
  const msItems=msRows.filter(r=>(r.f!=null||r.bf!=null)&&!placedOn(r.k)&&inR(r.L&&r.f!=null?r.f:r.bf)).map(r=>({r,x:X(r.L&&r.f!=null?r.f:r.bf)})).sort((a,b)=>a.x-b.x), tiers=[];
  msItems.forEach(m=>{ const w=Math.max(chw(11.5,m.r.name),chw(10.5,'00 Mmm 00 +000d'))+14; let ti=tiers.findIndex(end=>end<m.x-4); if(ti<0){ if(tiers.length<4){ tiers.push(0); ti=tiers.length-1; } else ti=tiers.indexOf(Math.min(...tiers)); }
    m.tier=ti; m.flip=m.x+w>x1+RW-4; tiers[ti]=m.flip?m.x+4:m.x+w; });
  const titleH=78, scaleH=44, msH=msItems.length?28+Math.max(1,tiers.length)*30:0, grpH=26;
  const groups=[]; rows.forEach(x=>{ const g=x.row.group||''; let G=groups[groups.length-1]; if(!G||G.name!==g){ G={name:g,items:[]}; groups.push(G); } G.items.push(x); });
  const cpH=CP?rowH:0, bodyH=cpH+groups.reduce((a,g)=>a+(g.name?grpH:0)+g.items.length*rowH,0), legH=W<1150?62:44;
  const ifRH=rowH<34?20:24, ifH=ifSel.length?30+ifSel.length*ifRH:0;
  const yScale=titleH, yMs=yScale+scaleH, yIf=yMs+msH, yBody=yIf+ifH, H=Hfix?Math.max(Hfix,yBody+bodyH+legH+8):yBody+bodyH+legH+8;
  const out=[]; const T=(x,y,str,o={})=>out.push(`<text x="${x}" y="${y}" font-family="${o.c?FC:F}" font-size="${o.s||12}" font-weight="${o.w||400}" fill="${o.f||C.ink}"${o.a?` text-anchor="${o.a}"`:''}${o.ls?` letter-spacing="${o.ls}"`:''}>${esc(str)}</text>`);
  out.push(`<rect width="${W}" height="${H}" fill="${C.surface}"/>`);
  // title
  const live=rows.reduce((a,x)=>Math.max(a,isFinite(x.st.f)?x.st.f:-Infinity),-Infinity), base=rows.reduce((a,x)=>Math.max(a,isFinite(x.st.bf)?x.st.bf:-Infinity),-Infinity), ov=isFinite(live)&&isFinite(base)?dd(live-base):null;
  T(pad,36,E.title.toUpperCase(),{c:1,s:26,w:700,ls:'0.4'});
  T(pad,58,`Data date ${fmtL(M.dd)}  ·  Baseline data date ${fmtL(M.bdd)}  ·  Forecast completion ${isFinite(live)?fmtL(live):'—'}${ov!=null?` (${ov===0?'on baseline':sgn(ov)+' days'})`:''}`,{s:12.5,f:C.ink2});
  const cnt={g:0,a:0,r:0}; rows.forEach(x=>{ const k=exRag(x.st.varF); if(cnt[k]!=null) cnt[k]++; });
  let px=W-pad; [['r','Red'],['a','Amber'],['g','Green']].forEach(([k,l])=>{ const lab=`${cnt[k]} ${l}`, w=String(lab).length*12*0.62+30; px-=w; out.push(`<rect x="${px}" y="22" width="${w-6}" height="24" rx="12" fill="${RAGC[k]}" fill-opacity="0.14"/><circle cx="${px+12}" cy="34" r="4.5" fill="${RAGC[k]}"/>`); T(px+21,38.5,lab,{s:12,w:700,f:RAGC[k]}); });
  // timescale
  const months=(t1-t0)/DAY/30.4, autoMode=months>48?'y':months>16?'q':months>4?'m':'w', mode={years:'y',quarters:'q',months:'m',weeks:'w'}[TL.scale]||autoMode;
  const yrs=mode==='w'?monthTicks(t0,t1,1):monthTicks(t0,t1,12), subs=mode==='w'?weekTicks(t0,t1):monthTicks(t0,t1,mode==='m'?1:3);
  const topLab=t=>{ const d=new Date(Math.max(t,t0)); return mode==='w'?MON[d.getUTCMonth()]+' '+d.getUTCFullYear():String(d.getUTCFullYear()); };
  yrs.forEach((t,i)=>{ const a=Math.max(x0,X(t)), b=Math.min(x1,X(yrs[i+1]??t1)); if(b<=a) return; if(i%2===0) out.push(`<rect x="${a}" y="${yScale}" width="${b-a}" height="${H-yScale-legH}" fill="${C.surface2}"/>`); });
  out.push(`<line x1="${x0}" x2="${x1}" y1="${yScale+20}" y2="${yScale+20}" stroke="${C.line}"/><line x1="${pad}" x2="${W-pad}" y1="${yScale+scaleH}" y2="${yScale+scaleH}" stroke="${C.line}"/>`);
  yrs.forEach((t,i)=>{ const a=Math.max(x0,X(t)), b=Math.min(x1,X(yrs[i+1]??t1)); if(b-a<24) return; T((a+b)/2,yScale+15,topLab(t),{s:12.5,w:700,a:'middle'}); if(t>=t0) out.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${yScale}" y2="${H-legH}" stroke="${C.line}"/>`); });
  if(mode!=='y') subs.forEach((t,i)=>{ const a=X(t), b=X(subs[i+1]??t1); if(t<t0) return; out.push(`<line x1="${a}" x2="${a}" y1="${yScale+20}" y2="${H-legH}" stroke="${C.grid}"/>`); const d=new Date(t), lab=mode==='w'?p2(d.getUTCDate()):mode==='m'?MON[d.getUTCMonth()].slice(0,b-a<26?1:3):'Q'+(d.getUTCMonth()/3+1); if(b-a>12) T((a+b)/2,yScale+37,lab,{s:11,f:C.ink2,a:'middle'}); });
  T(pad,yScale+37,'WORKSTREAM',{s:10.5,w:700,f:C.ink3,ls:'0.8'}); T(x1+16,yScale+37,'FORECAST',{s:10.5,w:700,f:C.ink3,ls:'0.8'}); T(W-pad,yScale+37,'VS BL',{s:10.5,w:700,f:C.ink3,ls:'0.8',a:'end'});
  // milestones lane
  if(msH){ T(pad,yMs+22,'KEY MILESTONES',{s:10.5,w:700,f:C.ink3,ls:'0.8'});
    msItems.forEach(m=>{ const r=m.r, y=yMs+20+m.tier*30, cx=m.x, v=r.varF, k=exRag(v), done=r.status==='TK_Complete';
      if(E.showBase&&r.bf!=null&&r.L&&r.f!=null&&Math.abs(X(CLt(r.bf))-cx)>2){ const bx=X(CLt(r.bf)); out.push(`<line x1="${bx}" x2="${cx}" y1="${y}" y2="${y}" stroke="${C.base}" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M${bx} ${y-6}L${bx+6} ${y}L${bx} ${y+6}L${bx-6} ${y}Z" fill="${C.surface}" stroke="${C.base}" stroke-width="1.5"/>`); }
      if(CP&&CP.has(r.k)) out.push(`<circle cx="${cx}" cy="${y}" r="11" fill="none" stroke="${C.accent}" stroke-width="2"/>`);
      out.push(`<g class="exms" data-k="${esc(r.k)}"><title>${esc(r.name)}: forecast ${fmtL(r.L?r.f:null)}, baseline ${fmtL(r.bf)}</title><path d="M${cx} ${y-7}L${cx+7} ${y}L${cx} ${y+7}L${cx-7} ${y}Z" fill="${done?C.ink:r.L?RAGC[k]:C.base}" stroke="${C.surface}" stroke-width="1.5"/>`);
      const rg=CP&&CP.has(r.k)?15:11, tx=m.flip?cx-rg:cx+rg, an=m.flip?'end':'start';
      T(tx,y-1,clip(r.name,11.5,220),{s:11.5,w:600,a:an}); T(tx,y+12,`${fmtD(r.L?r.f:r.bf)}${done?' · achieved':v!=null&&v!==0?' · '+sgn(v)+'d':''}`,{s:10.5,f:done?C.ink2:v>0?RAGC[k]:C.ink2,a:an}); out.push('</g>'); });
    out.push(`<line x1="${pad}" x2="${W-pad}" y1="${yIf}" y2="${yIf}" stroke="${C.line}"/>`); }
  if(ifH){ T(pad,yIf+20,'INTERFACE HANDOVERS',{s:10.5,w:700,f:C.ink3,ls:'0.8'});
    ifSel.forEach((I,i)=>{ const e=I.ev, cy=yIf+30+i*ifRH+ifRH/2-2, k=e.rag==='na'?'na':e.rag, col=RAGC[k], done=I.g.status==='TK_Complete';
      T(pad+8,cy+4,clip(`${I.id}  ${I.g.proj} → ${I.r.proj}`,11.5,LW-16),{s:11.5,w:600,f:C.ink2});
      out.push(`<g class="exms" data-k="${esc(I.g.k)}"><title>${esc(I.id)}: ${esc(I.g.name)} forecast ${fmtL(e.gF)}; ${esc(I.r.name)} needed ${fmtL(e.need)}</title>`);
      if(e.gF!=null&&e.need!=null&&vis(Math.min(e.gF,e.need),Math.max(e.gF,e.need))){ const a=X(CLt(e.gF)), b=X(CLt(e.need)); out.push(`<line x1="${Math.min(a,b)}" x2="${Math.max(a,b)}" y1="${cy}" y2="${cy}" stroke="${col}" stroke-width="${e.margin<0?3:2}" ${e.margin<0?'':'stroke-dasharray="4 3"'} stroke-opacity="${e.margin<0?0.9:0.6}"/>`); }
      if(inR(e.need)){ const b=X(e.need); out.push(`<rect x="${b-1.5}" y="${cy-8}" width="3" height="16" rx="1.5" fill="${C.ink}"/>`); }
      if(inR(e.gF)){ const a=X(e.gF); out.push(`<path d="M${a} ${cy-6.5}L${a+6.5} ${cy}L${a} ${cy+6.5}L${a-6.5} ${cy}Z" fill="${done?C.ink:col}" stroke="${C.surface}" stroke-width="1.3"/>`); }
      const xr=Math.max(e.gF!=null?X(CLt(e.gF)):0,e.need!=null?X(CLt(e.need)):0)+12; const lab=e.margin==null?'—':(done?(e.margin<0?`handed over ${-e.margin}d late`:'handed over'):e.margin<0?`${-e.margin}d late`:`${e.margin}d margin`);
      if(xr<x1-10) T(xr,cy+4,lab,{s:10.5,w:600,f:done&&e.margin>=0?C.ink2:col}); else T(Math.min(e.gF!=null?X(CLt(e.gF)):x1,e.need!=null?X(CLt(e.need)):x1)-12,cy+4,lab,{s:10.5,w:600,f:col,a:'end'});
      out.push('</g>'); });
    out.push(`<line x1="${pad}" x2="${W-pad}" y1="${yBody}" y2="${yBody}" stroke="${C.line}"/>`); }
  // rows
  let y=yBody; const msSet=new Set(E.ms);
  if(CP){ const cy=y+rowH/2, segs=mergeIv(cpAll), fin=cpInfo&&cpInfo.fin;
    out.push(`<rect x="${pad}" y="${y}" width="${W-2*pad}" height="${rowH}" fill="${C.accentSoft}" fill-opacity="0.55"/><rect x="${pad}" y="${y+5}" width="3" height="${rowH-10}" rx="1.5" fill="${C.accent}"/>`);
    if(rowH<34) T(pad+10,cy+4.5,'Critical path',{s:13,w:700,f:C.accent}); else { T(pad+10,cy-2,'Critical path',{s:13.5,w:700,f:C.accent}); T(pad+10,cy+13,`${cpAll.length} activities · ${S.cp.by==='float'?`float ≤ ${S.cp.thr}d`:'longest path'}${fin&&fin.tf!=null?` · float ${Math.round(fin.tf)}d`:''}`,{s:11,f:C.ink2}); }
    segs.forEach(([a,b],i)=>{ if(!vis(a,b)) return; const xa=X(CLt(a)), xb=X(CLt(b)); out.push(`<rect x="${xa}" y="${cy-5}" width="${Math.max(3,xb-xa)}" height="10" rx="5" fill="${C.accent}"/>`); if(i&&vis(segs[i-1][1],a)){ const pb=X(CLt(segs[i-1][1])); out.push(`<line x1="${pb}" x2="${xa}" y1="${cy}" y2="${cy}" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="3 3"/>`); } });
    cpAll.filter(r=>r.ms&&r.L&&inR(r.f)).forEach(r=>{ const mx=X(r.f); out.push(`<path d="M${mx} ${cy-8}L${mx+8} ${cy}L${mx} ${cy+8}L${mx-8} ${cy}Z" fill="${C.accent}" stroke="${C.surface}" stroke-width="1.5"/>`); });
    T(x1+16,cy+4,fin?fmtD(fin.f):'—',{s:12.5,w:600,f:C.accent});
    if(fin&&fin.varF!=null){ const k=exRag(fin.varF), lab=fin.varF===0?'On time':sgn(fin.varF)+'d', cw=chw(11.5,lab)+16; out.push(`<rect x="${W-pad-cw}" y="${cy-10}" width="${cw}" height="20" rx="10" fill="${RAGC[k]}" fill-opacity="0.16"/>`); T(W-pad-cw/2,cy+4,lab,{s:11.5,w:700,f:RAGC[k],a:'middle'}); }
    out.push(`<line x1="${pad}" x2="${W-pad}" y1="${y+rowH}" y2="${y+rowH}" stroke="${C.line}"/>`); y+=rowH; }
  groups.forEach(g=>{ if(g.name){ out.push(`<rect x="${pad}" y="${y}" width="${W-2*pad}" height="${grpH}" fill="${C.band}"/>`); T(pad+8,y+17,g.name.toUpperCase(),{s:11.5,w:700,f:C.ink2,ls:'0.6'}); y+=grpH; }
    g.items.forEach(({row,mem,st})=>{ const k=exRag(st.varF), col=E.color==='rag'?RAGC[k]:(row.color||C.bar), cy=y+rowH/2;
      out.push(`<line x1="${pad}" x2="${W-pad}" y1="${y+rowH}" y2="${y+rowH}" stroke="${C.grid}"/>`);
      if(CP&&mem.some(r=>CP.has(r.k))) out.push(`<rect x="${pad}" y="${y+7}" width="3" height="${rowH-14}" rx="1.5" fill="${C.accent}"/>`);
      if(rowH<34){ T(pad+8,cy+4.5,clip(row.label,13,LW-20),{s:13,w:600}); } else { T(pad+8,cy-2,clip(row.label,13.5,LW-20),{s:13.5,w:600}); T(pad+8,cy+13,`${st.n} activities${E.pct&&st.pct!=null?` · ${st.pct}% complete`:''}`,{s:11,f:C.ink3}); }
      out.push(`<g class="exrow" data-row="${row.id}"><title>${esc(row.label)}: ${fmtL(st.hasL?st.s:null)} → ${fmtL(st.hasL?st.f:null)}${st.hasB?` · baseline ${fmtL(st.bs)} → ${fmtL(st.bf)}`:''}. Click to open in the Gantt.</title><rect x="${pad}" y="${y}" width="${W-2*pad}" height="${rowH}" fill="transparent"/>`);
      if(E.showBase&&st.hasB&&vis(st.bs,st.bf)){ const a=X(CLt(st.bs)), b=X(CLt(st.bf)); out.push(`<rect x="${a}" y="${cy+8}" width="${Math.max(3,b-a)}" height="5" rx="2.5" fill="${C.base}"/>`); }
      if(st.hasL&&!vis(st.s,st.f)){ const left=st.f<t0, ax=left?x0+4:x1-4; out.push(`<path d="M${ax+(left?6:-6)} ${cy-8}L${ax} ${cy-2.5}L${ax+(left?6:-6)} ${cy+3}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round"/>`); T(left?ax+10:ax-10,cy+1,left?'earlier':'later',{s:10.5,f:C.ink3,a:left?'start':'end'}); }
      if(st.hasL&&vis(st.s,st.f)){ const a=X(CLt(st.s)), b=X(CLt(st.f)), w=Math.max(4,b-a), by=cy-10, bh=15;
        out.push(`<rect x="${a}" y="${by}" width="${w}" height="${bh}" rx="4" fill="${col}" fill-opacity="${E.pct?0.38:0.9}"/>`);
        if(E.pct&&st.pct){ const pe=st.s+(st.f-st.s)*st.pct/100; if(pe>t0) out.push(`<rect x="${a}" y="${by}" width="${Math.max(3,X(CLt(pe))-a)}" height="${bh}" rx="4" fill="${col}"/>`); }
        if(st.s<t0) out.push(`<path d="M${a+9} ${by+2}L${a+4} ${by+bh/2}L${a+9} ${by+bh-2}" fill="none" stroke="${C.surface}" stroke-width="2" stroke-linecap="round"/>`);
        if(st.f>t1) out.push(`<path d="M${b-9} ${by+2}L${b-4} ${by+bh/2}L${b-9} ${by+bh-2}" fill="none" stroke="${C.surface}" stroke-width="2" stroke-linecap="round"/>`);
        if(CP){ mergeIv(mem.filter(r=>CP.has(r.k))).forEach(([a2,b2])=>{ if(!vis(a2,b2)) return; const xa=X(CLt(a2)), xb=X(CLt(b2)); out.push(`<rect x="${xa}" y="${by-6}" width="${Math.max(3,xb-xa)}" height="4" rx="2" fill="${C.accent}"/>`); }); }
        mem.filter(r=>msSet.has(r.k)&&r.L&&inR(r.f)&&!placedOn(r.k)).forEach(r=>{ const mx=X(r.f); out.push(`<path d="M${mx} ${by-3}L${mx+5} ${by+bh/2}L${mx} ${by+bh+3}L${mx-5} ${by+bh/2}Z" fill="${C.ink}" stroke="${C.surface}" stroke-width="1.2"/>`); }); }
      out.push('</g>');
      const placed=msRows.filter(r=>placedOn(r.k)===row.id&&inR(r.L&&r.f!=null?r.f:r.bf)).sort((a,b)=>((a.L?a.f:a.bf)-(b.L?b.f:b.bf))); let lastEnd=-Infinity;
      placed.forEach(r=>{ const my=cy-2.5, mt=r.L&&r.f!=null?r.f:r.bf, mx=X(mt), v=r.varF, kk=exRag(v), done=r.status==='TK_Complete', sz=rowH<34?6:7.5;
        out.push(`<g class="exms" data-k="${esc(r.k)}"><title>${esc(r.name)}: forecast ${fmtL(r.L?r.f:null)}, baseline ${fmtL(r.bf)}</title>`);
        if(E.showBase&&r.bf!=null&&r.L&&r.f!=null&&Math.abs(X(CLt(r.bf))-mx)>2){ const bx=X(CLt(r.bf)); out.push(`<line x1="${bx}" x2="${mx}" y1="${my}" y2="${my}" stroke="${C.ink3}" stroke-width="1.3" stroke-dasharray="3 3"/><path d="M${bx} ${my-sz+1}L${bx+sz-1} ${my}L${bx} ${my+sz-1}L${bx-sz+1} ${my}Z" fill="${C.surface}" stroke="${C.ink3}" stroke-width="1.4"/>`); }
        if(CP&&CP.has(r.k)) out.push(`<circle cx="${mx}" cy="${my}" r="${sz+4}" fill="none" stroke="${C.accent}" stroke-width="2"/>`);
        out.push(`<path d="M${mx} ${my-sz}L${mx+sz} ${my}L${mx} ${my+sz}L${mx-sz} ${my}Z" fill="${done?C.ink:r.L?RAGC[kk]:C.base}" stroke="${C.surface}" stroke-width="1.6"/>`);
        const lab=`${clip(r.name,11,170)} · ${fmtD(mt)}${done?'':v?` (${sgn(v)}d)`:''}`, lw=chw(11,lab), right=mx+sz+6;
        const tx=right+lw<x1&&right>lastEnd?right:mx-sz-6-lw>lastEnd?mx-sz-6-lw:right;
        out.push(`<text x="${tx}" y="${my+4}" font-family="${F}" font-size="11" font-weight="600" fill="${done?C.ink:v>0?RAGC[kk]:C.ink}" stroke="${C.surface}" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(lab)}</text>`);
        lastEnd=tx+lw+4; out.push('</g>'); });
      T(x1+16,cy+4,st.hasL?fmtD(st.f):'—',{s:12.5,w:500});
      const lab=st.varF==null?(st.hasL?'New':'—'):st.varF===0?'On time':sgn(st.varF)+'d', cw=chw(11.5,lab)+16;
      out.push(`<rect x="${W-pad-cw}" y="${cy-10}" width="${cw}" height="20" rx="10" fill="${RAGC[k]}" fill-opacity="${k==='na'?0.12:0.16}"/>`); T(W-pad-cw/2,cy+4,lab,{s:11.5,w:700,f:RAGC[k],a:'middle'});
      y+=rowH; }); });
  if(!rows.length){ T(W/2,yBody+30,'No summary rows yet. Open Edit plan to build them.',{s:13,f:C.ink2,a:'middle'}); }
  // data date
  if(M.dd!=null&&M.dd>=t0&&M.dd<=t1){ const dx=X(M.dd); out.push(`<line x1="${dx}" x2="${dx}" y1="${yScale+scaleH}" y2="${H-legH}" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="5 4"/><rect x="${dx-34}" y="${H-legH-16}" width="68" height="16" rx="8" fill="${C.accent}"/>`); T(dx,H-legH-4.5,'DATA DATE',{s:9.5,w:700,f:'#fff',a:'middle',ls:'0.5'}); }
  // legend
  const ly=H-legH+26; let lx=pad; const L=(svg,label)=>{ out.push(svg(lx)); T(lx+30,ly+4,label,{s:11.5,f:C.ink2}); lx+=36+chw(11.5,label)+18; };
  L(x=>`<rect x="${x}" y="${ly-5}" width="24" height="10" rx="3" fill="${C.bar}" fill-opacity="${E.pct?0.38:0.9}"/>${E.pct?`<rect x="${x}" y="${ly-5}" width="13" height="10" rx="3" fill="${C.bar}"/>`:''}`,E.pct?'Forecast (solid = complete)':'Forecast');
  if(E.showBase) L(x=>`<rect x="${x}" y="${ly-2}" width="24" height="5" rx="2.5" fill="${C.base}"/>`,'Baseline');
  if(CP) L(x=>`<rect x="${x}" y="${ly-2}" width="24" height="4" rx="2" fill="${C.accent}"/>`,'Critical path');
  if(ifSel.length) L(x=>`<line x1="${x+4}" x2="${x+20}" y1="${ly}" y2="${ly}" stroke="${RAGC.r}" stroke-width="2.5"/><path d="M${x+4} ${ly-5}L${x+9} ${ly}L${x+4} ${ly+5}L${x-1} ${ly}Z" fill="${RAGC.r}"/><rect x="${x+19}" y="${ly-6}" width="2.5" height="12" fill="${C.ink}"/>`,'Handover vs need date');
  L(x=>`<path d="M${x+12} ${ly-6}L${x+18} ${ly}L${x+12} ${ly+6}L${x+6} ${ly}Z" fill="${RAGC.a}"/>`,'Milestone forecast');
  L(x=>`<path d="M${x+12} ${ly-6}L${x+18} ${ly}L${x+12} ${ly+6}L${x+6} ${ly}Z" fill="${C.ink}"/>`,'Achieved');
  if(E.showBase) L(x=>`<path d="M${x+12} ${ly-6}L${x+18} ${ly}L${x+12} ${ly+6}L${x+6} ${ly}Z" fill="${C.surface}" stroke="${C.base}" stroke-width="1.5"/>`,'Baseline date');
  const rag=`Green ≤ ${E.green}d · Amber ≤ ${E.amber}d · Red > ${E.amber}d finish variance`; if(lx<W-pad-chw(11,rag)-10) T(W-pad,ly+4,rag,{s:11,f:C.ink3,a:'end'}); else T(pad,ly+22,rag,{s:11,f:C.ink3});
    return {out:out.join(''),H,n:rows.length,W};
  };
  const SZ=EX_SIZES[E.size]||EX_SIZES.fit, nR=Math.max(1,rows.length);
  let svgW,svgH,vbW,vbH,inner;
  if(!SZ.w){ const W=Math.max(760,host.clientWidth||960), r=build(W,null,40); svgW=vbW=W; svgH=vbH=r.H; inner=r.out; }
  else { const f=Math.max(1,980/SZ.w), PW=SZ.w*f, PH=SZ.h*f; let r=build(PW,null,40); const nT=rows.length+(CP?1:0), fixed=r.H-nT*40, rh=nT?(PH-fixed)/Math.max(1,nT):40;
    if(rh>=26){ r=build(PW,PH,Math.min(PH>PW?84:64,rh)); vbW=PW; vbH=PH; }
    else { let Wl=PW; for(let k=0;k<3;k++){ const t=build(Wl,null,26); Wl=Math.max(PW,t.H*PW/PH); } const Hl=Wl*PH/PW; r=build(Wl,Hl,26); vbW=Wl; vbH=r.H; }
    inner=r.out; svgW=SZ.w; svgH=SZ.h; }
  E._out={w:svgW,h:svgH};
  host.classList.toggle('sheet',!!SZ.w);
  host.innerHTML=SZ.w?`<div class="exsheet-wrap"><div class="exsheet" style="aspect-ratio:${SZ.w}/${SZ.h};max-width:${Math.round(SZ.w>SZ.h?100:Math.min(100,SZ.w/SZ.h*100*1.05))}%"><svg id="exSvg" xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${esc(E.title)}">${inner}</svg></div><div class="exsize-note">${esc(SZ.label)} · ${SZ.note}</div></div>`
    :`<div class="exscroll"><svg id="exSvg" xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="${esc(E.title)}">${inner}</svg></div>`;
  document.getElementById('exInfo').textContent=`${rows.length} summary rows · ${msRows.length} milestones${ifSel.length?` · ${ifSel.length} interfaces`:''}`;
}
function exRenderBuilder(q){
  const E=S.ex, el=document.getElementById('exBuild'), cur=el.querySelector('#exMsQ'), mq=q!=null?q:(cur?cur.value:'');
  const all=M.rows.slice().sort((a,b)=>(b.ms-a.ms)||((a.f??a.bf??0)-(b.f??b.bf??0))), ql=mq.trim().toLowerCase();
  const list=all.filter(r=>ql?(r.code.toLowerCase().includes(ql)||r.name.toLowerCase().includes(ql)):r.ms).slice(0,200);
  const sel=new Set(E.ms);
  el.innerHTML=`<div class="exb-grid">
    <section><div class="dh" style="margin-top:0">Plan</div>
      <label class="exf"><span>Title</span><input id="exTitle" value="${esc(E.title)}"></label>
      <div class="exf"><span>Build rows from</span><div class="exrow2"><select id="exSrc">${exSources().map(([v,l])=>`<option value="${esc(v)}"${v===exDefaultSource()?' selected':''}>${esc(l)}</option>`).join('')}</select><button class="btn sm" id="exBuildBtn">Replace rows</button></div></div>
      <div class="exf"><span>Add a custom row</span><div class="exrow2"><button class="btn sm primary" id="exPickNew">Pick activities</button><button class="btn sm" id="exAddFilter">From current filters (${S.rows.length})</button></div><em class="muted">Choose specific activities, or narrow them with the sidebar filters and add them as one bar.</em></div>
      <div class="dh">Display</div>
      <div class="tvr"><label class="tg"><input type="checkbox" id="exBase" ${E.showBase?'checked':''}> Compare to baseline</label></div>
      <div class="tvr"><label class="tg"><input type="checkbox" id="exPct" ${E.pct?'checked':''}> Show % complete on bars</label></div>
      <div class="tvr"><span class="ctl">Bar colour</span><div class="sg"><button data-exc="row" class="${E.color==='row'?'on':''}">By row</button><button data-exc="rag" class="${E.color==='rag'?'on':''}">By RAG</button></div></div>
      <div class="tvr"><span class="ctl">Green ≤</span><input class="tvi" id="exG" value="${E.green}" inputmode="numeric"> <span class="ctl">Amber ≤</span><input class="tvi" id="exA" value="${E.amber}" inputmode="numeric"> <span class="muted">days late</span></div>
    </section>
    <section><div class="dh" style="margin-top:0">Summary rows · ${E.rows.length}</div>
      <div class="exrows">${E.rows.map((r,i)=>`<div class="exr"><input type="color" data-exr="${r.id}" data-f="color" value="${/^#[0-9a-f]{6}$/i.test(r.color||'')?r.color:'#3b6fe0'}" aria-label="Row colour">
        <input class="exn" data-exr="${r.id}" data-f="label" value="${esc(r.label)}" aria-label="Row name"><input class="exg" data-exr="${r.id}" data-f="group" value="${esc(r.group||'')}" placeholder="Group" aria-label="Group heading">
        <button class="exact" data-expick="${r.id}" title="Choose activities for this row">${exMembers(r).length}</button><button data-exmv="${r.id}" data-d="-1" aria-label="Move up" ${i?'':'disabled'}>↑</button><button data-exmv="${r.id}" data-d="1" aria-label="Move down" ${i<E.rows.length-1?'':'disabled'}>↓</button><button data-exdel="${r.id}" aria-label="Remove row">×</button></div>`).join('')||'<p class="muted">No rows. Build from WBS or a code, or add one from your filters.</p>'}</div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Rows with the same group name next to each other sit under one heading.</p>
    </section>
    <section><div class="dh" style="margin-top:0">Key milestones · ${E.ms.length}</div>
      ${E.ms.length?`<div class="exmsel">${E.ms.map(k=>{ const r=M.byKey.get(k); if(!r) return ''; const cur=(E.msRow||{})[k]||''; return `<div class="exmr"><span class="cpl" title="${esc(r.name)}"><b>${esc(r.code)}</b> ${esc(r.name)}</span><select data-exmsrow="${esc(k)}" aria-label="Where to show ${esc(r.code)}"><option value="">Milestone lane</option>${E.rows.map(row=>`<option value="${row.id}"${cur===row.id?' selected':''}>Row: ${esc(row.label)}</option>`).join('')}</select><button data-exmsdel="${esc(k)}" aria-label="Remove ${esc(r.code)}">×</button></div>`; }).join('')}</div>
      <div class="exrow2" style="margin:8px 0 4px"><button class="btn sm" id="exMsAuto">Put each on its own row</button><button class="btn sm" id="exMsLane">All in lane</button></div>`:''}
      <input id="exMsQ" class="exq" type="search" placeholder="Search any activity to add" value="${esc(mq)}" autocomplete="off">
      <div class="exms-l">${list.map(r=>`<button class="cpa${sel.has(r.k)?' on':''}" data-exms="${esc(r.k)}"><span class="bx"></span><span class="cpl"><b>${esc(r.code)}</b> ${esc(r.name)}</span><code>${fmtD(r.L?r.f:r.bf)}</code></button>`).join('')||'<p class="muted" style="font-size:13px">No matches.</p>'}</div>
      ${ql?'':'<p class="muted" style="font-size:12px;margin:6px 0 0">Showing milestones. Search to add any activity as a key date.</p>'}
      <div class="dh">Interface handovers · ${(E.ifcs||[]).length}</div>
      ${(()=>{ const il=ifcList().map(I=>({...I,ev:ifcEval(I)})), isel=new Set(E.ifcs||[]);
        return il.length?`<div class="exrow2" style="margin-bottom:6px"><button class="btn sm" data-exifq="all">All</button><button class="btn sm" data-exifq="late">Late only</button><button class="btn sm" data-exifq="none">None</button></div><div class="exms-l" style="max-height:26vh">${il.map(I=>{ const k=I.g.k+'>'+I.r.k; return `<button class="cpa${isel.has(k)?' on':''}" data-exif="${esc(k)}"><span class="bx"></span><span class="cpl"><b>${esc(I.id)}</b> ${esc(I.g.code)} → ${esc(I.r.code)}</span><code class="${I.ev.margin<0?'late':''}">${I.ev.margin==null?'—':sgn(I.ev.margin)+'d'}</code></button>`; }).join('')}</div>`
          :'<p class="muted" style="font-size:12.5px;margin:0">No interfaces found. Set them up on the Interfaces tab.</p>'; })()}
    </section></div>`;
}
function wireExec(){
  const b=document.getElementById('exBuild');
  document.getElementById('exAddRow').onclick=()=>exPickOpen(null);
  const cpT=document.getElementById('exCp'); cpT.checked=!!S.ex.cp;
  cpT.onchange=()=>{ S.ex.cp=cpT.checked; exSave(); exRenderPage(); };
  document.getElementById('exCpOpt').addEventListener('change',e=>{ if(e.target.id==='exCpBy') S.cp.by=e.target.value; if(e.target.id==='exCpThr'){ const n=parseFloat(e.target.value); S.cp.thr=isFinite(n)?n:0; } try{ localStorage.setItem('pacer.cp',JSON.stringify(S.cp)); }catch(_){} exRenderPage(); });
  const tlSync=()=>{ const T2=S.ex.tl||(S.ex.tl={from:'',to:'',scale:'auto'}); document.getElementById('exFrom').value=T2.from||''; document.getElementById('exTo').value=T2.to||''; document.getElementById('exScale').value=T2.scale||'auto'; document.getElementById('exTlNote').textContent=T2.from||T2.to?'Custom range. Bars beyond it are clipped with an arrow.':'Fitted to the plan'; };
  window.exTlSync=tlSync; tlSync();
  const tlSet=patch=>{ S.ex.tl={...(S.ex.tl||{}),...patch}; exSave(); tlSync(); exRenderPage(); };
  document.getElementById('exFrom').addEventListener('change',e=>tlSet({from:e.target.value}));
  document.getElementById('exTo').addEventListener('change',e=>tlSet({to:e.target.value}));
  document.getElementById('exScale').addEventListener('change',e=>tlSet({scale:e.target.value}));
  document.getElementById('exTl').addEventListener('click',e=>{ const b=e.target.closest('[data-extl]'); if(!b) return; const d=dayOf(M.dd??Date.now()), y=new Date(d*DAY).getUTCFullYear();
    if(b.dataset.extl==='fit') tlSet({from:'',to:''}); else if(b.dataset.extl==='next12') tlSet({from:isoD(d),to:isoD(d+365)}); else if(b.dataset.extl==='year') tlSet({from:`${y}-01-01`,to:`${y}-12-31`}); else tlSet({from:isoD(d),to:''}); });
  const sz=document.getElementById('exSize'); sz.value=EX_SIZES[S.ex.size]?S.ex.size:'ppt169';
  sz.onchange=()=>{ S.ex.size=sz.value; exSave(); exRenderPage(); document.getElementById('exMsg').textContent=''; };
  document.getElementById('exEdit').onclick=e=>{ const open=b.hidden; b.hidden=!open; e.currentTarget.setAttribute('aria-expanded',open); e.currentTarget.textContent=open?'Done editing':'Edit plan'; if(open) exRenderBuilder(''); };
  const changed=(page=true,build=false)=>{ exSave(); if(page) exRenderPage(); if(build) exRenderBuilder(); };
  b.addEventListener('change',e=>{ const t=e.target, E=S.ex;
    if(t.id==='exTitle'){ E.title=t.value; changed(); }
    else if(t.id==='exBase'){ E.showBase=t.checked; changed(); } else if(t.id==='exPct'){ E.pct=t.checked; changed(); }
    else if(t.id==='exG'||t.id==='exA'){ const v=parseInt(t.value,10); if(isFinite(v)){ if(t.id==='exG') E.green=v; else E.amber=Math.max(v,E.green); } t.value=t.id==='exG'?E.green:E.amber; changed(); }
    else if(t.dataset.exr){ const r=E.rows.find(x=>x.id===t.dataset.exr); if(r){ r[t.dataset.f]=t.value; changed(); } }
    else if(t.dataset.exmsrow!=null){ E.msRow=E.msRow||{}; if(t.value) E.msRow[t.dataset.exmsrow]=t.value; else delete E.msRow[t.dataset.exmsrow]; changed(); } });
  b.addEventListener('input',e=>{ const t=e.target; if(t.type==='color'&&t.dataset.exr){ const r=S.ex.rows.find(x=>x.id===t.dataset.exr); if(r){ r.color=t.value; changed(); } } if(t.id==='exMsQ') exRenderBuilderKeep(t.value); });
  b.addEventListener('click',e=>{ const t=e.target.closest('button'); if(!t) return; const E=S.ex;
    if(t.id==='exBuildBtn'){ E.rows=exBuild(document.getElementById('exSrc').value); changed(true,true); }
    else if(t.id==='exPickNew'){ exPickOpen(null); }
    else if(t.dataset.expick){ exPickOpen(t.dataset.expick); }
    else if(t.id==='exAddFilter'){ if(!S.rows.length) return; const lab=S.F.ids?S.F.ids.label:activeFilterCount()?'Selected activities':'All activities'; E.rows.push({id:uid(),label:lab,group:'',rule:{type:'keys',keys:S.rows.map(r=>r.k)},color:PAL[E.rows.length%PAL.length]}); changed(true,true); }
    else if(t.dataset.exc){ E.color=t.dataset.exc; changed(true,true); }
    else if(t.dataset.exmv){ const i=E.rows.findIndex(x=>x.id===t.dataset.exmv), j=i+(+t.dataset.d); if(i>=0&&j>=0&&j<E.rows.length){ [E.rows[i],E.rows[j]]=[E.rows[j],E.rows[i]]; changed(true,true); } }
    else if(t.dataset.exdel){ E.rows=E.rows.filter(x=>x.id!==t.dataset.exdel); changed(true,true); }
    else if(t.dataset.exmsdel){ const k=t.dataset.exmsdel; E.ms=E.ms.filter(x=>x!==k); if(E.msRow) delete E.msRow[k]; changed(true,true); }
    else if(t.id==='exMsAuto'){ E.msRow=E.msRow||{}; let n=0; E.ms.forEach(k=>{ const row=E.rows.find(rw=>exMembers(rw).some(r=>r.k===k)); if(row){ E.msRow[k]=row.id; n++; } }); changed(true,true); document.getElementById('exMsg').textContent=n?`Placed ${n} milestone${n===1?'':'s'} on the row that contains ${n===1?'it':'them'}.`:'None of the selected milestones belong to a summary row. Choose a row for each one.'; }
    else if(t.id==='exMsLane'){ E.msRow={}; changed(true,true); }
    else if(t.dataset.exif){ const k=t.dataset.exif; E.ifcs=E.ifcs||[]; const i=E.ifcs.indexOf(k); i<0?E.ifcs.push(k):E.ifcs.splice(i,1); changed(true,true); }
    else if(t.dataset.exifq){ const il=ifcList().map(I=>({...I,ev:ifcEval(I)})); E.ifcs=t.dataset.exifq==='all'?il.map(I=>I.g.k+'>'+I.r.k):t.dataset.exifq==='late'?il.filter(I=>I.ev.margin!=null&&I.ev.margin<0&&I.g.status!=='TK_Complete').map(I=>I.g.k+'>'+I.r.k):[]; changed(true,true); }
    else if(t.dataset.exms){ const k=t.dataset.exms, i=E.ms.indexOf(k); i<0?E.ms.push(k):E.ms.splice(i,1); t.classList.toggle('on'); exSave(); exRenderPage(); const h=b.querySelector('section:nth-child(3) .dh'); if(h) h.textContent=`Key milestones · ${E.ms.length}`; } });
  document.getElementById('exPage').addEventListener('click',e=>{ const g=e.target.closest('.exrow'); if(g){ const row=S.ex.rows.find(x=>x.id===g.dataset.row); if(!row) return; const mem=exMembers(row); if(!mem.length) return; S.F.ids={label:row.label,set:new Set(mem.map(r=>r.k))}; renderFilters(); setTab('gantt'); applyFilters(); fitGantt(); return; }
    const m=e.target.closest('.exms'); if(m) openDrawer(m.dataset.k); });
  document.getElementById('exCopy').onclick=()=>{ const svg=document.getElementById('exSvg'), msg=document.getElementById('exMsg'); if(!svg) return;
    const W=+svg.getAttribute('width'), H=+svg.getAttribute('height'), K=Math.max(2,Math.min(4,3600/Math.max(W,H))), url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
    const blob=new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=Math.round(W*K); c.height=Math.round(H*K); const x=c.getContext('2d'); x.fillStyle=C.surface; x.fillRect(0,0,c.width,c.height); x.drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); c.toBlob(b=>b?res(b):rej(new Error('render')),'image/png'); }; img.onerror=rej; img.src=url; });
    try{ navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>{ const z=EX_SIZES[S.ex.size]||EX_SIZES.fit; msg.textContent=`Copied at ${Math.round(W*K)} × ${Math.round(H*K)} px for ${z.label}. ${z.w?`Paste and it ${z.note}.`:'Paste it into PowerPoint, an email or a report.'}`; },()=>{ msg.textContent='Your browser blocked copying images here. Use Present and take a screenshot instead.'; }); }
    catch(_){ msg.textContent='Your browser blocked copying images here. Use Present and take a screenshot instead.'; } };
  document.getElementById('exFull').onclick=()=>{ const el=document.getElementById('exPage'); const p=el.requestFullscreen?el.requestFullscreen():null; if(p&&p.catch) p.catch(()=>{ document.getElementById('exMsg').textContent='Full screen is not available in this view.'; }); };
  document.addEventListener('fullscreenchange',()=>{ if(S.tab==='exec') requestAnimationFrame(exRenderPage); });
}
let exQT; function exRenderBuilderKeep(v){ clearTimeout(exQT); exQT=setTimeout(()=>{ exRenderBuilder(v); const q=document.getElementById('exMsQ'); if(q){ q.focus(); q.setSelectionRange(v.length,v.length); } },150); }

function cpChanged(){ try{ localStorage.setItem('pacer.cp',JSON.stringify(S.cp)); }catch(_){} renderControls(); renderLegend(); buildItems(); if(S.tab==='tld') T.view=null; redraw(); }


/* ---------------- Plan on a Page: activity picker ---------------- */
const PK={open:false,rowId:null,sel:new Set(),q:'',scope:'all',last:-1,shown:[]};
function exPickOpen(rowId){
  const row=rowId?S.ex.rows.find(r=>r.id===rowId):null;
  PK.open=true; PK.rowId=rowId; PK.sel=new Set(row?exMembers(row).map(r=>r.k):[]); PK.q=''; PK.scope=row?'sel':'all'; PK.last=-1;
  const el=document.getElementById('exPick');
  el.innerHTML=`<div class="cph"><strong>${row?'Choose activities for this row':'New row from selected activities'}</strong><span class="sp"></span><button class="fx" id="pkClose" aria-label="Close">×</button></div>
    <div class="pkhead"><label class="exf"><span>Row name</span><input id="pkName" value="${esc(row?row.label:'')}" placeholder="e.g. Westfield Station works"></label>
      <label class="exf"><span>Group (optional)</span><input id="pkGroup" value="${esc(row?row.group||'':'')}" placeholder="Swimlane heading"></label></div>
    <div class="pktools"><input id="pkQ" type="search" placeholder="Search activity ID, name or WBS" autocomplete="off">
      <div class="sg" role="group" aria-label="Show"><button data-pks="all">All</button><button data-pks="filt">Current filters</button><button data-pks="sel">Selected</button></div>
      <button class="btn sm" id="pkAll">Select all shown</button><button class="link" id="pkNone">Clear selection</button></div>
    <div class="pklist" id="pkList" role="listbox" aria-multiselectable="true"></div>
    <div class="pkfoot"><span id="pkSum" class="muted"></span><span class="sp"></span><button class="btn" id="pkCancel">Cancel</button><button class="btn primary" id="pkSave">${row?'Save row':'Add row'}</button></div>`;
  el.hidden=false; exPickList(); el.scrollIntoView({block:'nearest',behavior:'smooth'}); document.getElementById(row?'pkQ':'pkName').focus();
}
function exPickList(){
  const q=PK.q.trim().toLowerCase(), base=PK.scope==='filt'?S.rows:PK.scope==='sel'?M.rows.filter(r=>PK.sel.has(r.k)):M.rows;
  const list=base.filter(r=>!q||r.code.toLowerCase().includes(q)||r.name.toLowerCase().includes(q)||r.wkeys[r.wkeys.length-1].toLowerCase().includes(q)||r.wp.some(p=>p.n.toLowerCase().includes(q)))
    .slice().sort((a,b)=>a.wkeys[a.wkeys.length-1].localeCompare(b.wkeys[b.wkeys.length-1])||((a.s??a.bs??0)-(b.s??b.bs??0)));
  PK.shown=list; const max=600, shown=list.slice(0,max);
  document.getElementById('pkList').innerHTML=shown.length?shown.map((r,i)=>`<button class="pki${PK.sel.has(r.k)?' on':''}" data-pki="${i}" role="option" aria-selected="${PK.sel.has(r.k)}"><span class="bx"></span><b class="${r.crit?'acc':''}">${esc(r.code)}</b><span class="pkn">${esc(r.name)}${r.ms?' <span class="tg2">Milestone</span>':''}${!r.L?' <span class="tg2">Removed</span>':''}</span><span class="pkw">${esc(r.wp[r.wp.length-1].k)}</span><span class="pkd">${fmtD(r.L?r.s:r.bs)} → ${fmtD(r.L?r.f:r.bf)}</span></button>`).join('')+(list.length>max?`<div class="note" style="padding:8px">Showing ${max} of ${list.length}. Search to narrow the list.</div>`:'')
    :`<p class="muted" style="padding:12px;margin:0">${PK.scope==='sel'?'Nothing selected yet. Switch to All and tick activities.':'No activities match.'}</p>`;
  document.querySelectorAll('#exPick [data-pks]').forEach(b=>b.classList.toggle('on',b.dataset.pks===PK.scope));
  exPickSum();
}
function exPickSum(){ const sel=M.rows.filter(r=>PK.sel.has(r.k)); const st=exStats(sel);
  document.getElementById('pkSum').innerHTML=sel.length?`<b>${sel.length}</b> selected · ${st.hasL?`${fmtD(st.s)} → ${fmtD(st.f)}`:'no live dates'}${st.varF!=null?` · <b class="${st.varF>0?'late':st.varF<0?'early':''}">${sgn(st.varF)}d</b> vs baseline`:''}`:'Tick the activities to roll up into one bar.';
  document.getElementById('pkSave').disabled=!sel.length; }
function wireExPick(){
  const el=document.getElementById('exPick'), close=()=>{ PK.open=false; el.hidden=true; };
  let qT; el.addEventListener('input',e=>{ if(e.target.id==='pkQ'){ clearTimeout(qT); qT=setTimeout(()=>{ PK.q=e.target.value; PK.last=-1; exPickList(); },120); } });
  el.addEventListener('click',e=>{
    const it=e.target.closest('[data-pki]');
    if(it){ const i=+it.dataset.pki, r=PK.shown[i]; if(!r) return; const on=!PK.sel.has(r.k);
      if(e.shiftKey&&PK.last>=0){ const [a,b]=[Math.min(PK.last,i),Math.max(PK.last,i)]; for(let j=a;j<=b;j++){ const x=PK.shown[j]; if(x) on?PK.sel.add(x.k):PK.sel.delete(x.k); } exPickList(); }
      else { on?PK.sel.add(r.k):PK.sel.delete(r.k); it.classList.toggle('on',on); it.setAttribute('aria-selected',on); exPickSum(); }
      PK.last=i; return; }
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.pks){ PK.scope=b.dataset.pks; PK.last=-1; exPickList(); return; }
    if(b.id==='pkAll'){ PK.shown.slice(0,600).forEach(r=>PK.sel.add(r.k)); exPickList(); }
    else if(b.id==='pkNone'){ PK.sel.clear(); exPickList(); }
    else if(b.id==='pkClose'||b.id==='pkCancel') close();
    else if(b.id==='pkSave'){ if(!PK.sel.size) return; const E=S.ex, name=document.getElementById('pkName').value.trim()||'Selected activities', grp=document.getElementById('pkGroup').value.trim(), keys=[...PK.sel];
      if(PK.rowId){ const row=E.rows.find(r=>r.id===PK.rowId); if(row){ row.rule={type:'keys',keys}; row.label=name; row.group=grp; } }
      else E.rows.push({id:uid(),label:name,group:grp,rule:{type:'keys',keys},color:PAL[E.rows.length%PAL.length]});
      exSave(); close(); exRenderPage(); if(!document.getElementById('exBuild').hidden) exRenderBuilder();
      document.getElementById('exMsg').textContent=PK.rowId?`Updated “${name}”.`:`Added “${name}” with ${keys.length} activities.`; } });
  el.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
}


