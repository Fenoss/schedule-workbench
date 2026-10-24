/* ================= Risk Workbench: AI =================
   Ask AI about the registers (with tools to look up risks, the open schedule, and to draft new risks or
   propose changes for review), identify risks from the schedule, documents and a brief, quantify risks
   (one at a time in the editor or in bulk), and help word, score and plan responses. Nothing is saved
   until the user accepts it. */
const RKAI={turns:[],msgs:[],busy:false,ctl:null,tier:'default',open:false,id:null,bq:null};
const AISPARK='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor"/><circle cx="18.5" cy="17.5" r="1.8" fill="currentColor"/><circle cx="6" cy="18" r="1.2" fill="currentColor"/></svg>';
function rkAiOk(){ return typeof AI!=='undefined'&&!!AI.sample&&!(typeof PER!=='undefined'&&PER.mode==='supa'&&PER.site&&PER.site.ai===false); }
function rkAiWhy(){ return typeof AI!=='undefined'&&AI.checked&&!AI.sample?'AI isn’t available in this view. Sign in to the hosted site, or open the artifact in Claude.':'Connecting to AI…'; }

/* ---- context for the model ---- */
function rkRegKey(sc){ if(!sc||sc.lv==='portfolio') return 'PORTFOLIO'; const x=sc.lv==='programme'?rkProg(sc.id):rkProj(sc.id); return x?(x.code||x.name):'?'; }
function rkRegFind(key){ const k=String(key||'').trim().toLowerCase(); if(!k||k==='portfolio') return {lv:'portfolio',id:null};
  const g=(PER.programmes||[]).find(x=>(x.code||'').toLowerCase()===k||x.name.toLowerCase()===k); if(g) return {lv:'programme',id:g.id};
  const p=(PER.projects||[]).find(x=>(x.code||'').toLowerCase()===k||x.name.toLowerCase()===k); if(p) return {lv:'project',id:p.id}; return null; }
function rkAiStructure(){ const L=['REGISTERS (use the key in the first column to name a register)','key|level|name|programme|manager|status|schedule (data date, forecast finish, variance vs baseline, % complete)|description'];
  L.push(`PORTFOLIO|portfolio|${rkPortName()}||||`);
  (PER.programmes||[]).forEach(g=>{ L.push([rkRegKey({lv:'programme',id:g.id}),'programme',g.name,'','','',g.client?'client '+g.client:'',g.description||''].join('|'));
    PER.projects.filter(p=>p.programmeId===g.id).forEach(p=>{ const s=p.summary||{}; L.push([rkRegKey({lv:'project',id:p.id}),'project',p.name,g.name,p.manager||'',PSTAT[p.status]||p.status||'',s.dd!=null?`${aiFmt(s.dd)}, ${aiFmt(s.finish)}, ${s.finish!=null&&s.blFinish!=null?Math.round((s.finish-s.blFinish)/DAY)+'d':'-'}, ${s.pctA!=null?Math.round(s.pctA*100)+'%':'-'}`:'no schedule saved',p.description||''].join('|')); }); });
  PER.projects.filter(p=>!p.programmeId||!PER.programmes.some(g=>g.id===p.programmeId)).forEach(p=>L.push([rkRegKey({lv:'project',id:p.id}),'project',p.name,'',p.manager||'',p.status||'','',p.description||''].join('|')));
  return L.join('\n').slice(0,10000); }
function rkAiCfgText(){ const c=rkCfg(), prev=[0].concat(c.prob.map(p=>p.max));
  const L=[`SCORING (score = probability 1-5 × the highest impact 1-5; currency ${c.cur})`,'Probability: '+c.prob.map((p,i)=>`${i+1}=${p.l} (${prev[i]}-${p.max}%)`).join('; ')];
  c.dims.forEach(d=>{ L.push(`Impact "${d.id}" (${d.l}): `+[1,2,3,4,5].map(i=>{ if(d.kind==='cost'||d.kind==='time'){ const b=d.b, u=d.kind==='cost'?c.cur:'', s=d.kind==='time'?' days':''; return `${i}=${i===1?`<=${u}${b[0]}${s}`:i===5?`>${u}${b[3]}${s}`:`${u}${b[i-2]}-${u}${b[i-1]}${s}`}`; } return `${i}=${(d.d||[])[i-1]||c.ilab[i-1]}`; }).join('; ')); });
  L.push('Ratings: '+c.bands.map((b,i)=>`${b.l} up to ${b.max}`).join('; '));
  L.push('Categories: '+c.cats.join('; ')); L.push('Response strategies: threats avoid|reduce|transfer|accept; opportunities exploit|enhance|share|accept.');
  return L.join('\n'); }
function rkAiRiskLine(r,full){ const d=r.d||{}, q=d.qt||{}, t3=t=>t&&[t.min,t.ml,t.max].some(x=>x!==''&&x!=null)?[t.min,t.ml,t.max].map(x=>x===''||x==null?'-':x).join('/'):'-', s=rkCurScore(r);
  const base=[r.ref,r.level,rkRegKey(rkScopeOf(r)),r.title,d.type==='opp'?'opportunity':'threat',d.cat||'',RST[r.status]||r.status,d.owner||'',s==null?'-':`${s} ${rkBand(s).l}`,rkQS(r,'pre')??'-',rkQS(r,'tgt')??'-',q.p!==''&&q.p!=null?q.p+'%':'-',t3(q.cost),t3(q.time),Math.round(rkEV(r,false,'cost')),Math.round(rkEV(r,false,'time')),(d.resp||{}).strat||'-',rkOpenActs(r).length,(rkById(r.parentId)||{}).ref||'-',rkIfcPids(r).map(id=>rkRegKey({lv:'project',id})).join(' ')||'-',q.acts||'-'];
  if(full) base.push(`cause: ${d.cause||'-'}; event: ${d.event||'-'}; effect: ${d.effect||'-'}`);
  return base.join('|'); }
const RK_AI_HEAD='ref|level|register|title|type|category|status|owner|current score|inherent|target|probability|cost min/likely/max|days min/likely/max|cost EV|days EV|response|open actions|parent|interface projects|activities';
function rkAiRegister(list,full){ const L=[RK_AI_HEAD+(full?'|cause-event-effect':'')]; list.slice(0,180).forEach(r=>L.push(rkAiRiskLine(r,full))); return L.join('\n').slice(0,full?45000:30000); }
function rkAiSchedOpen(){ return typeof M!=='undefined'&&M&&M.rows&&M.rows.length&&S.files.some(f=>!f.error&&f.role!=='off'); }
function rkAiSchedName(){ try{ const c=ctxInfo(); return c.L?(c.L.multi?`${c.L.items.length} projects combined`:`${c.proj?c.proj.name:'Saved project'} · ${c.L.label}`):(schedTitle(c.ok).title||'Unsaved schedule')+(c.sample?' (demo)':''); }catch(_){ return 'the open schedule'; } }
function rkAiSched(max){ if(!rkAiSchedOpen()) return ''; const sv=AI.scope; AI.scope='all'; let t=''; try{ t=aiDigest(); }catch(_){ t=''; } AI.scope=sv; return t.slice(0,max||30000); }

/* ---- turning model output into risks ---- */
const rkAiNum=v=>v===''||v==null||!isFinite(+v)?'':+v;
const rkAi3=t=>t&&typeof t==='object'?{min:rkAiNum(t.min),ml:rkAiNum(t.likely??t.ml??t.most_likely),max:rkAiNum(t.max)}:{min:'',ml:'',max:''};
function rkAiScores(s){ const c=rkCfg(), o={p:0,i:{}}; if(!s||typeof s!=='object') return o; o.p=Math.max(0,Math.min(5,Math.round(+s.p||+s.probability||0)));
  const I=s.i||s.impacts||s; c.dims.forEach(d=>{ const v=Math.round(+(I[d.id]??(d.kind==='time'?I.schedule:undefined)??0)); if(v>0) o.i[d.id]=Math.min(5,v); }); return o; }
function rkAiDist(x){ x=String(x||'').toLowerCase(); return x.startsWith('pert')?'pert':x.startsWith('uni')?'uni':'tri'; }
function rkAiStrat(x,type){ x=String(x||'').toLowerCase(); return RSTRAT[type==='opp'?'opp':'threat'].some(s=>s[0]===x)?x:''; }
function rkAiToRisk(j,def,src){ const sc=rkRegFind(j.register)||def||RK.scope, r=rkBlank(sc), c=rkCfg(), d=r.d;
  r.title=String(j.title||'').slice(0,200); d.type=/opp/i.test(j.type||'')?'opp':'threat'; d.cat=c.cats.find(x=>x.toLowerCase()===String(j.category||'').toLowerCase())||String(j.category||'');
  d.owner=String(j.owner||''); d.cause=String(j.cause||''); d.event=String(j.event||''); d.effect=String(j.effect||'');
  const S0=j.scores||{}; d.q={pre:rkAiScores(S0.inherent||S0.pre),cur:rkAiScores(S0.current||S0.cur||S0.inherent),tgt:rkAiScores(S0.target||S0.tgt)};
  d.qt.p=rkAiNum(j.probability_pct); d.qt.cost=rkAi3(j.cost); d.qt.time=rkAi3(j.days); d.qt.dist=rkAiDist(j.distribution); d.qt.acts=(j.activities||[]).join(', ');
  if(j.post_response&&typeof j.post_response==='object'){ d.qt.post={p:rkAiNum(j.post_response.probability_pct),cost:rkAi3(j.post_response.cost),time:rkAi3(j.post_response.days)}; }
  const rp=j.response||{}; d.resp.strat=rkAiStrat(rp.strategy,d.type); d.resp.plan=String(rp.plan||''); d.resp.trigger=String(rp.trigger||''); d.resp.fallback=String(rp.fallback||''); d.resp.owner=String(rp.owner||d.owner||'');
  d.actions=(rp.actions||[]).filter(a=>a&&(a.action||a.text)).slice(0,8).map((a,i)=>({id:'a'+i+Math.random().toString(36).slice(2,6),t:String(a.action||a.text),owner:String(a.owner||d.resp.owner||''),due:rkToday()+Math.max(1,Math.round(+a.due_in_days||14))*DAY,status:'todo',cost:rkAiNum(a.cost)}));
  const ip=(j.interface_projects||[]).map(k=>rkRegFind(k)).filter(x=>x&&x.lv==='project').map(x=>x.id); if(ip.length>=2||(ip.length&&r.level==='project')){ d.ifc={on:true,pids:[...new Set(ip.concat(r.level==='project'?[r.projectId]:[]))],code:String(j.interface_id||'')}; }
  const par=j.parent_ref&&RK.risks.find(x=>x.ref===j.parent_ref); if(par&&rkParentOptions(r).some(p=>p.id===par.id)) r.parentId=par.id;
  d.ai={src:src||'ai',at:Date.now(),conf:String(j.confidence||''),why:String(j.rationale||''),ev:Array.isArray(j.evidence)?j.evidence.map(String).slice(0,5):[]};
  const dup=j.duplicate_of&&RK.risks.find(x=>x.ref===j.duplicate_of); return {r,dup:dup||null,sel:!dup}; }
const RK_AI_RISK_SCHEMA=`{"title":"short name","type":"threat|opportunity","category":"one of the categories","register":"register key from REGISTERS","cause":"because of…","event":"…this may happen…","effect":"…leading to…","owner":"role, e.g. Package Manager","probability_pct":0-100,"cost":{"min":n,"likely":n,"max":n},"days":{"min":n,"likely":n,"max":n},"distribution":"triangular|pert|uniform","activities":["activity IDs from the schedule"],"interface_projects":["project keys, only for interface risks"],"interface_id":"","parent_ref":"existing higher-level risk ref it rolls up to, or null","scores":{"inherent":{"p":1-5,"i":{"<impact id>":1-5}},"current":{…},"target":{…}},"response":{"strategy":"…","owner":"role","plan":"…","trigger":"early warning","fallback":"…","actions":[{"action":"…","owner":"role","due_in_days":n,"cost":n}]},"rationale":"why this is a risk here, citing the evidence","evidence":["short quotes or activity IDs"],"confidence":"low|medium|high","duplicate_of":"ref of an existing risk it repeats, or null"}`;
const RK_AI_RULES=()=>`You are a senior risk manager on major infrastructure programmes (ISO 31000, PMI risk practice standard, AACE 40R-08 / 57R-09 integrated cost and schedule risk analysis). The user is an experienced programme controls director: be direct and technical.
Rules:
- Use ONLY the data below, the documents provided and the results of tools. If something isn't in the data, say so.
- Write risks as cause → event → effect. Keep threats and opportunities distinct. Avoid generic risks that would apply to any project unless the data makes them specific.
- Quantify: probability in %, cost in ${rkCfg().cur} as min / most likely / max if it happens, schedule in calendar days of delay to the affected milestone or finish. Three-point ranges should be realistic and right-skewed for threats.
- Score with the scoring scheme below. The current score reflects responses in place now; the target reflects planned responses completed.
- Quote risk refs (e.g. PF-R001) and activity IDs exactly as written.`;

/* ---- Ask AI panel ---- */
const RK_AI_QUICK=[
  ['Risk summary','Write a board-level risk summary for this register: overall exposure and trend, the top 5 risks and why they matter, interface and escalation issues, overdue actions, and the decisions needed. Keep it under 350 words.'],
  ['Find missing risks','Identify important risks that are missing from this register, using the schedule (critical and near-critical path, interfaces, slipping work, long activities, constraints) and the register structure. Avoid duplicates of existing risks. Call draft_risks with your best 6-10, fully quantified and scored.'],
  ['Quantify gaps','Find live risks in this register without a three-point estimate (or with an unrealistic one) and propose probability, cost and schedule ranges for each using propose_changes. Explain the basis briefly.'],
  ['Review register quality','Review the register quality: duplicates, risks not written as cause-event-effect, scores inconsistent with the estimates, missing owners or responses, stale reviews, risks that should be escalated or linked to a parent, interface risks owned at the wrong level. Fix what you can with propose_changes and list the rest.'],
  ['Strengthen responses','For the highest-rated threats, assess whether the responses are adequate. Propose stronger responses and specific actions with owners and due dates using propose_changes.'],
  ['Schedule exposure','Using the schedule tools, test the delay impact of the top schedule risks on the finish (what-if delays on the linked activities) and say which risks really drive the end date. Propose activity links where missing.']];
function rkAiWrap(){ let w=document.getElementById('rkAiWrap'); if(w) return w;
  w=document.createElement('aside'); w.className='aipanel rk-aip'; w.id='rkAiWrap'; w.setAttribute('aria-label','Ask AI about risk'); w.hidden=true;
  w.innerHTML=`<div class="aip-h"><div class="aibadge" aria-hidden="true">${AISPARK.replace('width="16" height="16"','width="20" height="20"')}</div><div class="aip-t"><h3>Ask AI</h3><span class="muted" id="rkAiCtx"></span></div><button class="fx" data-rkai="close" aria-label="Close AI panel">×</button></div>
    <div class="aiopts"><div class="sg" role="group" aria-label="Depth"><button data-rkaid="default" class="on">Standard</button><button data-rkaid="complex">Deep</button></div><button class="btn sm" data-rkai="new">New chat</button><button class="btn sm" data-rkai="identify">Identify risks…</button></div>
    <div class="aiquick" id="rkAiQuick">${RK_AI_QUICK.map(([l],i)=>`<button class="aiq" data-rkaiq="${i}">${esc(l)}</button>`).join('')}</div>
    <div class="aichat" id="rkAiChat" aria-live="polite"></div>
    <form class="aiform" id="rkAiForm"><textarea id="rkAiQ" rows="2" placeholder="Ask about these risks, e.g. Which risks threaten the systems handover and what would you add?" aria-label="Question"></textarea><div class="aifb"><span class="muted" id="rkAiStatus"></span><button type="button" class="btn sm" id="rkAiStop" hidden>Stop</button><button type="submit" class="btn sm primary" id="rkAiAsk">Ask</button></div></form>
    <div class="note">Answers come from your registers, the open schedule and Claude’s judgement and may contain mistakes. Nothing changes until you add or apply it.</div>`;
  document.body.appendChild(w);
  w.addEventListener('click',rkAiPanelClick); w.addEventListener('change',e=>{ const t=e.target; if(t.dataset.rkdsel){ const [mi,i]=t.dataset.rkdsel.split(':'); const m=RKAI.msgs[+mi]; if(m&&m.drafts[+i]) m.drafts[+i].sel=t.checked; rkAiChatRender(); } if(t.dataset.rkcsel){ const [mi,i]=t.dataset.rkcsel.split(':'); const m=RKAI.msgs[+mi]; if(m&&m.changes[+i]) m.changes[+i].sel=t.checked; rkAiChatRender(); } });
  w.querySelector('#rkAiForm').addEventListener('submit',e=>{ e.preventDefault(); const q=document.getElementById('rkAiQ'); const t=q.value; q.value=''; rkAiAsk(t); });
  w.querySelector('#rkAiQ').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); document.getElementById('rkAiForm').requestSubmit(); } });
  w.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); rkAiPanel(false); } });
  return w; }
function rkAiPanel(open){ const w=rkAiWrap(); open=open==null?w.hidden:open; w.hidden=!open; RKAI.open=open; document.body.classList.toggle('ai-open',open);
  document.querySelectorAll('[data-rk="ai"]').forEach(b=>{ b.classList.toggle('on',open); b.setAttribute('aria-expanded',open); });
  if(open){ const h=document.querySelector('.top'); w.style.top=Math.max(0,h.getBoundingClientRect().bottom)+'px'; rkAiCtx(); rkAiChatRender(); setTimeout(()=>{ const q=document.getElementById('rkAiQ'); if(q&&!q.disabled) q.focus(); },60); } }
function rkAiCtx(){ const el=document.getElementById('rkAiCtx'); if(!el) return; el.textContent=`${rkScopeName(RK.scope)}${RK.roll&&RK.scope.lv!=='project'?' and below':''}${rkAiSchedOpen()?' · schedule: '+rkAiSchedName():' · no schedule open'}`; }
function rkAiMd(text){ const sv=AI.codeMap; AI.codeMap=new Map(RK.risks.filter(r=>r.ref).map(r=>[r.ref.toLowerCase(),'rk:'+r.id])); try{ return aiMd(text,new Set()); }finally{ AI.codeMap=sv; } }
function rkAiChatRender(){ const el=document.getElementById('rkAiChat'); if(!el) return; const ok=rkAiOk();
  document.getElementById('rkAiAsk').disabled=!ok||RKAI.busy; document.querySelectorAll('#rkAiQuick .aiq').forEach(b=>b.disabled=!ok||RKAI.busy);
  if(!RKAI.msgs.length){ el.innerHTML=`<div class="aiempty">${ok?`<h4>Ask about the risks in ${esc(rkScopeName(RK.scope))}, or start with a quick analysis.</h4><p class="muted">Claude reads the register${RK.roll&&RK.scope.lv!=='project'?' and the registers below it':''}${rkAiSchedOpen()?` and the open schedule (${esc(rkAiSchedName())})`:''}. It can draft new risks and propose changes for you to review. Open a project’s schedule in the Schedule Workbench to let it test delays on real activities.</p>`:`<h4>${esc(rkAiWhy())}</h4>`}</div>`; return; }
  el.innerHTML=RKAI.msgs.map((m,mi)=>m.role==='user'?`<div class="aimsg u"><div class="aib">${esc(m.text)}</div></div>`
    :`<div class="aimsg a"><div class="aib">${m.html||(m.text?'':'<span class="aithink">Thinking…</span>')}</div>${m.steps.length?`<div class="aisteps">${m.steps.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}${m.err?`<div class="aierr">${esc(m.err)}</div>`:''}${rkAiDraftsHtml(m,mi)}${rkAiChangesHtml(m,mi)}${!m.live&&m.text?`<div class="aiact"><button class="btn sm" data-rkaicopy="${mi}">Copy</button></div>`:''}</div>`).join('');
  el.scrollTop=el.scrollHeight; }
function rkAiDraftsHtml(m,mi){ if(!m.drafts||!m.drafts.length) return ''; const n=m.drafts.filter(x=>x.sel&&!x.added).length;
  return `<div class="rk-aic"><div class="rk-aich"><b>${m.drafts.length} draft risk${m.drafts.length===1?'':'s'}</b><span class="muted">tick the ones to add</span></div>${m.drafts.map((x,i)=>`<label class="rk-aid${x.added?' done':''}"><input type="checkbox" data-rkdsel="${mi}:${i}" ${x.sel?'checked':''} ${x.added?'disabled':''}><span class="rk-aidt"><b>${esc(x.r.title)}</b><span class="muted">${esc(rkScopeName(rkScopeOf(x.r)))} · ${esc(x.r.d.cat||'')}${x.dup?` · <span class="amber">may repeat ${esc(x.dup.ref)}</span>`:''}${x.added?(x.added==='editing'?' · opened in the editor':' · added'):''}</span></span>${rkChip(rkCurScore(x.r),{short:1})}<span class="num">${rkMoney(rkEV(x.r,false,'cost'))}</span><button type="button" class="link" data-rkdopen="${mi}:${i}">Open</button></label>`).join('')}
    <div class="aiact"><button class="btn sm primary" data-rkdadd="${mi}" ${n&&rkCanEdit()?'':'disabled'}>Add ${n} to the register${n===1?'':'s'}</button>${rkCanEdit()?'':'<span class="muted">View-only access</span>'}</div></div>`; }
function rkAiChangesHtml(m,mi){ if(!m.changes||!m.changes.length) return ''; const n=m.changes.filter(x=>x.sel&&!x.done).length;
  return `<div class="rk-aic"><div class="rk-aich"><b>${m.changes.length} proposed change${m.changes.length===1?'':'s'}</b><span class="muted">tick the ones to apply</span></div>${m.changes.map((x,i)=>`<label class="rk-aid${x.done?' done':''}"><input type="checkbox" data-rkcsel="${mi}:${i}" ${x.sel?'checked':''} ${x.done?'disabled':''}><span class="rk-aidt"><b>${esc(x.ref)} ${esc((rkById(x.id)||{}).title||'')}</b><span class="muted">${esc(x.summary)}${x.why?' — '+esc(x.why):''}${x.done?' · applied':''}</span></span></label>`).join('')}
    <div class="aiact"><button class="btn sm primary" data-rkcapply="${mi}" ${n&&rkCanEdit()?'':'disabled'}>Apply ${n} change${n===1?'':'s'}</button></div></div>`; }
function rkAiTools(msg){ const st=t=>{ msg.steps.push(t); const s=document.getElementById('rkAiStatus'); if(s) s.textContent=t+'…'; rkAiChatRender(); };
  const tools=[
    {name:'find_risks',description:'Search all risks the user can see (every register, not only the one in view). Filters are optional and combine. Returns up to `limit` (max 60) risk lines.',
      inputSchema:{type:'object',properties:{text:{type:'string'},register:{type:'string',description:'Register key'},level:{type:'string',enum:['portfolio','programme','project']},status:{type:'string',enum:['live','all','closed','occurred']},category:{type:'string'},min_score:{type:'number'},interface_only:{type:'boolean'},limit:{type:'number'}}},
      execute(i){ st('Searching risks'); const q=String(i.text||'').toLowerCase(), sc=i.register?rkRegFind(i.register):null;
        const L=RK.risks.filter(r=>(!q||[r.ref,r.title,r.d.cause,r.d.event,r.d.effect,r.d.cat,r.d.owner].some(x=>String(x||'').toLowerCase().includes(q)))&&(!sc||rkIn(r,sc,true))&&(!i.level||r.level===i.level)&&((i.status||'live')==='all'||((i.status||'live')==='live'?rkLive(r):r.status===i.status))&&(!i.category||(r.d.cat||'').toLowerCase()===String(i.category).toLowerCase())&&(i.min_score==null||(rkCurScore(r)||0)>=+i.min_score)&&(!i.interface_only||rkIsIfc(r)));
        return {total:L.length,header:RK_AI_HEAD,risks:L.slice(0,Math.min(60,+i.limit||30)).map(r=>rkAiRiskLine(r,false))}; }},
    {name:'get_risk',description:'Full detail of one risk by ref: wording, all scores, estimates, response, actions, parent and children, interface and history.',
      inputSchema:{type:'object',properties:{ref:{type:'string'}},required:['ref']},
      execute(i){ const r=RK.risks.find(x=>x.ref.toLowerCase()===String(i.ref||'').toLowerCase()); if(!r) throw new Error('No risk '+i.ref); st('Reading '+r.ref); const d=r.d;
        return {line:rkAiRiskLine(r,true),header:RK_AI_HEAD,scores:{inherent:d.q&&d.q.pre,current:d.q&&d.q.cur,target:d.q&&d.q.tgt},estimate:d.qt,response:d.resp,actions:rkActs(r).map(a=>({action:a.t,owner:a.owner,due:aiFmt(a.due),status:RACT[a.status]})),children:rkKids(r).map(k=>k.ref+' '+k.title),history:(d.hist||[]).slice(-6).map(h=>({date:aiFmt(h.at),current:h.cur,cost_ev:h.ev,status:h.st})),notes:d.desc||''}; }},
    {name:'draft_risks',description:'Show new risks to the user as drafts they can review and add. Use this whenever you recommend new risks. Each risk follows this shape: '+RK_AI_RISK_SCHEMA,
      inputSchema:{type:'object',properties:{risks:{type:'array',items:{type:'object'}}},required:['risks']},
      execute(i){ const L=(i.risks||[]).filter(x=>x&&x.title).slice(0,25).map(j=>rkAiToRisk(j,RK.scope,'chat')); msg.drafts=(msg.drafts||[]).concat(L); st(`Drafted ${L.length} risk${L.length===1?'':'s'}`); return {shown_to_user:L.length,note:'The user reviews and adds them. Do not repeat their details in full in your answer; summarise.'}; }},
    {name:'propose_changes',description:'Propose changes to existing risks for the user to review and apply. Only include fields you want to change. Fields: title, cause, event, effect, category, owner, status (draft|open|monitor|occurred|closed), probability_pct, cost {min,likely,max}, days {min,likely,max}, distribution, activities [ids], scores {inherent|current|target: {p, i:{impact id:1-5}}}, strategy, response_plan, add_actions [{action, owner, due_in_days, cost}], parent_ref, register (key). Give a short reason for each.',
      inputSchema:{type:'object',properties:{changes:{type:'array',items:{type:'object',properties:{ref:{type:'string'},reason:{type:'string'}},required:['ref']}}},required:['changes']},
      execute(i){ const out=[]; (i.changes||[]).slice(0,40).forEach(c=>{ const r=RK.risks.find(x=>x.ref.toLowerCase()===String(c.ref||'').toLowerCase()); if(!r) return; const s=rkAiChangeSummary(c); if(!s) return; out.push({id:r.id,ref:r.ref,patch:c,summary:s,why:String(c.reason||''),sel:true}); });
        msg.changes=(msg.changes||[]).concat(out); st(`Proposed ${out.length} change${out.length===1?'':'s'}`); return {shown_to_user:out.length,skipped:(i.changes||[]).length-out.length}; }}];
  if(rkAiSchedOpen()&&typeof aiTools==='function') tools.push(...aiTools().map(t=>({...t,execute:(inp,ctx)=>{ st({find_activities:'Searching activities',get_activity:`Reading activity ${inp.id||''}`,trace_driving_path:`Tracing logic from ${inp.id||''}`,what_if_delay:`Testing a ${inp.days||''}d delay on ${inp.id||''}`}[t.name]||t.name); const sv=AI.scope; AI.scope='all'; try{ return t.execute(inp,ctx); }finally{ AI.scope=sv; } }})));
  return tools; }
function rkAiChangeSummary(c){ const p=[], f=k=>k in c&&c[k]!=null&&c[k]!=='';
  if(f('title')||f('cause')||f('event')||f('effect')) p.push('rewords it'); if(f('category')) p.push('category → '+c.category); if(f('owner')) p.push('owner → '+c.owner); if(f('status')) p.push('status → '+(RST[c.status]||c.status));
  if(f('probability_pct')) p.push(`probability ${c.probability_pct}%`); if(c.cost) p.push(`cost ${rkMoney(+c.cost.min||0)}/${rkMoney(+(c.cost.likely??c.cost.ml)||0)}/${rkMoney(+c.cost.max||0)}`); if(c.days) p.push(`days ${c.days.min??'-'}/${c.days.likely??c.days.ml??'-'}/${c.days.max??'-'}`);
  if(c.scores) p.push('rescored '+Object.keys(c.scores).join(', ')); if(f('strategy')) p.push('response → '+c.strategy); if(f('response_plan')) p.push('new response plan'); if(Array.isArray(c.add_actions)&&c.add_actions.length) p.push(`${c.add_actions.length} action${c.add_actions.length===1?'':'s'}`);
  if(f('parent_ref')) p.push('roll up to '+c.parent_ref); if(f('register')) p.push('move to '+c.register); if(Array.isArray(c.activities)&&c.activities.length) p.push('links '+c.activities.slice(0,4).join(', '));
  return p.join(' · '); }
function rkAiApplyChange(r,c){ const x=rkClone(r), d=x.d; d.qt=Object.assign(rkBlank(rkScopeOf(r)).d.qt,d.qt||{}); d.resp=Object.assign({},d.resp||{}); d.q=Object.assign({},d.q||{});
  ['title'].forEach(k=>{ if(c[k]) x.title=String(c[k]); }); ['cause','event','effect','owner'].forEach(k=>{ if(c[k]) d[k]=String(c[k]); });
  if(c.category) d.cat=String(c.category); if(c.status&&RST[c.status]) x.status=c.status;
  if(c.probability_pct!=null&&c.probability_pct!=='') d.qt.p=rkAiNum(c.probability_pct); if(c.cost) d.qt.cost=rkAi3(c.cost); if(c.days) d.qt.time=rkAi3(c.days); if(c.distribution) d.qt.dist=rkAiDist(c.distribution);
  if(Array.isArray(c.activities)) d.qt.acts=c.activities.join(', ');
  if(c.scores){ const M0={inherent:'pre',pre:'pre',current:'cur',cur:'cur',target:'tgt',tgt:'tgt'}; Object.entries(c.scores).forEach(([k,v])=>{ if(M0[k]) d.q[M0[k]]=rkAiScores(v); }); }
  if(c.strategy){ const s=rkAiStrat(c.strategy,d.type); if(s) d.resp.strat=s; } if(c.response_plan) d.resp.plan=String(c.response_plan);
  if(Array.isArray(c.add_actions)) d.actions=(d.actions||[]).concat(c.add_actions.filter(a=>a&&(a.action||a.text)).map((a,i)=>({id:'a'+Date.now().toString(36)+i,t:String(a.action||a.text),owner:String(a.owner||d.resp.owner||d.owner||''),due:rkToday()+Math.max(1,Math.round(+a.due_in_days||14))*DAY,status:'todo',cost:rkAiNum(a.cost)})));
  if(c.register){ const sc=rkRegFind(c.register); if(sc){ x.level=sc.lv; x.programmeId=sc.lv==='programme'?sc.id:null; x.projectId=sc.lv==='project'?sc.id:null; } }
  if(c.parent_ref){ const p=RK.risks.find(y=>y.ref===c.parent_ref); if(p&&rkParentOptions(x).some(o=>o.id===p.id)) x.parentId=p.id; }
  d.ai=Object.assign({},d.ai||{},{edited:Date.now()}); return x; }
async function rkAiAsk(text){ if(RKAI.busy||!String(text).trim()) return; if(!rkAiOk()){ perToast(rkAiWhy(),'err'); return; }
  RKAI.busy=true; const ctl=RKAI.ctl=new AbortController(), st=document.getElementById('rkAiStatus');
  document.getElementById('rkAiStop').hidden=false; st.textContent='Thinking… the first answer can take up to a minute.';
  RKAI.turns.push({role:'user',content:text}); RKAI.msgs.push({role:'user',text}); const msg={role:'assistant',text:'',html:'',steps:[],drafts:[],changes:[],live:true}; RKAI.msgs.push(msg); rkAiChatRender();
  const vis=rkVis(), sched=rkAiSched(26000);
  const ctx=`${RK_AI_RULES()}
- When you recommend new risks, call draft_risks. When you recommend changes to existing risks, call propose_changes. Nothing is saved until the user accepts it, so say what you proposed.
- Format in Markdown: a one-line headline, then short sections with bullets; tables at most 5 columns. Keep it under about 350 words unless asked for more.

${rkAiCfgText()}

${rkAiStructure()}

REGISTER IN VIEW: ${rkScopeName(RK.scope)} (${RLV_L[RK.scope.lv]} register${RK.roll&&RK.scope.lv!=='project'?', including the registers below it':''}). ${vis.length} risks.
${rkAiRegister(vis,true)}
${sched?`\nOPEN SCHEDULE: ${rkAiSchedName()}\n${sched}`:'\nNo schedule is open in the Schedule Workbench, so schedule tools are not available.'}
Today: ${aiFmt(rkToday())}`;
  const input=[{role:'user',content:ctx},...RKAI.turns.slice(-12)];
  let raf=0; const paint=()=>{ raf=0; msg.html=rkAiMd(msg.text); rkAiChatRender(); };
  const opts={signal:ctl.signal,modelTier:RKAI.tier,onText:({text})=>{ msg.text=text; if(!raf) raf=requestAnimationFrame(paint); st.textContent='Writing…'; }};
  if(AI.tools) opts.tools=rkAiTools(msg); else opts.cache=false;
  try{ const res=await AI.sample(input,opts); msg.text=res.text; if(res.truncated) msg.err='The answer was cut short. Ask for less at a time.'; RKAI.turns.push({role:'assistant',content:res.text||'(proposed items for review)'}); st.textContent=''; }
  catch(e){ if(e&&e.text) msg.text=e.text; const c=e&&e.code; msg.err=c==='cancelled'?'Stopped.':(AI_ERR[c]||AI_ERR.upstream_error); if(msg.text) RKAI.turns.push({role:'assistant',content:msg.text}); else RKAI.turns.pop(); st.textContent=''; }
  finally{ msg.live=false; if(raf) cancelAnimationFrame(raf); msg.html=rkAiMd(msg.text); RKAI.busy=false; RKAI.ctl=null; document.getElementById('rkAiStop').hidden=true; rkAiChatRender(); } }
async function rkAiPanelClick(e){ const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.rkai==='close') rkAiPanel(false); else if(b.dataset.rkai==='new'){ if(RKAI.ctl) RKAI.ctl.abort(); RKAI.turns=[]; RKAI.msgs=[]; rkAiChatRender(); } else if(b.dataset.rkai==='identify') rkIdOpen();
  else if(b.dataset.rkaiq!=null) rkAiAsk(RK_AI_QUICK[+b.dataset.rkaiq][1]);
  else if(b.dataset.rkaid){ RKAI.tier=b.dataset.rkaid; b.parentNode.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); }
  else if(b.id==='rkAiStop'){ if(RKAI.ctl) RKAI.ctl.abort(); }
  else if(b.classList.contains('ailink')&&String(b.dataset.k).startsWith('rk:')){ const r=rkById(b.dataset.k.slice(3)); if(r) rkOpen(r,'det'); }
  else if(b.dataset.rkaicopy!=null){ const m=RKAI.msgs[+b.dataset.rkaicopy]; try{ navigator.clipboard.writeText(m.text).then(()=>{ b.textContent='Copied'; },()=>{ b.textContent='Copy blocked'; }); }catch(_){ b.textContent='Copy blocked'; } }
  else if(b.dataset.rkdopen){ e.preventDefault(); const [mi,i]=b.dataset.rkdopen.split(':'), x=RKAI.msgs[+mi].drafts[+i]; if(x&&!x.added){ x.r.ref=''; x.added='editing'; x.sel=false; rkAiChatRender(); rkOpen(x.r,'det',true); } }
  else if(b.dataset.rkdadd!=null){ const m=RKAI.msgs[+b.dataset.rkdadd]; b.disabled=true; const n=await rkAiAddDrafts(m.drafts); perToast(`Added ${n} risk${n===1?'':'s'} drafted by AI.`); rkAiChatRender(); }
  else if(b.dataset.rkcapply!=null){ const m=RKAI.msgs[+b.dataset.rkcapply]; b.disabled=true; let n=0; for(const x of m.changes.filter(y=>y.sel&&!y.done)){ const r=rkById(x.id); if(!r) continue; try{ await rkUpdate(rkAiApplyChange(r,x.patch)); x.done=true; n++; }catch(er){ perToast(perErr(er),'err'); break; } } perToast(`Applied ${n} change${n===1?'':'s'}.`); rkAiChatRender(); } }
async function rkAiAddDrafts(list){ let n=0; const refs={};
  for(const x of list.filter(y=>y.sel&&!y.added)){ const r=x.r, sc=rkScopeOf(r), code=rkScopeCode(sc); const pre=code+'-R';
    if(refs[code]==null){ let m=0; RK.risks.forEach(k=>{ if(String(k.ref).startsWith(pre)){ const v=parseInt(String(k.ref).slice(pre.length),10); if(v>m) m=v; } }); refs[code]=m; }
    r.ref=pre+String(++refs[code]).padStart(3,'0');
    try{ await rkCreate(r); x.added=true; n++; }catch(er){ perToast(perErr(er),'err'); break; } }
  return n; }

/* ---- Identify risks (from the schedule, documents and a brief) ---- */
async function rkReadDoc(f){ const ext=(f.name.split('.').pop()||'').toLowerCase(), d={name:f.name,text:'',images:[],note:'',ok:false};
  try{ if(/^(png|jpe?g|webp|gif)$/.test(ext)){ d.images=[f]; d.note='Image'; }
    else if(/^(csv|txt|md|json|tsv)$/.test(ext)){ d.text=(await f.text()).slice(0,80000); d.note=`${Math.max(1,Math.round(d.text.length/1000))}k characters`; }
    else if(ext==='xer'){ const T=parseXER(await baReadText(f)); d.text=baXerDigest(T); d.note=`${(T.TASK||[]).length} activities`; }
    else if(/^(xlsx|xlsm|xls)$/.test(ext)){ await loadScript(LIB.xlsx); const wb=window.XLSX.read(await f.arrayBuffer(),{type:'array'}); d.text=wb.SheetNames.slice(0,8).map(n=>`## Sheet: ${n}\n`+window.XLSX.utils.sheet_to_csv(wb.Sheets[n],{blankrows:false})).join('\n\n').slice(0,80000); d.note=`${wb.SheetNames.length} sheet${wb.SheetNames.length===1?'':'s'}`; }
    else if(ext==='pdf'){ const lib=await pdfLib(); const pdf=await lib.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false}).promise, T=[]; for(let i=1;i<=Math.min(pdf.numPages,80);i++){ const tc=await (await pdf.getPage(i)).getTextContent(); const t=tc.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim(); if(t) T.push(`[page ${i}] ${t}`); } d.text=T.join('\n').slice(0,80000); d.note=`${pdf.numPages} page${pdf.numPages===1?'':'s'}${d.text?'':' · no text found'}`; }
    else throw new Error('Use PDF, Excel, CSV, text, XER or images.');
    d.ok=true; }catch(e){ d.note=e.message||'Could not read this file.'; } return d; }
function rkIdOpen(){ if(!rkCanEdit()&&!rkAiOk()) return; const prev=RKAI.id;
  RKAI.id={sc:Object.assign({},RK.scope),brief:prev?prev.brief:'',docs:prev?prev.docs:[],useSched:rkAiSchedOpen(),useReg:true,n:15,opps:true,cats:new Set(),tier:'complex',busy:false,res:null,summary:'',status:'',ctl:null};
  const d=coModal('rkIdM','wide rk-idm'); d.addEventListener('click',rkIdClick); d.addEventListener('change',rkIdChange); d.addEventListener('input',e=>{ if(e.target.id==='rkIdBrief') RKAI.id.brief=e.target.value; }); rkIdRender(); }
function rkIdRender(){ const d=document.getElementById('rkIdM'); if(!d) return; const I=RKAI.id, c=rkCfg(), mc=d.querySelector('.mcard'), y=d.scrollTop;
  const regOpts=rkRegOpts().map(([v,l])=>`<option value="${esc(v)}"${v===`${I.sc.lv}:${I.sc.id||''}`?' selected':''}>${esc(l)}</option>`).join('');
  let body;
  if(I.res){ const n=I.res.filter(x=>x.sel).length;
    body=`${I.summary?`<p class="rk-idsum">${esc(I.summary)}</p>`:''}<div class="rk-idbar"><button type="button" class="link" data-rkid="all">Select all</button><button type="button" class="link" data-rkid="none">None</button><span class="sp"></span><span class="muted">${I.res.length} suggested · ${I.res.filter(x=>x.dup).length} may repeat existing risks</span></div>
      <div class="rk-idl">${I.res.map((x,i)=>{ const r=x.r; return `<div class="rk-idc${x.sel?' on':''}${x.added?' done':''}"><label class="rk-idck"><input type="checkbox" data-rkidsel="${i}" ${x.sel?'checked':''} ${x.added?'disabled':''} aria-label="Add this risk"></label>
        <div class="rk-idb"><div class="rk-idt"><input class="rk-idti" data-rkidt="${i}" value="${esc(r.title)}" aria-label="Title">${r.d.type==='opp'?'<span class="rk-opp">Opp</span>':''}${rkChip(rkQS(r,'pre'),{short:1,t:'Inherent'})}${rkChip(rkCurScore(r),{short:1,t:'Current'})}</div>
          <div class="rk-idm2"><select data-rkidreg="${i}" aria-label="Register">${rkRegOpts().map(([v,l])=>`<option value="${esc(v)}"${v===`${r.level}:${r.level==='programme'?r.programmeId:r.level==='project'?r.projectId:''}`?' selected':''}>${esc(l)}</option>`).join('')}</select><span>${esc(r.d.cat||'')}</span><span>${r.d.qt.p!==''?r.d.qt.p+'%':'—'} · ${rkMoney(rkEV(r,false,'cost'))} · ${rkDays(rkEV(r,false,'time'))}</span>${r.d.qt.acts?`<span class="muted">${esc(r.d.qt.acts)}</span>`:''}${rkIsIfc(r)?'<span class="rk-tag ifc">Interface</span>':''}${r.parentId?`<span class="rk-tag up">↑ ${esc((rkById(r.parentId)||{}).ref||'')}</span>`:''}${r.d.ai.conf?`<span class="rk-tag">${esc(r.d.ai.conf)} confidence</span>`:''}</div>
          <p class="rk-idw">Because of ${esc(r.d.cause||'…')}, ${esc(r.d.event||'…')}, leading to ${esc(r.d.effect||'…')}.</p>
          ${x.dup?`<p class="pwarn">This may repeat <b>${esc(x.dup.ref)}</b> ${esc(x.dup.title)}.</p>`:''}
          <details><summary>Why, response and actions</summary><p>${esc(r.d.ai.why||'')}</p>${r.d.ai.ev.length?`<p class="muted">Evidence: ${r.d.ai.ev.map(esc).join(' · ')}</p>`:''}<p><b>${esc((RSTRAT[r.d.type==='opp'?'opp':'threat'].find(s=>s[0]===r.d.resp.strat)||['',''])[1]||'Response')}:</b> ${esc(r.d.resp.plan||'')}</p>${r.d.actions.length?`<ul>${r.d.actions.map(a=>`<li>${esc(a.t)} — ${esc(a.owner)}, ${fmtD(a.due)}</li>`).join('')}</ul>`:''}</details></div>
        <button type="button" class="btn sm ghost" data-rkidopen="${i}" title="Open in the risk editor before adding">Edit</button></div>`; }).join('')}</div>
      <div class="adm-acts rk-cfga"><button type="button" class="btn primary" data-rkid="add" ${n&&rkCanEdit()?'':'disabled'}>Add ${n} risk${n===1?'':'s'}</button><button type="button" class="btn" data-rkid="back">Change inputs</button><button type="button" class="btn ghost" data-cox>Close</button></div>`; }
  else { const sched=rkAiSchedOpen();
    body=`<div class="rk-g2"><label class="pfl"><span>Identify risks for</span><select data-rkidf="sc">${regOpts}</select><small class="muted">Suggestions go into this register or the ones below it; interface risks go to the register above the projects involved.</small></label>
        <div class="pfl"><span>Use</span><label class="tg"><input type="checkbox" data-rkidf="sched" ${I.useSched?'checked':''} ${sched?'':'disabled'}> ${sched?`The open schedule: ${esc(rkAiSchedName())}`:'No schedule open — open the project in the Schedule Workbench to use its logic'}</label><label class="tg"><input type="checkbox" data-rkidf="reg" ${I.useReg?'checked':''}> Existing risks, so it doesn’t repeat them</label><span class="muted">Programme and project details are always included.</span></div></div>
      <label class="pfl"><span>Brief</span><textarea id="rkIdBrief" rows="5" placeholder="Describe the scope, contract and delivery model, site constraints, stakeholders, known concerns and what you want covered. The more specific, the better the risks.">${esc(I.brief)}</textarea></label>
      <div class="pfl"><span>Documents <span class="muted">— risk workshops, scope, contracts, reports, BoQs, XERs or images</span></span><label class="drop rk-iddrop"><input type="file" multiple accept=".pdf,.xlsx,.xls,.xlsm,.csv,.txt,.md,.json,.xer,.png,.jpg,.jpeg,.webp" data-rkidf="files"><strong>Drop files here</strong><span>or click to browse</span></label>
        ${I.docs.length?`<div class="rk-iddocs">${I.docs.map((x,i)=>`<span class="rk-iddoc${x.ok?'':' bad'}">${esc(x.name)} <span class="muted">${esc(x.note)}</span><button type="button" class="fx" data-rkiddel="${i}" aria-label="Remove">×</button></span>`).join('')}</div>`:''}</div>
      <div class="rk-g3"><label class="pfl"><span>How many</span><select data-rkidf="n">${[[8,'About 8'],[15,'About 15'],[25,'About 25']].map(([v,l])=>`<option value="${v}"${I.n===v?' selected':''}>${l}</option>`).join('')}</select></label>
        <div class="pfl"><span>Depth</span><div class="sg"><button type="button" data-rkidt2="default" class="${I.tier==='default'?'on':''}">Standard</button><button type="button" data-rkidt2="complex" class="${I.tier==='complex'?'on':''}">Deep</button></div></div>
        <div class="pfl"><span>Include</span><label class="tg"><input type="checkbox" data-rkidf="opps" ${I.opps?'checked':''}> Opportunities too</label></div></div>
      <div class="pfl"><span>Focus on <span class="muted">— leave blank for all categories</span></span><div class="rk-idcats">${c.cats.map(k=>`<button type="button" class="rk-ccb${I.cats.has(k)?' on':''}" data-rkidcat="${esc(k)}">${esc(k)}</button>`).join('')}</div></div>
      ${I.status?`<p class="${I.busy?'muted':'late'}" id="rkIdStatus">${esc(I.status)}</p>`:''}
      <div class="adm-acts rk-cfga">${I.busy?'<button type="button" class="btn" data-rkid="stop">Stop</button>':`<button type="button" class="btn primary" data-rkid="run" ${rkAiOk()?'':'disabled'}>${AISPARK} Identify risks</button>`}<button type="button" class="btn ghost" data-cox>Cancel</button>${rkAiOk()?'':`<span class="muted">${esc(rkAiWhy())}</span>`}</div>`; }
  mc.innerHTML=`<div class="mh"><h2>${AISPARK} Identify risks with AI</h2><button class="fx" data-cox aria-label="Close">×</button></div>${body}`; d.scrollTop=y; }
async function rkIdClick(e){ const b=e.target.closest('button'); if(!b) return; const I=RKAI.id; if(!I) return;
  if(b.dataset.rkidcat){ I.cats.has(b.dataset.rkidcat)?I.cats.delete(b.dataset.rkidcat):I.cats.add(b.dataset.rkidcat); rkIdRender(); return; }
  if(b.dataset.rkidt2){ I.tier=b.dataset.rkidt2; rkIdRender(); return; }
  if(b.dataset.rkiddel!=null){ I.docs.splice(+b.dataset.rkiddel,1); rkIdRender(); return; }
  if(b.dataset.rkidopen!=null){ const x=I.res[+b.dataset.rkidopen]; if(x){ x.r.ref=''; rkOpen(x.r,'det',true); x.added='editing'; x.sel=false; rkIdRender(); } return; }
  const k=b.dataset.rkid; if(!k) return;
  if(k==='run') rkIdRun(); else if(k==='stop'){ if(I.ctl) I.ctl.abort(); } else if(k==='back'){ I.res=null; I.status=''; rkIdRender(); }
  else if(k==='all'||k==='none'){ I.res.forEach(x=>{ if(!x.added) x.sel=k==='all'; }); rkIdRender(); }
  else if(k==='add'){ b.disabled=true; const n=await rkAiAddDrafts(I.res); perToast(`Added ${n} risk${n===1?'':'s'} identified by AI.`); rkIdRender(); } }
async function rkIdChange(e){ const t=e.target, I=RKAI.id; if(!I) return;
  if(t.dataset.rkidsel!=null){ I.res[+t.dataset.rkidsel].sel=t.checked; rkIdRender(); return; }
  if(t.dataset.rkidt!=null){ I.res[+t.dataset.rkidt].r.title=t.value; return; }
  if(t.dataset.rkidreg!=null){ const x=I.res[+t.dataset.rkidreg], [lv,id]=t.value.split(':'); x.r.level=lv; x.r.programmeId=lv==='programme'?id:null; x.r.projectId=lv==='project'?id:null; if(x.r.parentId&&!rkParentOptions(x.r).some(p=>p.id===x.r.parentId)) x.r.parentId=null; rkIdRender(); return; }
  const f=t.dataset.rkidf; if(!f) return;
  if(f==='sc'){ const [lv,id]=t.value.split(':'); I.sc={lv,id:id||null}; } else if(f==='sched') I.useSched=t.checked; else if(f==='reg') I.useReg=t.checked; else if(f==='n') I.n=+t.value; else if(f==='opps') I.opps=t.checked;
  else if(f==='files'){ const fs=[...t.files]; I.status=`Reading ${fs.length} file${fs.length===1?'':'s'}…`; I.busy=true; rkIdRender(); for(const x of fs) I.docs.push(await rkReadDoc(x)); I.busy=false; I.status=''; }
  rkIdRender(); }
function rkIdPrompt(I){ const c=rkCfg(), sc=I.sc, inScope=RK.risks.filter(r=>rkIn(r,sc,true)&&rkLive(r)), others=RK.risks.filter(r=>!inScope.includes(r)&&rkLive(r)&&rkRank(r.level)<rkRank(sc.lv==='portfolio'?'programme':sc.lv)+1);
  const docs=I.docs.filter(d=>d.ok&&d.text).map(d=>`### ${d.name}\n${d.text}`).join('\n\n').slice(0,90000);
  return `${RK_AI_RULES()}
TASK: Identify about ${I.n} specific, material ${I.opps?'risks (threats and, where genuine, opportunities)':'threats'} for the ${RLV_L[sc.lv].toLowerCase()} register "${rkScopeName(sc)}" (key ${rkRegKey(sc)})${sc.lv!=='project'?' and the registers below it':''}.
- Put each risk in the lowest register that can own it: ${sc.lv==='project'?'this project':'a project register when it belongs to one project, the programme for risks across its projects, the portfolio for risks across programmes'}. Interface risks between projects belong in the register above both projects and must list interface_projects.
- Where a new risk is a lower-level instance of an existing higher-level risk, set parent_ref to that risk.
${I.cats.size?`- Focus on these categories: ${[...I.cats].join(', ')}.`:''}
- Use the schedule where it is provided: critical and near-critical paths, interface handovers, slipping or long-duration work, constraints, resource-heavy or novel activities. Put the affected activity IDs in "activities" and size schedule impact as delay to those activities’ successors/finish.
- Ground every risk in the brief, documents or data and give the evidence. Do not repeat existing risks: if one is very close to an existing risk, set duplicate_of.
- Quantify every risk and give inherent, current (assume no responses beyond those described) and target scores, a response strategy and 1-3 specific actions.

${rkAiCfgText()}

${rkAiStructure()}

${I.useReg?`EXISTING RISKS IN AND AROUND THIS REGISTER (do not repeat)\n${rkAiRegister(inScope.concat(others.slice(0,40)),true)}`:''}
${I.useSched&&rkAiSchedOpen()?`\nOPEN SCHEDULE: ${rkAiSchedName()}\n${rkAiSched(32000)}`:''}
${I.brief.trim()?`\nBRIEF FROM THE USER\n${I.brief.trim()}`:''}
${docs?`\nDOCUMENTS\n${docs}`:''}
Today: ${aiFmt(rkToday())}

Reply with JSON only, in this shape:
{"summary":"two or three sentences on the main themes","risks":[${RK_AI_RISK_SCHEMA}]}`; }
async function rkIdRun(){ const I=RKAI.id; if(!I||I.busy) return; if(!rkAiOk()){ I.status=rkAiWhy(); rkIdRender(); return; }
  if(!I.brief.trim()&&!I.docs.some(d=>d.ok)&&!(I.useSched&&rkAiSchedOpen())&&!(PER.projects||[]).some(p=>p.description)){ I.status='Add a brief, a document or open a schedule so the risks are grounded in your project.'; rkIdRender(); return; }
  I.busy=true; I.ctl=new AbortController(); I.status='Reading the inputs and identifying risks… this can take a minute or two on Deep.'; rkIdRender();
  try{ let images=I.docs.filter(d=>d.ok).flatMap(d=>d.images); const lim=await AI.sample.limits().catch(()=>null), max=lim&&lim.images?lim.images.maxCount:0; images=max?images.slice(0,max):[];
    const o={signal:I.ctl.signal,modelTier:I.tier,cache:false,onText:({text})=>{ const s=document.getElementById('rkIdStatus'); if(s) s.textContent=`Writing… ${Math.round(text.length/1000)}k characters so far`; }}; if(images.length) o.images=images;
    const js=await AI.sample.json(rkIdPrompt(I),o); const L=(js&&Array.isArray(js.risks)?js.risks:Array.isArray(js)?js:[]).filter(x=>x&&x.title);
    if(!L.length) throw {code:'invalid_json'}; I.res=L.map(j=>rkAiToRisk(j,I.sc,'identify')); I.summary=String((js&&js.summary)||''); I.status=''; }
  catch(e){ const c=e&&e.code; I.status=c==='cancelled'?'Stopped.':c==='invalid_json'?'The answer could not be read as a list of risks. Try again, or ask for fewer.':c==='prompt_too_large'?'The inputs are too large to send together. Remove a document or untick the schedule.':(AI_ERR[c]||AI_ERR.upstream_error); }
  finally{ I.busy=false; I.ctl=null; rkIdRender(); } }

/* ---- AI in the risk editor: word, score, quantify, plan responses ---- */
const RK_EDAI={word:{tab:'det',label:'Improve wording'},score:{tab:'ass',label:'Score with AI'},quant:{tab:'qt',label:'Estimate with AI'},resp:{tab:'resp',label:'Suggest responses'}};
function rkEdAiBtn(mode){ return `<button type="button" class="btn sm rk-aibtn aionly" data-rkedai="${mode}" ${rkAiOk()&&!(RK.ed&&RK.ed.ai&&RK.ed.ai.busy)?'':'disabled'} title="${rkAiOk()?'':esc(rkAiWhy())}">${AISPARK} ${RK_EDAI[mode].label}</button>`; }
function rkEdAiBox(mode){ const A=RK.ed&&RK.ed.ai; if(!A||A.mode!==mode) return ''; if(A.busy) return `<div class="rk-aibox"><span class="aithink">${esc(A.status||'Thinking…')}</span><button type="button" class="btn sm" data-rkedai="stop">Stop</button></div>`;
  if(A.err) return `<div class="rk-aibox err"><span>${esc(A.err)}</span><button type="button" class="fx" data-rkedai="x" aria-label="Dismiss">×</button></div>`;
  if(!A.res) return ''; const r=RK.ed.r, p=A.res, rows=[];
  const t3=t=>t&&[t.min,t.likely??t.ml,t.max].some(x=>x!=null&&x!=='')?[t.min,t.likely??t.ml,t.max].map(x=>x==null||x===''?'—':x).join(' / '):'—', o3=t=>t&&[t.min,t.ml,t.max].some(x=>x!==''&&x!=null)?[t.min,t.ml,t.max].map(x=>x===''||x==null?'—':x).join(' / '):'—';
  const sc=s=>{ const x=rkAiScores(s); return rkChip(rkScore(x),{short:1}); };
  if(mode==='word') rows.push(['Title',esc(r.title),esc(p.title||r.title)],['Cause',esc(r.d.cause),esc(p.cause||'')],['Event',esc(r.d.event),esc(p.event||'')],['Effect',esc(r.d.effect),esc(p.effect||'')]).concat(p.category?[['Category',esc(r.d.cat),esc(p.category)]]:[]);
  if(mode==='score'||mode==='quant') if(p.scores) RQ.forEach(k=>{ const s=p.scores[{pre:'inherent',cur:'current',tgt:'target'}[k]]; if(s) rows.push([RQ_L[k]+' score',rkChip(rkQS(r,k),{short:1}),sc(s)]); });
  const m3=t=>t&&[t.min,t.likely??t.ml,t.max].some(x=>x!=null&&x!=='')?[t.min,t.likely??t.ml,t.max].map(x=>x==null||x===''?'—':rkMoney(+x)).join(' / '):'—';
  if(mode==='quant'){ rows.unshift(['Probability',r.d.qt.p!==''?r.d.qt.p+'%':'—',p.probability_pct!=null?p.probability_pct+'%':'—'],['Cost',m3(r.d.qt.cost),m3(p.cost)],['Days',o3(r.d.qt.time),t3(p.days)],['Distribution',RDIST[r.d.qt.dist||'tri'],RDIST[rkAiDist(p.distribution)]]);
    if(p.post_response) rows.push(['After responses',`${r.d.qt.post.p!==''?r.d.qt.post.p+'%':'—'} · ${m3(r.d.qt.post.cost)}`,`${p.post_response.probability_pct??'—'}% · ${m3(p.post_response.cost)} · ${t3(p.post_response.days)} d`]); if(p.activities&&p.activities.length) rows.push(['Activities',esc(r.d.qt.acts||'—'),esc(p.activities.join(', '))]); }
  if(mode==='resp'){ const SN=s=>(RSTRAT[r.d.type==='opp'?'opp':'threat'].find(x=>x[0]===s)||['','—'])[1]; rows.push(['Strategy',SN(r.d.resp.strat),SN(rkAiStrat(p.strategy,r.d.type))],['Plan',esc(r.d.resp.plan||'—'),esc(p.plan||'')],['Trigger',esc(r.d.resp.trigger||'—'),esc(p.trigger||'')],['Fallback',esc(r.d.resp.fallback||'—'),esc(p.fallback||'')]);
    (p.actions||[]).forEach(a=>rows.push(['+ Action','',`${esc(a.action||a.text||'')} <span class="muted">— ${esc(a.owner||'')}, in ${Math.round(+a.due_in_days||14)} days${a.cost?', '+rkMoney(+a.cost):''}</span>`])); if(p.scores&&p.scores.target) rows.push(['Target score',rkChip(rkQS(r,'tgt'),{short:1}),sc(p.scores.target)]); }
  return `<div class="rk-aibox"><div class="rk-aibh">${AISPARK}<b>AI suggestion</b><span class="sp"></span><button type="button" class="fx" data-rkedai="x" aria-label="Dismiss">×</button></div>
    <table class="rk-aidiff"><thead><tr><th></th><th>Now</th><th>Suggested</th></tr></thead><tbody>${rows.map(x=>`<tr><th>${x[0]}</th><td>${x[1]}</td><td>${x[2]}</td></tr>`).join('')}</tbody></table>
    ${p.rationale?`<p class="rk-aiwhy">${esc(p.rationale)}</p>`:''}${Array.isArray(p.assumptions)&&p.assumptions.length?`<ul class="rk-aiwhy">${p.assumptions.slice(0,6).map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}
    <div class="adm-acts"><button type="button" class="btn sm primary" data-rkedai="apply">Apply</button>${mode==='quant'&&p.scores?'<button type="button" class="btn sm" data-rkedai="applyq">Apply estimate only</button>':''}<span class="muted">Applied to the form — review, then Save.</span></div></div>`; }
function rkEdAiPrompt(mode){ const r=RK.ed.r, sc=rkScopeOf(r), d=r.d, near=RK.risks.filter(x=>x.id!==r.id&&rkLive(x)&&(rkProgOf(x)===rkProgOf(r)||x.level==='portfolio')&&rkQt(x).cost!=null).slice(0,30);
  const tasks={word:`Rewrite this risk so it is specific and in cause → event → effect form. Keep its meaning; sharpen vague wording. Suggest a better category only if clearly wrong.
Reply with JSON only: {"title":"…","cause":"…","event":"…","effect":"…","category":"…","rationale":"what you changed and why"}`,
    score:`Score this risk on the scoring scheme: inherent (no responses), current (responses in place now: ${d.resp.plan||'none described'}; ${rkActs(r).filter(a=>a.status==='done').length} actions done) and target (all planned actions done). Use its three-point estimate where present so scores and estimates agree.
Reply with JSON only: {"scores":{"inherent":{"p":1-5,"i":{"<impact id>":1-5}},"current":{…},"target":{…}},"rationale":"…"}`,
    quant:`Quantify this risk for Monte Carlo: probability it occurs (%), cost if it occurs and schedule delay if it occurs (calendar days to the affected milestone or finish) as min / most likely / max, the distribution, and the schedule activities affected (IDs from the schedule if one is provided). Also give a post-response estimate if the planned responses would change it, and scores consistent with the estimate. Calibrate against the other risks listed so the register is consistent. State key assumptions.
Reply with JSON only: {"probability_pct":n,"cost":{"min":n,"likely":n,"max":n},"days":{"min":n,"likely":n,"max":n},"distribution":"triangular|pert|uniform","activities":["…"],"post_response":{"probability_pct":n,"cost":{…},"days":{…}} or null,"scores":{"inherent":{…},"current":{…},"target":{…}},"rationale":"…","assumptions":["…"]}`,
    resp:`Propose a response for this ${d.type==='opp'?'opportunity':'threat'}: the strategy, a specific plan, an early-warning trigger, a fallback if it happens anyway, and 2-5 concrete actions with an owner role, due in N days and cost where meaningful. Give the target score once the actions are done.
Reply with JSON only: {"strategy":"…","plan":"…","trigger":"…","fallback":"…","actions":[{"action":"…","owner":"…","due_in_days":n,"cost":n}],"scores":{"target":{"p":1-5,"i":{…}}},"rationale":"…"}`}[mode];
  return `${RK_AI_RULES()}

${rkAiCfgText()}

${rkAiStructure()}

THE RISK (register ${rkRegKey(sc)}: ${rkScopeName(sc)})
${RK_AI_HEAD}|cause-event-effect
${rkAiRiskLine(r,true)}
Scores now: ${JSON.stringify(d.q)} · estimate: ${JSON.stringify({p:d.qt.p,cost:d.qt.cost,days:d.qt.time,dist:d.qt.dist,post:d.qt.post})} · response: ${JSON.stringify(d.resp)} · actions: ${JSON.stringify(rkActs(r).map(a=>({a:a.t,owner:a.owner,status:a.status})))}
Notes: ${d.desc||'-'}
${(mode==='quant'||mode==='score')&&near.length?`\nOTHER RISKS NEARBY, FOR CALIBRATION\n${rkAiRegister(near,false)}`:''}
${rkAiSchedOpen()?`\nOPEN SCHEDULE: ${rkAiSchedName()}\n${rkAiSched(mode==='quant'?28000:12000)}`:''}

TASK: ${tasks}`; }
async function rkEdAiRun(mode){ if(!RK.ed||!rkAiOk()) return; const A=RK.ed.ai={mode,busy:true,status:'Thinking…',ctl:new AbortController()}; RK.edTab=RK_EDAI[mode].tab; rkEdRender();
  try{ const js=await AI.sample.json(rkEdAiPrompt(mode),{signal:A.ctl.signal,modelTier:'default',cache:false,onText:({text})=>{ A.status=`Writing… ${text.length} characters`; }}); if(!js||typeof js!=='object') throw {code:'invalid_json'}; if(RK.ed&&RK.ed.ai===A){ A.res=js; } }
  catch(e){ const c=e&&e.code; A.err=c==='cancelled'?'Stopped.':c==='invalid_json'?'The suggestion could not be read. Try again.':(AI_ERR[c]||AI_ERR.upstream_error); }
  finally{ A.busy=false; if(RK.ed&&RK.ed.ai===A) rkEdRender(); } }
function rkEdAiApply(onlyQuant){ const A=RK.ed&&RK.ed.ai; if(!A||!A.res) return; const r=RK.ed.r, d=r.d, p=A.res, mode=A.mode;
  if(mode==='word'){ ['cause','event','effect'].forEach(k=>{ if(p[k]) d[k]=String(p[k]); }); if(p.title) r.title=String(p.title); if(p.category) d.cat=String(p.category); }
  if(mode==='quant'){ if(p.probability_pct!=null) d.qt.p=rkAiNum(p.probability_pct); if(p.cost) d.qt.cost=rkAi3(p.cost); if(p.days) d.qt.time=rkAi3(p.days); if(p.distribution) d.qt.dist=rkAiDist(p.distribution); if(Array.isArray(p.activities)&&p.activities.length) d.qt.acts=p.activities.join(', ');
    if(p.post_response) d.qt.post={p:rkAiNum(p.post_response.probability_pct),cost:rkAi3(p.post_response.cost),time:rkAi3(p.post_response.days)}; d.qt.fromKids=false; }
  if((mode==='score'||(mode==='quant'&&!onlyQuant))&&p.scores){ const M0={inherent:'pre',current:'cur',target:'tgt'}; Object.entries(p.scores).forEach(([k,v])=>{ if(M0[k]) d.q[M0[k]]=rkAiScores(v); }); }
  if(mode==='resp'){ const s=rkAiStrat(p.strategy,d.type); if(s) d.resp.strat=s; ['plan','trigger','fallback'].forEach(k=>{ if(p[k]) d.resp[k]=String(p[k]); });
    (p.actions||[]).forEach((a,i)=>{ if(a&&(a.action||a.text)) d.actions.push({id:'a'+Date.now().toString(36)+i,t:String(a.action||a.text),owner:String(a.owner||d.resp.owner||d.owner||''),due:rkToday()+Math.max(1,Math.round(+a.due_in_days||14))*DAY,status:'todo',cost:rkAiNum(a.cost)}); });
    if(p.scores&&p.scores.target) d.q.tgt=rkAiScores(p.scores.target); }
  d.ai=Object.assign({},d.ai||{},{assisted:Date.now()}); RK.ed.ai=null; rkEdRender(); perToast('Suggestion applied to the form. Review it, then Save.'); }

/* ---- bulk quantification ---- */
function rkBqOpen(){ const L=rkVis().filter(r=>rkLive(r)&&!(r.d.qt||{}).fromKids&&rkQt(r).cost==null&&rkQt(r).time==null);
  RKAI.bq={list:L,busy:false,res:null,status:'',ctl:null,scores:true}; const d=coModal('rkBqM','wide rk-idm'); d.addEventListener('click',rkBqClick); d.addEventListener('change',e=>{ const t=e.target; if(t.dataset.rkbq!=null){ RKAI.bq.res[+t.dataset.rkbq].sel=t.checked; rkBqRender(); } if(t.id==='rkBqSc') RKAI.bq.scores=t.checked; }); rkBqRender(); }
function rkBqRender(){ const d=document.getElementById('rkBqM'); if(!d) return; const Q=RKAI.bq, mc=d.querySelector('.mcard');
  let body;
  if(Q.res){ const n=Q.res.filter(x=>x.sel).length; body=`<div class="ptw"><table class="ptab rk-bqt"><thead><tr><th></th><th>Risk</th><th class="num">Probability</th><th class="num">Cost min / likely / max</th><th class="num">Days</th><th class="num">Cost exposure</th><th>Current</th><th style="min-width:240px">Basis</th></tr></thead><tbody>${Q.res.map((x,i)=>{ const e=x.e, mean=rkMean(rkAi3(e.cost),rkAiDist(e.distribution)); return `<tr><td><input type="checkbox" data-rkbq="${i}" ${x.sel?'checked':''} ${x.done?'disabled':''} aria-label="Apply"></td><td><span class="rk-ref">${esc(x.r.ref)}</span> ${esc(x.r.title)}${x.done?' <span class="muted">· applied</span>':''}</td><td class="num">${e.probability_pct??'—'}%</td><td class="num">${e.cost?[e.cost.min,e.cost.likely,e.cost.max].map(v=>rkMoney(+v||0)).join(' / '):'—'}</td><td class="num">${e.days?[e.days.min,e.days.likely,e.days.max].map(v=>v??'—').join(' / '):'—'}</td><td class="num">${mean!=null&&e.probability_pct!=null?rkMoney(mean*e.probability_pct/100):'—'}</td><td>${e.scores&&e.scores.current?rkChip(rkScore(rkAiScores(e.scores.current)),{short:1}):'—'}</td><td class="muted">${esc(e.rationale||'')}</td></tr>`; }).join('')}</tbody></table></div>
    <label class="tg"><input type="checkbox" id="rkBqSc" ${Q.scores?'checked':''}> Also set the current scores to match the estimates</label>
    <div class="adm-acts rk-cfga"><button type="button" class="btn primary" data-rkbqa="apply" ${n&&rkCanEdit()?'':'disabled'}>Apply ${n} estimate${n===1?'':'s'}</button><button type="button" class="btn ghost" data-cox>Close</button></div>`; }
  else body=`<p>${Q.list.length?`${Q.list.length} live risk${Q.list.length===1?' has':'s have'} no three-point estimate in ${esc(rkScopeName(RK.scope))}${RK.roll&&RK.scope.lv!=='project'?' and below':''}. Claude will propose probability, cost and schedule ranges for ${Q.list.length===1?'it':'each'}, calibrated against the risks that are already quantified${rkAiSchedOpen()?' and the open schedule':''}.`:'Every live risk in view already has an estimate.'}</p>
    ${Q.list.length?`<div class="rk-bql">${Q.list.slice(0,60).map(r=>`<span class="rk-pj">${esc(r.ref)}</span>`).join(' ')}${Q.list.length>60?` and ${Q.list.length-60} more (the first 60 are done)`:''}</div>`:''}
    ${Q.status?`<p class="${Q.busy?'muted':'late'}" id="rkBqStatus">${esc(Q.status)}</p>`:''}
    <div class="adm-acts rk-cfga">${Q.busy?'<button type="button" class="btn" data-rkbqa="stop">Stop</button>':`<button type="button" class="btn primary" data-rkbqa="run" ${Q.list.length&&rkAiOk()?'':'disabled'}>${AISPARK} Estimate ${Math.min(60,Q.list.length)} risk${Q.list.length===1?'':'s'}</button>`}<button type="button" class="btn ghost" data-cox>Cancel</button></div>`;
  mc.innerHTML=`<div class="mh"><h2>${AISPARK} Quantify with AI</h2><button class="fx" data-cox aria-label="Close">×</button></div>${body}`; }
async function rkBqClick(e){ const b=e.target.closest('[data-rkbqa]'); if(!b) return; const Q=RKAI.bq, k=b.dataset.rkbqa;
  if(k==='stop'){ if(Q.ctl) Q.ctl.abort(); return; }
  if(k==='run'){ Q.busy=true; Q.ctl=new AbortController(); Q.res=null; const out=[], L=Q.list.slice(0,60), cal=RK.risks.filter(r=>rkLive(r)&&rkQt(r).cost!=null).slice(0,40);
    try{ for(let i=0;i<L.length;i+=12){ const part=L.slice(i,i+12); Q.status=`Estimating ${i+1}–${i+part.length} of ${L.length}…`; rkBqRender();
        const js=await AI.sample.json(`${RK_AI_RULES()}

${rkAiCfgText()}

${rkAiStructure()}

RISKS ALREADY QUANTIFIED, FOR CALIBRATION
${rkAiRegister(cal,false)}
${rkAiSchedOpen()?`\nOPEN SCHEDULE: ${rkAiSchedName()}\n${rkAiSched(20000)}`:''}

TASK: For each risk below, estimate the probability it occurs (%), the cost if it occurs and the schedule delay if it occurs (calendar days) as min / most likely / max, a distribution, the affected activity IDs if a schedule is provided, and current scores consistent with the estimate. Be consistent with the calibration risks.
RISKS TO QUANTIFY
${rkAiRegister(part,true)}

Reply with JSON only: {"estimates":[{"ref":"…","probability_pct":n,"cost":{"min":n,"likely":n,"max":n},"days":{"min":n,"likely":n,"max":n},"distribution":"triangular|pert|uniform","activities":["…"],"scores":{"current":{"p":1-5,"i":{"<impact id>":1-5}}},"rationale":"one sentence"}]}`,{signal:Q.ctl.signal,modelTier:'default',cache:false});
        (js&&js.estimates||[]).forEach(x=>{ const r=part.find(y=>y.ref===x.ref); if(r) out.push({r,e:x,sel:true}); }); }
      Q.res=out; Q.status=out.length?'':'No estimates came back. Try again.'; }
    catch(er){ const c=er&&er.code; Q.status=c==='cancelled'?'Stopped.':c==='invalid_json'?'An answer could not be read. Try again.':(AI_ERR[c]||AI_ERR.upstream_error); if(out.length) Q.res=out; }
    finally{ Q.busy=false; Q.ctl=null; rkBqRender(); } return; }
  if(k==='apply'){ b.disabled=true; let n=0; for(const x of Q.res.filter(y=>y.sel&&!y.done)){ const r=rkById(x.r.id); if(!r) continue; const c={probability_pct:x.e.probability_pct,cost:x.e.cost,days:x.e.days,distribution:x.e.distribution,activities:x.e.activities}; if(Q.scores&&x.e.scores&&x.e.scores.current) c.scores={current:x.e.scores.current};
      try{ await rkUpdate(rkAiApplyChange(r,c)); x.done=true; x.sel=false; n++; }catch(er){ perToast(perErr(er),'err'); break; } }
    perToast(`Applied ${n} estimate${n===1?'':'s'}.`); rkBqRender(); } }
