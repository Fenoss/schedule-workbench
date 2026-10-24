/* ---------------- AI Analyst (claude.use("sample")) ---------------- */
const AI={sample:null,ready:false,tools:false,turns:[],msgs:[],busy:false,ctl:null,scope:'all',tier:'default'};
const aiRows=()=>AI.scope==='filt'?S.rows:M.rows;
const aiAct=r=>{ const a=r.L||r.B; return a; };
const aiFmt=t=>t==null?'-':fx(t).slice(0,10);
function aiDigest(){
  const R=aiRows(), L=R.filter(r=>r.L), lines=[], add=(...x)=>lines.push(x.join(''));
  const lf=Math.max(...L.map(r=>r.f??-Infinity)), bf=Math.max(...R.filter(r=>r.B).map(r=>r.bf??-Infinity));
  add('SCHEDULE: ',M.projs.join(', '),' | live data date ',aiFmt(M.dd),' | baseline data date ',aiFmt(M.bdd),' | scope: ',AI.scope==='filt'?`current filters (${R.length} of ${M.rows.length} activities)`:`whole schedule (${R.length} activities)`);
  const st={ns:0,ip:0,cp:0}; L.forEach(r=>st[stat(r)]++);
  add('STATUS: not started ',st.ns,', in progress ',st.ip,', complete ',st.cp,' | added since baseline ',R.filter(r=>r.cmp==='added').length,', removed ',R.filter(r=>r.cmp==='removed').length,', behind baseline finish ',R.filter(r=>r.cmp==='late').length);
  if(isFinite(lf)) add('FORECAST FINISH: ',aiFmt(lf),isFinite(bf)?` vs baseline ${aiFmt(bf)} (${sgn(dd(lf-bf))} days)`:'');
  const cps=cpSet(), cpi=cpCache.info, cpl=R.filter(r=>cps.has(r.k)).sort((a,b)=>(a.s??0)-(b.s??0));
  add('\nCRITICAL PATH (',S.cp.by==='float'?`total float <= ${S.cp.thr}d`:'longest path',', ',cpl.length,' activities',cpi.fin?`, finishes ${aiFmt(cpi.fin.f)} with float ${cpi.fin.tf==null?'-':Math.round(cpi.fin.tf)}d`:'',')');
  add('id|name|project|start|finish|total float d|finish var d|status');
  cpl.slice(0,45).forEach(r=>add(r.code,'|',r.name,'|',r.proj,'|',aiFmt(r.s),'|',aiFmt(r.f),'|',r.tf==null?'-':Math.round(r.tf),'|',r.varF==null?'-':r.varF,'|',stat(r)||'removed'));
  const ms=R.filter(r=>r.ms).sort((a,b)=>((a.f??a.bf)-(b.f??b.bf)));
  add('\nMILESTONES (',ms.length,')'); add('id|name|baseline|forecast|var d|status|total float d');
  ms.slice(0,40).forEach(r=>add(r.code,'|',r.name,'|',aiFmt(r.bf),'|',r.L?aiFmt(r.f):'removed','|',r.varF==null?'-':r.varF,'|',stat(r)||'removed','|',r.tf==null?'-':Math.round(r.tf)));
  const slips=R.filter(r=>!r.ms&&r.varF>0).sort((a,b)=>b.varF-a.varF);
  add('\nBIGGEST FINISH SLIPS vs BASELINE (top 25 of ',slips.length,')'); add('id|name|project|wbs|baseline finish|forecast finish|var d|status|total float d');
  slips.slice(0,25).forEach(r=>add(r.code,'|',r.name,'|',r.proj,'|',r.wp.map(p=>p.k).join('.'),'|',aiFmt(r.bf),'|',aiFmt(r.f),'|',r.varF,'|',stat(r),'|',r.tf==null?'-':Math.round(r.tf)));
  const depth=M.roots.some(n=>n.children.length)?1:0, agg=new Map(); R.forEach(r=>{ const k=r.wkeys[Math.min(depth,r.wkeys.length-1)]; if(!agg.has(k)) agg.set(k,[]); agg.get(k).push(r); });
  add('\nWBS SUMMARY'); add('wbs|name|activities|% complete (duration weighted)|forecast finish|baseline finish|finish var d');
  [...agg].forEach(([k,sub])=>{ const n=M.wbs.get(k), x=exStats(sub); add(k,'|',n?n.label:k,'|',x.n,'|',x.pct??'-','|',x.hasL?aiFmt(x.f):'-','|',x.hasB?aiFmt(x.bf):'-','|',x.varF??'-'); });
  const ip=L.filter(r=>r.status==='TK_Active').slice(0,30);
  add('\nIN PROGRESS (',ip.length,')'); ip.forEach(r=>add(r.code,'|',r.name,'|',Math.round(r.L.pct),'% |forecast finish ',aiFmt(r.f),'|var ',r.varF??'-'));
  if(M.dd!=null){ const nx=L.filter(r=>r.status==='TK_NotStart'&&r.s!=null&&r.s<=M.dd+28*DAY).sort((a,b)=>a.s-b.s).slice(0,30);
    add('\nSTARTING IN NEXT 4 WEEKS (',nx.length,')'); nx.forEach(r=>add(r.code,'|',r.name,'|start ',aiFmt(r.s),'|tf ',r.tf==null?'-':Math.round(r.tf))); }
  try{ const sv=S.dq.scope, sr=S.dq.role; S.dq.scope=AI.scope==='filt'?'filtered':'all'; S.dq.role='live'; const dq=runDCMA(); S.dq.scope=sv; S.dq.role=sr;
    if(dq){ add('\n'+(DQ.ctx&&DQ.ctx.name||'Quality checks').toUpperCase()+' (live)'); dq.forEach(c=>add(c.n,'. ',c.title,': ',c.status.toUpperCase(),' ',c.metric,' (',c.sub||'',', target ',c.thr||'-',')',c.items&&c.items.length&&c.status==='fail'?' e.g. '+c.items.slice(0,5).map(i=>i.code).join(', '):'')); } }catch(_){}
  try{ const il=ifcList().map(I=>({...I,ev:ifcEval(I)})); if(il.length){ add('\nINTERFACES (giver -> receiver, margin = receiver need date minus giver forecast)'); add('id|giver|receiver|giver forecast|need by|margin d|logic issues');
      il.slice(0,40).forEach(I=>add(I.id,'|',I.g.code,' ',I.g.proj,'|',I.r.code,' ',I.r.proj,'|',aiFmt(I.ev.gF),'|',aiFmt(I.ev.need),'|',I.ev.margin??'-','|',I.ev.checks.filter(c=>!c[1]).map(c=>c[2]).join('; ')||'none')); } }catch(_){}
  try{ if(typeof PER!=='undefined'&&PER.loaded&&!PER.loaded.multi&&PER.pid===PER.loaded.pid&&PER.periods.length){ const P=PER.periods;
    add('\nUPDATE HISTORY (oldest first)'); add('update|data date|forecast finish|baseline finish|actual %|planned %|BEI|SPI|CPI|EAC');
    P.slice(-12).forEach(p=>{ const s=p.stats||{}, c=s.cost||{}; add(p.label,'|',aiFmt(p.dd),'|',aiFmt(s.finish),'|',aiFmt(s.blFinish),'|',s.pctA!=null?Math.round(s.pctA*100):'-','|',s.pctP!=null?Math.round(s.pctP*100):'-','|',s.bei!=null?(+s.bei).toFixed(2):'-','|',c.spi!=null?c.spi.toFixed(2):'-','|',c.cpi!=null?c.cpi.toFixed(2):'-','|',c.eac!=null?Math.round(c.eac):'-'); });
    const n=[...P].reverse().find(p=>narHas(p.narrative)); if(n){ add('\nLATEST UPDATE NARRATIVE (',n.label,')'); NAR.forEach(([k,l])=>{ if(n.narrative[k]) add(l,': ',n.narrative[k]); }); } } }catch(_){}
  return lines.join('\n').slice(0,60000);
}
const AI_RULES=`You are a senior project controls scheduler (Primavera P6, critical path method, DCMA 14-point, interface management) reviewing a construction programme inside Schedule Workbench, a schedule comparison tool. The user is an experienced programme controls director, so be direct and technical, and do not explain basic terms.
Rules:
- Use ONLY the schedule digest below and the results of the tools you call. If something is not in the data, say so rather than guessing.
- Quote activity IDs exactly as written (for example CT640) so the app can link them. Quantify in days and dates (DD Mon YYYY).
- "var" means forecast finish minus baseline finish in calendar days; positive is late. Total float is in working days.
- Use the tools to check specifics (driving logic, what-if delays, activity detail) before making a claim about cause.
- Format in Markdown: a one-line headline, then short sections with bullets. Tables at most 5 columns. Keep it under about 350 words unless asked for more. End with 2-4 concrete actions where relevant.`;
function aiTools(){
  const act=id=>{ const r=M.rows.find(x=>x.code.toLowerCase()===String(id||'').trim().toLowerCase())||M.byKey.get(String(id)); if(!r) throw new Error(`No activity with ID ${id}`); return r; };
  const brief=r=>({id:r.code,name:r.name,project:r.proj,wbs:r.wp.map(p=>p.k).join('.'),status:stat(r)||'removed',start:aiFmt(r.L?r.s:r.bs),finish:aiFmt(r.L?r.f:r.bf),baseline_finish:aiFmt(r.bf),finish_var_days:r.varF,total_float_days:r.tf==null?null:Math.round(r.tf*10)/10,critical:cpSet().has(r.k)});
  return [
    {name:'find_activities',description:'Search activities. Filters are optional and combine. Returns up to `limit` (max 40) brief records with dates, variance and float.',
      inputSchema:{type:'object',properties:{text:{type:'string',description:'Words in the ID, name or WBS'},status:{type:'string',enum:['not_started','in_progress','complete']},critical_only:{type:'boolean'},min_finish_var_days:{type:'number'},project:{type:'string'},code_type:{type:'string'},code_value:{type:'string'},limit:{type:'number'}}},
      execute(i){ const q=String(i.text||'').toLowerCase(), m={not_started:'ns',in_progress:'ip',complete:'cp'}[i.status], cps=cpSet(), lim=Math.min(40,Math.max(1,+i.limit||20));
        const out=aiRows().filter(r=>(!q||r.code.toLowerCase().includes(q)||r.name.toLowerCase().includes(q)||r.wkeys.some(k=>k.toLowerCase().includes(q)))&&(!m||stat(r)===m)&&(!i.critical_only||cps.has(r.k))&&(i.min_finish_var_days==null||(r.varF!=null&&r.varF>=+i.min_finish_var_days))&&(!i.project||r.proj===i.project)&&(!i.code_type||r.codes[i.code_type]===i.code_value));
        return {total:out.length,activities:out.slice(0,lim).map(brief)}; }},
    {name:'get_activity',description:'Full detail for one activity by ID: dates, baseline, float, codes, constraint, and each predecessor/successor with type, lag and whether it is driving.',
      inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']},
      execute(i){ const r=act(i.id), a=aiAct(r); const rel=(list,dir)=>list.slice(0,30).map(p=>({id:p.a.code,name:p.a.name,project:p.a.proj,type:p.type,lag_days:Math.round(p.lag*10)/10,driving:r.L?(dir==='p'?isDrv(p.a,r.L,p.type):isDrv(r.L,p.a,p.type)):false,finish:aiFmt(p.a.f)}));
        return {...brief(r),baseline_start:aiFmt(r.bs),start_var_days:r.varS,pct_complete:r.L?r.L.pct:null,free_float_days:a.raw.free_float_hr_cnt?Math.round(+a.raw.free_float_hr_cnt/(a.dh||8)):null,remaining_duration_days:a.raw.remain_drtn_hr_cnt?Math.round(+a.raw.remain_drtn_hr_cnt/(a.dh||8)):null,constraint:a.raw.cstr_type?(ENUM[a.raw.cstr_type]||a.raw.cstr_type)+' '+(a.raw.cstr_date||''):null,codes:r.codes,predecessors:rel(a.preds,'p'),successors:rel(a.succs,'s')}; }},
    {name:'trace_driving_path',description:'Walk the driving predecessors backwards from an activity (the logic that controls its date), through incomplete work. Returns the chain from the activity back towards the data date.',
      inputSchema:{type:'object',properties:{id:{type:'string'},max_steps:{type:'number'}},required:['id']},
      execute(i){ const r=act(i.id); let a=r.L; if(!a) throw new Error('Activity is not in the live schedule'); const chain=[], seen=new Set(), max=Math.min(60,+i.max_steps||30);
        while(a&&chain.length<max&&!seen.has(a)){ seen.add(a); chain.push({id:a.code,name:a.name,project:a.proj,start:aiFmt(a.s),finish:aiFmt(a.f),float:a.tf==null?null:Math.round(a.tf),status:a.status}); const d=[...drivingSet(a)].filter(p=>p.a.status!=='TK_Complete'); if(!d.length) break; a=d.sort((x,y)=>(y.a.f??0)-(x.a.f??0))[0].a; }
        return {steps:chain.length,chain}; }},
    {name:'what_if_delay',description:'Estimate the knock-on of delaying one incomplete activity by N calendar days through the live logic (float absorbs delay). Returns activities pushed, finish movement and the most affected activities.',
      inputSchema:{type:'object',properties:{id:{type:'string'},days:{type:'number'}},required:['id','days']},
      execute(i){ const r=act(i.id); if(!r.L||r.status==='TK_Complete') throw new Error('Pick an incomplete live activity'); const d=Math.max(0,+i.days||0), delta=ifcWhatIf(r.L,d); delta.delete(r.L);
        let mf=-Infinity,mf2=-Infinity; for(const a of M.live.acts.values()){ if(a.f==null) continue; mf=Math.max(mf,a.f); mf2=Math.max(mf2,a.f+(delta.get(a)||0)*DAY); }
        return {delayed:r.code,days:d,activities_pushed:delta.size,project_finish_moves_days:Math.round((mf2-mf)/DAY),most_affected:[...delta].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([a,x])=>({id:a.code,name:a.name,project:a.proj,pushed_days:Math.round(x)}))}; }}];
}
// Markdown → safe HTML with activity links
function aiInline(t,codeMap,seen){
  let h=esc(t).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>');
  return h.replace(/(<[^>]+>)|([A-Za-z0-9][A-Za-z0-9\-_.]{2,}[A-Za-z0-9])/g,(m,tag,word)=>{ if(tag) return tag; if(!/\d/.test(word)) return word; const k=codeMap.get(word.toLowerCase()); if(!k) return word; seen.add(k); return `<button type="button" class="ailink" data-k="${esc(k)}">${word}</button>`; });
}
function aiMd(src,seen){
  const codeMap=AI.codeMap||(AI.codeMap=new Map(M.rows.map(r=>[r.code.toLowerCase(),r.k])));
  const L=String(src).replace(/\r/g,'').split('\n'), out=[]; let list=null, i=0;
  const close=()=>{ if(list){ out.push(`</${list}>`); list=null; } };
  while(i<L.length){ const l=L[i];
    if(/^\s*\|.*\|\s*$/.test(l)&&i+1<L.length&&/^\s*\|?\s*:?-{2,}/.test(L[i+1])){ close(); const cells=x=>x.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()); const hd=cells(l); i+=2; const body=[]; while(i<L.length&&/^\s*\|.*\|\s*$/.test(L[i])){ body.push(cells(L[i])); i++; }
      out.push(`<div class="tw"><table class="rt aitb"><thead><tr>${hd.map(c=>`<th>${aiInline(c,codeMap,seen)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(c=>`<td>${aiInline(c,codeMap,seen)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue; }
    let m;
    if((m=/^(#{1,4})\s+(.*)$/.exec(l))){ close(); out.push(`<h${Math.min(6,m[1].length+3)}>${aiInline(m[2],codeMap,seen)}</h${Math.min(6,m[1].length+3)}>`); }
    else if((m=/^\s*[-*•]\s+(.*)$/.exec(l))){ if(list!=='ul'){ close(); out.push('<ul>'); list='ul'; } out.push(`<li>${aiInline(m[1],codeMap,seen)}</li>`); }
    else if((m=/^\s*\d+[.)]\s+(.*)$/.exec(l))){ if(list!=='ol'){ close(); out.push('<ol>'); list='ol'; } out.push(`<li>${aiInline(m[1],codeMap,seen)}</li>`); }
    else if(!l.trim()){ close(); }
    else if(/^---+$/.test(l.trim())){ close(); out.push('<hr>'); }
    else { close(); out.push(`<p>${aiInline(l,codeMap,seen)}</p>`); }
    i++; }
  close(); return out.join('');
}
const AI_QUICK=[
  ['Executive summary','Write an executive summary of where this programme stands: forecast completion versus baseline, the main drivers of any slip, what is on the critical path, and the top risks. Suitable for a monthly report.'],
  ['What is driving the slip?','Identify what is driving the forecast slip to completion. Trace the driving logic from the latest finishing milestone back to the data date, name the activities responsible and quantify how much each contributes.'],
  ['Critical path review','Review the critical path: is it continuous and credible, where is it driven by constraints or broken logic, how much negative or near-critical float exists, and what could be accelerated.'],
  ['Interface risks','Assess the interface handovers between projects: which are late against need dates, which have weak or broken logic, and what the knock-on is if the worst one slips a further 2 weeks.'],
  ['Schedule quality','Review schedule quality using the DCMA results and the data: explain the failing checks in plain terms, name the worst offending activities and recommend fixes in priority order.'],
  ['4-week look-ahead','Produce a 4-week look-ahead from the data date: work that must start or finish, critical or near-critical items, and what must be true to hold the dates.'],
  ['Recovery options','Suggest realistic recovery options to claw back the forecast slip (resequencing, overlaps, extra crews on critical work, de-scoping), quantify the potential days for each using what-if tests where helpful, and note risks.']];
// Ask AI side panel: opens beside the current view; wide screens make room for it.
function aiPlace(){ const p=document.getElementById('aiWrap'), h=document.querySelector('.top'); p.style.top=Math.max(0,h.getBoundingClientRect().bottom)+'px'; }
function aiPanel(open){
  const p=document.getElementById('aiWrap'), b=document.getElementById('btnAi'); open=open==null?p.hidden:open;
  if(open&&!PROJ_TABS.includes(S.tab)) setTab(S.lastProj||'dash');
  p.hidden=!open; b.setAttribute('aria-expanded',open); b.classList.toggle('on',open); document.body.classList.toggle('ai-open',open);
  try{ localStorage.setItem('pacer.aiopen',open?'1':''); }catch(_){}
  if(open){ aiPlace(); renderAi(); aiCtxLabel(); setTimeout(()=>{ const q=document.getElementById('aiQ'); if(q&&!q.disabled) q.focus(); },60); }
  requestAnimationFrame(()=>{ if(typeof drawProfile==='function') drawProfile(); redraw(); });
}
function aiCtxLabel(){ const el=document.getElementById('aiCtx'); if(!el) return; const c=typeof ctxInfo==='function'?ctxInfo():null;
  el.textContent=!c||!c.ok.length?'No schedule open':c.L&&c.L.multi?`${c.prog?c.prog.name+' · ':''}${c.L.items.length} projects combined`:c.L?`${c.proj?c.proj.name:'Saved project'} · ${c.L.label}`:(schedTitle(c.ok).title||'Unsaved schedule')+(c.sample?' (demo)':''); }
function renderAi(){
  const q=document.getElementById('aiQuick');
  if(!q.childElementCount) q.innerHTML=AI_QUICK.map(([l],i)=>`<button class="aiq" data-aiq="${i}">${esc(l)}</button>`).join('');
  q.querySelectorAll('.aiq').forEach(b=>b.disabled=!AI.ready);
  aiRenderChat();
}
function aiRenderChat(){
  const el=document.getElementById('aiChat');
  if(!AI.msgs.length){ el.innerHTML=`<div class="aiempty">${AI.ready?`<h4>Start with a quick analysis above, or ask your own question.</h4><p class="muted">Claude reads the schedule digest for ${AI.scope==='filt'?'your current filters':'the whole schedule'} and can look up activities, trace driving logic and test delays. Activity IDs in answers are clickable.</p>`:AI.sample===null&&AI.checked?`<h4>AI analysis isn't available in this view.</h4><p class="muted">Open the artifact in Claude while signed in to use it.</p>`:`<h4>Connecting…</h4>`}</div>`; return; }
  el.innerHTML=AI.msgs.map((m,i)=>m.role==='user'?`<div class="aimsg u"><div class="aib">${esc(m.text)}</div></div>`
    :`<div class="aimsg a"><div class="aib">${m.html||(m.text?'':'<span class="aithink">Thinking…</span>')}</div>${m.steps&&m.steps.length?`<div class="aisteps">${m.steps.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}${m.err?`<div class="aierr">${esc(m.err)}</div>`:''}${m.keys&&m.keys.size&&!m.live?`<div class="aiact"><button class="btn sm" data-aig="${i}">Show ${m.keys.size} mentioned activities in Gantt</button><button class="btn sm" data-aicopy="${i}">Copy</button></div>`:''}</div>`).join('');
  el.scrollTop=el.scrollHeight;
}
const AI_ERR={not_granted:'Claude was not allowed for this page. You can allow it from the artifact Permissions menu.',sampling_disabled:'Claude is not available for this account.',rate_limited:'Too many requests just now. Wait a moment and try again.',session_expired:'Your session expired. Sign in again and retry.',prompt_too_large:'The schedule is too large to send in one go. Narrow it with filters and set Scope to Current filters.',refused:'Claude declined that request. Try rephrasing it.',empty_completion:'Claude returned an empty answer. Try a simpler question.',upstream_error:'The connection dropped. What arrived is kept; try again.'};
async function aiAsk(text){
  if(AI.busy||!text.trim()) return; if(!AI.sample){ setNote('AI analysis is not available in this view.'); return; }
  AI.busy=true; const ctl=AI.ctl=new AbortController(); const st=document.getElementById('aiStatus');
  document.getElementById('aiAsk').disabled=true; document.getElementById('aiStop').hidden=false; st.textContent='Thinking… the first answer can take up to a minute.';
  AI.turns.push({role:'user',content:text}); AI.msgs.push({role:'user',text}); const msg={role:'assistant',text:'',html:'',steps:[],keys:new Set(),live:true}; AI.msgs.push(msg); aiRenderChat();
  const input=[{role:'user',content:AI_RULES+'\n\nSCHEDULE DIGEST\n'+aiDigest()},...AI.turns.slice(-12)];
  let raf=0; const paint=()=>{ raf=0; const keys=new Set(); msg.html=aiMd(msg.text,keys); msg.keys=keys; aiRenderChat(); };
  const opts={signal:ctl.signal,cache:false,modelTier:AI.tier,onText:({text})=>{ msg.text=text; if(!raf) raf=requestAnimationFrame(paint); st.textContent='Writing…'; }};
  if(AI.tools){ delete opts.cache; opts.tools=aiTools().map(t=>({...t,execute:(inp,ctx)=>{ const lab={find_activities:'Searching activities',get_activity:`Reading ${inp.id||'activity'}`,trace_driving_path:`Tracing logic from ${inp.id||''}`,what_if_delay:`Testing ${inp.days||''}d delay on ${inp.id||''}`}[t.name]||t.name; msg.steps.push(lab); st.textContent=lab+'…'; aiRenderChat(); return t.execute(inp,ctx); }})); }
  try{ const res=await AI.sample(input,opts); msg.text=res.text; if(res.truncated) msg.err='The answer was cut short. Ask for less at a time.'; AI.turns.push({role:'assistant',content:res.text}); st.textContent=''; }
  catch(e){ if(e&&e.text) msg.text=e.text; else if(e&&e.code==='refused') msg.text=''; const c=e&&e.code; msg.err=c==='cancelled'?'Stopped.':(AI_ERR[c]||AI_ERR.upstream_error); if(msg.text) AI.turns.push({role:'assistant',content:msg.text}); else AI.turns.pop(); st.textContent='';
    if(c==='not_granted'||c==='sampling_disabled'){ AI.ready=false; } }
  finally{ msg.live=false; if(raf) cancelAnimationFrame(raf); const keys=new Set(); msg.html=aiMd(msg.text,keys); msg.keys=keys; AI.busy=false; AI.ctl=null; document.getElementById('aiAsk').disabled=!AI.ready; document.getElementById('aiStop').hidden=true; aiRenderChat(); }
}
function wireAi(){
  (async()=>{ try{ AI.sample=await window.claude?.use?.('sample')??null; }catch(_){ AI.sample=null; } AI.checked=true; AI.ready=!!AI.sample;
    if(AI.sample){ try{ const lim=await AI.sample.limits(); AI.tools=!!(lim&&lim.tools); }catch(_){ AI.tools=false; } }
    document.getElementById('aiAsk').disabled=!AI.ready; document.querySelectorAll('.aiq').forEach(b=>b.disabled=!AI.ready); if(!document.getElementById('aiWrap').hidden) aiRenderChat(); })();
  const w=document.getElementById('aiWrap');
  w.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.aiq!=null){ const [l,p]=AI_QUICK[+b.dataset.aiq]; aiAsk(p); }
    else if(b.dataset.ais){ AI.scope=b.dataset.ais; w.querySelectorAll('[data-ais]').forEach(x=>x.classList.toggle('on',x===b)); aiRenderChat(); }
    else if(b.dataset.aid){ AI.tier=b.dataset.aid; w.querySelectorAll('[data-aid]').forEach(x=>x.classList.toggle('on',x===b)); }
    else if(b.id==='aiNew'){ if(AI.ctl) AI.ctl.abort(); AI.turns=[]; AI.msgs=[]; aiRenderChat(); }
    else if(b.id==='aiStop'){ if(AI.ctl) AI.ctl.abort(); }
    else if(b.classList.contains('ailink')){ openDrawer(b.dataset.k); }
    else if(b.dataset.aig!=null){ const m=AI.msgs[+b.dataset.aig]; if(!m||!m.keys.size) return; S.F.ids={label:'Activities in AI answer',set:new Set(m.keys)}; renderFilters(); setTab('gantt'); applyFilters(); fitGantt(); }
    else if(b.dataset.aicopy!=null){ const m=AI.msgs[+b.dataset.aicopy]; try{ navigator.clipboard.writeText(m.text).then(()=>{ b.textContent='Copied'; },()=>{ b.textContent='Copy blocked'; }); }catch(_){ b.textContent='Copy blocked'; } } });
  document.getElementById('aiForm').addEventListener('submit',e=>{ e.preventDefault(); const q=document.getElementById('aiQ'); const t=q.value; q.value=''; aiAsk(t); });
  document.getElementById('aiQ').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); document.getElementById('aiForm').requestSubmit(); } });
}

