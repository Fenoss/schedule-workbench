/* ---------------- utilities ---------------- */
const DAY=864e5, HR=36e5, MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PAL=['#3B6FE0','#14A37F','#9B5DE5','#D99A00','#E04F8C','#1BA1C4','#7C8796','#6DAA1A','#C2662D','#5D5FEF','#0F8B7E','#B5179E'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const pd=s=>{ if(!s) return null; const m=/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s); return m?Date.UTC(+m[1],m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)):null; };
const fx=t=>{const d=new Date(t);return `${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`};
const fmtD=t=>{ if(t==null) return '—'; const d=new Date(t); return `${p2(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`; };
const fmtL=t=>{ if(t==null) return '—'; const d=new Date(t); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dd=ms=>Math.round(ms/DAY);
const sgn=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
let uidN=0; const uid=()=>'f'+(++uidN);

/* ---------------- XER parser ---------------- */
function parseXER(text){
  const T={}; let cur=null, fields=null;
  const lines=text.split(/\r?\n/);
  for(const line of lines){
    if(!line) continue;
    const c=line.charCodeAt(0);
    if(c!==37) continue; // '%'
    const parts=line.split('\t'), tag=parts[0];
    if(tag==='%T'){ cur=parts[1]; T[cur]=T[cur]||[]; fields=null; }
    else if(tag==='%F'){ fields=parts.slice(1); }
    else if(tag==='%R' && cur && fields){ const o={}; for(let i=0;i<fields.length;i++) o[fields[i]]=parts[i+1]??''; T[cur].push(o); }
  }
  return T;
}
function fileInfo(T){
  const P=T.PROJECT||[];
  const d=P.map(p=>pd(p.last_recalc_date||p.next_data_date)).filter(x=>x!=null);
  return { projs:P.map(p=>p.proj_short_name), acts:(T.TASK||[]).filter(t=>t.task_type!=='TT_WBS').length, dd:d.length?Math.max(...d):null, links:(T.TASKPRED||[]).length };
}

/* ---------------- sample schedule (generated XER text, parsed like an upload) ---------------- */
function sampleFiles(opt){
  opt=opt||{}; const B0=Date.UTC(2026,1,2), DDT=opt.ddt||Date.UTC(2026,9,19), ddn=Math.round((DDT-B0)/DAY), KK=opt.k??1, UPN=opt.up||'09';
  const SEG=['Depot Approach','Riverside Cutting','Westfield Station','Calder Viaduct','Hollins Embankment','Northgate Terminus'];
  const DISC=[['ERTH','Earthworks'],['DRN','Drainage & Ducting'],['STR','Structures'],['TRK','Track'],['OLE','Overhead Line'],['SIG','Signalling'],['COM','Comms & SCADA'],['TNC','Testing & Commissioning'],['STN','Stations & Buildings'],['KEY','Key Dates']];
  const CTR=[['CVJ','Ardent Civils JV'],['RSP','Railsys Partners'],['OWN','Owner']];
  const LOCS=SEG.map((n,i)=>['S0'+(i+1),`${n} Ch ${i*2}+000 to ${i*2+2}+000`]).concat([['RTE','Route-wide Ch 0+000 to 12+000']]);
  function defs(live,kk){
    const A=[]; const add=o=>{o.dur=Math.round(o.dur); o.type=o.type||'TT_Task'; A.push(o);};
    const K=live?(kk??1):0, g=x=>1+(x-1)*K, h=x=>live?1-x*(1-K):1;
    const SNM=i=>SEG[i];
    add({code:'MS1000',name:'Notice to proceed',proj:'CIV',seg:null,disc:'KEY',ctr:'OWN',dur:0,type:'TT_Mile',preds:[]});
    // Earthworks: gang A works south to north from Ch 0, gang B starts at Ch 6 and works north
    for(let i=0;i<6;i++){ const a=i*2,b=a+2,n=i+1;
      add({code:`CE${n}10`,name:`Bulk earthworks – ${SNM(i)}`,proj:'CIV',seg:i,disc:'ERTH',ctr:'CVJ',dur:48*(i===1?g(1.35):1),c0:a,c1:b,preds:i===0?[['MS1000','FS',0]]:i===3?[['MS1000','FS',14]]:[[`CE${i}10`,'FS',0]]});
      if((!live||K<0.15)&&i===3) add({code:'CE4005',name:'Temporary haul road – Calder',proj:'CIV',seg:i,disc:'ERTH',ctr:'CVJ',dur:15,c0:6,c1:6.7,preds:[['MS1000','FS',0]]});
      const dp=[[`CE${n}10`,'SS',18],[`CE${n}10`,'FF',6]];
      if(live&&K>=0.35&&i===2){ add({code:'CE3015',name:'Utility diversion – Westfield gas main Ch 4+400 to 5+200',proj:'CIV',seg:i,disc:'DRN',ctr:'CVJ',dur:45,c0:4.4,c1:5.2,preds:[['CE310','SS',10]]}); dp.push(['CE3015','FS',0]); }
      add({code:`CD${n}20`,name:`Drainage & ducting – ${SNM(i)}`,proj:'CIV',seg:i,disc:'DRN',ctr:'CVJ',dur:34,c0:a,c1:b,preds:dp});
    }
    // Structures
    add({code:'CS2030',name:'Riverside underbridge Ch 3+200',proj:'CIV',seg:1,disc:'STR',ctr:'CVJ',dur:75,c0:3.2,c1:3.2,preds:[['MS1000','FS',20]]});
    add({code:'CS4030',name:'Calder Viaduct piers & deck',proj:'CIV',seg:3,disc:'STR',ctr:'CVJ',dur:165*g(1.22),c0:6.2,c1:7.8,preds:[['MS1000','FS',0]]});
    add({code:'CS5030',name:'Hollins culvert extension Ch 8+800',proj:'CIV',seg:4,disc:'STR',ctr:'CVJ',dur:45,c0:8.8,c1:8.8,preds:[['CE510','SS',10]]});
    // Stations and buildings (area work)
    add({code:'CB1060',name:'Depot building & stabling sidings Ch 0+000 to 0+450',proj:'CIV',seg:0,disc:'STN',ctr:'CVJ',dur:150,c0:0,c1:0.45,preds:[['CE110','SS',20]]});
    add({code:'CB3060',name:'Westfield Station structure & fit-out Ch 4+600 to 5+000',proj:'CIV',seg:2,disc:'STN',ctr:'CVJ',dur:175,c0:4.6,c1:5.0,preds:[['CD320','SS',10]].concat(live&&K>=0.35?[['CE3015','FS',0]]:[])});
    add({code:'CB6060',name:'Northgate Terminus building Ch 11+500 to 12+000',proj:'CIV',seg:5,disc:'STN',ctr:'CVJ',dur:190,c0:11.5,c1:12,preds:[['CE610','SS',15]]});
    // Track: one trackbed crew and one track-laying crew run the whole route
    const ST={2:'CS2030',4:'CS4030',5:'CS5030'};
    for(let i=0;i<6;i++){ const a=i*2,b=a+2,n=i+1;
      const tp=[[`CD${n}20`,'FS',0]]; if(ST[n]) tp.push([ST[n],'FS',0]); if(i) tp.push([`CT${i}40`,'FS',0]);
      add({code:`CT${n}40`,name:`Trackbed formation – ${SNM(i)}`,proj:'CIV',seg:i,disc:'TRK',ctr:'CVJ',dur:20,c0:a,c1:b,preds:tp});
      const lp=[[`CT${n}40`,'SS',6],[`CT${n}40`,'FF',3]]; if(i) lp.push([`CT${i}50`,'FS',0]);
      add({code:`CT${n}50`,name:`Track laying – ${SNM(i)}`,proj:'CIV',seg:i,disc:'TRK',ctr:'CVJ',dur:14,c0:a,c1:b,preds:lp});
    }
    add({code:'MS1900',name:'Civils substantially complete',proj:'CIV',seg:null,disc:'KEY',ctr:'OWN',dur:0,type:'TT_FinMile',preds:[1,2,3,4,5,6].map(n=>[`CT${n}50`,'FS',0]).concat([['CB1060','FS',0],['CB3060','FS',0],['CB6060','FS',0]])});
    // Interface milestones: civils hands each section to systems through a giver/receiver pair
    for(let i=0;i<6;i++){ const n=i+1; add({code:`IM${n}60`,name:`Interface: track access handed over – ${SNM(i)}`,proj:'CIV',seg:i,disc:'KEY',ctr:'CVJ',dur:0,type:'TT_FinMile',ifc:`IF-0${n}`,preds:[[`CT${n}50`,'FS',0]]}); }
    for(let i=0;i<6;i++){ const n=i+1; add({code:`IR${n}05`,name:`Interface: track access received – ${SNM(i)}`,proj:'SYS',seg:i,disc:'KEY',ctr:'RSP',dur:0,type:'TT_Mile',ifc:`IF-0${n}`,preds:live&&K>=0.6&&n===6?[]:[[`IM${n}60`,'FS',0]]}); }
    if(live&&K>=0.95) add({code:'CE6090',name:'Landscaping & reinstatement – Northgate Terminus',proj:'CIV',seg:5,disc:'STN',ctr:'CVJ',dur:20,c0:10,c1:12,preds:[['CT650','FS',0]]});
    // Overhead line: crews start at the terminus and work back towards the depot
    for(let i=5;i>=0;i--){ const a=i*2,b=a+2,n=i+1;
      add({code:`SO${n}10`,name:`OLE foundations – ${SNM(i)}`,proj:'SYS',seg:i,disc:'OLE',ctr:'RSP',dur:16,c0:b,c1:a,preds:[[`CT${n}40`,'FS',0]].concat(i<5?[[`SO${n+1}10`,'FS',0]]:[])});
      add({code:`SO${n}20`,name:`OLE wiring & registration – ${SNM(i)}`,proj:'SYS',seg:i,disc:'OLE',ctr:'RSP',dur:12,c0:b,c1:a,preds:[[`SO${n}10`,'FS',0],[`IR${n}05`,'FS',0]].concat(i<5?[[`SO${n+1}20`,'FS',0]]:[])});
    }
    // Signalling and comms follow the track north
    for(let i=0;i<6;i++){ const a=i*2,b=a+2,n=i+1;
      add({code:`SG${n}30`,name:`Signalling installation – ${SNM(i)}`,proj:'SYS',seg:i,disc:'SIG',ctr:'RSP',dur:18*(i>=2?g(1.2):1),c0:a,c1:b,preds:[[`IR${n}05`,'FS',5]].concat(i?[[`SG${i}30`,'FS',0]]:[])});
      add({code:`SC${n}40`,name:`Comms & SCADA fit-out – ${SNM(i)}`,proj:'SYS',seg:i,disc:'COM',ctr:'RSP',dur:15,c0:a,c1:b,preds:[[`SG${n}30`,n===5?'FS':'SS',n===5?-3:6]]});
    }
    for(let i=0;i<6;i++){ const a=i*2,b=a+2,n=i+1;
      add({code:`ST${n}50`,name:`Section testing – ${SNM(i)}`,proj:'SYS',seg:i,disc:'TNC',ctr:'RSP',dur:10*h(.5),c0:a,c1:b,preds:[[`SO${n}20`,'FS',0],[`SG${n}30`,'FS',0],[`SC${n}40`,'FS',0]]}); }
    add({code:'MS2900',name:'OLE energisation',proj:'SYS',seg:null,disc:'KEY',ctr:'OWN',dur:0,type:'TT_FinMile',preds:[1,2,3,4,5,6].map(n=>[`SO${n}20`,'FS',0])});
    add({code:'TC2950',name:'System integration testing',proj:'SYS',seg:null,disc:'TNC',ctr:'RSP',dur:30*h(.6),c0:0,c1:12,preds:[1,2,3,4,5,6].map(n=>[`ST${n}50`,'FS',0]).concat([['MS2900','FS',0],['MS1900','FS',0]])});
    add({code:'MS2990',name:'Entry into service',proj:'SYS',seg:null,disc:'KEY',ctr:'OWN',dur:0,type:'TT_FinMile',preds:[['TC2950','FS',0]]});
    return A;
  }
  function schedule(A,cap,pin){
    const by={}; A.forEach(a=>{by[a.code]=a; a.succ=[];});
    A.forEach(a=>{ let es=0; a.preds.forEach(([c,t,l])=>{ const p=by[c]; if(!p) return; p.succ.push([a,t,l]);
      const v=t==='FS'?p.ef+l:t==='SS'?p.es+l:t==='FF'?p.ef+l-a.dur:p.es+l-a.dur; es=Math.max(es,v); });
      const tr=pin&&pin.truth[a.code];
      if(tr&&tr.ef<=pin.ddn&&(tr.dur>0||tr.es<pin.ddn)){ a.es=tr.es; a.ef=tr.ef; }
      else if(tr&&tr.es<pin.ddn){ a.es=tr.es; a.ef=Math.max(tr.es+a.dur,pin.ddn+1); }
      else { if(pin) es=Math.max(es,pin.ddn); a.es=es; a.ef=es+a.dur; } });
    const end=Math.min(Math.max(...A.map(a=>a.ef)),cap??Infinity);
    for(let i=A.length-1;i>=0;i--){ const a=A[i]; let lf=end;
      a.succ.forEach(([s,t,l])=>{ const v=t==='FS'?s.ls-l:t==='SS'?s.ls-l+a.dur:t==='FF'?s.lf-l:s.lf-l+a.dur; lf=Math.min(lf,v); });
      a.lf=lf; a.ls=lf-a.dur; a.tf=lf-a.ef;
      let ff=end-a.ef; a.succ.forEach(([s,t,l])=>{ const v=t==='FS'?s.es-l-a.ef:t==='SS'?s.es-l-a.es:t==='FF'?s.ef-l-a.ef:s.ef-l-a.es; ff=Math.min(ff,v); }); a.ff=Math.max(0,ff); }
    return by;
  }
  const tbl=(name,fields,rows)=>`%T\t${name}\n%F\t${fields.join('\t')}\n`+rows.map(r=>'%R\t'+fields.map(f=>r[f]??'').join('\t')).join('\n')+(rows.length?'\n':'');
  const out=[]; const capDay=schedule(defs(false),Infinity).MS2990.ef;
  const pin=KK<1||opt.ddt?{ddn,truth:schedule(defs(true,1),capDay)}:null;
  for(const role of opt.liveOnly?['L']:['B','L']){
    const L=role==='L', A=L?defs(true,KK):defs(false), by=schedule(A,L?capDay:Infinity,L?pin:null);
    A.forEach((a,i)=>a.tid=(L?10000:60000)+i);
    const P={CIV:{id:L?1001:2001,short:'NXR-CIV',name:'Northgate Express Rail – Civils'},SYS:{id:L?1002:2002,short:'NXR-SYS',name:'Northgate Express Rail – Systems'}};
    const IFC=[1,2,3,4,5,6].map(n=>[`IF-0${n}`,`Track access ${SEG[n-1]}`]);
    const types=[[801,'Discipline',DISC],[802,'Location',LOCS],[803,'Contractor',CTR],[804,'Interface ID',IFC]];
    const codeId=(ti,short)=>types[ti][0]*10+types[ti][2].findIndex(x=>x[0]===short)+1;
    let pid=L?1:50001;
    for(const pk of ['CIV','SYS']){
      const p=P[pk], root=p.id*10;
      const wbs=[{wbs_id:root,proj_id:p.id,seq_num:0,proj_node_flag:'Y',wbs_short_name:p.short,wbs_name:p.name,parent_wbs_id:''}]
        .concat(SEG.map((n,i)=>({wbs_id:root+1+i,proj_id:p.id,seq_num:(i+1)*10,proj_node_flag:'N',wbs_short_name:'S0'+(i+1),wbs_name:`S0${i+1} ${n}`,parent_wbs_id:root})))
        .concat([{wbs_id:root+9,proj_id:p.id,seq_num:90,proj_node_flag:'N',wbs_short_name:'KD',wbs_name:'Key dates & integration',parent_wbs_id:root}]);
      const tasks=[], preds=[], tav=[], udf=[], tr=[]; const NORS=new Set(['CE3015','SC540','SC640','CE6090']);
      A.filter(a=>a.proj===pk).forEach(a=>{
        const sD=B0+a.es*DAY+8*HR, fD=a.dur?B0+(a.ef-1)*DAY+17*HR:sD;
        const t={task_id:a.tid,proj_id:p.id,wbs_id:a.seg!=null?root+1+a.seg:root+9,clndr_id:1,phys_complete_pct:0,task_code:a.code,task_name:a.name,task_type:a.type,status_code:'TK_NotStart',
          total_float_hr_cnt:a.tf*8,free_float_hr_cnt:a.ff*8,target_drtn_hr_cnt:a.dur*8,remain_drtn_hr_cnt:a.dur*8,act_start_date:'',act_end_date:'',early_start_date:fx(sD),early_end_date:fx(fD),
          late_start_date:fx(B0+a.ls*DAY+8*HR),late_end_date:fx(a.dur?B0+(a.lf-1)*DAY+17*HR:B0+a.ls*DAY+8*HR),target_start_date:fx(sD),target_end_date:fx(fD),driving_path_flag:a.tf<=0?'Y':'N',
          duration_type:'DT_FixedDUR2',complete_pct_type:'CP_Phys',priority_type:'PT_Normal',cstr_type:a.code==='MS2990'?'CS_MEOB':'',cstr_date:a.code==='MS2990'?fx(B0+capDay*DAY+8*HR):''};
        if(L){
          if(a.ef<=ddn && (a.dur>0||a.es<ddn)){ Object.assign(t,{status_code:'TK_Complete',phys_complete_pct:100,act_start_date:fx(sD),act_end_date:fx(fD),early_start_date:'',early_end_date:'',late_start_date:'',late_end_date:'',remain_drtn_hr_cnt:0,total_float_hr_cnt:'',free_float_hr_cnt:''}); }
          else if(a.es<ddn){ Object.assign(t,{status_code:'TK_Active',phys_complete_pct:Math.min(99,Math.round((ddn-a.es)/Math.max(1,a.ef-a.es)*100)),act_start_date:fx(sD),early_start_date:fx(DDT+8*HR),late_start_date:'',remain_drtn_hr_cnt:(a.ef-ddn)*8}); }
        }
        tasks.push(t);
        a.preds.forEach(([c,ty,l])=>{ const q=by[c]; preds.push({task_pred_id:pid++,task_id:a.tid,pred_task_id:q.tid,proj_id:p.id,pred_proj_id:P[q.proj].id,pred_type:'PR_'+ty,lag_hr_cnt:l*8}); });
        if(a.dur>0&&!NORS.has(a.code)) tr.push({taskrsrc_id:a.tid+500000,task_id:a.tid,proj_id:p.id,rsrc_id:a.ctr==='CVJ'?501:502,target_qty:a.dur*8*4});
        tav.push({task_id:a.tid,actv_code_type_id:801,actv_code_id:codeId(0,a.disc),proj_id:p.id});
        tav.push({task_id:a.tid,actv_code_type_id:802,actv_code_id:codeId(1,a.seg!=null?'S0'+(a.seg+1):'RTE'),proj_id:p.id});
        tav.push({task_id:a.tid,actv_code_type_id:803,actv_code_id:codeId(2,a.ctr),proj_id:p.id});
        if(a.ifc) tav.push({task_id:a.tid,actv_code_type_id:804,actv_code_id:codeId(3,a.ifc),proj_id:p.id});
        if(a.c0!=null){ udf.push({udf_type_id:901,fk_id:a.tid,proj_id:p.id,udf_number:a.c0.toFixed(2)}); udf.push({udf_type_id:902,fk_id:a.tid,proj_id:p.id,udf_number:a.c1.toFixed(2)}); }
      });
      const dateStr=fx(L?DDT:B0).slice(0,10);
      let txt=`ERMHDR\t21.12\t${dateStr}\tProject\tADMIN\tsample\tdbxDatabaseNoName\tProject Management\tUSD\n`;
      txt+=tbl('CALENDAR',['clndr_id','default_flag','clndr_name','day_hr_cnt','week_hr_cnt'],[{clndr_id:1,default_flag:'Y',clndr_name:'7 Day x 8h',day_hr_cnt:8,week_hr_cnt:56}]);
      txt+=tbl('PROJECT',['proj_id','proj_short_name','last_recalc_date','plan_start_date','next_data_date'],[{proj_id:p.id,proj_short_name:p.short,last_recalc_date:fx(L?DDT:B0),plan_start_date:fx(B0),next_data_date:fx(L?DDT:B0)}]);
      txt+=tbl('PROJWBS',['wbs_id','proj_id','seq_num','proj_node_flag','wbs_short_name','wbs_name','parent_wbs_id'],wbs);
      txt+=tbl('ACTVTYPE',['actv_code_type_id','actv_code_type','seq_num','actv_short_len','proj_id','actv_code_type_scope'],types.map(([id,n],i)=>({actv_code_type_id:id,actv_code_type:n,seq_num:i+1,actv_short_len:4,proj_id:'',actv_code_type_scope:'AS_Global'})));
      txt+=tbl('ACTVCODE',['actv_code_id','parent_actv_code_id','actv_code_type_id','actv_code_name','short_name','seq_num','color'],types.flatMap(([id,,vals])=>vals.map(([s,n],j)=>({actv_code_id:id*10+j+1,parent_actv_code_id:'',actv_code_type_id:id,actv_code_name:n,short_name:s,seq_num:j+1,color:''}))));
      txt+=tbl('UDFTYPE',['udf_type_id','table_name','udf_type_name','udf_type_label','logical_data_type'],[{udf_type_id:901,table_name:'TASK',udf_type_name:'user_field_901',udf_type_label:'Chainage Start (km)',logical_data_type:'FT_FLOAT_2_DECIMALS'},{udf_type_id:902,table_name:'TASK',udf_type_name:'user_field_902',udf_type_label:'Chainage End (km)',logical_data_type:'FT_FLOAT_2_DECIMALS'}]);
      txt+=tbl('TASK',['task_id','proj_id','wbs_id','clndr_id','phys_complete_pct','complete_pct_type','task_code','task_name','task_type','duration_type','status_code','priority_type','total_float_hr_cnt','free_float_hr_cnt','target_drtn_hr_cnt','remain_drtn_hr_cnt','act_start_date','act_end_date','early_start_date','early_end_date','late_start_date','late_end_date','target_start_date','target_end_date','cstr_type','cstr_date','driving_path_flag'],tasks);
      txt+=tbl('TASKPRED',['task_pred_id','task_id','pred_task_id','proj_id','pred_proj_id','pred_type','lag_hr_cnt'],preds);
      txt+=tbl('TASKRSRC',['taskrsrc_id','task_id','proj_id','rsrc_id','target_qty'],tr);
      txt+=tbl('TASKACTV',['task_id','actv_code_type_id','actv_code_id','proj_id'],tav);
      txt+=tbl('UDFVALUE',['udf_type_id','fk_id','proj_id','udf_date','udf_number','udf_text'],udf);
      txt+='%E\n';
      const dl=new Date(DDT), name=L?`${p.short}_UP${UPN}_${dl.getUTCDate()}${MON[dl.getUTCMonth()]}${String(dl.getUTCFullYear()).slice(2)}.xer`:`${p.short}_Baseline_BL01.xer`;
      const T=spEnrich(parseXER(txt),{501:['CVJ','Ardent Civils JV'],502:['RSP','Railsys Partners']});
      out.push({id:uid(),name,role:L?'live':'baseline',tables:T,info:fileInfo(T),sample:true});
    }
  }
  return out;
}

