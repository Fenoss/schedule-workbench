/* ================= AI schedule generation & refinement (Build tab) ================= */
const BA={docs:[],brief:'',opts:{start:'',cal:'5',detail:'standard',code:'PRJ-01',name:'',tier:'complex'},busy:false,ctl:null,result:null,status:'',refine:'',log:[]};
const LIB={pdf:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',pdfw:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',xlsx:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'};
function loadScript(src){ return new Promise((res,rej)=>{ const ex=document.querySelector(`script[data-src="${src}"]`); if(ex){ if(ex.dataset.ok) return res(); ex.addEventListener('load',()=>res()); ex.addEventListener('error',()=>rej(new Error('Could not load a reader library.'))); return; } const s=document.createElement('script'); s.src=src; s.dataset.src=src; s.onload=()=>{ s.dataset.ok='1'; res(); }; s.onerror=()=>rej(new Error('Could not load a reader library.')); document.head.appendChild(s); }); }
async function pdfLib(){ if(window.pdfjsLib) return window.pdfjsLib; await loadScript(LIB.pdfw); await loadScript(LIB.pdf); window.pdfjsLib.GlobalWorkerOptions.workerSrc=LIB.pdfw; return window.pdfjsLib; }
const DOC_ROLES=[['drawing','Drawing'],['boq','Bill of quantities'],['spec','Specification'],['schedule','Previous schedule'],['other','Other']];
function guessRole(name,kind){ const n=name.toLowerCase(); if(kind==='xer'||/programme|schedule|baseline|\.xer/.test(n)) return 'schedule'; if(/boq|bill|quant|takeoff|take-off|estimate|cost/.test(n)||kind==='sheet') return 'boq'; if(/spec|requirement|scope|ers|employer/.test(n)) return 'spec'; if(kind==='image'||/drg|dwg|drawing|plan|section|elevation|layout|gad/.test(n)) return 'drawing'; return kind==='pdf'?'spec':'other'; }
async function baAddFiles(list){
  for(const f of list){ const ext=(f.name.split('.').pop()||'').toLowerCase(); const kind=/^(png|jpe?g|webp|gif)$/.test(ext)?'image':ext==='pdf'?'pdf':/^(xlsx|xlsm|xls)$/.test(ext)?'sheet':ext==='xer'?'xer':/^(csv|txt|md|json|tsv)$/.test(ext)?'text':null;
    const d={id:bid(),name:f.name,kind,role:guessRole(f.name,kind),text:'',images:[],status:'reading',note:''}; BA.docs.push(d); baRender();
    try{
      if(!kind) throw new Error('This file type is not supported. Use PDF, images, Excel, CSV, text or XER.');
      if(kind==='image'){ d.images=[f]; d.note='Image'; }
      else if(kind==='text'){ d.text=(await f.text()).slice(0,120000); d.note=d.text.length<1000?`${d.text.length} characters`:`${Math.round(d.text.length/1000)}k characters`; }
      else if(kind==='xer'){ const T=parseXER(await baReadText(f)); d.text=baXerDigest(T); d.note=`${(T.TASK||[]).length} activities`; }
      else if(kind==='sheet'){ await loadScript(LIB.xlsx); const wb=window.XLSX.read(await f.arrayBuffer(),{type:'array'}); const parts=[]; wb.SheetNames.slice(0,8).forEach(n=>{ const csv=window.XLSX.utils.sheet_to_csv(wb.Sheets[n],{blankrows:false}); if(csv.trim()) parts.push(`## Sheet: ${n}\n${csv}`); }); d.text=parts.join('\n\n').slice(0,120000); d.note=`${wb.SheetNames.length} sheet${wb.SheetNames.length===1?'':'s'}, ${d.text.length<1000?d.text.length:Math.round(d.text.length/1000)+'k'} characters`; }
      else if(kind==='pdf'){ const lib=await pdfLib(); const pdf=await lib.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false}).promise; const n=pdf.numPages, texts=[];
        const wantImg=d.role==='drawing'; let imgCount=0;
        for(let i=1;i<=Math.min(n,60);i++){ const pg=await pdf.getPage(i); const tc=await pg.getTextContent(); const t=tc.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim(); if(t) texts.push(`[page ${i}] ${t}`);
          if((wantImg||t.length<200)&&imgCount<6){ const vp0=pg.getViewport({scale:1}), sc=Math.min(2.2,1800/Math.max(vp0.width,vp0.height)), vp=pg.getViewport({scale:sc}); const cv=document.createElement('canvas'); cv.width=Math.round(vp.width); cv.height=Math.round(vp.height); const cx=cv.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); await pg.render({canvasContext:cx,viewport:vp}).promise; const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.82)); if(blob){ d.images.push(blob); imgCount++; } } }
        d.text=texts.join('\n').slice(0,120000); d.note=`${n} page${n===1?'':'s'}${d.images.length?`, ${d.images.length} sheet image${d.images.length===1?'':'s'}`:''}${n>60?' (first 60 read)':''}`; }
      d.status='ready';
    }catch(e){ d.status='error'; d.note=e.message||'Could not read this file.'; }
    baRender(); }
}
async function baReadText(f){ const buf=await f.arrayBuffer(); try{ return new TextDecoder('utf-8',{fatal:true}).decode(buf); }catch(_){ return new TextDecoder('windows-1252').decode(buf); } }
function baXerDigest(T){ const cal={}; (T.CALENDAR||[]).forEach(c=>cal[c.clndr_id]=+c.day_hr_cnt||8); const byId={}, wbs={}; (T.PROJWBS||[]).forEach(w=>wbs[w.wbs_id]=w);
  (T.TASK||[]).forEach(t=>byId[t.task_id]=t); const preds={}; (T.TASKPRED||[]).forEach(p=>{ (preds[p.task_id]=preds[p.task_id]||[]).push(p); });
  const lines=['id|name|wbs|type|orig duration d|predecessors']; (T.TASK||[]).slice(0,600).forEach(t=>{ const dh=cal[t.clndr_id]||8; const pr=(preds[t.task_id]||[]).map(p=>{ const q=byId[p.pred_task_id]; if(!q) return ''; const lag=Math.round((+p.lag_hr_cnt||0)/dh); const ty=(p.pred_type||'PR_FS').replace('PR_',''); return q.task_code+(ty!=='FS'||lag?ty:'')+(lag?(lag>0?'+':'')+lag:''); }).filter(Boolean).join(' ');
    lines.push([t.task_code,t.task_name,(wbs[t.wbs_id]||{}).wbs_name||'',t.task_type.replace('TT_',''),Math.round((+t.target_drtn_hr_cnt||0)/dh),pr].join('|')); });
  return lines.join('\n'); }

function baGenPrompt(){
  const o=BA.opts, target={summary:'30 to 60',standard:'60 to 150',detailed:'150 to 300'}[o.detail], calTxt={5:'5-day (Mon to Fri)',6:'6-day (Mon to Sat)',7:'7-day'}[o.cal];
  const docs=BA.docs.filter(d=>d.status==='ready'&&d.text); const budget=170000; let used=0; const parts=[];
  docs.forEach(d=>{ const share=Math.max(4000,Math.floor(budget/Math.max(1,docs.length))); const t=d.text.slice(0,Math.min(share,budget-used)); used+=t.length; parts.push(`### ${DOC_ROLES.find(r=>r[0]===d.role)[1].toUpperCase()}: ${d.name}\n${t}`); });
  const imgDocs=BA.docs.filter(d=>d.status==='ready'&&d.images.length).map(d=>`${d.name} (${DOC_ROLES.find(r=>r[0]===d.role)[1]})`);
  return `You are an expert construction planner (Primavera P6 and MS Project, critical path method, linear and building works). Build a realistic, logic-linked baseline programme from the brief and documents below.

Reply with ONLY one JSON object, no other text, in exactly this shape (arrays keep it compact):
{"project":{"short":"${o.code||'PRJ-01'}","name":"Project name"},
 "summary":"2-3 sentences describing the programme logic and overall duration",
 "wbs":[["1","Preliminaries",null],["1.1","Design","1"]],
 "disciplines":[["PRE","Preliminaries"],["CIV","Civils"]],
 "activities":[["A1000","Notice to proceed","1","start",0,[],"PRE"],["A1010","Site set-up","1","task",15,["A1000"],"PRE"],["A1020","Excavation zone 1","1.1","task",20,["A1010FS+5"],"CIV"]],
 "chainage":{"A1020":[0,1.2]},
 "assumptions":["..."],
 "questions":["..."]}
Activity fields in order: id, name, wbs code, type ("task", "start" or "finish"), original duration in working days, predecessors, discipline code. A predecessor is an activity id with optional relationship type and lag in working days, e.g. "A1010", "A1010SS+5", "A1020FF-2".

Rules:
- ${target} activities. Use clear verb-noun names. IDs unique, in steps of 10.
- One start milestone first and one finish milestone last. Every other activity has at least one predecessor and at least one successor. No loops.
- Mostly finish-to-start. Use SS/FF with lags only for genuine overlaps (for example following trades along a linear route).
- Durations are working days on a ${calTxt} calendar. Where a bill of quantities gives quantities, derive durations from them using stated productivity rates, and list those rates in assumptions.
- Include design, approvals, procurement and long-lead items, construction, testing and commissioning, handover, and key milestones, as the documents justify.
- Read drawings for scope, phasing, areas and access. Use any previous schedule only as a reference for structure, logic and productivity, never copied wholesale.
- "chainage" is optional: include it only for linear works, as [from, to] in kilometres.
- Put every assumption you had to make in "assumptions", and anything the planner must confirm in "questions".

PROJECT BRIEF
${(BA.brief||'(no brief given)').slice(0,8000)}
Planned start: ${o.start||'not given'}. Calendar: ${calTxt}.
${imgDocs.length?`\nIMAGES ATTACHED (in this order): ${imgDocs.join('; ')}\n`:''}
DOCUMENTS
${parts.join('\n\n')||'(none)'}`;
}
function baToState(js){
  const o=BA.opts, calId=bid(), cal={id:calId,name:{5:'Standard 5-day',6:'6-day week',7:'7-day week'}[o.cal],work:o.cal==='7'?[1,1,1,1,1,1,1]:o.cal==='6'?[0,1,1,1,1,1,1]:[0,1,1,1,1,1,0],hrs:8,hol:[]};
  const pid=bid(), proj={id:pid,short:String(js.project&&js.project.short||o.code||'PRJ-01').slice(0,20),name:String(js.project&&js.project.name||o.name||'AI generated project').slice(0,120)};
  const st={v:1,name:proj.name,dd:parseDay(o.start)??dayOf(Date.now()),mf:null,defCal:calId,cals:[cal],projects:[proj],wbs:[],acts:[],rels:[],codeTypes:[{name:'Discipline',values:[]}],baseline:null,sync:false,chUnit:'km'};
  const wmap=new Map(); let seq=0;
  (js.wbs||[]).forEach(w=>{ const [code,name]=Array.isArray(w)?w:[w.code,w.name]; if(code==null) return; const n={id:bid(),proj:pid,parent:null,code:String(code),name:String(name||code),seq:++seq}; wmap.set(String(code),n); st.wbs.push(n); });
  (js.wbs||[]).forEach(w=>{ const [code,,parent]=Array.isArray(w)?w:[w.code,w.name,w.parent]; const n=wmap.get(String(code)); if(n&&parent!=null&&wmap.has(String(parent))&&String(parent)!==String(code)) n.parent=wmap.get(String(parent)).id; });
  if(!st.wbs.length){ const n={id:bid(),proj:pid,parent:null,code:'1',name:'Works',seq:1}; wmap.set('1',n); st.wbs.push(n); }
  const disc=new Map((js.disciplines||[]).map(d=>Array.isArray(d)?[String(d[0]),String(d[1]||d[0])]:[String(d.code),String(d.name||d.code)]));
  const byCode=new Map(); let aseq=0;
  (js.activities||[]).forEach(r=>{ const [id,name,w,type,dur,preds,dc]=Array.isArray(r)?r:[r.id,r.name,r.wbs,r.type,r.duration,r.predecessors,r.discipline]; if(!id) return; let code=String(id).trim(); while(byCode.has(code)) code+='_';
    const t=type==='start'||type==='finish'?type:'task', n=wmap.get(String(w))||st.wbs[0];
    const a={id:bid(),proj:pid,wbs:n.id,seq:++aseq,code,name:String(name||code).slice(0,160),type:t,dur:t==='task'?Math.max(1,Math.round(+dur||1)):0,cal:calId,cstr:'',cdate:null,as:null,af:null,rem:null,pct:null,codes:{},ch0:null,ch1:null,_p:Array.isArray(preds)?preds:String(preds||'').split(/[,;\s]+/).filter(Boolean)};
    if(dc){ a.codes.Discipline=String(dc); if(!disc.has(String(dc))) disc.set(String(dc),String(dc)); }
    const ch=js.chainage&&js.chainage[code]; if(Array.isArray(ch)){ const v0=parseFloat(ch[0]), v1=parseFloat(ch[1]); if(isFinite(v0)) a.ch0=v0; if(isFinite(v1)) a.ch1=v1; }
    byCode.set(code.toLowerCase(),a); st.acts.push(a); });
  const bad=[];
  st.acts.forEach(a=>{ (a._p||[]).forEach(tok=>{ const m=/^\s*(.+?)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+(?:\.\d+)?)\s*[dD]?)?\s*$/i.exec(String(tok)); const p=m&&byCode.get(m[1].trim().toLowerCase()); if(!p||p===a){ bad.push(`${a.code}: ${tok}`); return; } if(!st.rels.some(r=>r.p===p.id&&r.s===a.id)) st.rels.push({p:p.id,s:a.id,t:(m[2]||'FS').toUpperCase(),lag:m[4]?(m[3]==='-'?-1:1)*Math.round(+m[4]):0}); }); delete a._p; });
  st.codeTypes[0].values=[...disc].map(([short,name])=>({short,name}));
  // break any loops by dropping the last relationship into a looping activity
  let res=bCompute(st), guard=0; const dropped=[];
  const backEdge=()=>{ const succ=new Map(); st.rels.forEach((r,k)=>{ if(!succ.has(r.p)) succ.set(r.p,[]); succ.get(r.p).push([r.s,k]); }); const state=new Map(); let found=-1;
    const dfs=n=>{ if(found>=0) return; state.set(n,1); for(const [m,k] of (succ.get(n)||[])){ if(found>=0) return; const s2=state.get(m); if(s2===1){ found=k; return; } if(!s2) dfs(m); } state.set(n,2); };
    for(const a of st.acts){ if(!state.get(a.id)) dfs(a.id); if(found>=0) break; } return found; };
  while(res.loops.length&&guard++<50){ const k=backEdge(); if(k<0) break; const r=st.rels.splice(k,1)[0]; dropped.push(`${st.acts.find(a=>a.id===r.p).code}→${st.acts.find(a=>a.id===r.s).code}`); res=bCompute(st); }
  return {st,res,bad,dropped};
}
async function baGenerate(){
  if(BA.busy) return; const sample=AI.sample; if(!sample){ BA.status='AI generation is not available in this view. Open the artifact in Claude while signed in.'; baRender(); return; }
  if(!BA.brief.trim()&&!BA.docs.some(d=>d.status==='ready')){ BA.status='Add a brief or at least one document first.'; baRender(); return; }
  if(BA.docs.some(d=>d.status==='reading')){ BA.status='Wait for the documents to finish reading.'; baRender(); return; }
  BA.busy=true; BA.result=null; BA.ctl=new AbortController(); BA.status='Reading your documents and drafting the programme… this can take a few minutes on Deep.'; baRender();
  let images=BA.docs.filter(d=>d.status==='ready').flatMap(d=>d.images);
  try{ const lim=await sample.limits().catch(()=>null); const max=lim&&lim.images?lim.images.maxCount:0; if(images.length&&!max){ BA.status='Drawings are not sent in this view, so only their text is used.'; images=[]; } else images=images.slice(0,max);
    let chars=0; const gopts={signal:BA.ctl.signal,modelTier:BA.opts.tier,cache:false}; if(images.length) gopts.images=images; const js=await sample.json(baGenPrompt(),{...gopts,onText:({text})=>{ chars=text.length; BA.status=`Writing the programme… ${Math.round(chars/1000)}k characters so far`; const s=document.getElementById('baStatus'); if(s) s.textContent=BA.status; }});
    if(!js||!Array.isArray(js.activities)||!js.activities.length) throw {code:'invalid_json',message:'no activities'};
    const conv=baToState(js); BA.result={js,...conv}; BA.status='';
  }catch(e){ const c=e&&e.code; BA.status=c==='cancelled'?'Stopped.':c==='invalid_json'?'The answer could not be read as a programme, often because it was too long. Try Summary detail, fewer documents, or try again.':c==='images_unavailable'?'Images cannot be sent in this view. Remove drawings or use PDFs with text.':c==='image_rejected'?'One of the drawings could not be used. Try a smaller image or a PDF.':c==='prompt_too_large'?'The documents are too large to send together. Remove some or keep only the relevant sections.':(AI_ERR[c]||AI_ERR.upstream_error); }
  finally{ BA.busy=false; BA.ctl=null; baRender(); }
}
function baApply(mode){ const r=BA.result; if(!r) return; if(mode==='new'||!B.st){ if(B.st) bPush(); const keep=B.undo; B.st=r.st; B.undo=keep; }
  else { bPush(); const st=B.st, used=new Set(st.projects.map(p=>p.short)); let sh=r.st.projects[0].short, k=2; while(used.has(sh)) sh=r.st.projects[0].short+'-'+(k++); r.st.projects[0].short=sh;
    const calMap=new Map(); r.st.cals.forEach(c=>{ const same=st.cals.find(x=>x.name===c.name&&x.work.join()===c.work.join()); if(same) calMap.set(c.id,same.id); else { st.cals.push(c); calMap.set(c.id,c.id); } });
    r.st.acts.forEach(a=>{ a.cal=calMap.get(a.cal)||st.defCal; });
    st.projects.push(...r.st.projects); st.wbs.push(...r.st.wbs); st.acts.push(...r.st.acts); st.rels.push(...r.st.rels);
    r.st.codeTypes.forEach(t=>{ const ex=st.codeTypes.find(x=>x.name===t.name); if(ex) t.values.forEach(v=>{ if(!ex.values.some(x=>x.short===v.short)) ex.values.push(v); }); else st.codeTypes.push(t); }); }
  BA.result=null; B.t0=0; B.sel={r:0,c:'name'}; document.getElementById('bAi').hidden=true; if(!document.getElementById('bGrid')) bShell(); bChanged(); bToastMsg('Programme applied. Review the logic and durations, then capture a baseline when you are happy.'); }

/* ---------- refine with tools ---------- */
function baRefineTools(proj){
  const st=()=>B.st, find=id=>st().acts.find(a=>a.code.toLowerCase()===String(id||'').trim().toLowerCase());
  const wbsBy=code=>st().wbs.find(w=>w.code===String(code)&&(!proj||w.proj===proj))||st().wbs.find(w=>w.code===String(code));
  const setPreds=(a,list)=>{ const {rels,errs}=bParsePreds((list||[]).join(','),a); st().rels=st().rels.filter(r=>r.s!==a.id).concat(rels); return errs; };
  const recalc=()=>{ B.res=bCompute(B.st); return {finish:B.res.finish!=null?isoD(B.res.finish):null,activities:B.st.acts.length,loops:B.res.loops}; };
  return [
    {name:'list_activities',description:'List activities in the builder (up to 300) with id, name, wbs code, type, duration, predecessors, start, finish and total float. Optional text filter.',inputSchema:{type:'object',properties:{text:{type:'string'}}},
      execute(i){ const q=String(i.text||'').toLowerCase(); return st().acts.filter(a=>!q||a.code.toLowerCase().includes(q)||a.name.toLowerCase().includes(q)).slice(0,300).map(a=>{ const r=B.res.R.get(a.id), w=st().wbs.find(x=>x.id===a.wbs); return [a.code,a.name,w?w.code:'',a.type,bDur(a),bPredText(a),r?isoD(r.status==='ns'?r.es:a.as):'',r?isoD(r.ef):'',r&&r.tf!=null?r.tf:'']; }); }},
    {name:'list_wbs',description:'List WBS nodes as [code, name, parent code].',execute(){ return st().wbs.map(w=>[w.code,w.name,(st().wbs.find(x=>x.id===w.parent)||{}).code||null]); }},
    {name:'add_wbs',description:'Add WBS nodes. Each item: code, name, optional parent code.',inputSchema:{type:'object',properties:{items:{type:'array',items:{type:'object',properties:{code:{type:'string'},name:{type:'string'},parent:{type:'string'}},required:['code','name']}}},required:['items']},
      execute(i){ const added=[]; (i.items||[]).forEach(x=>{ if(wbsBy(x.code)) return; const par=x.parent?wbsBy(x.parent):null; const p=proj||(par?par.proj:st().projects[0].id); const sib=st().wbs.filter(w=>w.proj===p&&(w.parent||null)===(par?par.id:null)); st().wbs.push({id:bid(),proj:p,parent:par?par.id:null,code:String(x.code),name:String(x.name),seq:sib.length+1}); added.push(x.code); }); return {added,...recalc()}; }},
    {name:'add_activities',description:'Add activities. Each: id (unique), name, wbs code, type task|start|finish, duration (working days), predecessors (list like "A1010", "A1010SS+5").',inputSchema:{type:'object',properties:{activities:{type:'array',items:{type:'object',properties:{id:{type:'string'},name:{type:'string'},wbs:{type:'string'},type:{type:'string'},duration:{type:'number'},predecessors:{type:'array',items:{type:'string'}},discipline:{type:'string'}},required:['id','name']}}},required:['activities']},
      execute(i){ const added=[], errors=[]; const list=i.activities||[];
        list.forEach(x=>{ if(find(x.id)){ errors.push(`${x.id} already exists`); return; } const w=wbsBy(x.wbs)||st().wbs.find(w=>!proj||w.proj===proj); const t=x.type==='start'||x.type==='finish'?x.type:'task'; const sibs=st().acts.filter(a=>a.wbs===(w&&w.id));
          const a={id:bid(),proj:w?w.proj:(proj||st().projects[0].id),wbs:w?w.id:null,seq:sibs.length+1,code:String(x.id),name:String(x.name),type:t,dur:t==='task'?Math.max(1,Math.round(+x.duration||1)):0,cal:st().defCal,cstr:'',cdate:null,as:null,af:null,rem:null,pct:null,codes:x.discipline?{Discipline:String(x.discipline)}:{},ch0:null,ch1:null};
          st().acts.push(a); added.push(a); });
        added.forEach(a=>{ const x=list.find(y=>String(y.id)===a.code); const e=setPreds(a,x.predecessors); if(e.length) errors.push(`${a.code}: unknown predecessor ${e.join(', ')}`); });
        return {added:added.map(a=>a.code),errors,...recalc()}; }},
    {name:'update_activities',description:'Change activities. Each change: id plus any of name, duration, wbs, predecessors (replaces the list), add_successors (list of ids that should follow this activity FS), constraint (SNET|FNET|SNLT|FNLT|MSO|MFO or empty) and constraint_date (YYYY-MM-DD).',inputSchema:{type:'object',properties:{changes:{type:'array',items:{type:'object',properties:{id:{type:'string'},name:{type:'string'},duration:{type:'number'},wbs:{type:'string'},predecessors:{type:'array',items:{type:'string'}},add_successors:{type:'array',items:{type:'string'}},constraint:{type:'string'},constraint_date:{type:'string'}},required:['id']}}},required:['changes']},
      execute(i){ const done=[], errors=[]; (i.changes||[]).forEach(c=>{ const a=find(c.id); if(!a){ errors.push(`No activity ${c.id}`); return; }
          if(c.name) a.name=String(c.name); if(c.duration!=null&&a.type==='task') a.dur=Math.max(1,Math.round(+c.duration)); if(c.wbs){ const w=wbsBy(c.wbs); if(w) a.wbs=w.id; }
          if(Array.isArray(c.predecessors)){ const e=setPreds(a,c.predecessors); if(e.length) errors.push(`${a.code}: unknown predecessor ${e.join(', ')}`); }
          (c.add_successors||[]).forEach(sid=>{ const s=find(sid); if(s&&!st().rels.some(r=>r.p===a.id&&r.s===s.id)) st().rels.push({p:a.id,s:s.id,t:'FS',lag:0}); });
          if(c.constraint!=null){ a.cstr=CSTR.some(x=>x[0]===c.constraint)?c.constraint:''; a.cdate=a.cstr?parseDay(c.constraint_date):null; if(a.cstr&&a.cdate==null) a.cstr=''; }
          done.push(a.code); }); return {updated:done,errors,...recalc()}; }},
    {name:'delete_activities',description:'Delete activities by id. Their relationships are removed; reconnect their predecessors to successors yourself if logic must be kept.',inputSchema:{type:'object',properties:{ids:{type:'array',items:{type:'string'}}},required:['ids']},
      execute(i){ const gone=new Set(); (i.ids||[]).forEach(id=>{ const a=find(id); if(a) gone.add(a.id); }); const codes=st().acts.filter(a=>gone.has(a.id)).map(a=>a.code); st().acts=st().acts.filter(a=>!gone.has(a.id)); st().rels=st().rels.filter(r=>!gone.has(r.p)&&!gone.has(r.s)); return {deleted:codes,...recalc()}; }}];
}
async function baRefine(){
  if(BA.busy||!B.st) return; const sample=AI.sample, text=BA.refine.trim(); if(!sample){ BA.status='AI is not available in this view.'; baRender(); return; } if(!text) return;
  const lim=await sample.limits().catch(()=>null); if(!lim||!lim.tools){ BA.status='This view cannot let Claude edit the schedule directly. Use Generate instead.'; baRender(); return; }
  const row=bSelRow(); const proj=row?(row.t==='p'?row.p.id:row.t==='w'?row.w.proj:row.a.proj):B.st.projects[0].id;
  bPush(); BA.busy=true; BA.log=[]; BA.ctl=new AbortController(); BA.status='Claude is working through the schedule…'; baRender();
  const tools=baRefineTools(proj).map(t=>({...t,execute:(inp,ctx)=>{ const label={list_activities:'Reading activities',list_wbs:'Reading WBS',add_wbs:'Adding WBS',add_activities:`Adding ${(inp.activities||[]).length} activities`,update_activities:`Changing ${(inp.changes||[]).length} activities`,delete_activities:`Deleting ${(inp.ids||[]).length} activities`}[t.name]||t.name; BA.log.push(label); BA.status=label+'…'; baRender(); const out=t.execute(inp,ctx); if(/^(add|update|delete)/.test(t.name)){ bSave(); bRenderAll(); } return out; }}));
  const p=B.st.projects.find(x=>x.id===proj);
  const prompt=`You are an expert planner editing a CPM schedule in Schedule Workbench using the tools provided. Make the change the planner asks for with good scheduling practice: unique activity IDs in the existing numbering style, every new activity linked with a predecessor and a successor, mostly finish-to-start, no loops, realistic working-day durations. Read the existing activities and WBS first, then apply the changes, then reply with a short summary of what you changed and the new finish date. Work in project ${p?p.short:''} unless told otherwise.
Data date ${isoD(B.st.dd)}. Current finish ${B.res.finish!=null?isoD(B.res.finish):'unknown'}. ${B.st.acts.length} activities.

PLANNER'S REQUEST
${text}`;
  try{ const res=await sample(prompt,{signal:BA.ctl.signal,modelTier:BA.opts.tier==='complex'?'default':BA.opts.tier,tools}); BA.status=''; BA.refineOut=res.text; BA.refine=''; }
  catch(e){ const c=e&&e.code; BA.status=c==='cancelled'?'Stopped. Changes made so far are kept; Undo reverses the whole run.':(AI_ERR[c]||AI_ERR.upstream_error); if(e&&e.text) BA.refineOut=e.text; }
  finally{ BA.busy=false; BA.ctl=null; bChanged(); baRender(); }
}

/* ---------- panel ---------- */
function baOpen(){ const el=document.getElementById('bAi'); el.hidden=!el.hidden; if(!BA.opts.start) BA.opts.start=isoD(B.st?B.st.dd:dayOf(Date.now())); baRender(); if(!el.hidden) el.scrollIntoView({block:'nearest',behavior:'smooth'}); }
function baRender(){
  const el=document.getElementById('bAi'); if(!el||el.hidden) return; const o=BA.opts, ready=!!AI.sample, r=BA.result;
  const docRows=BA.docs.map(d=>`<div class="bad"><span class="badk ${d.status}">${esc(d.kind||'?')}</span><span class="badn" title="${esc(d.name)}">${esc(d.name)}</span><select data-barole="${d.id}" aria-label="Document type">${DOC_ROLES.map(([k,l])=>`<option value="${k}"${d.role===k?' selected':''}>${l}</option>`).join('')}</select><span class="badm ${d.status==='error'?'late':''}">${d.status==='reading'?'Reading…':esc(d.note)}</span><button class="fx" data-badel="${d.id}" aria-label="Remove ${esc(d.name)}">×</button></div>`).join('');
  let resH='';
  if(r){ const res=r.res, fin=res.finish, st=r.st, days=fin!=null?fin-st.dd:null;
    resH=`<div class="bar"><div class="bar-h"><div><div class="eyebrow">Draft programme</div><h4>${esc(st.projects[0].name)}</h4><p>${esc(r.js.summary||'')}</p></div>
      <div class="bar-s"><div><div class="sl">Activities</div><div class="sv">${st.acts.length}</div></div><div><div class="sl">Finish</div><div class="sv">${fin!=null?fmtD(fin*DAY):'—'}</div></div><div><div class="sl">Duration</div><div class="sv">${days!=null?Math.round(days/7)+'<small>wk</small>':'—'}</div></div><div><div class="sl">Critical</div><div class="sv acc">${res.crit}</div></div></div></div>
      ${r.bad.length||r.dropped.length||res.openEnds.length?`<div class="bar-w">${r.bad.length?`<span>${r.bad.length} predecessor references could not be matched and were skipped.</span>`:''}${r.dropped.length?`<span>Removed ${r.dropped.length} relationship${r.dropped.length===1?'':'s'} that formed a loop: ${esc(r.dropped.slice(0,4).join(', '))}.</span>`:''}${res.openEnds.length?`<span>${res.openEnds.length} open end${res.openEnds.length===1?'':'s'} to review.</span>`:''}</div>`:''}
      <div class="bar-g"><div><div class="dh">Assumptions</div><ul>${(r.js.assumptions||[]).slice(0,30).map(x=>`<li>${esc(x)}</li>`).join('')||'<li class="muted">None stated</li>'}</ul></div><div><div class="dh">Questions to confirm</div><ul>${(r.js.questions||[]).slice(0,30).map(x=>`<li>${esc(x)}</li>`).join('')||'<li class="muted">None</li>'}</ul></div></div>
      <div class="dh">First activities</div><div class="tw"><table class="rt"><thead><tr><th>ID</th><th>Activity</th><th>WBS</th><th class="n">Dur</th><th>Predecessors</th><th class="n">Start</th><th class="n">Finish</th></tr></thead><tbody>${st.acts.slice(0,25).map(a=>{ const x=res.R.get(a.id), w=st.wbs.find(z=>z.id===a.wbs); const pr=st.rels.filter(z=>z.s===a.id).map(z=>{ const p=st.acts.find(q=>q.id===z.p); return p?p.code+(z.t!=='FS'||z.lag?z.t:'')+(z.lag?(z.lag>0?'+':'')+z.lag:''):''; }).join(', ');
        return `<tr><td><b class="${x&&x.crit?'acc':''}">${esc(a.code)}</b></td><td class="nm">${esc(a.name)}</td><td>${esc(w?w.code:'')}</td><td class="n">${bDur(a)}</td><td>${esc(pr)}</td><td class="n">${x?fmtDay(x.es):''}</td><td class="n">${x?fmtDay(a.type==='start'?x.es:x.ef):''}</td></tr>`; }).join('')}</tbody></table></div>${st.acts.length>25?`<p class="muted" style="font-size:12.5px">+ ${st.acts.length-25} more. Apply it to see everything in the grid and Gantt.</p>`:''}
      <div class="bar-a"><button class="btn primary" data-baapply="new">${B.st?'Replace the builder with this':'Use this programme'}</button>${B.st?'<button class="btn" data-baapply="add">Add as another project</button>':''}<button class="btn" data-ba2="discard">Discard</button></div></div>`; }
  el.innerHTML=`<div class="cph"><strong>✦ AI build</strong><span class="sp"></span><button class="fx" data-ba2="close" aria-label="Close">×</button></div>
    ${ready?'':`<p class="aierr">AI isn't available in this view. Open the artifact in Claude while signed in.</p>`}
    <div class="bag">
      <section><div class="dh" style="margin-top:0">1 · Brief</div><textarea id="baBrief" rows="7" placeholder="Describe the project: what is being built, where, size and phasing, contract and access constraints, key dates, working pattern, anything the documents don't say.">${esc(BA.brief)}</textarea>
        <div class="bao"><label class="exf"><span>Project code</span><input id="baCode" value="${esc(o.code)}"></label><label class="exf"><span>Planned start</span><input id="baStart" type="date" value="${esc(o.start)}"></label>
          <label class="exf"><span>Calendar</span><select id="baCal"><option value="5"${o.cal==='5'?' selected':''}>5-day</option><option value="6"${o.cal==='6'?' selected':''}>6-day</option><option value="7"${o.cal==='7'?' selected':''}>7-day</option></select></label>
          <label class="exf"><span>Detail</span><select id="baDetail"><option value="summary"${o.detail==='summary'?' selected':''}>Summary (30–60)</option><option value="standard"${o.detail==='standard'?' selected':''}>Standard (60–150)</option><option value="detailed"${o.detail==='detailed'?' selected':''}>Detailed (150–300)</option></select></label>
          <label class="exf"><span>Thinking</span><select id="baTier"><option value="complex"${o.tier==='complex'?' selected':''}>Deep (best)</option><option value="default"${o.tier==='default'?' selected':''}>Standard (faster)</option></select></label></div></section>
      <section><div class="dh" style="margin-top:0">2 · Documents</div>
        <label class="drop bad-drop" id="baDrop"><input type="file" id="baFiles" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.xlsm,.csv,.txt,.md,.tsv,.xer,.json"><strong>Drop drawings, BoQ, specs or previous schedules</strong><span>PDF, images, Excel, CSV, text or XER · read in your browser</span></label>
        <div class="bads">${docRows||'<p class="muted" style="font-size:13px;margin:6px 0 0">No documents yet. A brief alone also works.</p>'}</div></section>
    </div>
    <div class="bab"><span class="muted" id="baStatus">${esc(BA.status)}</span><button class="btn" data-ba2="stop" ${BA.busy?'':'hidden'}>Stop</button><button class="btn primary" data-ba2="gen" ${BA.busy||!ready?'disabled':''}>Generate programme</button></div>
    ${resH}
    ${B.st?`<div class="baref"><div class="dh">Refine the current schedule with AI</div><div class="baref-r"><textarea id="baRefine" rows="2" placeholder="e.g. Add a 4-week commissioning phase after each station fit-out and link it to Entry into Service">${esc(BA.refine)}</textarea><button class="btn primary" data-ba2="refine" ${BA.busy||!ready?'disabled':''}>Apply with AI</button></div>
      ${BA.log.length?`<div class="aisteps">${BA.log.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${BA.refineOut?`<div class="aimsg a"><div class="aib">${aiMd(BA.refineOut,new Set())}</div></div>`:''}<p class="muted" style="font-size:12px;margin:6px 0 0">Claude edits the schedule in the grid directly. One Undo reverses the whole change.</p></div>`:''}
    <p class="muted" style="font-size:12px;margin:10px 0 0">${window.claude&&window.claude.hosted?'Uses the workbench’s Anthropic API key.':'Uses your own Claude usage.'} Document text and drawing images are sent to Claude for this request only. Always review logic, durations and assumptions before baselining.</p>`;
}
function wireBa(){
  const el=document.getElementById('bAi');
  el.addEventListener('input',e=>{ const t=e.target; if(t.id==='baBrief') BA.brief=t.value; if(t.id==='baRefine') BA.refine=t.value; });
  el.addEventListener('change',e=>{ const t=e.target, o=BA.opts; if(t.id==='baCode') o.code=t.value.trim(); if(t.id==='baStart') o.start=t.value; if(t.id==='baCal') o.cal=t.value; if(t.id==='baDetail') o.detail=t.value; if(t.id==='baTier') o.tier=t.value;
    if(t.dataset.barole){ const d=BA.docs.find(x=>x.id===t.dataset.barole); if(d) d.role=t.value; } if(t.id==='baFiles'){ baAddFiles([...t.files]); t.value=''; } });
  el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.ba2==='close'){ el.hidden=true; return; } if(b.dataset.ba2==='gen') baGenerate(); if(b.dataset.ba2==='stop'&&BA.ctl) BA.ctl.abort(); if(b.dataset.ba2==='refine') baRefine();
    if(b.dataset.ba2==='discard'){ BA.result=null; baRender(); } if(b.dataset.baapply) baApply(b.dataset.baapply);
    if(b.dataset.badel){ BA.docs=BA.docs.filter(d=>d.id!==b.dataset.badel); baRender(); } });
  el.addEventListener('dragover',e=>{ const d=e.target.closest('#baDrop'); if(d){ e.preventDefault(); d.classList.add('over'); } });
  el.addEventListener('dragleave',e=>{ const d=e.target.closest('#baDrop'); if(d) d.classList.remove('over'); });
  el.addEventListener('drop',e=>{ const d=e.target.closest('#baDrop'); if(!d) return; e.preventDefault(); d.classList.remove('over'); const fs=[...(e.dataTransfer?.files||[])]; if(fs.length) baAddFiles(fs); });
}

