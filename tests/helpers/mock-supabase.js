(()=>{
const DB={profiles:[],projects:[],periods:[],xer_files:[],programmes:[],quality_settings:[],companies:[],invitations:[],company_settings:[],audit_log:[]}, BLOB={}; window.__DB=DB; window.__BLOB=BLOB;
let session=null; const subs=[]; window.__mock={setUser(u,role){ session={access_token:'tok',user:{id:u.id,email:u.email}}; if(!DB.profiles.find(p=>p.id===u.id)) DB.profiles.push({id:u.id,email:u.email,name:u.name,role,created_at:new Date().toISOString(),company_id:u.company_id||(DB.companies.some(c=>c.id==='co-default')?'co-default':(DB.companies.push({id:'co-default',name:'Default Co',status:'active'}),'co-default')),is_owner:!!u.is_owner,active_company_id:null}); }, DB};
const uuid=()=>crypto.randomUUID();
class Q{ constructor(t){ this.t=t; this.f=[]; this.op='select'; this.one=null; this.cnt=false; }
  select(c,o){ if(this.op==='select') this.op='select'; this.sel=true; if(o&&o.count) this.cnt=true; if(o&&o.head) this.head=true; return this; }
  eq(k,v){ this.f.push(r=>r[k]===v); return this; } is(k,v){ this.f.push(r=>(r[k]??null)===v); return this; } like(k,v){ const re=new RegExp('^'+v.replace(/[.]/g,'\\.').replace(/%/g,'.*')+'$'); this.f.push(r=>re.test(r[k])); return this; } limit(){ return this; } in(k,v){ this.f.push(r=>v.includes(r[k])); return this; } order(){ return this; }
  insert(r){ this.op='insert'; this.rows=[].concat(r); return this; } update(r){ this.op='update'; this.patch=r; return this; } upsert(r){ this.op='upsert'; this.rows=[].concat(r); return this; } delete(){ this.op='delete'; return this; }
  single(){ this.one='single'; return this; } maybeSingle(){ this.one='maybe'; return this; }
  then(res,rej){ try{ res(this.exec()); }catch(e){ rej(e); } }
  exec(){ const T=DB[this.t]||(DB[this.t]=[]), uid=session&&session.user.id, me=DB.profiles.find(p=>p.id===uid), role=me?me.role:'pending'; let out;
    if(this.op==='insert'){ out=this.rows.map(r=>{ const n={...r}; if(this.t==='projects'||this.t==='programmes'){ if(n.space==='team'&&!['contributor','admin'].includes(role)) return null; Object.assign(n,{id:uuid(),owner:uid,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}); if(this.t==='projects') n.status=n.status||'active'; }
        if(this.t==='periods') Object.assign(n,{id:uuid(),saved_by:uid,saved_at:new Date().toISOString()}); if(!n) return null; if(!n.id&&!['xer_files','company_settings','quality_settings'].includes(this.t)) n.id=uuid(); if(!n.created_at) n.created_at=new Date().toISOString(); if(this.t==='invitations'){ n.email=n.email.toLowerCase(); const pr=DB.profiles.find(x=>x.email===n.email&&!x.company_id&&!x.is_owner); if(pr){ pr.company_id=n.company_id; pr.role=n.role; n.accepted_at=new Date().toISOString(); } } if(this.t==='companies') n.status=n.status||'active'; T.push(n); return n; }).filter(Boolean); if(!out.length) return {data:null,error:{code:'42501',message:'new row violates row-level security policy'}}; fire(this.t); if(this.t==='periods') out.forEach(r=>summ(r.project_id)); }
    else if(this.op==='upsert'){ out=this.rows.map(r=>{ const i=this.t==='company_settings'?T.findIndex(x=>x.company_id===r.company_id):T.findIndex(x=>x.project_id===r.project_id&&x.hash===r.hash); if(i>=0) T[i]={...T[i],...r}; else T.push({...r,created_by:uid}); return r; }); }
    else if(this.op==='update'){ out=T.filter(r=>this.f.every(f=>f(r))); out.forEach(r=>Object.assign(r,this.patch)); fire(this.t); }
    else if(this.op==='delete'){ out=T.filter(r=>this.f.every(f=>f(r))); out.forEach(r=>T.splice(T.indexOf(r),1)); if(this.t==='periods') out.forEach(r=>summ(r.project_id)); if(this.t==='programmes'){ out.forEach(g=>DB.projects.forEach(p=>{ if(p.programme_id===g.id) p.programme_id=null; })); fire('projects'); } if(this.t==='projects'){ out.forEach(p=>{ DB.periods=DB.periods.filter(x=>x.project_id!==p.id); DB.xer_files=DB.xer_files.filter(x=>x.project_id!==p.id); }); } fire(this.t); }
    else { out=T.filter(r=>this.f.every(f=>f(r))); if(this.t==='periods') out=out.filter(r=>DB.projects.some(p=>p.id===r.project_id)); }
    if(this.cnt) return {data:null,count:out.length,error:null};
    if(this.one) return {data:out[0]||null,error:this.one==='single'&&!out[0]?{message:'no rows'}:null};
    return {data:JSON.parse(JSON.stringify(out)),error:null}; } }
function summ(pid){ const L=DB.periods.filter(r=>r.project_id===pid).map(r=>({id:r.id,label:r.label,dd:r.dd,stats:r.stats,savedAt:Date.parse(r.saved_at)})); const p=DB.projects.find(x=>x.id===pid); if(p){ p.summary=window.perSummary(L); fire('projects'); } }
function fire(t){ setTimeout(()=>subs.filter(s=>s.t===t).forEach(s=>s.cb({})),10); }
const client={ auth:{ getSession:async()=>({data:{session}}), onAuthStateChange(cb){ this._cb=cb; return {data:{subscription:{unsubscribe(){}}}}; },
    signInWithOtp:async({email})=>{ window.__otp=email; return {error:null}; }, signInWithOAuth:async()=>({error:null}), signOut:async()=>{ session=null; client.auth._cb&&client.auth._cb('SIGNED_OUT',null); return {error:null}; } },
  from:t=>new Q(t),
  functions:{ invoke:async(n,o)=>{ (window.__fn=window.__fn||[]).push([n,o.body]); return {data:{sent:'invite'},error:null}; } },
  rpc:async(n,a)=>{ const uid=session&&session.user.id, me=DB.profiles.find(p=>p.id===uid);
    if(n==='set_active_company'){ me.active_company_id=a.cid; return {data:null,error:null}; }
    if(n==='owner_companies') return {data:DB.companies.map(c=>({...c,users:DB.profiles.filter(p=>p.company_id===c.id).length,admins:DB.profiles.filter(p=>p.company_id===c.id&&p.role==='admin').length,pending:DB.profiles.filter(p=>p.company_id===c.id&&p.role==='pending').length,programmes:DB.programmes.filter(x=>x.company_id===c.id).length,projects:DB.projects.filter(x=>x.company_id===c.id).length,periods:0,invites:DB.invitations.filter(i=>i.company_id===c.id&&!i.accepted_at).length})),error:null};
    if(n==='company_remove_user'){ const t=DB.profiles.find(p=>p.id===a.uid); t.company_id=null; t.role='pending'; return {data:null,error:null}; }
    if(n==='owner_assign_user'){ const t=DB.profiles.find(p=>p.id===a.uid); t.company_id=a.cid; t.role=a.cid?a.r:'pending'; return {data:null,error:null}; }
    return {data:null,error:{message:'unknown rpc '+n}}; },
  storage:{ from:b=>({ upload:async(p,blob)=>{ BLOB[p]=blob; return {data:{path:p},error:null}; }, download:async p=>BLOB[p]?{data:BLOB[p],error:null}:{data:null,error:{message:'not found'}}, remove:async ps=>{ ps.forEach(p=>delete BLOB[p]); return {error:null}; } }) },
  channel(n){ const s={t:null,cb:null}; const ch={ on(ev,f,cb){ s.t=f.table; s.cb=cb; subs.push(s); return ch; }, subscribe(){ return ch; } }; return ch; }, removeChannel(){} };
window.supabase={createClient:()=>client};
})();
