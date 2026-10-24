/* ================= Accounts, saved schedules and period performance ================= */
const PER={mode:null, db:null, user:null, me:null, uid:null, canWrite:null, isOwner:false, canEdit:false, role:'',
  space:'team', projects:[], periods:[], pid:null, unP:null, unR:null, blobs:new Map(), stats:new Map(), cmp:{a:null,b:null,tab:'slip'}, ms:null, loaded:null, busy:'', readOnly:false};

/* ---- local document store (IndexedDB) with the same surface the page uses from the shared db ---- */
function localDocStore(){
  let dbp=null; const mem=new Map(), L=new Map();
  const open=()=>dbp||(dbp=new Promise(res=>{ try{ const r=indexedDB.open('schedule-workbench',1); r.onupgradeneeded=()=>r.result.createObjectStore('docs'); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); }catch(_){ res(null); } }));
  const req=(mode,fn)=>open().then(d=>{ if(!d) return fn(null); return new Promise((res,rej)=>{ const t=d.transaction('docs',mode), st=t.objectStore('docs'); let out; const r=fn(st); if(r) r.onsuccess=()=>{ out=r.result; }; t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); }); });
  const get=k=>req('readonly',st=>st?st.get(k):null).then(v=>v===undefined&&!mem.size?undefined:(v!==undefined?v:mem.get(k)));
  const put=(k,v)=>req('readwrite',st=>{ if(!st){ mem.set(k,v); return null; } return st.put(v,k); });
  const del=k=>req('readwrite',st=>{ if(!st){ mem.delete(k); return null; } return st.delete(k); });
  const list=coll=>req('readonly',st=>st?st.getAllKeys(IDBKeyRange.bound(coll+'/',coll+'/￿')):null).then(async keys=>{
    keys=keys||[...mem.keys()].filter(k=>k.startsWith(coll+'/')); const depth=coll.split('/').length+1; keys=keys.filter(k=>k.split('/').length===depth);
    const docs=[]; for(const k of keys){ const v=await get(k); if(v!==undefined) docs.push(snapDoc(k.split('/').pop(),v)); } return {docs,size:docs.length,empty:!docs.length}; });
  const snapDoc=(id,v)=>({id,exists:v!==undefined,data:()=>v,metadata:{fromCache:false,hasPendingWrites:false}});
  const notify=path=>{ const coll=path.split('/').slice(0,-1).join('/'); (L.get(coll)||new Set()).forEach(fn=>list(coll).then(fn)); };
  const docRef=path=>({id:path.split('/').pop(),path,
    get:()=>get(path).then(v=>snapDoc(path.split('/').pop(),v)),
    set:d=>put(path,JSON.parse(JSON.stringify(d))).then(()=>notify(path)),
    update:d=>get(path).then(v=>{ if(v===undefined) throw {code:'invalid_argument',message:'Document does not exist'}; return put(path,Object.assign({},v,JSON.parse(JSON.stringify(d)))); }).then(()=>notify(path)),
    delete:()=>del(path).then(()=>notify(path)),
    collection:sub=>collRef(path+'/'+sub)});
  const collRef=path=>({path, doc:id=>docRef(path+'/'+(id||('l'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)))), get:()=>list(path),
    onSnapshot:(next)=>{ if(!L.has(path)) L.set(path,new Set()); L.get(path).add(next); list(path).then(next); return ()=>L.get(path).delete(next); }});
  return {doc:docRef, collection:collRef, local:true};
}

/* ---- encoding: XER text <-> gzip base64 chunks ---- */
function tablesToXer(T){
  let out='ERMHDR\t21.12\t'+new Date().toISOString().slice(0,10)+'\tProject\tADMIN\tworkbench\tdbxDatabaseNoName\tProject Management\tUSD\n';
  for(const [name,rows] of Object.entries(T)){ if(!Array.isArray(rows)) continue; const f=new Set(); rows.forEach(r=>Object.keys(r).forEach(k=>f.add(k))); const F=[...f];
    out+=`%T\t${name}\n%F\t${F.join('\t')}\n`; for(const r of rows) out+='%R\t'+F.map(k=>String(r[k]??'').replace(/[\t\r\n]/g,' ')).join('\t')+'\n'; }
  return out+'%E\n';
}
async function perHash(text){
  try{ const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)); return [...new Uint8Array(b)].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join(''); }
  catch(_){ let h1=0x811c9dc5,h2=0x1234567; for(let i=0;i<text.length;i++){ const c=text.charCodeAt(i); h1=Math.imul(h1^c,16777619); h2=Math.imul(h2^c,2246822519)>>>0; } return (h1>>>0).toString(16).padStart(8,'0')+h2.toString(16).padStart(8,'0')+text.length.toString(16); }
}
const b64=u=>{ let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); };
const unb64=s=>{ const b=atob(s), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; };
async function perPack(text){
  if(typeof CompressionStream==='undefined') return {enc:'raw',data:text};
  const st=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return {enc:'gz',data:b64(new Uint8Array(await new Response(st).arrayBuffer()))};
}
async function perUnpack(enc,data){
  if(enc!=='gz') return data;
  const st=new Blob([unb64(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(st).text();
}
const CHUNK=180000;

/* ---- paths ---- */
/* ---- store interface: docStore (Claude db or this browser) and supaStore (hosted) share these methods ---- */
function docStore(db){
  const base=name=>PER.space==='private'&&PER.uid&&!db.local?db.doc('data/users/'+PER.uid+'/space').collection(name):db.collection(name);
  const root=()=>base('projects'), progs=()=>base('programmes');
  const proj=pid=>root().doc(pid), files=pid=>proj(pid).collection('files');
  const rows=s=>s.docs.map(d=>({id:d.id,...d.data()}));
  return {
    watchProjects:(cb,err)=>root().onSnapshot(s=>cb(rows(s)),err),
    watchPeriods:(pid,cb,err)=>proj(pid).collection('periods').onSnapshot(s=>cb(rows(s)),err),
    async createProject(name,x){ x=x||{}; const ref=root().doc(); await ref.set({name,programmeId:x.programmeId||null,code:x.code||'',status:x.status||'active',manager:x.manager||'',description:x.description||'',createdBy:PER.uid||'local',createdAt:Date.now(),updatedAt:Date.now()}); return ref.id; },
    renameProject:(pid,name)=>proj(pid).update({name,updatedAt:Date.now()}),
    updateProject:(pid,f)=>proj(pid).update(Object.assign({},f,{updatedAt:Date.now()})),
    async listPeriods(pid){ return rows(await proj(pid).collection('periods').get()); },
    async refreshSummary(pid){ const sm=perSummary(rows(await proj(pid).collection('periods').get())); await proj(pid).update({summary:sm,lastDD:sm?sm.dd:null,updatedAt:Date.now()}); },
    watchProgrammes:(cb,err)=>progs().onSnapshot(s=>cb(rows(s)),err),
    async createProgramme(f){ const ref=progs().doc(); await ref.set(Object.assign({sort:0},f,{createdBy:PER.uid||'local',createdAt:Date.now(),updatedAt:Date.now()})); return ref.id; },
    updateProgramme:(id,f)=>progs().doc(id).update(Object.assign({},f,{updatedAt:Date.now()})),
    async deleteProgramme(id){ const ps=rows(await root().get()).filter(p=>p.programmeId===id); for(const p of ps) await proj(p.id).update({programmeId:null}); await progs().doc(id).delete(); },
    async hasFile(pid,h){ const ex=await files(pid).doc(h).get(); return ex.exists&&!!ex.data().done; },
    async putFile(pid,h,name,text){ const fr=files(pid).doc(h), pk=await perPack(text), parts=[]; for(let i=0;i<pk.data.length;i+=CHUNK) parts.push(pk.data.slice(i,i+CHUNK)); if(!parts.length) parts.push('');
      await fr.set({name,size:text.length,n:parts.length,enc:pk.enc,done:false,by:PER.uid||'local',at:Date.now()});
      for(let i=0;i<parts.length;i++) await fr.collection('chunks').doc('c'+String(i).padStart(4,'0')).set({i,d:parts[i]});
      await fr.update({done:true}); },
    async getFileText(pid,h,name){ const fr=files(pid).doc(h), meta=await fr.get(); if(!meta.exists) throw new Error(`The saved copy of ${name} is missing.`);
      const m=meta.data(), ch=await fr.collection('chunks').get(), parts=ch.docs.map(d=>d.data()).sort((x,y)=>x.i-y.i);
      if(parts.length<m.n) throw new Error(`${name} is incomplete in the database (${parts.length} of ${m.n} parts).`);
      return perUnpack(m.enc,parts.map(p=>p.d).join('')); },
    async dropFile(pid,h){ const fr=files(pid).doc(h), ch=await fr.collection('chunks').get(); for(const d of ch.docs) await fr.collection('chunks').doc(d.id).delete(); await fr.delete(); },
    async addPeriod(pid,doc){ const ref=proj(pid).collection('periods').doc(); await ref.set(doc); await this.refreshSummary(pid); return ref.id; },
    async deletePeriod(pid,id){ await proj(pid).collection('periods').doc(id).delete(); await this.refreshSummary(pid); },
    updatePeriod:(pid,id,f)=>proj(pid).collection('periods').doc(id).update(f),
    async deleteProject(pid){ const pr=proj(pid), ps=await pr.collection('periods').get(), fs=await files(pid).get();
      for(const d of ps.docs) await pr.collection('periods').doc(d.id).delete(); for(const d of fs.docs) await this.dropFile(pid,d.id); await pr.delete(); },
    async getQuality(){ const d=await db.collection('settings').doc('quality').get(); return d.exists?(d.data()||{}).config:null; },
    setQuality:cfg=>db.collection('settings').doc('quality').set({config:cfg,at:Date.now(),by:PER.uid||'local'}),
    profiles:ids=>PER.mode==='cloud'&&PER.user?PER.user.profiles([...new Set(ids.filter(x=>x&&x!=='local'))]):Promise.resolve({})
  };
}
async function perGzipBlob(text){ if(typeof CompressionStream==='undefined') return new Blob([text],{type:'text/plain'}); return await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); }
async function perGunzipBlob(b){ const h=new Uint8Array(await b.slice(0,2).arrayBuffer()); if(h[0]!==0x1f||h[1]!==0x8b) return await b.text(); return await new Response(b.stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
function supaStore(sb){
  const ok=({data,error})=>{ if(error) throw error; return data; };
  const mapP=r=>({id:r.id,name:r.name,createdBy:r.owner,updatedAt:Date.parse(r.updated_at)||0,space:r.space,programmeId:r.programme_id||null,code:r.code||'',status:r.status||'active',manager:r.manager||'',description:r.description||'',summary:r.summary||null});
  const mapG=r=>({id:r.id,name:r.name,code:r.code||'',client:r.client||'',description:r.description||'',colour:r.colour||'',sort:r.sort||0,createdBy:r.owner,updatedAt:Date.parse(r.updated_at)||0});
  const pCols=f=>{ const o={}; if('name' in f) o.name=f.name; if('programmeId' in f) o.programme_id=f.programmeId||null; ['code','status','manager','description'].forEach(k=>{ if(k in f) o[k]=f[k]||(k==='status'?'active':''); }); return o; };
  const gCols=f=>{ const o={}; ['name','code','client','description','colour','sort'].forEach(k=>{ if(k in f) o[k]=f[k]; }); return o; };
  const mapR=r=>({id:r.id,label:r.label,notes:r.notes||'',dd:r.dd==null?null:Number(r.dd),stats:r.stats||{},files:r.files||[],narrative:r.narrative||{},savedBy:r.saved_by,savedAt:Date.parse(r.saved_at)||0});
  let n=0;
  const watch=(table,filter,load,cb,err)=>{ let alive=true, t=null; const run=()=>load().then(x=>{ if(alive) cb(x); }).catch(e=>{ if(alive&&err) err(e); }); run();
    const ch=sb.channel('sw-'+table+'-'+(++n)+'-'+Date.now()).on('postgres_changes',Object.assign({event:'*',schema:'public',table},filter?{filter}:{}),()=>{ clearTimeout(t); t=setTimeout(run,300); }).subscribe();
    return ()=>{ alive=false; clearTimeout(t); try{ sb.removeChannel(ch); }catch(_){} }; };
  const fileRow=async(pid,h)=>ok(await sb.from('xer_files').select('path').eq('project_id',pid).eq('hash',h).maybeSingle());
  return {
    watchProjects(cb,err){ const sp=PER.space, me=PER.uid; return watch('projects',null,async()=>{ let q=sb.from('projects').select('*').eq('space',sp); if(sp==='private') q=q.eq('owner',me); return ok(await q).map(mapP); },cb,err); },
    watchPeriods:(pid,cb,err)=>watch('periods','project_id=eq.'+pid,async()=>ok(await sb.from('periods').select('*').eq('project_id',pid)).map(mapR),cb,err),
    async createProject(name,x){ return ok(await sb.from('projects').insert(Object.assign(pCols(x||{}),{name,space:PER.space})).select('id').single()).id; },
    async renameProject(pid,name){ ok(await sb.from('projects').update({name}).eq('id',pid)); },
    async updateProject(pid,f){ ok(await sb.from('projects').update(pCols(f)).eq('id',pid)); },
    async listPeriods(pid){ return ok(await sb.from('periods').select('*').eq('project_id',pid)).map(mapR); },
    watchProgrammes(cb,err){ const sp=PER.space, me=PER.uid; return watch('programmes',null,async()=>{ let q=sb.from('programmes').select('*').eq('space',sp); if(sp==='private') q=q.eq('owner',me); return ok(await q).map(mapG); },cb,err); },
    async createProgramme(f){ return ok(await sb.from('programmes').insert(Object.assign(gCols(f),{space:PER.space})).select('id').single()).id; },
    async updateProgramme(id,f){ ok(await sb.from('programmes').update(gCols(f)).eq('id',id)); },
    async deleteProgramme(id){ ok(await sb.from('programmes').delete().eq('id',id)); },
    async hasFile(pid,h){ return !!(await fileRow(pid,h)); },
    async putFile(pid,h,name,text){ const path=`${pid}/${h}.xer.gz`, blob=await perGzipBlob(text);
      const up=await sb.storage.from('xer').upload(path,blob,{contentType:'application/gzip',upsert:true}); if(up.error) throw up.error;
      ok(await sb.from('xer_files').upsert({project_id:pid,hash:h,name,size:text.length,path})); },
    async getFileText(pid,h,name){ const row=await fileRow(pid,h); if(!row) throw new Error(`The saved copy of ${name} is missing.`);
      const d=await sb.storage.from('xer').download(row.path); if(d.error) throw d.error; return perGunzipBlob(d.data); },
    async dropFile(pid,h){ const row=await fileRow(pid,h); if(row) await sb.storage.from('xer').remove([row.path]); ok(await sb.from('xer_files').delete().eq('project_id',pid).eq('hash',h)); },
    async addPeriod(pid,doc){ return ok(await sb.from('periods').insert({project_id:pid,label:doc.label,notes:doc.notes,dd:doc.dd,stats:doc.stats,files:doc.files,narrative:doc.narrative||{}}).select('id').single()).id; },
    async updatePeriod(pid,id,f){ const o={}; if('narrative' in f) o.narrative=f.narrative||{}; if('notes' in f) o.notes=f.notes||''; if('label' in f) o.label=f.label; ok(await sb.from('periods').update(o).eq('id',id)); },
    async deletePeriod(pid,id){ ok(await sb.from('periods').delete().eq('id',id)); },
    async deleteProject(pid){ const fs=ok(await sb.from('xer_files').select('path').eq('project_id',pid)); if(fs.length) await sb.storage.from('xer').remove(fs.map(f=>f.path)); ok(await sb.from('projects').delete().eq('id',pid)); },
    async profiles(ids){ ids=[...new Set(ids.filter(Boolean))]; const out={}; if(!ids.length) return out; const rs=ok(await sb.from('profiles').select('id,name,email').in('id',ids));
      rs.forEach(r=>out[r.id]={id:r.id,name:r.name||r.email||'',isMe:r.id===PER.uid}); return out; }
  };
}
const perErr=e=>{ const c=e&&e.code, msg=(e&&e.message)||''; if(c==='42501'||/row-level security|permission denied|not authorized|Unauthorized/i.test(msg)) return 'You don’t have permission to do that. Ask an admin to change your access.'; if(/maximum allowed size|Payload too large/i.test(msg)||e&&e.statusCode==='413') return 'That file is larger than the storage limit allows.'; if(/Failed to fetch|NetworkError/i.test(msg)) return 'Can’t reach the database. Check your connection and try again.'; return c==='quota_exceeded'?'The database is full. Delete older periods or projects to make room.':c==='invalid_argument'?(perRO()?'You have view-only access, so you can’t save here.':'The database refused that change'+(e.message?': '+e.message:'.')):c==='resource_exhausted'?'Too many requests at once. Wait a moment and try again.':c==='revoked'?'Your access to this workbench changed. Reload the page.':(e&&e.message)||'Something went wrong talking to the database.'; };
function perToast(msg,kind){ let t=document.getElementById('perToast'); if(!t){ t=document.createElement('div'); t.id='perToast'; t.className='ptoast'; t.setAttribute('role','status'); document.body.appendChild(t); }
  t.textContent=msg; t.className='ptoast show'+(kind?' '+kind:''); clearTimeout(t._h); t._h=setTimeout(()=>t.className='ptoast',kind==='err'?7000:3800); }

/* ---- sign in ---- */
const SWC=(typeof window!=='undefined'&&window.SW_CONFIG)||null;
const supaOn=()=>!!(SWC&&SWC.supabaseUrl&&SWC.supabaseAnonKey&&!/YOUR-/.test(SWC.supabaseUrl+SWC.supabaseAnonKey));
const LOGO='<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)"/><rect x="6" y="6.5" width="11" height="4" rx="2" fill="#fff"/><path d="M6 16h4.5l2.5-3.5 3 7 2.5-3.5H26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="15" y="21.5" width="11" height="4" rx="2" fill="#fff" opacity=".75"/></svg>';
const MSLOGO='<svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>';
function authArt(){ let g=''; const r=[[40,120,0],[90,170,1],[150,90,0],[200,150,1],[110,210,0],[260,120,1],[300,160,0],[180,240,1],[330,110,0],[230,200,1],[370,80,0]];
  r.forEach(([x,w,o],i)=>{ const y=40+i*32; g+=`<rect x="${x-20}" y="${y}" width="${w}" height="14" rx="7" fill="${o?'#fff':'rgba(255,255,255,.28)'}"/>`; if(i%3===2) g+=`<rect x="${x+w-14}" y="${y-5}" width="14" height="14" transform="rotate(45 ${x+w-7} ${y+7})" fill="#fff"/>`; });
  return `<div class="auth-art" aria-hidden="true"><svg viewBox="0 0 480 560" preserveAspectRatio="xMidYMid slice">${g}<path d="M20 330 L120 300 L170 318 L260 262 L330 280 L460 200" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>
    <div class="auth-q"><b>Every period, on record.</b><span>Save each update, compare it with the last, and see where the programme is really heading.</span></div></div>`; }
function authShell(inner){ const old=document.getElementById('auth'); if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="auth" id="auth" role="dialog" aria-modal="true" aria-labelledby="authT">${authArt()}<div class="auth-side"><div class="auth-card"><div class="brand auth-brand">${LOGO}<span class="bname">Schedule <span>Workbench</span></span></div>${inner}</div></div></div>`);
  const off=document.getElementById('authOff'); if(off) off.onclick=()=>authDone('local'); }
const OFFLINE_HTML=`<div class="auth-or"><span>or</span></div><button class="btn auth-off" id="authOff">Work offline on this device</button><p class="auth-fine">Offline work is saved in this browser only and isn’t shared with your team.</p>`;
function avatar(src,cls){ return `<img class="${cls||'av'}" src="${esc(src||'')}" alt="" referrerpolicy="no-referrer">`; }
function initials(name,cls){ const t=(name||'?').trim().split(/[\s@._-]+/).filter(Boolean), s=((t[0]||'?')[0]+((t[1]||'')[0]||'')).toUpperCase(); let h=0; for(const c of name||'') h=(h*31+c.charCodeAt(0))>>>0; return `<span class="${cls||'av'} ini" style="background:${PAL[h%PAL.length]}" aria-hidden="true">${esc(s)}</span>`; }
async function authStart(){
  if(supaOn()) return supaAuthStart();
  let keep=null; try{ keep=localStorage.getItem('pacer.auth'); }catch(_){}
  if(SWC){ authShell(`<h1 id="authT">Sign in</h1><div class="auth-id"><div class="auth-x" aria-hidden="true">!</div><div><b>Sign-in isn’t set up yet</b><span class="muted">Add your Supabase project URL and anon key to config.js to switch on accounts and the team database. Until then you can work offline.</span></div></div>${OFFLINE_HTML.replace('auth-off"','auth-off primary"')}`);
    if(keep==='local') authDone('local'); return; }
  authShell(`<h1 id="authT">Sign in</h1>
    <p class="muted">Use your Claude account to open the team workspace. Your saved projects and period history are kept in the workbench database.</p>
    <div class="auth-id" id="authId"><div class="auth-spin" aria-hidden="true"></div><div><b>Checking your account…</b><span class="muted">This takes a moment.</span></div></div>
    <button class="btn primary auth-go" id="authGo" disabled>Continue</button>
    <label class="auth-keep"><input type="checkbox" id="authKeep" checked> Keep me signed in on this device</label>
    ${OFFLINE_HTML}<p class="auth-fine">Access is managed through Claude. To add colleagues, share the workbench from its Share menu as Viewer (read only), Contributor (save periods) or Editor (manage projects).</p>`);
  const go=document.getElementById('authGo'); go.onclick=()=>authDone('cloud');
  const cl=typeof window!=='undefined'&&window.claude&&typeof window.claude.use==='function'?window.claude:null;
  let user=null, db=null;
  if(cl){ try{ [user,db]=await Promise.all([cl.use('user'),cl.use('db')]); }catch(_){} }
  PER.user=user; PER.db=db;
  const id=document.getElementById('authId'); if(!id) return;
  if(user){ PER.me=await user.me(); PER.uid=PER.me.id; PER.isOwner=PER.me.isOwner; PER.canEdit=PER.me.canEdit; try{ PER.canWrite=await user.can('data.write'); }catch(_){ PER.canWrite=null; } }
  PER.role=PER.isOwner?'Owner':PER.canEdit?'Editor':PER.canWrite===true?'Contributor':PER.canWrite===false?'Viewer':'Member';
  if(db&&PER.uid){
    id.innerHTML=`${avatar(PER.me.avatarUrl,'av lg')}<div><b></b><span class="muted">${esc(PER.role)} · signed in with Claude</span></div>`; id.querySelector('b').textContent=PER.me.name||'Your Claude account';
    go.disabled=false; go.textContent='Continue as '+((PER.me.name||'').split(' ')[0]||'you');
    if(keep==='cloud'){ authDone('cloud'); return; } go.focus();
  } else {
    id.innerHTML=`<div class="auth-x" aria-hidden="true">!</div><div><b>No Claude sign-in here</b><span class="muted">${cl?'Open the workbench from claude.ai while signed in to use the team database.':'This copy isn’t running inside claude.ai, so only offline mode is available.'}</span></div>`;
    go.hidden=true; document.getElementById('authOff').classList.add('primary'); document.querySelector('.auth-or').hidden=true;
    if(keep==='local'){ authDone('local'); return; }
  }
}
/* hosted sign-in: Supabase (Microsoft and email magic link) */
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('Could not load '+src)); document.head.appendChild(s); }); }
async function supaClient(){
  if(PER.sb) return PER.sb;
  if(!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js');
  PER.sb=window.supabase.createClient(SWC.supabaseUrl,SWC.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
  PER.sb.auth.onAuthStateChange((ev,session)=>{
    if(ev==='SIGNED_OUT'&&PER.mode==='supa'){ perReset(); supaAuthStart(); }
    else if(ev==='SIGNED_IN'&&session&&!PER.mode&&!PER.sbChecking) supaAfter(session); });
  return PER.sb;
}
const supaRedirect=()=>location.origin+location.pathname;
async function supaAuthStart(){
  let keep=null; try{ keep=localStorage.getItem('pacer.auth'); }catch(_){}
  const ms=!SWC.signIn||SWC.signIn.microsoft!==false, em=!SWC.signIn||SWC.signIn.email!==false;
  authShell(`<h1 id="authT">Sign in</h1>
    <p class="muted">${ms&&em?'Use your Microsoft work account, or get a one-time sign-in link by email.':ms?'Use your Microsoft work account.':'We’ll email you a one-time sign-in link.'}</p>
    <div class="auth-id" id="authId"><div class="auth-spin" aria-hidden="true"></div><div><b>Checking your session…</b><span class="muted">One moment.</span></div></div>
    <div id="authOpts" hidden>
      ${ms?`<button class="btn auth-go auth-ms" id="authMs">${MSLOGO}<span>Sign in with Microsoft</span></button>`:''}
      ${ms&&em?'<div class="auth-or"><span>or</span></div>':''}
      ${em?`<form class="auth-mail" id="authMail"><label class="pfl"><span>Work email</span><input type="email" id="authEmail" required autocomplete="email" placeholder="name@company.com"></label><button class="btn primary auth-go" type="submit" id="authSend">Email me a sign-in link</button></form>`:''}
    </div>
    ${OFFLINE_HTML}
    <p class="auth-fine">New accounts need an admin to approve them before they can see team projects.</p>`);
  const id=document.getElementById('authId');
  let sb; try{ sb=await supaClient(); }catch(e){ id.innerHTML=`<div class="auth-x">!</div><div><b>Can’t reach the sign-in service</b><span class="muted">${esc(e.message||e)}. Check config.js and your connection, or work offline.</span></div>`; return; }
  const q=new URLSearchParams(location.search+'&'+location.hash.replace(/^#/,'')), urlErr=q.get('error_description');
  PER.sbChecking=true; let session=null; try{ session=(await sb.auth.getSession()).data.session; }catch(_){} PER.sbChecking=false;
  if(session) return supaAfter(session);
  if(keep==='local') return authDone('local');
  id.innerHTML=urlErr?`<div class="auth-x">!</div><div><b>Sign-in didn’t complete</b><span class="muted"></span></div>`:''; id.hidden=!urlErr; if(urlErr) id.querySelector('span').textContent=urlErr;
  if(urlErr) history.replaceState(null,'',supaRedirect());
  document.getElementById('authOpts').hidden=false;
  const msb=document.getElementById('authMs'); if(msb) msb.onclick=async()=>{ msb.disabled=true; const {error}=await sb.auth.signInWithOAuth({provider:'azure',options:{scopes:'openid profile email',redirectTo:supaRedirect(),queryParams:{prompt:'select_account'}}}); if(error){ msb.disabled=false; authMsg('Microsoft sign-in failed',error.message); } };
  const f=document.getElementById('authMail'); if(f) f.onsubmit=async e=>{ e.preventDefault(); const email=document.getElementById('authEmail').value.trim(), btn=document.getElementById('authSend'); if(!email) return; btn.disabled=true; btn.textContent='Sending…';
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:supaRedirect()}});
    btn.disabled=false; btn.textContent='Email me a sign-in link';
    if(error) authMsg('Couldn’t send the link',error.message); else authMsg('Check your email',`We sent a sign-in link to ${email}. Open it on this device to finish signing in.`,true); };
}
function authMsg(title,body,good){ const id=document.getElementById('authId'); if(!id) return; id.hidden=false; id.innerHTML=`<div class="auth-x${good?' ok':''}" aria-hidden="true">${good?'✓':'!'}</div><div><b></b><span class="muted"></span></div>`; id.querySelector('b').textContent=title; id.querySelector('span').textContent=body; }
async function supaAfter(session){
  const sb=PER.sb; PER.uid=session.user.id; PER.email=session.user.email||'';
  if(location.search.includes('code=')||location.hash.includes('access_token')) history.replaceState(null,'',supaRedirect());
  let prof=null;
  for(let i=0;i<3&&!prof;i++){ const r=await sb.from('profiles').select('*').eq('id',PER.uid).maybeSingle(); prof=r.data; if(r.error&&i===2){ authShellPending(`Can’t load your profile`,r.error.message+'. Has schema.sql been run in Supabase?'); return; } if(!prof) await new Promise(r=>setTimeout(r,800)); }
  if(!prof){ authShellPending('Your account is being set up','Try again in a moment.'); return; }
  PER.prof=prof; await coLoad(prof);
  PER.srole=PER.platform?'admin':!prof.company_id?'pending':(PER.company&&PER.company.status==='suspended')?'pending':prof.role;
  if(PER.srole==='pending'){
    if(!PER.platform&&!prof.company_id) authShellPending('Not part of a company yet',`You’re signed in as ${PER.email}, but this account hasn’t been added to a company. Ask your company’s workbench admin to invite this email address, then choose Check again. You can still work offline.`);
    else if(PER.company&&PER.company.status==='suspended') authShellPending('Workbench paused',`${PER.company.name}’s workbench is suspended at the moment. Contact the workbench owner. You can still work offline.`);
    else authShellPending('Waiting for approval',`You’re signed in as ${PER.email}. An admin at ${PER.company?PER.company.name:'your company'} needs to approve your account before you can see its projects. You can still work offline.`);
    return; }
  authDone('supa');
}
function authShellPending(title,body){
  authShell(`<h1 id="authT">Almost there</h1><div class="auth-id" id="authId"></div>
    <button class="btn primary auth-go" id="authRe">Check again</button><button class="btn auth-go" id="authOut">Sign out</button>${OFFLINE_HTML}`);
  authMsg(title,body);
  document.getElementById('authRe').onclick=async()=>{ const s=(await PER.sb.auth.getSession()).data.session; if(s) supaAfter(s); else supaAuthStart(); };
  document.getElementById('authOut').onclick=async()=>{ await PER.sb.auth.signOut(); supaAuthStart(); };
}
function authDone(mode){
  const keep=document.getElementById('authKeep'); try{ if(mode==='supa') localStorage.removeItem('pacer.auth'); else if(!keep||keep.checked) localStorage.setItem('pacer.auth',mode); else localStorage.removeItem('pacer.auth'); }catch(_){}
  PER.mode=mode;
  if(mode==='local'){ PER.store=docStore(localDocStore()); PER.space='team'; PER.role='This browser'; PER.canWrite=true; PER.readOnly=false; PER.isOwner=true; }
  else if(mode==='supa'){ const r=PER.srole; PER.store=supaStore(PER.sb); PER.isOwner=false; PER.canEdit=r==='admin'; PER.canWrite=r==='admin'||r==='contributor'; PER.role={admin:'Admin',contributor:'Contributor',viewer:'Viewer'}[r]||r; }
  else { PER.store=docStore(PER.db); PER.readOnly=PER.canWrite===false; }
  try{ const sp=localStorage.getItem('pacer.space'); if(mode!=='local'&&(sp==='private'||sp==='team')) PER.space=sp; }catch(_){}
  const au=document.getElementById('auth'); if(au){ au.classList.add('out'); setTimeout(()=>au.remove(),260); }
  renderUserChip(); perSubscribe(); setTab('port'); qLoad();
}
function perReset(){ if(PER.unP) PER.unP(); if(PER.unR) PER.unR(); if(PER.unG) PER.unG(); PER.unP=PER.unR=PER.unG=null; PER.projects=[]; PER.programmes=[]; PER.periods=[]; PER.pid=null; PER.mode=null; PER.store=null; PER.loaded=null; PER.company=null; PER.site={}; PER.platform=false; try{ brandApply(); siteApply(); }catch(_){} const m=document.getElementById('userMenu'); if(m) m.hidden=true; renderUserChip(); perRenderAll(); }
async function signOut(){
  try{ localStorage.removeItem('pacer.auth'); }catch(_){}
  const wasSupa=PER.mode==='supa'; perReset();
  if(wasSupa&&PER.sb){ try{ await PER.sb.auth.signOut(); }catch(_){} }
  authStart();
}
function userName(){ return PER.mode==='cloud'?(PER.me&&PER.me.name)||'You':PER.mode==='supa'?(PER.prof&&(PER.prof.name||PER.prof.email))||PER.email||'You':'Offline'; }
function userAv(lg){ const c=lg?'av lg':'av'; return PER.mode==='cloud'?avatar(PER.me.avatarUrl,c):PER.mode==='supa'?initials(userName(),c):`<span class="${c} off" aria-hidden="true">⌂</span>`; }
function renderUserChip(){
  const el=document.getElementById('userChip'); if(!el) return; renderAdminTab();
  if(!PER.mode){ el.hidden=true; return; } el.hidden=false;
  const nm=userName(), shared=PER.mode!=='local';
  el.innerHTML=userAv()+`<span class="uc-t"><b></b><em>${esc(PER.role)}${PER.mode==='supa'&&PER.company?' · '+esc(PER.company.name):''}</em></span><span class="ucb" id="ucBadge" hidden></span><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  el.querySelector('b').textContent=nm;
  const m=document.getElementById('userMenu');
  m.innerHTML=`<div class="um-h">${userAv(true)}<div><b></b><span class="muted">${PER.mode==='local'?'Offline · this browser only':esc(PER.role)+(PER.mode==='cloud'?' · Claude account':PER.email?' · '+esc(PER.email):'')}</span></div></div>
    ${shared?`<div class="um-s"><div class="sl">Workspace</div><div class="sg" role="group" aria-label="Workspace"><button data-space="team" class="${PER.space==='team'?'on':''}">Team</button><button data-space="private" class="${PER.space==='private'?'on':''}">Private</button></div>
    <p class="muted">${PER.space==='team'?(PER.mode==='supa'&&PER.company?`Projects everyone at ${esc(PER.company.name)} can see.`:'Projects everyone with access to this workbench can see.'):'Projects only you can see.'}</p></div>`:''}
    <div class="um-s"><div class="sl">Your access</div><p class="muted">${esc(roleBlurb())}</p></div>
    ${PER.mode==='supa'&&PER.platform?`<div class="um-s"><div class="sl">Company</div><select id="umCo" class="um-co" aria-label="Switch company">${(PER.companies||[]).map(c=>`<option value="${esc(c.id)}"${c.id===PER.companyId?' selected':''}>${esc(c.name)}${c.status==='suspended'?' (suspended)':''}</option>`).join('')}${PER.companyId?'':'<option selected value="">Choose a company</option>'}</select><p class="muted">As workbench owner you can work in any company.</p></div>`:''}
    ${PER.mode==='supa'&&PER.srole==='admin'&&PER.companyId?`<button class="um-b" data-um="users">${esc(PER.company?PER.company.name:'Company')} admin <span class="ucb" id="umBadge" hidden></span></button>`:''}
    ${PER.mode==='supa'&&PER.platform?'<button class="um-b" data-um="owner">Workbench admin (owner)</button>':''}
    <button class="um-b" data-um="periods">Portfolio</button><button class="um-b" data-um="out">Sign out</button>`;
  m.querySelector('b').textContent=nm;
  if(PER.mode==='supa'&&PER.srole==='admin'&&PER.companyId) PER.sb.from('profiles').select('id',{count:'exact',head:true}).eq('company_id',PER.companyId).eq('role','pending').then(({count})=>{ ['ucBadge','umBadge'].forEach(i=>{ const b=document.getElementById(i); if(b){ b.hidden=!count; b.textContent=count||''; b.title=count?count+' waiting for approval':''; } }); });
}
function roleBlurb(){
  if(PER.mode==='local') return supaOn()?'Everything you save stays in this browser. Sign in to share with your team.':'Everything you save stays in this browser. Sign in with Claude to share with your team.';
  if(PER.mode==='supa'&&PER.platform) return `Workbench owner: you can create companies, move people between them and work in any company as its admin. You’re in ${PER.company?PER.company.name:'no company'} now.`;
  if(PER.mode==='supa') return PER.srole==='admin'?'Admin: you can save periods, manage every project and approve users.':PER.srole==='contributor'?'Contributor: you can create team projects, save periods and delete what you saved.':'Viewer: you can open and compare team periods. You can save to your Private workspace.';
  return PER.isOwner?'You own this workbench: you can save, rename and delete any project or period.':PER.canEdit?'Editor: you can save periods and manage every project.':perRO()?'Viewer: you can open and compare saved periods but not save new ones.':'Contributor: you can create projects, save periods and delete what you saved.'; }
