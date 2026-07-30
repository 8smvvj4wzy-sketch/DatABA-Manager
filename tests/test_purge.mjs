let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

const base={
  personnes:[{initials:'L.M.'},{initials:'T.B.'}],
  sources:['tabA','tabB'],
  _idVersInitiales:{tabA:{a1:'L.M.',a2:'T.B.'},tabB:{b1:'L.M.'}},
  _ateliers:{tabA:{at1:'Repas'},tabB:{at2:'Habiletés'}},
  seances:[
    {id:'s1',date:'2026-05-10',source:'tabA',studentIds:['a1','a2'],selectedObjectives:{a1:['o1'],a2:['o2']},data:{a1:{},a2:{}}},
    {id:'s2',date:'2026-07-10',source:'tabA',studentIds:['a1'],selectedObjectives:{a1:['o1']},data:{a1:{}}},
    {id:'s3',date:'2026-07-20',source:'tabB',studentIds:['b1'],selectedObjectives:{b1:['o3']},data:{b1:{}}},
  ],
  crises:[
    {id:'c1',date:'2026-05-11',source:'tabA',studentId:'a1'},
    {id:'c2',date:'2026-07-11',source:'tabA',studentId:'a2'},
  ],
  alias:{personnes:{'L.M.':'Lucas M.'},objectifs:{'L.M.|o1':'Couleurs'}},
  commentaires:{'L.M.|o1':'à revoir'},
};

/* Purge par date */
function purgerAvant(d,iso){const lim=new Date(iso);
  return {...d, seances:d.seances.filter(x=>new Date(x.date)>=lim), crises:d.crises.filter(x=>new Date(x.date)>=lim)};}
const r1=purgerAvant(base,'2026-07-01T00:00:00');
t('séances anciennes retirées', r1.seances.map(s=>s.id), ['s2','s3']);
t('crises anciennes retirées', r1.crises.map(c=>c.id), ['c2']);
t('les personnes ne sont pas touchées', r1.personnes.length, 2);

/* Purge d une source */
function purgerSource(d,src){
  const idv={...d._idVersInitiales};delete idv[src];
  const ate={...d._ateliers};delete ate[src];
  const encore=new Set();Object.values(idv).forEach(tb=>Object.values(tb).forEach(i=>encore.add(i)));
  return {...d, seances:d.seances.filter(x=>x.source!==src), crises:d.crises.filter(x=>x.source!==src),
    sources:d.sources.filter(x=>x!==src), _idVersInitiales:idv, _ateliers:ate,
    personnes:d.personnes.filter(p=>encore.has(p.initials))};
}
const r2=purgerSource(base,'tabA');
t('séances de la source retirées', r2.seances.map(s=>s.id), ['s3']);
t('source retirée de la liste', r2.sources, ['tabB']);
t('T.B. disparaît, plus présente ailleurs', r2.personnes.map(p=>p.initials), ['L.M.']);
t('L.M. reste, encore présente sur tabB', r2.personnes.length, 1);
t('table d ateliers nettoyée', Object.keys(r2._ateliers), ['tabB']);

/* Purge d une personne : ses cotations partent des séances partagées */
function purgerPersonne(d,ini){
  const idDe=src=>Object.keys(d._idVersInitiales[src]||{}).find(k=>d._idVersInitiales[src][k]===ini);
  const seances=d.seances.map(se=>{
    const sid=idDe(se.source);
    if(!sid||!(se.studentIds||[]).includes(sid))return se;
    const studentIds=se.studentIds.filter(x=>x!==sid);
    const sel={...se.selectedObjectives};delete sel[sid];
    const data={...se.data};delete data[sid];
    return {...se,studentIds,selectedObjectives:sel,data};
  }).filter(se=>(se.studentIds||[]).length>0);
  const crises=d.crises.filter(c=>(d._idVersInitiales[c.source]||{})[c.studentId]!==ini);
  const alias={personnes:{...d.alias.personnes},
    objectifs:Object.fromEntries(Object.entries(d.alias.objectifs).filter(([k])=>k.split('|')[0]!==ini))};
  delete alias.personnes[ini];
  const commentaires=Object.fromEntries(Object.entries(d.commentaires).filter(([k])=>k.split('|')[0]!==ini));
  const idv={};Object.entries(d._idVersInitiales).forEach(([src,tb])=>{
    idv[src]=Object.fromEntries(Object.entries(tb).filter(([,i])=>i!==ini));});
  return {...d,seances,crises,alias,commentaires,_idVersInitiales:idv,
    personnes:d.personnes.filter(p=>p.initials!==ini)};
}
const r3=purgerPersonne(base,'L.M.');
t('personne retirée', r3.personnes.map(p=>p.initials), ['T.B.']);
t('POINT CLÉ : la séance partagée survit sans elle', r3.seances.find(s=>s.id==='s1').studentIds, ['a2']);
t('ses cotations sont retirées de la séance partagée', Object.keys(r3.seances.find(s=>s.id==='s1').data), ['a2']);
t('les séances où elle était seule disparaissent', r3.seances.map(s=>s.id), ['s1']);
t('ses crises partent', r3.crises.map(c=>c.id), ['c2']);
t('ses libellés partent', r3.alias.personnes, {});
t('ses commentaires partent', r3.commentaires, {});
t("l'autre personne garde ses données", r3.seances.find(s=>s.id==='s1').selectedObjectives.a2, ['o2']);

/* Jours de la semaine dans l ordre du calendrier */
const JOURS=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
t('sept jours', JOURS.length, 7);
t('la semaine commence le lundi', JOURS[0], 'lundi');

/* Pourcentage sur le total des enregistrements retenus */
const val=(n,tot,unite)=>unite==='pct'?Math.round(n/(tot||1)*100):n;
t('en nombre', val(3,12,'nombre'), 3);
t('en pourcentage', val(3,12,'pct'), 25);
t('aucun enregistrement : pas de division par zéro', val(0,0,'pct'), 0);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
