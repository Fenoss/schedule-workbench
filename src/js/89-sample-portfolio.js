/* ================= Sample portfolio generator: integrated programmes with monthly updates =================
   Each programme is one logic network spanning its projects. Projects hand work to each other through
   interface milestones (giver → receiver, matched by the "Interface ID" code). Inside a saved project the
   link is a real cross-file relationship; between projects the receiver carries a "start on or after"
   constraint set to the giver's forecast, so a slip in one project moves the other in the next update.
   Updates follow the NXR sample: actuals are fixed by a single "truth" schedule, and later updates reveal
   more of the eventual growth, so forecasts drift realistically from period to period. */
const SP_DDS=[[2026,4,18,.15,'04'],[2026,5,22,.3,'05'],[2026,6,20,.5,'06'],[2026,7,17,.65,'07'],[2026,8,21,.8,'08'],[2026,9,19,1,'09']];

function spKit(live,K){
  const A=[], g=x=>live?1+(x-1)*K:1, on=t=>live&&K>=t, off=t=>!live||K<t;
  const a=o=>{ o.dur=Math.max(0,Math.round(o.dur||0)); o.type=o.type||(o.dur?'TT_Task':(o.fin?'TT_FinMile':'TT_Mile')); o.preds=(o.preds||[]).filter(Boolean); A.push(o); return o; };
  return {A,g,on,off,a};
}

const SP_DEFS={
  /* ---------- Northgate Express Rail: depot (joins the existing Civils & Systems sample) ---------- */
  NXR:{code:'NXR',name:'Northgate Express Rail',client:'Northgate Transit Authority',desc:'12 km light rail extension',colour:'#FC4C02',start:Date.UTC(2026,1,2),
    pps:{DP:{name:'Depot & Stabling – Phase 2',code:'NXR-DP2',manager:'S. Ahmed',desc:'Maintenance depot, stabling sidings and wash plant'}},
    p6:{DEP:{pp:'DP',short:'NXR-DEP',name:'Northgate Express Rail – Depot & Stabling',ctr:'CVJ'}},
    disc:[['ERTH','Earthworks'],['DRN','Drainage & Ducting'],['TRK','Track'],['STN','Stations & Buildings'],['OLE','Overhead Line'],['SYS','Depot Systems'],['TNC','Testing & Commissioning'],['KEY','Key Dates']],
    locs:[['DY','Depot yard'],['SR','Stabling roads'],['MS','Maintenance shed'],['WP','Wash plant']],
    ctr:[['CVJ','Ardent Civils JV'],['RSP','Railsys Partners'],['OWN','Owner']],
    ifc:[['IF-07','Depot track connection']],
    wbs:{D1:'D1 Yard & sidings',D2:'D2 Maintenance shed',D3:'D3 Systems & commissioning',KD:'Key dates'},
    build(live,K){ const {A,g,on,a}=spKit(live,K);
      a({code:'DP000',name:'Depot works start',p6:'DEP',wbs:'KD',disc:'KEY',loc:'DY',ctr:'OWN',es0:70});
      a({code:'DP110',name:'Depot earthworks & platform',p6:'DEP',wbs:'D1',disc:'ERTH',loc:'DY',dur:55*g(1.2),preds:[['DP000','FS',0]]});
      a({code:'DP120',name:'Yard drainage & ducts',p6:'DEP',wbs:'D1',disc:'DRN',loc:'DY',dur:35,preds:[['DP110','SS',20],['DP110','FF',5]]});
      for(let i=1;i<=4;i++) a({code:`DP13${i}`,name:`Stabling road ${i} – trackbed & track`,p6:'DEP',wbs:'D1',disc:'TRK',loc:'SR',dur:16,preds:[['DP120','FS',0]].concat(i>1?[[`DP13${i-1}`,'FS',0]]:[])});
      a({code:'DP150',name:'Interface: depot track connection available',p6:'DEP',wbs:'KD',disc:'KEY',loc:'DY',ctr:'OWN',ifc:'IF-07',ext:{base:150,slip:17}});
      a({code:'DP160',name:'Depot connection turnout & signalling tie-in',p6:'DEP',wbs:'D1',disc:'TRK',loc:'DY',dur:14,preds:[['DP134','FS',0],['DP150','FS',0]]});
      a({code:'DP210',name:'Maintenance shed foundations & pits',p6:'DEP',wbs:'D2',disc:'STN',loc:'MS',dur:50,preds:[['DP110','FS',0]]});
      a({code:'DP220',name:'Maintenance shed steel frame & roof',p6:'DEP',wbs:'D2',disc:'STN',loc:'MS',dur:45*g(1.15),preds:[['DP210','FS',0]]});
      if(on(.35)) a({code:'DP2205',name:'Roof sheeting re-procurement',p6:'DEP',wbs:'D2',disc:'STN',loc:'MS',dur:28,preds:[['DP210','FS',0]]});
      a({code:'DP230',name:'Shed cladding & doors',p6:'DEP',wbs:'D2',disc:'STN',loc:'MS',dur:35,preds:[['DP220','FS',0]].concat(on(.35)?[['DP2205','FS',0]]:[])});
      a({code:'DP240',name:'Shed fit-out, cranes & jacks',p6:'DEP',wbs:'D2',disc:'STN',loc:'MS',dur:60,preds:[['DP230','SS',15]]});
      a({code:'DP250',name:'Wash plant civils & equipment',p6:'DEP',wbs:'D2',disc:'STN',loc:'WP',dur:45,preds:[['DP120','FS',0]]});
      a({code:'DP310',name:'Depot OLE & traction power',p6:'DEP',wbs:'D3',disc:'OLE',loc:'SR',ctr:'RSP',dur:30,preds:[['DP134','FS',0]]});
      a({code:'DP320',name:'Depot control & signalling systems',p6:'DEP',wbs:'D3',disc:'SYS',loc:'DY',ctr:'RSP',dur:40,preds:[['DP160','FS',0],['DP310','SS',10]]});
      a({code:'DP330',name:'Depot testing & commissioning',p6:'DEP',wbs:'D3',disc:'TNC',loc:'DY',ctr:'RSP',dur:25,preds:[['DP240','FS',0],['DP250','FS',0],['DP320','FS',0]]});
      a({code:'DP900',name:'Depot ready for fleet',p6:'DEP',wbs:'KD',disc:'KEY',loc:'DY',ctr:'OWN',fin:true,preds:[['DP330','FS',0]]});
      return A; }},

  /* ---------- Westfield Station Quarter: highways/public realm + residential block ---------- */
  WSQ:{code:'WSQ',name:'Westfield Station Quarter',client:'Westfield Development Corporation',desc:'Mixed-use regeneration around the new station',colour:'#3B6FE0',start:Date.UTC(2026,1,2),
    pps:{PR:{name:'Public realm & highways',code:'WSQ-PR',manager:'R. Okafor',desc:'Utility diversions, highway works and landscaping'},
         RA:{name:'Residential block A',code:'WSQ-A',manager:'K. Lindqvist',desc:'10-storey residential block, 120 homes'}},
    p6:{HWY:{pp:'PR',short:'WSQ-HWY',name:'Westfield – Highways & Utilities',ctr:'HCL'},PRL:{pp:'PR',short:'WSQ-PRL',name:'Westfield – Public Realm',ctr:'LSC'},RA:{pp:'RA',short:'WSQ-RA',name:'Westfield – Residential Block A',ctr:'BRK'}},
    disc:[['UTL','Utilities'],['HWY','Highways'],['LND','Landscaping'],['SUB','Substructure'],['FRM','Frame'],['ENV','Envelope'],['MEP','MEP'],['FIT','Fit-out'],['TNC','Testing & Commissioning'],['KEY','Key Dates']],
    locs:[['Z1','North Road'],['Z2','Station Square'],['Z3','Canal Street'],['Z4','East Link'],['B0','Block A basement']].concat(Array.from({length:10},(_,i)=>['L'+String(i+1).padStart(2,'0'),'Block A level '+(i+1)])),
    ctr:[['HCL','Highway Civils Ltd'],['LSC','Landscape Collective'],['BRK','Brickhouse Construction'],['OWN','Westfield DevCo']],
    ifc:[['IF-WS-01','Site access road for Block A'],['IF-WS-02','Block A scaffold strike for Station Square'],['IF-WS-11','North Road to landscaping'],['IF-WS-12','Station Square to landscaping'],['IF-WS-13','Canal Street to landscaping'],['IF-WS-14','East Link to landscaping']],
    wbs:{Z1:'Z1 North Road',Z2:'Z2 Station Square',Z3:'Z3 Canal Street',Z4:'Z4 East Link',SB:'Substructure',FR:'Frame',EN:'Envelope',IN:'MEP & fit-out',CM:'Commissioning & handover',KD:'Key dates'},
    build(live,K){ const {A,g,on,off,a}=spKit(live,K); const Z=['Z1','Z2','Z3','Z4'], ZN={Z1:'North Road',Z2:'Station Square',Z3:'Canal Street',Z4:'East Link'};
      a({code:'HW000',name:'Highways works start',p6:'HWY',wbs:'KD',disc:'KEY',loc:'Z1',ctr:'OWN'});
      Z.forEach((z,i)=>{ const n=i+1, prev=i?Z[i-1]:null;
        a({code:`HW${n}10`,name:`Utility diversions – ${ZN[z]}`,p6:'HWY',wbs:z,disc:'UTL',loc:z,dur:35*(n===2?g(1.45):1),preds:[['HW000','FS',i*5]].concat(prev?[[`HW${n-1}10`,'FS',0]]:[])});
        a({code:`HW${n}20`,name:`Drainage & ducts – ${ZN[z]}`,p6:'HWY',wbs:z,disc:'UTL',loc:z,dur:25,preds:[[`HW${n}10`,'SS',15]].concat(prev?[[`HW${n-1}20`,'FS',0]]:[])});
        a({code:`HW${n}30`,name:`Carriageway & kerbs – ${ZN[z]}`,p6:'HWY',wbs:z,disc:'HWY',loc:z,dur:30,preds:[[`HW${n}20`,'FS',0],[`HW${n}10`,'FS',0]].concat(prev?[[`HW${n-1}30`,'FS',0]]:[])});
        a({code:`HW${n}40`,name:`Surfacing & lining – ${ZN[z]}`,p6:'HWY',wbs:z,disc:'HWY',loc:z,dur:10,preds:[[`HW${n}30`,'FS',0]]});
        a({code:`IG-H${n}`,name:`Interface: ${ZN[z]} handed to landscaping`,p6:'HWY',wbs:'KD',disc:'KEY',loc:z,ifc:`IF-WS-1${n}`,type:'TT_FinMile',preds:[[`HW${n}40`,'FS',0]]});
        a({code:`IR-H${n}`,name:`Interface: ${ZN[z]} received for landscaping`,p6:'PRL',wbs:'KD',disc:'KEY',loc:z,ifc:`IF-WS-1${n}`,preds:[[`IG-H${n}`,'FS',0]]});
        a({code:`PL${n}10`,name:`Hard landscaping – ${ZN[z]}`,p6:'PRL',wbs:z,disc:'LND',loc:z,dur:30,preds:[[`IR-H${n}`,'FS',0]].concat(n===2?[['IR-WS02','FS',0]]:[]).concat(prev?[[`PL${n-1}10`,'FS',0]]:[])});
        a({code:`PL${n}20`,name:`Soft landscaping & trees – ${ZN[z]}`,p6:'PRL',wbs:z,disc:'LND',loc:z,dur:20,preds:[[`PL${n}10`,'FS',0]]});
      });
      a({code:'IG-WS01',name:'Interface: site access road open to Block A',p6:'HWY',wbs:'KD',disc:'KEY',loc:'Z1',ifc:'IF-WS-01',fin:false,type:'TT_FinMile',preds:[['HW130','FS',0]]});
      a({code:'IR-WS02',name:'Interface: Station Square released by Block A',p6:'PRL',wbs:'KD',disc:'KEY',loc:'Z2',ifc:'IF-WS-02',preds:[['IG-RA02','FS',0]]});
      a({code:'PR900',name:'Public realm complete',p6:'PRL',wbs:'KD',disc:'KEY',loc:'Z4',ctr:'OWN',fin:true,preds:Z.map((z,i)=>[`PL${i+1}20`,'FS',0])});
      // Block A
      a({code:'RA000',name:'Block A start on site',p6:'RA',wbs:'KD',disc:'KEY',loc:'B0',ctr:'OWN',es0:20});
      a({code:'RA010',name:'Site establishment & hoarding',p6:'RA',wbs:'SB',disc:'SUB',loc:'B0',dur:20,preds:[['RA000','FS',0]]});
      if(off(.15)) a({code:'RA0035',name:'Temporary dewatering trial',p6:'RA',wbs:'SB',disc:'SUB',loc:'B0',dur:15,preds:[['RA010','FS',0]]});
      a({code:'RA020',name:'Piling',p6:'RA',wbs:'SB',disc:'SUB',loc:'B0',dur:45,preds:[['RA010','FS',0]].concat(off(.15)?[['RA0035','FS',0]]:[])});
      a({code:'RA030',name:'Pile caps & ground beams',p6:'RA',wbs:'SB',disc:'SUB',loc:'B0',dur:35,preds:[['RA020','SS',20],['RA020','FF',10]]});
      a({code:'RA040',name:'Basement slab & retaining walls',p6:'RA',wbs:'SB',disc:'SUB',loc:'B0',dur:50*g(1.1),preds:[['RA030','FS',0]]});
      if(on(.35)) a({code:'RA4015',name:'Basement waterproofing remedials',p6:'RA',wbs:'SB',disc:'SUB',loc:'B0',dur:25,preds:[['RA040','FS',0]]});
      a({code:'IR-WS01',name:'Interface: site access road received',p6:'RA',wbs:'KD',disc:'KEY',loc:'B0',ifc:'IF-WS-01',preds:[['IG-WS01','FS',0]]});
      a({code:'RA050',name:'Tower crane erection',p6:'RA',wbs:'FR',disc:'FRM',loc:'B0',dur:10,preds:[['RA030','FS',0],['IR-WS01','FS',0]]});
      for(let l=1;l<=10;l++){ const L='L'+String(l).padStart(2,'0');
        a({code:`RF${L}`,name:`Frame & slab – level ${l}`,p6:'RA',wbs:'FR',disc:'FRM',loc:L,dur:12*(l>=4&&l<=6?g(1.35):1),preds:[[l===1?'RA040':`RFL${String(l-1).padStart(2,'0')}`,'FS',0]].concat(l===1?[['RA050','FS',0]].concat(on(.35)?[['RA4015','FS',0]]:[]):[])});
      }
      a({code:'RF100',name:'Roof structure & plant deck',p6:'RA',wbs:'FR',disc:'FRM',loc:'L10',dur:15,preds:[['RFL10','FS',0]]});
      for(let l=1;l<=10;l++){ const L='L'+String(l).padStart(2,'0'), p2=String(l-1).padStart(2,'0');
        a({code:`RE${L}`,name:`Facade – level ${l}`,p6:'RA',wbs:'EN',disc:'ENV',loc:L,dur:10,preds:[[`RF${l<=8?'L'+String(l+2).padStart(2,'0'):'100'}`,'FS',0]].concat(l>1?[[`REL${p2}`,'FS',0]]:[])});
        a({code:`RM${L}`,name:`MEP first fix – level ${l}`,p6:'RA',wbs:'IN',disc:'MEP',loc:L,dur:12,preds:[[`RE${L}`,'FS',0]].concat(l>1?[[`RML${p2}`,'FS',0]]:[])});
        a({code:`RK${L}`,name:`Apartment fit-out – level ${l}`,p6:'RA',wbs:'IN',disc:'FIT',loc:L,dur:18*g(1.12),preds:[[`RM${L}`,'FS',0]].concat(l>1?[[`RKL${p2}`,'FS',0]]:[])});
      }
      a({code:'RA800',name:'Scaffold strike & hoist removal',p6:'RA',wbs:'EN',disc:'ENV',loc:'L10',dur:15,preds:[['REL10','FS',0],['RF100','FS',0]]});
      a({code:'IG-RA02',name:'Interface: Station Square released for landscaping',p6:'RA',wbs:'KD',disc:'KEY',loc:'B0',ifc:'IF-WS-02',type:'TT_FinMile',preds:[['RA800','FS',0]]});
      a({code:'RA850',name:'Building commissioning & testing',p6:'RA',wbs:'CM',disc:'TNC',loc:'B0',dur:30,preds:[['RKL10','FS',0],['RA800','FS',0]]});
      a({code:'RA880',name:'Snagging & handover',p6:'RA',wbs:'CM',disc:'TNC',loc:'B0',dur:20,preds:[['RA850','FS',0]]});
      a({code:'RA900',name:'Block A practical completion',p6:'RA',wbs:'KD',disc:'KEY',loc:'B0',ctr:'OWN',fin:true,preds:[['RA880','FS',0]]});
      return A; }},

  /* ---------- Harbour Line Metro: tunnels & stations + rail systems ---------- */
  HLM:{code:'HLM',name:'Harbour Line Metro',client:'Harbour City Transport',desc:'8 km driverless metro with four underground stations',colour:'#14A37F',start:Date.UTC(2026,0,5),chain:true,
    pps:{TS:{name:'Tunnels & stations',code:'HLM-TS',manager:'M. Rossi',desc:'TBM tunnels and four station boxes'},
         RS:{name:'Rail systems & integration',code:'HLM-RS',manager:'D. Nakamura',desc:'Track, power, signalling, testing and opening'}},
    p6:{TUN:{pp:'TS',short:'HLM-TUN',name:'Harbour Line – Tunnels',ctr:'TJV'},STN:{pp:'TS',short:'HLM-STN',name:'Harbour Line – Stations',ctr:'SBC'},SYS:{pp:'RS',short:'HLM-SYS',name:'Harbour Line – Rail Systems',ctr:'MSI'}},
    disc:[['TUN','Tunnelling'],['STR','Station Structures'],['ARC','Architecture & Fit-out'],['MEP','Station MEP'],['TRK','Track'],['PWR','Traction Power'],['SIG','Signalling & Train Control'],['TNC','Testing & Commissioning'],['KEY','Key Dates']],
    locs:[['ST1','Quayside'],['ST2','Market Street'],['ST3','University'],['ST4','Airport'],['T1','Tunnel Quayside–Market'],['T2','Tunnel Market–University'],['T3','Tunnel University–Airport'],['RTE','Route-wide']],
    ctr:[['TJV','Harbour Tunnelling JV'],['SBC','Station Builders Consortium'],['MSI','Metro Systems Integrator'],['OWN','Harbour City Transport']],
    ifc:[['IF-HL-01','Tunnel 1 to systems'],['IF-HL-02','Tunnel 2 to systems'],['IF-HL-03','Tunnel 3 to systems'],['IF-HL-11','Quayside rooms to systems'],['IF-HL-12','Market Street rooms to systems'],['IF-HL-13','University rooms to systems'],['IF-HL-14','Airport rooms to systems'],['IF-HL-21','Quayside box ready for TBM'],['IF-HL-22','Market Street box ready for TBM'],['IF-HL-23','University box ready for TBM'],['IF-HL-24','Airport box ready for TBM'],['IF-HL-30','Tunnels complete for station finishes']],
    wbs:{T1:'T1 Quayside–Market',T2:'T2 Market–University',T3:'T3 University–Airport',ST1:'Quayside station',ST2:'Market Street station',ST3:'University station',ST4:'Airport station',TBM:'TBM procurement & logistics',SY:'Systems by section',SS:'Station systems',IT:'Integration & opening',KD:'Key dates'},
    build(live,K){ const {A,g,on,off,a}=spKit(live,K); const ST=['Quayside','Market Street','University','Airport'], CH=[0,2.7,5.4,8.0];
      a({code:'HM000',name:'Notice to proceed – civils',p6:'TUN',wbs:'KD',disc:'KEY',loc:'RTE',ctr:'OWN',c0:0,c1:8});
      a({code:'HS000',name:'Notice to proceed – stations',p6:'STN',wbs:'KD',disc:'KEY',loc:'RTE',ctr:'OWN',c0:0,c1:8});
      a({code:'TB020',name:'TBM manufacture, delivery & assembly',p6:'TUN',wbs:'TBM',disc:'TUN',loc:'ST1',dur:140*g(1.12),preds:[['HM000','FS',0]],c0:0,c1:0});
      ST.forEach((n,j)=>{ const s=j+1, c=CH[j];
        a({code:`SB${s}10`,name:`Diaphragm walls – ${n}`,p6:'STN',wbs:'ST'+s,disc:'STR',loc:'ST'+s,ctr:'SBC',dur:60,preds:[['HS000','FS',j*25]],c0:c,c1:c});
        if(s===4&&off(.15)) a({code:'SB4005',name:'Temporary cofferdam – Airport',p6:'STN',wbs:'ST4',disc:'STR',loc:'ST4',ctr:'SBC',dur:30,preds:[['SB410','SS',10]],c0:c,c1:c});
        if(s===2&&on(.35)) a({code:'SB2015',name:'Utility diversion – Market Street water main',p6:'STN',wbs:'ST2',disc:'STR',loc:'ST2',ctr:'SBC',dur:40,preds:[['SB210','SS',20]],c0:c,c1:c});
        a({code:`SB${s}20`,name:`Bulk excavation & props – ${n}`,p6:'STN',wbs:'ST'+s,disc:'STR',loc:'ST'+s,ctr:'SBC',dur:80*(s===2?g(1.2):1),preds:[[`SB${s}10`,'FS',0]].concat(s===2&&on(.35)?[['SB2015','FS',0]]:[]).concat(s===4&&off(.15)?[['SB4005','FS',0]]:[]),c0:c,c1:c});
        a({code:`IG-B${s}`,name:`Interface: ${n} box ready for TBM`,p6:'STN',wbs:'KD',disc:'KEY',loc:'ST'+s,ctr:'SBC',ifc:`IF-HL-2${s}`,type:'TT_FinMile',preds:[[`SB${s}20`,'FS',0]],c0:c,c1:c});
        a({code:`IR-B${s}`,name:`Interface: ${n} box received for TBM`,p6:'TUN',wbs:'KD',disc:'KEY',loc:'ST'+s,ifc:`IF-HL-2${s}`,preds:[[`IG-B${s}`,'FS',0]],c0:c,c1:c});
        a({code:`SB${s}30`,name:`Base slab, concourse & roof – ${n}`,p6:'STN',wbs:'ST'+s,disc:'STR',loc:'ST'+s,ctr:'SBC',dur:90,preds:[[`SB${s}20`,'FS',0]],c0:c,c1:c});
        a({code:`SB${s}40`,name:`Architectural fit-out – ${n}`,p6:'STN',wbs:'ST'+s,disc:'ARC',loc:'ST'+s,ctr:'SBC',dur:100,preds:[[`SB${s}30`,'FS',0]],c0:c,c1:c});
        a({code:`SB${s}50`,name:`Station MEP – ${n}`,p6:'STN',wbs:'ST'+s,disc:'MEP',loc:'ST'+s,ctr:'SBC',dur:80,preds:[[`SB${s}40`,'SS',30]],c0:c,c1:c});
        a({code:`IG-S${s}`,name:`Interface: ${n} systems rooms handed over`,p6:'STN',wbs:'KD',disc:'KEY',loc:'ST'+s,ctr:'SBC',ifc:`IF-HL-1${s}`,type:'TT_FinMile',preds:[[`SB${s}50`,'FF',10]],c0:c,c1:c});
      });
      [1,2,3].forEach(i=>{ const a0=CH[i-1], a1=CH[i];
        a({code:`TD${i}10`,name:`TBM drive ${i} – ${ST[i-1]} to ${ST[i]}`,p6:'TUN',wbs:'T'+i,disc:'TUN',loc:'T'+i,dur:100*(i===2?g(1.3):1),preds:(i===1?[['TB020','FS',0],['IR-B1','FS',0]]:[[`TD${i-1}10`,'FS',15]]).concat([[`IR-B${i+1}`,'FS',0]]),c0:a0,c1:a1});
        a({code:`TD${i}20`,name:`Cross passages & grouting – drive ${i}`,p6:'TUN',wbs:'T'+i,disc:'TUN',loc:'T'+i,dur:45,preds:[[`TD${i}10`,'SS',40],[`TD${i}10`,'FF',10]],c0:a0,c1:a1});
        a({code:`TD${i}30`,name:`Tunnel invert & walkways – drive ${i}`,p6:'TUN',wbs:'T'+i,disc:'TUN',loc:'T'+i,dur:40,preds:[[`TD${i}20`,'FS',0]],c0:a0,c1:a1});
        a({code:`IG-T${i}`,name:`Interface: tunnel ${i} handed to systems`,p6:'TUN',wbs:'KD',disc:'KEY',loc:'T'+i,ifc:`IF-HL-0${i}`,type:'TT_FinMile',preds:[[`TD${i}30`,'FS',0]],c0:a1,c1:a1});
      });
      a({code:'TR040',name:'TBM retrieval – Airport',p6:'TUN',wbs:'TBM',disc:'TUN',loc:'ST4',dur:30,preds:[['TD310','FS',0]],c0:8,c1:8});
      a({code:'IG-TC',name:'Interface: tunnels complete for station finishes',p6:'TUN',wbs:'KD',disc:'KEY',loc:'RTE',ifc:'IF-HL-30',type:'TT_FinMile',preds:[['TR040','FS',0],['IG-T3','FS',0]],c0:8,c1:8});
      a({code:'IR-TC',name:'Interface: tunnels complete received',p6:'STN',wbs:'KD',disc:'KEY',loc:'RTE',ifc:'IF-HL-30',preds:[['IG-TC','FS',0]],c0:8,c1:8});
      a({code:'HM800',name:'Civils substantially complete',p6:'STN',wbs:'KD',disc:'KEY',loc:'RTE',ctr:'OWN',fin:true,preds:[['IR-TC','FS',0]].concat([1,2,3,4].map(s=>[`SB${s}40`,'FS',0])),c0:0,c1:8});
      // systems
      a({code:'RS000',name:'Notice to proceed – systems',p6:'SYS',wbs:'KD',disc:'KEY',loc:'RTE',ctr:'OWN',es0:200,c0:0,c1:8});
      a({code:'RS010',name:'Systems design & factory testing',p6:'SYS',wbs:'IT',disc:'SIG',loc:'RTE',dur:150,preds:[['RS000','FS',0]],c0:0,c1:8});
      [1,2,3].forEach(i=>{ const a0=CH[i-1], a1=CH[i];
        a({code:`IR-T${i}`,name:`Interface: tunnel ${i} received`,p6:'SYS',wbs:'KD',disc:'KEY',loc:'T'+i,ifc:`IF-HL-0${i}`,preds:[[`IG-T${i}`,'FS',0]],c0:a0,c1:a0});
        a({code:`RT${i}10`,name:`Track slab & rail – section ${i}`,p6:'SYS',wbs:'SY',disc:'TRK',loc:'T'+i,dur:40,preds:[[`IR-T${i}`,'FS',0],['RS000','FS',0]].concat(i>1?[[`RT${i-1}10`,'FS',0]]:[]),c0:a0,c1:a1});
        a({code:`RT${i}20`,name:`Traction power & cabling – section ${i}`,p6:'SYS',wbs:'SY',disc:'PWR',loc:'T'+i,dur:35,preds:[[`RT${i}10`,'SS',10]],c0:a0,c1:a1});
        a({code:`RT${i}30`,name:`Signalling & train control – section ${i}`,p6:'SYS',wbs:'SY',disc:'SIG',loc:'T'+i,dur:45*(i>=2?g(1.15):1),preds:[[`RT${i}20`,'FS',0],['RS010','FS',0]].concat(i>1&&!(i===3&&on(.6))?[[`RT${i-1}30`,'FS',0]]:[]),c0:a0,c1:a1});
        a({code:`RT${i}40`,name:`Section testing – section ${i}`,p6:'SYS',wbs:'SY',disc:'TNC',loc:'T'+i,dur:15,preds:[[`RT${i}30`,'FS',0]],c0:a0,c1:a1});
      });
      ST.forEach((n,j)=>{ const s=j+1, c=CH[j];
        a({code:`IR-S${s}`,name:`Interface: ${n} systems rooms received`,p6:'SYS',wbs:'KD',disc:'KEY',loc:'ST'+s,ifc:`IF-HL-1${s}`,preds:[[`IG-S${s}`,'FS',0]],c0:c,c1:c});
        a({code:`RS${s}50`,name:`Station systems install – ${n}`,p6:'SYS',wbs:'SS',disc:'SIG',loc:'ST'+s,dur:50,preds:[[`IR-S${s}`,'FS',0],['RS010','FS',0]],c0:c,c1:c});
        a({code:`RS${s}60`,name:`Platform screen doors – ${n}`,p6:'SYS',wbs:'SS',disc:'ARC',loc:'ST'+s,dur:30,preds:[[`RS${s}50`,'SS',20]],c0:c,c1:c});
      });
      a({code:'RS800',name:'Systems integration testing',p6:'SYS',wbs:'IT',disc:'TNC',loc:'RTE',dur:60,preds:[1,2,3].map(i=>[`RT${i}40`,'FS',0]).concat([1,2,3,4].map(s=>[`RS${s}60`,'FS',0])),c0:0,c1:8});
      a({code:'RS850',name:'Trial running',p6:'SYS',wbs:'IT',disc:'TNC',loc:'RTE',dur:45,preds:[['RS800','FS',0]],c0:0,c1:8});
      a({code:'RS900',name:'Harbour Line opening',p6:'SYS',wbs:'KD',disc:'KEY',loc:'RTE',ctr:'OWN',fin:true,preds:[['RS850','FS',0]],c0:0,c1:8});
      return A; }},

  /* ---------- Northfield Data Centre: shell & core + MEP/utility & commissioning ---------- */
  NDC:{code:'NDC',name:'Northfield Data Centre Campus',client:'Cirrus Cloud',desc:'36 MW campus, phase 1: data hall 1',colour:'#9B5DE5',start:Date.UTC(2026,2,2),
    pps:{SC:{name:'Data hall 1 – shell & core',code:'NDC-SC',manager:'P. Moreau',desc:'Earthworks, structure and envelope'},
         ME:{name:'Data hall 1 – MEP & commissioning',code:'NDC-ME',manager:'T. Adeyemi',desc:'Power, cooling, utility connection and IST'}},
    p6:{SC:{pp:'SC',short:'NDC-SC',name:'Northfield DC – Shell & Core',ctr:'GBC'},MEP:{pp:'ME',short:'NDC-MEP',name:'Northfield DC – MEP',ctr:'VMS'},UTL:{pp:'ME',short:'NDC-UTL',name:'Northfield DC – Utility Connection',ctr:'GRD'}},
    disc:[['ERTH','Earthworks'],['STR','Structure'],['ENV','Envelope'],['ELE','Electrical'],['MEC','Mechanical & Cooling'],['UTL','Utility & Grid'],['TNC','Commissioning (IST)'],['KEY','Key Dates']],
    locs:[['HA','Hall A'],['HB','Hall B'],['AD','Admin & security'],['PY','Plant yard'],['SS','Substation']],
    ctr:[['GBC','Granite Build Co'],['VMS','Vector MEP Services'],['GRD','Northfield Grid'],['OWN','Cirrus Cloud']],
    ifc:[['IF-DC-01','Hall A weathertight'],['IF-DC-02','Hall B weathertight'],['IF-DC-03','Permanent power available']],
    wbs:{EW:'Enabling & earthworks',HA:'Hall A',HB:'Hall B',AD:'Admin & security',PY:'Plant yard',UT:'Utility connection',CX:'Commissioning (IST)',KD:'Key dates'},
    build(live,K){ const {A,g,on,off,a}=spKit(live,K); const H=[['A','HA'],['B','HB']];
      a({code:'DC000',name:'Site possession',p6:'SC',wbs:'KD',disc:'KEY',loc:'PY',ctr:'OWN'});
      a({code:'DC010',name:'Bulk earthworks & platform',p6:'SC',wbs:'EW',disc:'ERTH',loc:'PY',dur:40*g(.85),preds:[['DC000','FS',0]]});
      a({code:'DC020',name:'Site drainage & attenuation',p6:'SC',wbs:'EW',disc:'ERTH',loc:'PY',dur:30,preds:[['DC010','SS',15]]});
      H.forEach(([h,L],i)=>{ const p=i?`DC${H[i-1][0]}`:null;
        a({code:`DC${h}10`,name:`Piling – Hall ${h}`,p6:'SC',wbs:L,disc:'STR',loc:L,dur:30,preds:[['DC010','FS',0]].concat(p?[[`${p}10`,'FS',0]]:[])});
        a({code:`DC${h}20`,name:`Ground slab – Hall ${h}`,p6:'SC',wbs:L,disc:'STR',loc:L,dur:30*g(.9),preds:[[`DC${h}10`,'FS',0]].concat(p?[[`${p}20`,'FS',0]]:[])});
        a({code:`DC${h}30`,name:`Steel frame – Hall ${h}`,p6:'SC',wbs:L,disc:'STR',loc:L,dur:45*g(.85),preds:[[`DC${h}20`,'FS',0]].concat(p?[[`${p}30`,'FS',0]]:[])});
        a({code:`DC${h}40`,name:`Roof deck & membrane – Hall ${h}`,p6:'SC',wbs:L,disc:'ENV',loc:L,dur:25,preds:[[`DC${h}30`,'FS',0]]});
        a({code:`DC${h}50`,name:`Wall cladding – Hall ${h}`,p6:'SC',wbs:L,disc:'ENV',loc:L,dur:35,preds:[[`DC${h}30`,'SS',20],[`DC${h}40`,'FF',5]]});
        a({code:`IG-W${h}`,name:`Interface: Hall ${h} weathertight`,p6:'SC',wbs:'KD',disc:'KEY',loc:L,ifc:`IF-DC-0${i+1}`,type:'TT_FinMile',preds:[[`DC${h}40`,'FS',0],[`DC${h}50`,'FS',0]]});
      });
      a({code:'DC610',name:'Admin & security building',p6:'SC',wbs:'AD',disc:'STR',loc:'AD',dur:120,preds:[['DC010','FS',0]]});
      a({code:'DC620',name:'Plant yard slabs & generator plinths',p6:'SC',wbs:'PY',disc:'STR',loc:'PY',dur:35,preds:[['DC020','FS',0]]});
      a({code:'SC900',name:'Shell & core complete',p6:'SC',wbs:'KD',disc:'KEY',loc:'PY',ctr:'OWN',fin:true,preds:[['IG-WB','FS',0],['DC610','FS',0],['DC620','FS',0]]});
      // utility
      a({code:'UT010',name:'Substation civils',p6:'UTL',wbs:'UT',disc:'UTL',loc:'SS',ctr:'GRD',dur:40,preds:[['DC010','FS',0]]});
      a({code:'UT020',name:'Transformer manufacture & delivery',p6:'UTL',wbs:'UT',disc:'UTL',loc:'SS',ctr:'GRD',dur:210*g(1.18),preds:[['DC000','FS',0]]});
      a({code:'UT030',name:'Transformer install & HV cabling',p6:'UTL',wbs:'UT',disc:'UTL',loc:'SS',ctr:'GRD',dur:30,preds:[['UT010','FS',0],['UT020','FS',0]]});
      a({code:'UT040',name:'Grid connection & energisation',p6:'UTL',wbs:'UT',disc:'UTL',loc:'SS',ctr:'GRD',dur:20,preds:[['UT030','FS',0]]});
      a({code:'IG-PWR',name:'Permanent power available',p6:'UTL',wbs:'KD',disc:'KEY',loc:'SS',ctr:'GRD',ifc:'IF-DC-03',type:'TT_FinMile',preds:[['UT040','FS',0]]});
      // MEP
      a({code:'ME000',name:'MEP mobilisation',p6:'MEP',wbs:'KD',disc:'KEY',loc:'PY',ctr:'OWN',es0:120});
      a({code:'ME610',name:'Generators install & fuel system',p6:'MEP',wbs:'PY',disc:'ELE',loc:'PY',dur:40,preds:[['ME000','FS',0],['DC620','FS',0]]});
      H.forEach(([h,L],i)=>{ const p=i?`ME${H[i-1][0]}`:null;
        a({code:`IR-W${h}`,name:`Interface: Hall ${h} weathertight received`,p6:'MEP',wbs:'KD',disc:'KEY',loc:L,ifc:`IF-DC-0${i+1}`,preds:[[`IG-W${h}`,'FS',0]]});
        a({code:`ME${h}10`,name:`Containment & cable tray – Hall ${h}`,p6:'MEP',wbs:L,disc:'ELE',loc:L,dur:30,preds:[[`IR-W${h}`,'FS',0],['ME000','FS',0]].concat(p?[[`${p}10`,'FS',0]]:[])});
        a({code:`ME${h}20`,name:`Switchgear & UPS – Hall ${h}`,p6:'MEP',wbs:L,disc:'ELE',loc:L,dur:45,preds:[[`ME${h}10`,'SS',15]].concat(p?[[`${p}20`,'FS',0]]:[])});
        a({code:`ME${h}30`,name:`Cooling: CRAH units & chilled water – Hall ${h}`,p6:'MEP',wbs:L,disc:'MEC',loc:L,dur:50*(h==='B'?g(1.2):1),preds:[[`ME${h}10`,'SS',10]].concat(p?[[`${p}30`,'FS',0]]:[])});
        a({code:`ME${h}40`,name:`IST level 3: equipment start-up – Hall ${h}`,p6:'MEP',wbs:'CX',disc:'TNC',loc:L,dur:25,preds:[[`ME${h}20`,'FS',0],[`ME${h}30`,'FS',0],['IR-PWR','FS',0],['ME610','FS',0]]});
        a({code:`ME${h}50`,name:`IST level 4: functional testing – Hall ${h}`,p6:'MEP',wbs:'CX',disc:'TNC',loc:L,dur:20,preds:[[`ME${h}40`,'FS',0]]});
      });
      a({code:'IR-PWR',name:'Interface: permanent power received',p6:'MEP',wbs:'KD',disc:'KEY',loc:'SS',ifc:'IF-DC-03',preds:[['IG-PWR','FS',0]]});
      if(on(.6)) a({code:'ME5005',name:'Load bank hire & temporary power for IST',p6:'MEP',wbs:'CX',disc:'TNC',loc:'PY',dur:15,preds:[['ME610','FS',0]]});
      a({code:'ME800',name:'IST level 5: integrated systems test',p6:'MEP',wbs:'CX',disc:'TNC',loc:'PY',dur:20,preds:[['MEA50','FS',0],['MEB50','FS',0]].concat(on(.6)?[['ME5005','FS',0]]:[])});
      a({code:'ME900',name:'Data hall 1 ready for service',p6:'MEP',wbs:'KD',disc:'KEY',loc:'PY',ctr:'OWN',fin:true,preds:[['ME800','FS',0]]});
      return A; }}
};

/* schedule a network: topological forward pass (with progress pins) and backward pass to each project's finish */
function spSchedule(A,cap,pin){
  const by={}; A.forEach(x=>{ by[x.code]=x; x.succ=[]; });
  const indeg=new Map(A.map(x=>[x,0]));
  A.forEach(x=>{ x.preds=x.preds.filter(([c])=>by[c]); x.preds.forEach(([c,t,l])=>{ by[c].succ.push([x,t,l]); indeg.set(x,indeg.get(x)+1); }); });
  const q=A.filter(x=>!indeg.get(x)), ord=[];
  while(q.length){ const x=q.shift(); ord.push(x); x.succ.forEach(([s])=>{ indeg.set(s,indeg.get(s)-1); if(!indeg.get(s)) q.push(s); }); }
  if(ord.length!==A.length) throw new Error('Sample network has a loop');
  ord.forEach(x=>{
    let es=x.es0||0; x.preds.forEach(([c,t,l])=>{ const p=by[c], v=t==='FS'?p.ef+l:t==='SS'?p.es+l:t==='FF'?p.ef+l-x.dur:p.es+l-x.dur; es=Math.max(es,v); });
    if(x.ext) es=Math.max(es,x.ext.day);
    const tr=pin&&pin.truth[x.code];
    if(tr&&tr.ef<=pin.ddn&&(tr.dur>0||tr.es<pin.ddn)){ x.es=tr.es; x.ef=tr.ef; }
    else if(tr&&tr.es<pin.ddn){ x.es=tr.es; x.ef=Math.max(tr.es+x.dur,pin.ddn+1); }
    else { if(pin) es=Math.max(es,pin.ddn); x.es=es; x.ef=es+x.dur; }
  });
  const end={}; A.forEach(x=>{ end[x.pp]=Math.max(end[x.pp]??-1e9,x.ef); });
  ord.slice().reverse().forEach(x=>{
    const e=cap&&cap[x.pp]!=null?cap[x.pp]:end[x.pp]; let lf=e, ff=e-x.ef;
    x.succ.forEach(([s,t,l])=>{ lf=Math.min(lf,t==='FS'?s.ls-l:t==='SS'?s.ls-l+x.dur:t==='FF'?s.lf-l:s.lf-l+x.dur); ff=Math.min(ff,t==='FS'?s.es-l-x.ef:t==='SS'?s.es-l-x.es:t==='FF'?s.ef-l-x.ef:s.ef-l-x.es); });
    x.lf=lf; x.ls=lf-x.dur; x.tf=lf-x.ef; x.ff=Math.max(0,ff);
  });
  return {by,end};
}
const SP_CACHE=new Map();
function spNetwork(key,live,K){
  const D=SP_DEFS[key], A=D.build(live,K);
  A.forEach(x=>{ x.pp=D.p6[x.p6].pp; x.ctr=x.ctr||D.p6[x.p6].ctr; if(x.ext) x.ext.day=x.ext.base+(live?Math.round(x.ext.slip*K):0); });
  return A;
}
// Files (baseline + live) for one project of a sample programme at one data date.
function spFiles(key,ppKey,opt){
  const D=SP_DEFS[key], B0=D.start, DDT=opt.ddt, ddn=Math.round((DDT-B0)/DAY), K=opt.k??1;
  let base=SP_CACHE.get(key+':base'); if(!base){ const A=spNetwork(key,false,0); base={A,...spSchedule(A,null,null)}; SP_CACHE.set(key+':base',base); }
  const cap=base.end;
  let truth=SP_CACHE.get(key+':truth'); if(!truth){ const A=spNetwork(key,true,1); truth={A,...spSchedule(A,cap,null)}; SP_CACHE.set(key+':truth',truth); }
  const LA=spNetwork(key,true,K), live={A:LA,...spSchedule(LA,cap,{ddn,truth:truth.by})};
  const tbl=(name,fields,rows)=>`%T\t${name}\n%F\t${fields.join('\t')}\n`+rows.map(r=>'%R\t'+fields.map(f=>r[f]??'').join('\t')).join('\n')+(rows.length?'\n':'');
  const ifcIds=new Set(); [base.A,LA].forEach(L=>L.forEach(x=>{ if(x.ifc) ifcIds.add(x.ifc); }));
  const types=[[801,'Discipline',D.disc],[802,'Location',D.locs],[803,'Contractor',D.ctr],[804,'Interface ID',D.ifc.filter(([c])=>ifcIds.has(c))]];
  const codeId=(ti,short)=>{ const i=types[ti][2].findIndex(x=>x[0]===short); return i<0?null:types[ti][0]*100+i+1; };
  const p6keys=Object.keys(D.p6).filter(k=>D.p6[k].pp===ppKey), out=[];
  for(const role of ['B','L']){
    const L=role==='L', net=L?live:base, A=net.A.filter(x=>x.pp===ppKey), by=net.by;
    p6keys.forEach((pk,pi)=>{
      const P=D.p6[pk], pid=(L?40000:80000)+Object.keys(D.p6).indexOf(pk)*10+1, root=pid*10, tidOf=x=>(L?400000:800000)+Object.keys(D.p6).indexOf(x.p6)*1000+net.A.indexOf(x);
      const mine=A.filter(x=>x.p6===pk), wk=[...new Set(mine.map(x=>x.wbs))];
      const wbs=[{wbs_id:root,proj_id:pid,seq_num:0,proj_node_flag:'Y',wbs_short_name:P.short,wbs_name:P.name,parent_wbs_id:''}].concat(wk.map((w,i)=>({wbs_id:root+1+i,proj_id:pid,seq_num:(i+1)*10,proj_node_flag:'N',wbs_short_name:w,wbs_name:D.wbs[w]||w,parent_wbs_id:root})));
      const tasks=[], preds=[], tav=[], udf=[], tr=[]; let tpid=(L?500000:900000)+pi*5000;
      mine.forEach(x=>{
        const sD=B0+x.es*DAY+8*HR, fD=x.dur?B0+(x.ef-1)*DAY+17*HR:sD, ext=x.preds.filter(([c])=>by[c].pp!==ppKey);
        const t={task_id:tidOf(x),proj_id:pid,wbs_id:root+1+wk.indexOf(x.wbs),clndr_id:1,phys_complete_pct:0,task_code:x.code,task_name:x.name,task_type:x.type,status_code:'TK_NotStart',
          total_float_hr_cnt:x.tf*8,free_float_hr_cnt:x.ff*8,target_drtn_hr_cnt:x.dur*8,remain_drtn_hr_cnt:x.dur*8,act_start_date:'',act_end_date:'',early_start_date:fx(sD),early_end_date:fx(fD),
          late_start_date:fx(B0+x.ls*DAY+8*HR),late_end_date:fx(x.dur?B0+(x.lf-1)*DAY+17*HR:B0+x.ls*DAY+8*HR),target_start_date:fx(sD),target_end_date:fx(fD),driving_path_flag:x.tf<=0?'Y':'N',
          duration_type:'DT_FixedDUR2',complete_pct_type:'CP_Phys',priority_type:'PT_Normal',cstr_type:'',cstr_date:''};
        if(x.fin){ t.cstr_type='CS_MEOB'; t.cstr_date=fx(B0+cap[ppKey]*DAY+8*HR); }
        else if(ext.length){ const d=Math.max(...ext.map(([c,ty,l])=>{ const p=by[c]; return ty==='SS'?p.es+l:p.ef+l; })); t.cstr_type='CS_MSOA'; t.cstr_date=fx(B0+d*DAY+8*HR); }
        else if(x.ext){ t.cstr_type='CS_MSOA'; t.cstr_date=fx(B0+x.ext.day*DAY+8*HR); }
        if(L){
          if(x.ef<=ddn&&(x.dur>0||x.es<ddn)) Object.assign(t,{status_code:'TK_Complete',phys_complete_pct:100,act_start_date:fx(sD),act_end_date:fx(fD),early_start_date:'',early_end_date:'',late_start_date:'',late_end_date:'',remain_drtn_hr_cnt:0,total_float_hr_cnt:'',free_float_hr_cnt:''});
          else if(x.es<ddn) Object.assign(t,{status_code:'TK_Active',phys_complete_pct:Math.min(99,Math.round((ddn-x.es)/Math.max(1,x.ef-x.es)*100)),act_start_date:fx(sD),early_start_date:fx(DDT+8*HR),late_start_date:'',remain_drtn_hr_cnt:(x.ef-ddn)*8});
        }
        tasks.push(t);
        x.preds.forEach(([c,ty,l])=>{ const q=by[c]; if(q.pp!==ppKey) return; preds.push({task_pred_id:tpid++,task_id:tidOf(x),pred_task_id:tidOf(q),proj_id:pid,pred_proj_id:(L?40000:80000)+Object.keys(D.p6).indexOf(q.p6)*10+1,pred_type:'PR_'+ty,lag_hr_cnt:l*8}); });
        if(x.dur>0) tr.push({taskrsrc_id:tidOf(x)+9000000,task_id:tidOf(x),proj_id:pid,rsrc_id:600+D.ctr.findIndex(c=>c[0]===x.ctr),target_qty:x.dur*8*4});
        [[0,x.disc],[1,x.loc],[2,x.ctr],[3,x.ifc]].forEach(([ti,v])=>{ const id=v&&codeId(ti,v); if(id) tav.push({task_id:tidOf(x),actv_code_type_id:types[ti][0],actv_code_id:id,proj_id:pid}); });
        if(D.chain&&x.c0!=null){ udf.push({udf_type_id:901,fk_id:tidOf(x),proj_id:pid,udf_number:(+x.c0).toFixed(2)}); udf.push({udf_type_id:902,fk_id:tidOf(x),proj_id:pid,udf_number:(+(x.c1??x.c0)).toFixed(2)}); }
      });
      const dl=new Date(DDT), dstr=fx(L?DDT:B0);
      let txt=`ERMHDR\t21.12\t${dstr.slice(0,10)}\tProject\tADMIN\tsample\tdbxDatabaseNoName\tProject Management\tUSD\n`;
      txt+=tbl('CALENDAR',['clndr_id','default_flag','clndr_name','day_hr_cnt','week_hr_cnt'],[{clndr_id:1,default_flag:'Y',clndr_name:'7 Day x 8h',day_hr_cnt:8,week_hr_cnt:56}]);
      txt+=tbl('PROJECT',['proj_id','proj_short_name','last_recalc_date','plan_start_date','next_data_date'],[{proj_id:pid,proj_short_name:P.short,last_recalc_date:dstr,plan_start_date:fx(B0),next_data_date:dstr}]);
      txt+=tbl('PROJWBS',['wbs_id','proj_id','seq_num','proj_node_flag','wbs_short_name','wbs_name','parent_wbs_id'],wbs);
      txt+=tbl('ACTVTYPE',['actv_code_type_id','actv_code_type','seq_num','actv_short_len','proj_id','actv_code_type_scope'],types.map(([id,n],i)=>({actv_code_type_id:id,actv_code_type:n,seq_num:i+1,actv_short_len:8,proj_id:'',actv_code_type_scope:'AS_Global'})));
      txt+=tbl('ACTVCODE',['actv_code_id','parent_actv_code_id','actv_code_type_id','actv_code_name','short_name','seq_num','color'],types.flatMap(([id,,vals])=>vals.map(([s,n],j)=>({actv_code_id:id*100+j+1,parent_actv_code_id:'',actv_code_type_id:id,actv_code_name:n,short_name:s,seq_num:j+1,color:''}))));
      if(D.chain) txt+=tbl('UDFTYPE',['udf_type_id','table_name','udf_type_name','udf_type_label','logical_data_type'],[{udf_type_id:901,table_name:'TASK',udf_type_name:'user_field_901',udf_type_label:'Chainage Start (km)',logical_data_type:'FT_FLOAT_2_DECIMALS'},{udf_type_id:902,table_name:'TASK',udf_type_name:'user_field_902',udf_type_label:'Chainage End (km)',logical_data_type:'FT_FLOAT_2_DECIMALS'}]);
      txt+=tbl('TASK',['task_id','proj_id','wbs_id','clndr_id','phys_complete_pct','complete_pct_type','task_code','task_name','task_type','duration_type','status_code','priority_type','total_float_hr_cnt','free_float_hr_cnt','target_drtn_hr_cnt','remain_drtn_hr_cnt','act_start_date','act_end_date','early_start_date','early_end_date','late_start_date','late_end_date','target_start_date','target_end_date','driving_path_flag','cstr_type','cstr_date'],tasks);
      txt+=tbl('TASKPRED',['task_pred_id','task_id','pred_task_id','proj_id','pred_proj_id','pred_type','lag_hr_cnt'],preds);
      txt+=tbl('TASKRSRC',['taskrsrc_id','task_id','proj_id','rsrc_id','target_qty'],tr);
      txt+=tbl('TASKACTV',['task_id','actv_code_type_id','actv_code_id','proj_id'],tav);
      if(udf.length) txt+=tbl('UDFVALUE',['udf_type_id','fk_id','proj_id','udf_date','udf_number','udf_text'],udf);
      txt+='%E\n';
      const T=spEnrich(parseXER(txt),Object.fromEntries(D.ctr.map((c,i)=>[600+i,c]))), name=L?`${P.short}_UP${opt.up||'09'}_${dl.getUTCDate()}${MON[dl.getUTCMonth()]}${String(dl.getUTCFullYear()).slice(2)}.xer`:`${P.short}_Baseline_BL01.xer`;
      out.push({id:uid(),name,role:L?'live':'baseline',tables:T,info:fileInfo(T)});
    });
  }
  return out;
}

/* ---- put the sample programmes into the portfolio (adds what's missing, fills empty slots, never duplicates) ---- */
const SP_ORDER=['NXR','WSQ','HLM','NDC'];
function spMissing(){
  if(typeof PER==='undefined'||!PER.mode) return 0; let n=0;
  SP_ORDER.forEach(k=>{ const D=SP_DEFS[k], g=PER.programmes.find(x=>x.code===D.code);
    Object.values(D.pps).forEach(pp=>{ const p=g&&PER.projects.find(x=>x.programmeId===g.id&&x.name===pp.name); if(!p||!p.summary) n++; }); });
  return n;
}
async function spPopulate(known){
  known=known||{}; const plan=[];
  for(const k of SP_ORDER){ const D=SP_DEFS[k]; let g=PER.programmes.find(x=>x.code===D.code);
    const gid=known[k]||(g?g.id:null)||await PER.store.createProgramme({name:D.name,code:D.code,client:D.client,description:D.desc,colour:D.colour});
    for(const [ppKey,pp] of Object.entries(D.pps)){
      const p=PER.projects.find(x=>x.programmeId===gid&&x.name===pp.name);
      if(p&&p.summary) continue;
      let pid=p?p.id:await PER.store.createProject(pp.name,{programmeId:gid,code:pp.code,status:'active',manager:pp.manager,description:pp.desc});
      if(p) await PER.store.updateProject(pid,{status:'active',code:p.code||pp.code,manager:p.manager||pp.manager,description:p.description||pp.desc});
      plan.push({k,ppKey,pid,label:`${D.name} · ${pp.name}`});
    }
  }
  let i=0;
  for(const it of plan){ i++; perPick(it.pid);
    for(const [y,m,d,kk,up] of SP_DDS){ const dt=Date.UTC(y,m,d);
      perBusy(`Building ${it.label} — update ${up} (${i} of ${plan.length})…`);
      const files=spFiles(it.k,it.ppKey,{ddt:dt,k:kk,up});
      await perSavePeriod(it.pid,files,{label:`Update ${up} · ${fmtL(dt)}`,notes:'Generated sample period'});
      await new Promise(r=>setTimeout(r,40)); } }
  return plan.length;
}
async function portSampleMore(){
  perToast('Adding sample programmes. Keep this tab open until it finishes.');
  await perRun('Adding sample programmes…',async()=>{ const n=await spPopulate(); perToast(n?`Added ${n} project${n===1?'':'s'} with six monthly updates each.`:'The sample programmes are already complete.'); });
}

/* ---- hosted mode: stand-ins for the Claude page capabilities (AI through your Supabase function, normal downloads) ---- */
function makeHostedSample(C){
  const fnUrl=C.supabaseUrl.replace(/\/$/,'')+'/functions/v1/'+(C.aiFunction||'ai-proxy');
  const blobB64=async b=>b64(new Uint8Array(await b.arrayBuffer()));
  async function call(body,signal,onDelta){
    const sb=PER.sb, sess=sb&&(await sb.auth.getSession()).data.session; if(!sess||PER.mode!=='supa') throw {code:'session_expired',message:'Sign in to use AI.'};
    let r; try{ r=await fetch(fnUrl,{method:'POST',signal,headers:{'content-type':'application/json',Authorization:'Bearer '+sess.access_token,apikey:C.supabaseAnonKey},body:JSON.stringify(body)}); }
    catch(e){ if(e&&e.name==='AbortError') throw {code:'cancelled'}; throw {code:'upstream_error',message:String(e)}; }
    if(!r.ok){ let j=null; try{ j=await r.json(); }catch(_){} const er=(j&&j.error)||{}; throw {code:er.code||(r.status===401?'session_expired':r.status===429?'rate_limited':r.status===404?'sampling_disabled':'upstream_error'),message:er.message||('HTTP '+r.status)}; }
    const rd=r.body.getReader(), dec=new TextDecoder(); let buf='', blocks=[], stop=null;
    try{ for(;;){ const {done,value}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true}); let i;
        while((i=buf.indexOf('\n\n'))>=0){ const raw=buf.slice(0,i); buf=buf.slice(i+2); const line=raw.split('\n').find(l=>l.startsWith('data:')); if(!line) continue; let ev; try{ ev=JSON.parse(line.slice(5)); }catch(_){ continue; }
          if(ev.type==='content_block_start'){ const b={...ev.content_block}; if(b.type==='tool_use') b._json=''; if(b.type==='text') b.text=b.text||''; blocks[ev.index]=b; }
          else if(ev.type==='content_block_delta'){ const b=blocks[ev.index]; if(!b) continue; if(ev.delta.type==='text_delta'){ b.text+=ev.delta.text; onDelta(ev.delta.text); } else if(ev.delta.type==='input_json_delta') b._json+=ev.delta.partial_json; }
          else if(ev.type==='message_delta'){ if(ev.delta&&ev.delta.stop_reason) stop=ev.delta.stop_reason; }
          else if(ev.type==='error'){ const t=(ev.error&&ev.error.type)||''; throw {code:/overloaded|rate/i.test(t)?'rate_limited':'upstream_error',message:ev.error&&ev.error.message}; } } } }
    catch(e){ if(e&&e.name==='AbortError') throw {code:'cancelled'}; throw e; }
    const content=blocks.filter(Boolean).map(b=>{ if(b.type==='tool_use'){ let input={}; try{ input=b._json?JSON.parse(b._json):(b.input||{}); }catch(_){} return {type:'tool_use',id:b.id,name:b.name,input}; } return b.type==='text'?{type:'text',text:b.text}:null; }).filter(Boolean);
    return {content,stop};
  }
  async function run(input,opts,jsonMode){
    opts=opts||{}; const tools=opts.tools||[], msgs=[];
    (typeof input==='string'?[{role:'user',content:input}]:input).forEach(x=>{ const l=msgs[msgs.length-1]; if(l&&l.role===x.role) l.content+='\n\n'+x.content; else msgs.push({role:x.role,content:String(x.content)}); });
    if(msgs[0]&&msgs[0].role!=='user') msgs.unshift({role:'user',content:'Continue.'});
    const last=msgs[msgs.length-1];
    if(opts.images&&opts.images.length){ const imgs=[]; for(const b of opts.images.slice(0,20)) imgs.push({type:'image',source:{type:'base64',media_type:b.type||'image/png',data:await blobB64(b)}}); last.content=[...imgs,{type:'text',text:last.content}]; }
    let text='', truncated=false; const emit=d=>{ text+=d; if(opts.onText) try{ opts.onText({text,delta:d}); }catch(_){} };
    const apiTools=tools.map(t=>({name:t.name,description:t.description||'',input_schema:t.inputSchema||{type:'object',properties:{}}}));
    for(let turn=0;turn<16;turn++){
      if(opts.signal&&opts.signal.aborted) throw {code:'cancelled',text};
      let res; try{ res=await call({tier:opts.modelTier||'default',max_tokens:jsonMode?32000:8000,system:jsonMode?'Reply with valid JSON only: no prose before or after it and no code fences.':undefined,messages:msgs,tools:apiTools.length?apiTools:undefined},opts.signal,emit); }
      catch(e){ throw {...e,text}; }
      if(res.stop==='max_tokens') truncated=true;
      const uses=res.content.filter(b=>b.type==='tool_use'); if(res.stop!=='tool_use'||!uses.length) break;
      msgs.push({role:'assistant',content:res.content}); const results=[];
      for(const u of uses){ const t=tools.find(x=>x.name===u.name); let out, bad=false; try{ out=t?await t.execute(u.input,{signal:opts.signal}):{error:'Unknown tool '+u.name}; }catch(e){ out={error:String((e&&e.message)||e)}; bad=true; }
        results.push(Object.assign({type:'tool_result',tool_use_id:u.id,content:typeof out==='string'?out:JSON.stringify(out===undefined?null:out)},bad?{is_error:true}:{})); }
      msgs.push({role:'user',content:results}); if(text&&!/\n\n$/.test(text)) emit('\n\n');
    }
    return {text:text.trim(),truncated};
  }
  const sample=(input,opts)=>run(input,opts,false);
  sample.json=async(input,opts)=>{ const r=await run(input,opts,true); const t=r.text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
    try{ return JSON.parse(t); }catch(_){ for(const [o,c] of [['{','}'],['[',']']]){ const a=t.indexOf(o), b=t.lastIndexOf(c); if(a>=0&&b>a){ try{ return JSON.parse(t.slice(a,b+1)); }catch(_){} } } throw {code:'invalid_json',message:'The answer was not valid JSON.',text:r.text}; } };
  sample.limits=async()=>({tools:true,images:{maxCount:20}});
  return sample;
}
