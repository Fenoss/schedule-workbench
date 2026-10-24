function init(){
  readTheme(); loadPrefs(); exLoad(); ifcLoad(); bLoad(); try{ const cp=JSON.parse(localStorage.getItem('pacer.cp')||'null'); if(cp&&['off','hi','only'].includes(cp.mode)) S.cp={...S.cp,...cp}; }catch(_){} try{ const tl=JSON.parse(localStorage.getItem('pacer.tilos')||'null'); if(tl){ const {styles,...rest}=tl; Object.assign(S.tld,rest); S.styles=styles||{}; } const st=JSON.parse(localStorage.getItem('pacer.site')||'null'); if(st&&Array.isArray(st.marks)) S.site=st; }catch(_){} try{ S.chmap=JSON.parse(localStorage.getItem('pacer.chmap')||'{}')||{}; const cf=JSON.parse(localStorage.getItem('pacer.chfmt')||'null'); if(cf&&FMT[cf.fmt]) S.tld.fmt=cf.fmt; }catch(_){} try{ const lg=localStorage.getItem('pacer.logic'); if(['off','sel','all'].includes(lg)) S.logic=lg; }catch(_){} wire();
  S.files=(B.st&&B.st.sync&&B.res&&!B.res.loops.length)?bToFiles():sampleFiles(); if(!S.site.marks.length&&!S.site.profile.length) S.site=sampleSite(); if(!Object.keys(S.styles).length) S.styles=sampleStyles();
  let tab='gantt'; try{ tab=localStorage.getItem('pacer.tab')||'gantt'; }catch(_){} if(tab==='ai') tab='dash';
  rebuild(true);
  if(tab!=='gantt') setTab(tab);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ drawProfile(); redraw(); });
  if(window.claude&&window.claude.hosted) document.querySelectorAll('#aiWrap .note').forEach(n=>{ n.textContent=n.textContent.replace('Uses your own Claude usage.','Uses the workbench’s Anthropic API key.'); });
  authStart();
}
if(typeof document!=='undefined'&&document.getElementById('ganttWrap')) init();
