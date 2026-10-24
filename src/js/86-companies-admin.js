/* ================= Companies: workbench owner, company instances and company admins (hosted mode) ================= */
const CO={tab:'people',otab:'companies',edit:null};
const CO_ROLES=[['pending','Pending'],['viewer','Viewer'],['contributor','Contributor'],['admin','Admin']];
async function coLoad(prof){
  const sb=PER.sb; PER.platform=!!prof.is_owner; PER.companyId=PER.platform?(prof.active_company_id||prof.company_id||null):(prof.company_id||null); PER.company=null; PER.companies=[];
  if(PER.companyId){ try{ const r=await sb.from('companies').select('*').eq('id',PER.companyId).maybeSingle(); PER.company=r.data||null; }catch(_){} }
  if(PER.platform){ try{ const r=await sb.from('companies').select('id,name,status').order('name'); PER.companies=r.data||[]; }catch(_){} }
  PER.site={}; if(PER.companyId){ try{ const r=await sb.from('company_settings').select('site').eq('company_id',PER.companyId).maybeSingle(); PER.site=(r.data&&r.data.site)||{}; }catch(_){} }
  PER.coCounts=null; if(PER.companyId&&(PER.platform||prof.role==='admin')){ try{ const [a,b]=await Promise.all([sb.from('profiles').select('id',{count:'exact',head:true}).eq('company_id',PER.companyId),sb.from('invitations').select('id',{count:'exact',head:true}).eq('company_id',PER.companyId).is('accepted_at',null)]); PER.coCounts={people:a.count||0,invites:b.count||0}; }catch(_){} }
  ADM.cache={}; brandApply(); siteApply();
}
function coModal(id,cls){ let d=document.getElementById(id); if(d) d.remove(); d=document.createElement('div'); d.className='modal'; d.id=id; d.innerHTML=`<div class="mcard ${cls}" role="dialog" aria-modal="true"></div>`; document.body.appendChild(d);
  d.addEventListener('click',e=>{ if(e.target===d||e.target.closest('[data-cox]')) d.remove(); }); d.addEventListener('keydown',e=>{ if(e.key==='Escape') d.remove(); }); return d; }
const coWho=u=>`<b>${esc(u.name||u.email||'—')}</b>${u.name&&u.email?`<div class="muted">${esc(u.email)}</div>`:''}`;
// Switch the owner into another company's instance.
async function coSwitch(cid){
  if(!PER.platform||cid===PER.companyId) return;
  perBusy('Switching company…');
  try{ const {error}=await PER.sb.rpc('set_active_company',{cid}); if(error) throw error;
    if(PER.loaded){ S.files=[]; PER.loaded=null; try{ rebuild(true); }catch(_){} }
    const s=(await PER.sb.auth.getSession()).data.session; perReset(); if(s) await supaAfter(s);
    perToast(`You’re now working in ${PER.company?PER.company.name:'that company'}.`); }
  catch(e){ perToast(perErr(e),'err'); } finally{ perBusy(''); }
}
/* ---- Admin pages: the workbench owner's page and each company's admin page ---- */
const ADM={sec:null,tok:0,open:null,cache:{}};
function confirmIn(b,label){ if(b.dataset.armed){ return true; } b.dataset.armed='1'; const t=b.textContent; b.textContent=label; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.armed; b.textContent=t; } },3000); return false; }
function admAllowed(){ return typeof PER!=='undefined'&&PER.mode==='supa'&&(PER.platform||PER.srole==='admin'); }
function admSections(){ const co=PER.company?PER.company.name:'Company', L=[];
  if(PER.platform) L.push({g:'Workbench (owner)',items:[['wb-overview','Overview'],['wb-companies','Companies'],['wb-admins','Company admins'],['wb-people','All people'],['wb-owners','Owners'],['wb-log','Activity log']]});
  if(PER.companyId) L.push({g:co,items:[['co-overview','Overview'],['co-people','People'],['co-invites','Invitations'],['co-access','Sign-in & access'],['co-brand','Branding'],['co-features','Features'],['co-quality','Quality checks'],['co-risk','Risk registers'],['co-log','Activity log']]});
  return L; }
function admGo(sec){ ADM.sec=sec; if(S.tab!=='admin') setTab('admin'); else renderAdmin(); }
function renderAdminTab(){ /* Admin lives in the account menu now */ }
async function renderAdmin(){
  const el=document.getElementById('adminWrap'); if(!el||el.hidden) return;
  if(!admAllowed()){ el.innerHTML='<div class="card pempty big"><h3>Admin</h3><p class="muted">Only company admins and the workbench owner can open this page.</p></div>'; return; }
  const secs=admSections(), all=secs.flatMap(g=>g.items.map(i=>i[0])); if(!all.includes(ADM.sec)) ADM.sec=all[0];
  const nav=`<nav class="card adm-nav" aria-label="Admin sections">${secs.map(g=>`<div class="adm-g">${esc(g.g)}</div>${g.items.map(([k,l])=>`<button class="adm-i${ADM.sec===k?' on':''}" data-adm="${k}" aria-current="${ADM.sec===k?'page':'false'}">${esc(l)}</button>`).join('')}`).join('')}
    ${PER.platform?`<div class="adm-g">Working in</div><select class="adm-co" id="admCo" aria-label="Company to work in">${(PER.companies||[]).map(c=>`<option value="${esc(c.id)}"${c.id===PER.companyId?' selected':''}>${esc(c.name)}</option>`).join('')}${PER.companyId?'':'<option selected value="">Choose a company</option>'}</select>`:''}</nav>`;
  if(!el.querySelector('.adm-body')) el.innerHTML=`<div class="adm">${nav}<section class="card adm-body" id="admBody"></section></div>`;
  else el.querySelector('.adm-nav').outerHTML=nav;
  if(!el._wired){ el._wired=true; admWire(el); }
  ADM.shown=ADM.sec; const body=document.getElementById('admBody'), tok=++ADM.tok; body.innerHTML='<p class="muted">Loading…</p>';
  try{ const html=await ADM_R[ADM.sec](); if(tok===ADM.tok) body.innerHTML=html; }catch(e){ if(tok===ADM.tok) body.innerHTML=`<p class="late">${esc(perErr(e))}</p>`; }
}
const admH=(t,sub)=>`<div class="adm-h"><h2>${esc(t)}</h2>${sub?`<p class="muted">${sub}</p>`:''}</div>`;
const admStat=(l,v,s,cls)=>`<div class="stat"><div class="sl">${esc(l)}</div><div class="sv${cls?' '+cls:''}">${v}</div>${s?`<div class="ss">${s}</div>`:''}</div>`;
const admOk=r=>{ if(r.error) throw r.error; return r.data; };
const admCount=async q=>{ const r=await q; if(r.error) throw r.error; return r.count||0; };
const ADM_R={
  async 'co-risk'(){ await rkLoadCfg(); RK.ce=rkClone(rkCfg()); return admH('Risk registers','How the portfolio, programme and project risk registers line up, the columns each one shows, the scoring matrix and when to escalate. These settings apply to everyone in this company.')+rkCfgHtml('admin'); },
  async 'wb-overview'(){ const cos=admOk(await PER.sb.rpc('owner_companies')), ppl=admOk(await PER.sb.from('profiles').select('id,company_id,role,is_owner'));
    const sum=k=>cos.reduce((n,c)=>n+(+c[k]||0),0), none=ppl.filter(u=>!u.company_id&&!u.is_owner).length, susp=cos.filter(c=>c.status!=='active').length, noAdmin=cos.filter(c=>!+c.admins&&c.status==='active');
    return admH('Workbench overview','Everything across every company on this workbench. Only owners see this page.')+
      `<div class="stats adm-stats">${admStat('Companies',cos.length,susp?`${susp} suspended`:'all active')}${admStat('People',ppl.length,`${ppl.filter(u=>u.is_owner).length} owner${ppl.filter(u=>u.is_owner).length===1?'':'s'}`)}${admStat('Not in a company',none,none?'need placing':'everyone placed',none?'amber':'')}${admStat('Waiting for approval',sum('pending'),'across companies',sum('pending')?'amber':'')}${admStat('Projects',sum('projects'),`${sum('programmes')} programmes`)}${admStat('Schedule updates',sum('periods'),'saved periods')}</div>
      ${noAdmin.length?`<p class="pwarn">${noAdmin.length===1?'This company has':'These companies have'} no admin yet: ${noAdmin.map(c=>`<b>${esc(c.name)}</b>`).join(', ')}. Invite one from Companies or Company admins.</p>`:''}
      <div class="adm-acts"><button class="btn primary" data-adm="wb-companies">Manage companies</button><button class="btn" data-adm="wb-admins">Company admins</button>${none?`<button class="btn" data-adm="wb-people">Place ${none} ${none===1?'person':'people'}</button>`:''}</div>`; },
  async 'wb-companies'(){ const cos=admOk(await PER.sb.rpc('owner_companies')); PER.companies=cos.map(c=>({id:c.id,name:c.name,status:c.status}));
    return admH('Companies','Each company is a separate instance: its people only see its own programmes, projects, updates and settings.')+
      `<form class="co-inv" data-admform="newco"><label class="pfl"><span>New company</span><input name="name" maxlength="120" required placeholder="Company name"></label><label class="pfl"><span>Its first admin (email, optional)</span><input type="email" name="admin" placeholder="admin@company.com"></label><button class="btn primary">Create company</button></form>
      <div class="ptw"><table class="ptab co-t"><thead><tr><th>Company</th><th>Status</th><th class="num">People</th><th class="num">Admins</th><th class="num">Waiting</th><th class="num">Invites</th><th class="num">Projects</th><th class="num">Updates</th><th></th></tr></thead><tbody>
      ${cos.map(c=>`<tr class="${c.id===PER.companyId?'co-cur':''}"><td><b>${esc(c.name)}</b>${c.id===PER.companyId?'<span class="pill">Working here</span>':''}${c.auto_approve_domain?`<div class="muted">Auto-joins @${esc(c.auto_approve_domain)}</div>`:''}${c.notes?`<div class="muted">${esc(c.notes)}</div>`:''}</td>
        <td><span class="st ${c.status==='active'?'pass':'fail'}">${c.status==='active'?'Active':'Suspended'}</span></td><td class="num">${c.users}</td><td class="num${+c.admins?'':' amber'}">${c.admins}</td><td class="num${+c.pending?' amber':''}">${c.pending}</td><td class="num">${c.invites}</td><td class="num">${c.projects}</td><td class="num">${c.periods}</td>
        <td class="co-act">${c.id!==PER.companyId?`<button class="btn sm" data-coopen="${esc(c.id)}">Work in it</button>`:`<button class="btn sm" data-adm="co-overview">Its admin page</button>`}<button class="link" data-coedit="${esc(c.id)}">Edit</button></td></tr>
        ${ADM.open===c.id?`<tr class="adm-x"><td colspan="9"><form class="co-set" data-admform="editco" data-id="${esc(c.id)}"><label class="pfl"><span>Name</span><input name="name" maxlength="120" value="${esc(c.name)}" required></label><label class="pfl"><span>Status</span><select name="status"><option value="active"${c.status==='active'?' selected':''}>Active</option><option value="suspended"${c.status!=='active'?' selected':''}>Suspended: its people can’t reach its data</option></select></label><label class="pfl"><span>Owner notes (only owners see these)</span><input name="notes" maxlength="300" value="${esc(c.notes||'')}"></label>
          <div class="adm-acts"><button class="btn primary">Save</button><button type="button" class="btn ghost" data-coedit="">Close</button>${!+c.users&&!+c.projects&&!+c.programmes?`<button type="button" class="link danger" data-codel="${esc(c.id)}">Delete company</button>`:''}</div></form></td></tr>`:''}`).join('')||'<tr><td colspan="9" class="muted">No companies yet.</td></tr>'}</tbody></table></div>`; },
  async 'wb-admins'(){ const cos=admOk(await PER.sb.rpc('owner_companies')), ppl=admOk(await PER.sb.from('profiles').select('*').eq('role','admin').order('created_at')), inv=admOk(await PER.sb.from('invitations').select('*').eq('role','admin').is('accepted_at',null));
    return admH('Company admins','The people who run each company’s workbench: they approve people, invite colleagues and configure their company’s site.')+
      `<form class="co-inv" data-admform="invadmin"><label class="pfl"><span>Company</span><select name="cid">${cos.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label class="pfl"><span>Admin’s email</span><input type="email" name="email" required placeholder="admin@company.com"></label><button class="btn primary">Make admin</button></form>
      <p class="muted">They’re emailed a sign-in link. If they’ve already signed in without a company they become its admin straight away; otherwise when they first sign in with this email. To promote someone already in a company, change their access under All people.</p>
      ${cos.map(c=>{ const A=ppl.filter(u=>u.company_id===c.id), I=inv.filter(i=>i.company_id===c.id);
        return `<div class="adm-co-blk"><div class="adm-co-h"><b>${esc(c.name)}</b>${c.status!=='active'?'<span class="st fail">Suspended</span>':''}${!A.length&&!I.length?'<span class="st warn">No admin</span>':''}</div>
          ${A.map(u=>`<div class="adm-row">${coWho(u)}<span class="sp"></span>${u.is_owner?'<span class="pill">Workbench owner</span>':`<button class="link" data-admdemote="${esc(u.id)}">Make contributor</button>`}</div>`).join('')}${I.map(i=>`<div class="adm-row"><span>${esc(i.email)} <span class="muted">· invited ${fmtD(Date.parse(i.created_at))}, not signed in yet</span></span><span class="sp"></span><button class="link danger" data-coinvdel="${esc(i.id)}">Cancel</button></div>`).join('')}${!A.length&&!I.length?'<div class="muted adm-row">No admin yet.</div>':''}</div>`; }).join('')}`; },
  async 'wb-people'(){ const cos=admOk(await PER.sb.rpc('owner_companies')), people=admOk(await PER.sb.from('profiles').select('*').order('created_at')), none=people.filter(u=>!u.company_id&&!u.is_owner);
    return admH('All people',`Everyone who has signed in. Move people between companies and set their access${none.length?`. <b class="amber">${none.length} not in a company yet.</b>`:'.'}`)+
      `<div class="ptw"><table class="ptab co-t"><thead><tr><th>Person</th><th>Joined</th><th>Company</th><th>Access</th></tr></thead><tbody>${people.map(u=>`<tr><td>${coWho(u)}</td><td class="num">${fmtD(Date.parse(u.created_at))}</td>
        <td>${u.is_owner?'<span class="pill">Workbench owner</span>':`<select data-coco="${esc(u.id)}"><option value="">No company</option>${cos.map(c=>`<option value="${esc(c.id)}"${u.company_id===c.id?' selected':''}>${esc(c.name)}</option>`).join('')}</select>`}</td>
        <td>${u.is_owner?'<span class="muted">Admin everywhere</span>':`<select data-cor="${esc(u.id)}" ${u.company_id?'':'disabled'}>${CO_ROLES.map(([v,l])=>`<option value="${v}"${u.role===v?' selected':''}>${l}</option>`).join('')}</select>`}</td></tr>`).join('')}</tbody></table></div>`; },
  async 'wb-owners'(){ const people=admOk(await PER.sb.from('profiles').select('*').order('created_at')), O=people.filter(u=>u.is_owner), others=people.filter(u=>!u.is_owner);
    return admH('Owners','Owners run the whole workbench: they create companies, move people and can work in any company as its admin. Keep this list short.')+
      `<div class="adm-co-blk">${O.map(u=>`<div class="adm-row">${coWho(u)}<span class="sp"></span>${u.id===PER.uid?'<span class="muted">You</span>':`<button class="link danger" data-admowner="${esc(u.id)}" data-v="0">Remove owner</button>`}</div>`).join('')}</div>
      ${others.length?`<form class="co-inv" data-admform="addowner"><label class="pfl"><span>Make someone an owner</span><select name="uid">${others.map(u=>`<option value="${esc(u.id)}">${esc(u.name||u.email)}${u.name?' · '+esc(u.email):''}</option>`).join('')}</select></label><button class="btn">Make owner</button></form><p class="muted">They must have signed in at least once.</p>`:''}`; },
  async 'co-overview'(){ const cid=PER.companyId, c=PER.company||{};
    const [P,inv,proj,prog]=await Promise.all([PER.sb.from('profiles').select('id,role').eq('company_id',cid),PER.sb.from('invitations').select('id').eq('company_id',cid).is('accepted_at',null),admCount(PER.sb.from('projects').select('id',{count:'exact',head:true}).eq('space','team')),admCount(PER.sb.from('programmes').select('id',{count:'exact',head:true}).eq('space','team'))]);
    const ppl=admOk(P), pend=ppl.filter(u=>u.role==='pending').length, admins=ppl.filter(u=>u.role==='admin').length;
    return admH(`${c.name||'Company'} admin`,'Configure your company’s workbench: who can get in, what they can do, and how it looks.')+
      `<div class="stats adm-stats">${admStat('People',ppl.length,`${admins} admin${admins===1?'':'s'}`)}${admStat('Waiting for approval',pend,pend?'approve under People':'none waiting',pend?'amber':'')}${admStat('Open invitations',admOk(inv).length,'not signed in yet')}${admStat('Programmes',prog,'team workspace')}${admStat('Projects',proj,'team workspace')}${admStat('Status',c.status==='suspended'?'Suspended':'Active',c.auto_approve_domain?`auto-joins @${esc(c.auto_approve_domain)}`:'invitation only',c.status==='suspended'?'late':'')}</div>
      ${(PER.coCounts={people:ppl.length,invites:admOk(inv).length},setupCard(true))}
      <div class="adm-acts"><button class="btn primary" data-adm="co-people">${pend?`Approve ${pend} ${pend===1?'person':'people'}`:'Manage people'}</button><button class="btn" data-adm="co-invites">Invite someone</button><button class="btn" data-adm="co-brand">Branding</button><button class="btn" data-adm="co-quality">Quality checks</button></div>`; },
  async 'co-people'(){ const people=admOk(await PER.sb.from('profiles').select('*').eq('company_id',PER.companyId).order('created_at')), pend=people.filter(u=>u.role==='pending').length;
    return admH('People',`${pend?`<b class="amber">${pend} waiting for approval.</b> `:''}Viewers open and compare projects; contributors also create projects and save updates; admins also manage this page.`)+
      `<div class="ptw"><table class="ptab co-t"><thead><tr><th>Person</th><th>Joined</th><th>Access</th><th></th></tr></thead><tbody>${people.map(u=>`<tr class="${u.role==='pending'?'adm-pend':''}"><td>${coWho(u)}${u.is_owner?'<span class="pill">Workbench owner</span>':''}</td><td class="num">${fmtD(Date.parse(u.created_at))}</td>
        <td><select data-corole="${esc(u.id)}" ${u.id===PER.uid||u.is_owner?'disabled':''}>${CO_ROLES.map(([v,l])=>`<option value="${v}"${u.role===v?' selected':''}>${l}</option>`).join('')}</select></td>
        <td>${u.id===PER.uid||u.is_owner?'':`<button class="link danger" data-corm="${esc(u.id)}">Remove</button>`}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">No one yet.</td></tr>'}</tbody></table></div>`; },
  async 'co-invites'(){ const inv=admOk(await PER.sb.from('invitations').select('*').eq('company_id',PER.companyId).order('created_at')), open=inv.filter(i=>!i.accepted_at), done=inv.filter(i=>i.accepted_at).slice(-10).reverse();
    return admH('Invitations',`Invited people get an email with a sign-in link and join ${esc(PER.company?PER.company.name:'the company')} with that access. They can also sign in with Microsoft using the same address.`)+
      `<form class="co-inv" data-admform="invite"><label class="pfl"><span>Email</span><input type="email" name="email" required placeholder="name@company.com"></label><label class="pfl"><span>Access</span><select name="role">${CO_ROLES.slice(1).map(([v,l])=>`<option value="${v}"${v==='viewer'?' selected':''}>${l}</option>`).join('')}</select></label><button class="btn primary">Invite</button></form>
      <div class="ptw"><table class="ptab co-t"><thead><tr><th>Email</th><th>Access</th><th>Invited</th><th></th></tr></thead><tbody>${open.map(i=>`<tr><td>${esc(i.email)}</td><td>${esc((CO_ROLES.find(r=>r[0]===i.role)||[0,i.role])[1])}</td><td class="num">${fmtD(Date.parse(i.created_at))}</td><td class="co-act"><button class="link" data-coinvsend="${esc(i.email)}">Resend email</button><button class="link danger" data-coinvdel="${esc(i.id)}">Cancel</button></td></tr>`).join('')||'<tr><td colspan="4" class="muted">No open invitations.</td></tr>'}</tbody></table></div>
      ${done.length?`<div class="sl" style="margin-top:6px">Recently accepted</div><div class="muted">${done.map(i=>esc(i.email)+' · '+fmtD(Date.parse(i.accepted_at))).join(' &nbsp;·&nbsp; ')}</div>`:''}`; },
  async 'co-access'(){ const c=PER.company||{};
    return admH('Sign-in & access','Decide who can get into your company’s workbench without an invitation.')+
      `<form class="co-set" data-admform="access"><label class="pfl"><span>Company name</span><input name="name" maxlength="120" value="${esc(c.name||'')}" required></label>
      <label class="pfl"><span>Let everyone from this email domain join (optional)</span><input name="domain" placeholder="e.g. acme.com" value="${esc(c.auto_approve_domain||'')}"></label>
      <label class="pfl"><span>…with this access</span><select name="role">${CO_ROLES.slice(1,3).map(([v,l])=>`<option value="${v}"${(c.auto_approve_role||'viewer')===v?' selected':''}>${l}</option>`).join('')}</select></label>
      <div class="adm-acts"><button class="btn primary">Save</button></div></form>
      <p class="muted">With a domain set, anyone who signs in with an address on it joins automatically with the access above. Leave it blank to admit people by invitation only. Sign-in methods (Microsoft and email links) are set for the whole workbench.</p>`; },
  async 'co-brand'(){ const b=(PER.company&&PER.company.branding)||{};
    return admH('Branding','How the workbench looks for everyone in your company.')+
      `<form class="co-set" data-admform="brand"><label class="pfl"><span>Title in the top bar</span><input name="title" maxlength="40" placeholder="Schedule Workbench" value="${esc(b.title||'')}"></label>
      <label class="pfl"><span>Accent colour</span><span class="adm-col"><input type="color" name="accent" value="${esc(b.accent||'#FC4C02')}"><button type="button" class="link" data-admresetcol>Use default</button></span></label>
      <div class="pfl"><span>Logo (PNG, JPG or SVG; shown at 30 px high)</span><span class="adm-logo">${b.logo?`<img src="${esc(b.logo)}" alt="Current logo">`:'<span class="muted">Default logo</span>'}<label class="btn sm">Upload<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-admlogo hidden></label>${b.logo?'<button type="button" class="link" data-admnologo>Remove</button>':''}</span></div>
      <div class="adm-acts"><button class="btn primary">Save branding</button></div></form>
      <div class="adm-prev"><div class="sl">Preview</div><div class="adm-pv">${b.logo?`<img src="${esc(b.logo)}" alt="">`:'<span class="adm-pvd"></span>'}<b>${esc(b.title||'Schedule Workbench')}</b><span class="adm-pvb" style="background:${esc(b.accent||'var(--accent)')}">Button</span></div></div>`; },
  async 'co-features'(){ const s=ADM.cache.site||await admSite();
    return admH('Features','Switch parts of the workbench on or off for your company.')+
      `<form class="co-set adm-feat" data-admform="features"><label class="tg"><input type="checkbox" name="ai" ${s.ai!==false?'checked':''}> AI features (Ask AI and AI schedule build)</label>
      <label class="tg"><input type="checkbox" name="build" ${s.build!==false?'checked':''}> Build tab (schedule builder and in-app updates)</label>
      <label class="tg"><input type="checkbox" name="samples" ${s.samples!==false?'checked':''}> Sample portfolio buttons</label>
      <label class="tg"><input type="checkbox" name="setup" ${!s.hideSetup?'checked':''}> Set-up checklist on the Portfolio (for admins)</label>
      <label class="tg"><input type="checkbox" name="reminders" ${s.reminders!==false?'checked':''}> Weekly email to admins and project managers when updates are due</label>
      <label class="pfl" style="max-width:320px"><span>Update cycle: a project is due an update after this many days</span><input type="number" name="cycle" min="7" max="120" value="${+s.cycle||35}"></label>
      <div class="adm-acts"><button class="btn primary">Save features</button></div></form>
      <p class="muted">These change what everyone in your company sees. AI features and reminder emails also need the workbench owner to set up the AI and email services. A project manager gets reminders when the project’s Manager field contains their email address.</p>`; },
  async 'wb-log'(){ return admLog(true); },
  async 'co-log'(){ return admLog(false); },
  async 'co-quality'(){ const c=qCfg(), av=qAvail();
    return admH('Quality checks','Which schedule-check sets your company uses, and the pass and amber limits for each check.')+
      `<div class="stats adm-stats">${admStat('Default set',esc(qFwName(c.def&&av.includes(c.def)?c.def:av[0])),'what people see first')}${admStat('Available sets',av.length,esc(av.map(qFwName).join(', ')))}${admStat('Bespoke set',c.custom&&c.custom.checks&&c.custom.checks.length?c.custom.checks.length+' checks':'not set up',c.custom&&c.custom.name?esc(c.custom.name):'')}</div>
      <div class="adm-acts"><button class="btn primary" data-admq>Configure checks</button></div>`; }
};
// Email the invitation through the invite-email function (Supabase sends it). Falls back to telling the admin to let them know.
async function admEmailInvite(email){ try{ const {data,error}=await PER.sb.functions.invoke('invite-email',{body:{email,redirectTo:supaRedirect()}}); if(error||!data||data.error) throw new Error((data&&data.error)||(error&&error.message)||'no reply'); return data.sent==='magiclink'?' A sign-in link was emailed to them.':' An invitation email was sent.'; }catch(e){ return ` The email couldn’t be sent (${e.message}), so let them know to sign in with that address.`; } }
const AUD_L={'access.changed':'Access changed','person.moved':'Moved company','owner.added':'Owner added','owner.removed':'Owner removed','person.signed_up':'Signed up','person.deleted':'Person deleted','company.created':'Company created','company.deleted':'Company deleted','company.suspended':'Company suspended','company.reactivated':'Company reactivated','company.renamed':'Company renamed','company.signin_changed':'Sign-in settings changed','company.branding_changed':'Branding changed','invite.sent':'Invited','invite.cancelled':'Invitation cancelled','settings.quality_changed':'Quality checks changed','settings.risk_changed':'Risk register settings changed','risk.created':'Risk added','structure.created':'Structure created','structure.changed':'Structure changed','structure.deleted':'Structure deleted','risk.deleted':'Risk deleted','risk.status':'Risk status changed','risk.linked':'Risk linked to parent','settings.features_changed':'Features changed','project.created':'Project created','project.deleted':'Project deleted','programme.created':'Programme created','programme.deleted':'Programme deleted','update.saved':'Update saved','update.deleted':'Update deleted'};
const AUD_G=[['','Everything'],['access','Access and people'],['company','Company settings'],['invite','Invitations'],['settings','Quality and features'],['project','Projects and programmes'],['update','Schedule updates']];
function audDetail(a){ const d=a.detail||{}; switch(a.action){
  case 'access.changed': return `${d.from||'—'} → ${d.to||'—'}`; case 'person.moved': return `${d.from||'no company'} → ${d.to||'no company'}`;
  case 'company.renamed': return `was ${d.from||''}`; case 'company.signin_changed': return d.domain?`@${d.domain} joins as ${d.role}`:'invitation only';
  case 'invite.sent': return `${d.role}${d.joined_now?' · joined straight away':''}`; case 'settings.quality_changed': return d.default?`default ${d.default.toUpperCase()}`:'';
  case 'settings.features_changed': return ['ai','build','samples'].filter(k=>k in d).map(k=>`${({ai:'AI',build:'Build',samples:'Samples'})[k]} ${d[k]===false?'off':'on'}`).join(' · ');
  case 'company.branding_changed': return [d.title?`title “${d.title}”`:'',d.accent||'',d.logo?'logo':''].filter(Boolean).join(' · ');
  case 'person.signed_up': return d.role||''; case 'risk.created': case 'risk.deleted': return d.level||''; case 'risk.status': return `${d.from||''} → ${d.to||''}`; case 'risk.linked': return d.parent?`to ${d.parent}`:''; case 'settings.risk_changed': return d.align||''; case 'structure.created': case 'structure.changed': case 'structure.deleted': return (FWK[d.kind]||{}).l||d.kind||''; case 'update.saved': return d.notes||''; default: return ''; } }
async function admLog(all){ const g=ADM.logG||''; let q=PER.sb.from('audit_log').select('*').order('at',{ascending:false}).limit(300); if(!all) q=q.eq('company_id',PER.companyId); if(g) q=q.like('action',g+'.%');
  const rows=admOk(await q), cos=all?((PER.companies||[]).reduce((m,c)=>(m[c.id]=c.name,m),{})):{};
  return admH('Activity log',all?'Every recorded change across the workbench: access, companies, invitations, settings, projects and schedule updates. Newest first.':'Recorded changes in your company: access, invitations, settings, projects and schedule updates. Newest first.')+
    `<div class="adm-acts"><label class="pfl"><span>Show</span><select data-adlog>${AUD_G.map(([k,l])=>`<option value="${k}"${g===k?' selected':''}>${l}</option>`).join('')}</select></label><span class="muted">${rows.length===300?'Latest 300 entries':rows.length+' entr'+(rows.length===1?'y':'ies')}</span></div>
    <div class="ptw"><table class="ptab co-t"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Item</th><th>Detail</th>${all?'<th>Company</th>':''}</tr></thead><tbody>${rows.map(a=>`<tr><td class="num">${fmtD(Date.parse(a.at))} ${new Date(a.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td><td>${esc(a.actor_email||'System')}</td><td><b>${esc(AUD_L[a.action]||a.action)}</b></td><td>${esc(a.target)}</td><td class="muted">${esc(audDetail(a))}</td>${all?`<td>${esc(cos[a.company_id]||'')}</td>`:''}</tr>`).join('')||`<tr><td colspan="${all?6:5}" class="muted">Nothing recorded yet.</td></tr>`}</tbody></table></div>`; }
async function admSite(){ let s={}; try{ const r=await PER.sb.from('company_settings').select('site').eq('company_id',PER.companyId).maybeSingle(); s=(r.data&&r.data.site)||{}; }catch(_){} ADM.cache.site=s; return s; }
async function admLogo(file){ return new Promise((res,rej)=>{ if(file.size>2e6) return rej(new Error('Choose an image under 2 MB.')); const fr=new FileReader(); fr.onerror=()=>rej(fr.error); fr.onload=()=>{ const url=fr.result; if(file.type==='image/svg+xml'&&url.length<150000) return res(url);
  const img=new Image(); img.onload=()=>{ const h=96, w=Math.max(1,Math.round(img.width*h/img.height)), c=document.createElement('canvas'); c.width=Math.min(w,480); c.height=h; c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/png')); }; img.onerror=()=>rej(new Error('That image could not be read.')); img.src=url; }; fr.readAsDataURL(file); }); }
async function admSaveCompany(f){ const {error}=await PER.sb.from('companies').update(f).eq('id',PER.companyId); if(error) throw error; Object.assign(PER.company||(PER.company={}),f); const k=(PER.companies||[]).find(x=>x.id===PER.companyId); if(k&&f.name) k.name=f.name; renderUserChip(); brandApply(); }
function admWire(el){
  el.addEventListener('click',async e=>{ const b=e.target.closest('button,a'); if(!b) return;
    try{
      if(b.dataset.adm){ ADM.sec=b.dataset.adm; renderAdmin(); return; }
      if(b.dataset.coopen){ ADM.sec='co-overview'; await coSwitch(b.dataset.coopen); setTab('admin'); return; }
      if(b.dataset.coedit!=null){ ADM.open=b.dataset.coedit||null; renderAdmin(); return; }
      if(b.dataset.codel){ if(!confirmIn(b,'Delete?')) return; admOk(await PER.sb.from('companies').delete().eq('id',b.dataset.codel)); ADM.open=null; perToast('Company deleted.'); renderAdmin(); return; }
      if(b.dataset.coinvsend){ b.disabled=true; const m=await admEmailInvite(b.dataset.coinvsend); b.disabled=false; perToast(m.trim(),/couldn/.test(m)?'err':undefined); return; }
      if(b.dataset.coinvdel){ admOk(await PER.sb.from('invitations').delete().eq('id',b.dataset.coinvdel)); perToast('Invitation cancelled.'); renderAdmin(); return; }
      if(b.dataset.corm){ if(!confirmIn(b,'Remove?')) return; admOk(await PER.sb.rpc('company_remove_user',{uid:b.dataset.corm})); perToast('Removed from the company.'); renderAdmin(); return; }
      if(b.dataset.admdemote){ admOk(await PER.sb.rpc('owner_assign_user',{uid:b.dataset.admdemote,cid:(await PER.sb.from('profiles').select('company_id').eq('id',b.dataset.admdemote).single()).data.company_id,r:'contributor'})); perToast('Now a contributor.'); renderAdmin(); return; }
      if(b.dataset.admowner){ if(!confirmIn(b,'Sure?')) return; admOk(await PER.sb.from('profiles').update({is_owner:b.dataset.v==='1'}).eq('id',b.dataset.admowner)); perToast('Owners updated.'); renderAdmin(); return; }
      if(b.hasAttribute('data-admq')){ qOpenConfig(); return; }
      if(b.hasAttribute('data-admresetcol')){ const f=b.closest('form'); f.accent.value='#FC4C02'; f.dataset.noaccent='1'; return; }
      if(b.hasAttribute('data-admnologo')){ const br={...((PER.company&&PER.company.branding)||{})}; delete br.logo; await admSaveCompany({branding:br}); perToast('Logo removed.'); renderAdmin(); return; }
    }catch(ex){ perToast(perErr(ex),'err'); } });
  el.addEventListener('change',async e=>{ const t=e.target;
    try{
      if(t.id==='admCo'&&t.value){ ADM.sec='co-overview'; await coSwitch(t.value); setTab('admin'); return; }
      if(t.hasAttribute('data-admlogo')&&t.files[0]){ const logo=await admLogo(t.files[0]); await admSaveCompany({branding:{...((PER.company&&PER.company.branding)||{}),logo}}); perToast('Logo updated.'); renderAdmin(); return; }
      if(t.dataset.corole){ t.disabled=true; admOk(await PER.sb.from('profiles').update({role:t.value}).eq('id',t.dataset.corole)); perToast('Access updated.'); renderUserChip(); renderAdmin(); return; }
      if(t.dataset.coco||t.dataset.cor){ const tr=t.closest('tr'), uid=t.dataset.coco||t.dataset.cor, co=tr.querySelector('[data-coco]').value||null, r=tr.querySelector('[data-cor]').value; t.disabled=true;
        admOk(await PER.sb.rpc('owner_assign_user',{uid,cid:co,r:co&&r==='pending'&&t.dataset.coco?'viewer':r})); perToast('Updated.'); renderAdmin(); return; }
      if(t.name==='accent'){ delete t.form.dataset.noaccent; }
      if(t.hasAttribute('data-adlog')){ ADM.logG=t.value; renderAdmin(); }
    }catch(ex){ perToast(perErr(ex),'err'); renderAdmin(); } });
  el.addEventListener('submit',async e=>{ const f=e.target, k=f.dataset.admform; if(!k) return; e.preventDefault(); const btn=f.querySelector('button.primary,button:not([type])'); if(btn) btn.disabled=true;
    try{
      if(k==='newco'){ const name=f.name.value.trim(), admin=f.admin.value.trim().toLowerCase(); const d=admOk(await PER.sb.from('companies').insert({name,created_by:PER.uid}).select('id').single());
        let m=''; if(admin){ admOk(await PER.sb.from('invitations').insert({company_id:d.id,email:admin,role:'admin',invited_by:PER.uid})); m=await admEmailInvite(admin); } perToast(`Created ${name}${admin?` and made ${admin} its admin.`+m:'.'}`); }
      else if(k==='editco'){ admOk(await PER.sb.from('companies').update({name:f.name.value.trim(),status:f.status.value,notes:f.notes.value.trim()}).eq('id',f.dataset.id)); ADM.open=null; if(f.dataset.id===PER.companyId) Object.assign(PER.company,{name:f.name.value.trim(),status:f.status.value}); renderUserChip(); perToast('Company saved.'); }
      else if(k==='invadmin'){ const email=f.email.value.trim().toLowerCase(); admOk(await PER.sb.from('invitations').insert({company_id:f.cid.value,email,role:'admin',invited_by:PER.uid})); perToast(`${email} will be admin of ${f.cid.selectedOptions[0].text}.`+await admEmailInvite(email)); }
      else if(k==='addowner'){ admOk(await PER.sb.from('profiles').update({is_owner:true}).eq('id',f.uid.value)); perToast('Owner added.'); }
      else if(k==='invite'){ const email=f.email.value.trim().toLowerCase(); const r=await PER.sb.from('invitations').insert({company_id:PER.companyId,email,role:f.role.value,invited_by:PER.uid}); if(r.error) throw (/duplicate|unique/i.test(r.error.message||'')?new Error('That email already has an open invitation.'):r.error); perToast(`Invited ${email}.`+await admEmailInvite(email)); }
      else if(k==='access'){ await admSaveCompany({name:f.name.value.trim(),auto_approve_domain:f.domain.value.trim().replace(/^@/,'').toLowerCase()||null,auto_approve_role:f.role.value}); perToast('Sign-in settings saved.'); }
      else if(k==='brand'){ const br={...((PER.company&&PER.company.branding)||{})}; const t=f.title.value.trim(); if(t) br.title=t; else delete br.title; if(f.dataset.noaccent) delete br.accent; else br.accent=f.accent.value; await admSaveCompany({branding:br}); perToast('Branding saved for everyone in the company.'); }
      else if(k==='features'){ const site={...(ADM.cache.site||{}),ai:f.ai.checked,build:f.build.checked,samples:f.samples.checked,hideSetup:!f.setup.checked,reminders:f.reminders.checked,cycle:Math.max(7,Math.min(120,+f.cycle.value||35))}; admOk(await PER.sb.from('company_settings').upsert({company_id:PER.companyId,site,updated_by:PER.uid,updated_at:new Date().toISOString()})); ADM.cache.site=site; PER.site=site; siteApply(); perToast('Features saved for everyone in the company.'); }
      renderAdmin();
    }catch(ex){ perToast(perErr(ex),'err'); if(btn) btn.disabled=false; } });
}
// Company look and features, applied for everyone in the company.
const BRAND0={html:null};
function brandApply(){
  const b=(typeof PER!=='undefined'&&PER.mode==='supa'&&PER.company&&PER.company.branding)||{}, R=document.documentElement.style, br=document.querySelector('.top .brand'); if(!br) return;
  if(BRAND0.html==null) BRAND0.html=br.innerHTML;
  if(b.accent&&/^#[0-9a-f]{6}$/i.test(b.accent)){ R.setProperty('--accent',b.accent); R.setProperty('--accentSoft',`color-mix(in srgb, ${b.accent} 14%, var(--surface))`); R.setProperty('--accentText',`color-mix(in srgb, ${b.accent} 72%, var(--ink))`); R.setProperty('--accentBtn',`color-mix(in srgb, ${b.accent} 78%, #000)`); } else { ['--accent','--accentSoft','--accentText','--accentBtn'].forEach(k=>R.removeProperty(k)); }
  if(b.logo||b.title){ br.innerHTML=(b.logo?`<img class="blogo" src="${esc(b.logo)}" alt="">`:BRAND0.html.match(/<svg[\s\S]*?<\/svg>/)[0])+`<span class="bname">${b.title?esc(b.title):'Schedule <span>Workbench</span>'}</span>`; } else br.innerHTML=BRAND0.html;
  if(typeof rkBrand==='function') rkBrand();
}
function siteApply(){ const s=(typeof PER!=='undefined'&&PER.mode==='supa'&&PER.site)||{}; document.body.classList.toggle('no-ai',s.ai===false); document.body.classList.toggle('no-build',s.build===false); document.body.classList.toggle('no-samples',s.samples===false); if(s.build===false&&S.tab==='build') setTab('port'); }
